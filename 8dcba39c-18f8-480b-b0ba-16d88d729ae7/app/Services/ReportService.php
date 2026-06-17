<?php

namespace App\Services;

use App\Models\ReportStat;
use App\Models\Ticket;
use App\Models\SLAViolation;
use App\Models\SLAMetric;
use App\Models\User;
use App\Models\BillingRecord;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class ReportService
{
    protected $cacheTtl;

    public function __construct()
    {
        $this->cacheTtl = config('cache.ttl.stats_overview', 300);
    }

    public function getTenantOverview(int $tenantId, string $startDate, string $endDate): array
    {
        $cacheKey = "report:overview:{$tenantId}:{$startDate}:{$endDate}";
        return Cache::remember($cacheKey, $this->cacheTtl, function () use ($tenantId, $startDate, $endDate) {
            $stats = ReportStat::where('tenant_id', $tenantId)
                ->whereBetween('stat_date', [$startDate, $endDate])
                ->get();

            $totals = $this->aggregateStatsTotals($stats);

            return [
                'period' => ['start' => $startDate, 'end' => $endDate],
                'summary' => [
                    'tickets_created' => $totals['tickets_created'],
                    'tickets_resolved' => $totals['tickets_resolved'],
                    'tickets_closed' => $totals['tickets_closed'],
                    'tickets_reopened' => $totals['tickets_reopened'],
                    'tickets_escalated' => $totals['tickets_escalated'],
                    'avg_first_response_minutes' => $this->calcAvg($totals['total_first_response_minutes'], $totals['tickets_first_responded']),
                    'avg_resolution_minutes' => $this->calcAvg($totals['total_resolution_minutes'], $totals['tickets_resolved']),
                    'satisfaction_score' => $this->calcAvg($totals['satisfaction_total'], $totals['satisfaction_count']),
                    'satisfaction_rate' => $totals['satisfaction_count'] > 0
                        ? round($totals['satisfaction_positive'] / $totals['satisfaction_count'] * 100, 2)
                        : null,
                    'sla_violations' => $totals['sla_violations'],
                    'sla_compliance_rate' => $this->calcSlaCompliance($totals['tickets_resolved'], $totals['sla_violations']),
                    'escalation_rate' => $this->calcPercent($totals['tickets_escalated'], $totals['tickets_created']),
                    'reopen_rate' => $this->calcPercent($totals['tickets_reopened'], $totals['tickets_created']),
                ],
                'open_tickets' => [
                    'total' => Ticket::forTenant($tenantId)->open()->count(),
                    'by_priority' => $this->getOpenByPriority($tenantId),
                    'by_assignee' => $this->getOpenByAssignee($tenantId),
                    'by_group' => $this->getOpenByGroup($tenantId),
                    'overdue_count' => Ticket::forTenant($tenantId)->overdue()->count(),
                ],
                'trend' => $this->buildTrendData($stats),
            ];
        });
    }

    protected function aggregateStatsTotals($stats): array
    {
        $fields = [
            'tickets_created', 'tickets_resolved', 'tickets_closed',
            'tickets_reopened', 'tickets_escalated', 'tickets_first_responded',
            'total_first_response_minutes', 'total_resolution_minutes',
            'satisfaction_count', 'satisfaction_total', 'satisfaction_positive',
            'sla_violations', 'sla_violations_mild', 'sla_violations_severe',
            'sla_violations_critical',
        ];
        $totals = array_fill_keys($fields, 0);
        foreach ($stats as $stat) {
            foreach ($fields as $f) {
                $totals[$f] += (int) ($stat->{$f} ?? 0);
            }
        }
        return $totals;
    }

    protected function calcAvg(?int $total, int $count): ?float
    {
        if ($count <= 0) {
            return null;
        }
        return round($total / $count, 2);
    }

    protected function calcPercent(int $part, int $total): ?float
    {
        if ($total <= 0) {
            return null;
        }
        return round($part / $total * 100, 2);
    }

    protected function calcSlaCompliance(int $resolved, int $violations): ?float
    {
        if ($resolved <= 0) {
            return null;
        }
        return round(max(0, $resolved - $violations) / $resolved * 100, 2);
    }

    protected function getOpenByPriority(int $tenantId): array
    {
        return Ticket::forTenant($tenantId)->open()
            ->selectRaw('priority, COUNT(*) as count')
            ->groupBy('priority')
            ->pluck('count', 'priority')
            ->toArray();
    }

    protected function getOpenByAssignee(int $tenantId): array
    {
        return Ticket::forTenant($tenantId)->open()
            ->whereNotNull('assignee_id')
            ->with('assignee:id,name')
            ->selectRaw('assignee_id, COUNT(*) as count')
            ->groupBy('assignee_id')
            ->orderByDesc('count')
            ->limit(20)
            ->get()
            ->map(fn ($t) => ['user_id' => $t->assignee_id, 'name' => $t->assignee?->name, 'count' => $t->count])
            ->toArray();
    }

    protected function getOpenByGroup(int $tenantId): array
    {
        return Ticket::forTenant($tenantId)->open()
            ->whereNotNull('group_id')
            ->with('group:id,name')
            ->selectRaw('group_id, COUNT(*) as count')
            ->groupBy('group_id')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($t) => ['group_id' => $t->group_id, 'name' => $t->group?->name, 'count' => $t->count])
            ->toArray();
    }

    protected function buildTrendData($stats): array
    {
        $daily = $stats->map(function ($s) {
            return [
                'date' => $s->stat_date,
                'created' => (int) $s->tickets_created,
                'resolved' => (int) $s->tickets_resolved,
                'closed' => (int) $s->tickets_closed,
                'violations' => (int) $s->sla_violations,
                'avg_first_response_minutes' => $s->calculateAverages()['avg_first_response'],
                'avg_resolution_minutes' => $s->calculateAverages()['avg_resolution'],
                'satisfaction_score' => $s->calculateAverages()['satisfaction_score'],
            ];
        })->toArray();

        return [
            'daily' => array_values($daily),
            'peak_hour' => $this->calcPeakHour($stats),
            'busiest_day' => $this->calcBusiestDay($stats),
        ];
    }

    protected function calcPeakHour($stats): ?array
    {
        if ($stats->isEmpty()) {
            return null;
        }
        $hours = [];
        foreach ($stats as $s) {
            $h = $s->hourly_breakdown ?? [];
            foreach ($h as $hour => $count) {
                $hours[$hour] = ($hours[$hour] ?? 0) + (int) $count;
            }
        }
        if (empty($hours)) {
            return null;
        }
        arsort($hours);
        $peakHour = (int) array_key_first($hours);
        return [
            'hour' => $peakHour,
            'hour_label' => sprintf('%02d:00-%02d:00', $peakHour, $peakHour + 1),
            'count' => reset($hours),
        ];
    }

    protected function calcBusiestDay($stats): ?array
    {
        if ($stats->isEmpty()) {
            return null;
        }
        $max = $stats->sortByDesc('tickets_created')->first();
        return $max ? [
            'date' => $max->stat_date,
            'tickets_created' => (int) $max->tickets_created,
        ] : null;
    }

    public function getAgentPerformance(int $tenantId, string $startDate, string $endDate, ?int $groupId = null): array
    {
        $cacheKey = "report:agent_perf:{$tenantId}:{$startDate}:{$endDate}:{$groupId}";
        return Cache::remember($cacheKey, $this->cacheTtl, function () use ($tenantId, $startDate, $endDate, $groupId) {
            $query = User::forTenant($tenantId)
                ->whereIn('type', [User::TYPE_OWNER, User::TYPE_AGENT])
                ->where('status', User::STATUS_ACTIVE);

            if ($groupId) {
                $query->whereHas('groups', fn ($q) => $q->where('id', $groupId));
            }

            $agents = $query->withCount([
                'assignedTickets as tickets_created_count' => fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]),
                'assignedTickets as tickets_resolved_count' => fn ($q) => $q->whereBetween('resolved_at', [$startDate, $endDate]),
            ])->get();

            $ticketStats = ReportStat::where('tenant_id', $tenantId)
                ->whereBetween('stat_date', [$startDate, $endDate])
                ->get();

            $result = $agents->map(function (User $agent) use ($ticketStats, $startDate, $endDate) {
                $byAgent = $ticketStats->filter(fn ($s) => !empty($s->by_assignee[$agent->id] ?? null));
                $assignedCreated = $agent->tickets_created_count ?? 0;
                $assignedResolved = $agent->tickets_resolved_count ?? 0;
                $avgFirst = 0;
                $avgRes = 0;
                $violations = 0;
                $satisfaction = null;
                $totalSat = 0;
                $countSat = 0;

                foreach ($byAgent as $stat) {
                    $agentStat = $stat->by_assignee[$agent->id] ?? [];
                    $avgFirst += $agentStat['total_first_response_minutes'] ?? 0;
                    $avgRes += $agentStat['total_resolution_minutes'] ?? 0;
                    $violations += $agentStat['sla_violations'] ?? 0;
                    $totalSat += $agentStat['satisfaction_total'] ?? 0;
                    $countSat += $agentStat['satisfaction_count'] ?? 0;
                }

                return [
                    'user_id' => $agent->id,
                    'name' => $agent->name,
                    'email' => $agent->email,
                    'avatar' => $agent->avatar,
                    'tickets_assigned' => $assignedCreated,
                    'tickets_resolved' => $assignedResolved,
                    'resolution_rate' => $this->calcPercent($assignedResolved, $assignedCreated),
                    'avg_first_response_minutes' => $this->calcAvg($avgFirst, $assignedResolved),
                    'avg_resolution_minutes' => $this->calcAvg($avgRes, $assignedResolved),
                    'sla_violations' => $violations,
                    'sla_compliance_rate' => $this->calcSlaCompliance($assignedResolved, $violations),
                    'satisfaction_score' => $this->calcAvg($totalSat, $countSat),
                    'efficiency_score' => $this->calcEfficiencyScore($assignedResolved, $avgFirst, $avgRes, $violations),
                ];
            })->sortByDesc('efficiency_score')->values()->toArray();

            $summary = [
                'agents_count' => count($result),
                'avg_tickets_per_agent' => $this->calcAvg(collect($result)->sum('tickets_assigned'), count($result)),
                'overall_sla_compliance' => $this->calcAvg(collect($result)->avg('sla_compliance_rate'), 1),
                'overall_satisfaction' => $this->calcAvg(collect($result)->avg('satisfaction_score'), 1),
            ];

            return [
                'period' => ['start' => $startDate, 'end' => $endDate],
                'summary' => $summary,
                'agents' => $result,
            ];
        });
    }

    protected function calcEfficiencyScore(int $resolved, int $avgFirst, int $avgRes, int $violations): float
    {
        $score = 100;
        $score -= min(20, $avgFirst / 60);
        $score -= min(30, $avgRes / 1440);
        $score -= $violations * 5;
        $score += min(20, $resolved * 0.5);
        return max(0, round($score, 2));
    }

    public function getSlaPerformance(int $tenantId, string $startDate, string $endDate): array
    {
        $cacheKey = "report:sla_perf:{$tenantId}:{$startDate}:{$endDate}";
        return Cache::remember($cacheKey, $this->cacheTtl, function () use ($tenantId, $startDate, $endDate) {
            $metrics = SLAMetric::where('tenant_id', $tenantId)
                ->whereBetween('metric_date', [$startDate, $endDate])
                ->get();

            $violations = SLAViolation::where('tenant_id', $tenantId)
                ->whereBetween('breached_at', [$startDate, $endDate])
                ->get();

            $firstResponse = $metrics->where('metric_type', 'first_response');
            $resolution = $metrics->where('metric_type', 'resolution');

            return [
                'period' => ['start' => $startDate, 'end' => $endDate],
                'summary' => [
                    'first_response_measured' => $firstResponse->sum('total_count'),
                    'first_response_on_time' => $firstResponse->sum('on_time_count'),
                    'first_response_avg_minutes' => $this->calcAvg($firstResponse->sum('total_minutes'), $firstResponse->sum('total_count')),
                    'first_response_breach_rate' => $this->calcPercent($firstResponse->sum('breach_count'), $firstResponse->sum('total_count')),
                    'resolution_measured' => $resolution->sum('total_count'),
                    'resolution_on_time' => $resolution->sum('on_time_count'),
                    'resolution_avg_minutes' => $this->calcAvg($resolution->sum('total_minutes'), $resolution->sum('total_count')),
                    'resolution_breach_rate' => $this->calcPercent($resolution->sum('breach_count'), $resolution->sum('total_count')),
                    'violations_total' => $violations->count(),
                    'violations_mild' => $violations->where('level', SLAViolation::LEVEL_MILD)->count(),
                    'violations_severe' => $violations->where('level', SLAViolation::LEVEL_SEVERE)->count(),
                    'violations_critical' => $violations->where('level', SLAViolation::LEVEL_CRITICAL)->count(),
                    'violations_acknowledged' => $violations->where('acknowledged', true)->count(),
                    'overall_compliance_rate' => $this->calcSlaCompliance(
                        $firstResponse->sum('total_count') + $resolution->sum('total_count'),
                        $violations->count()
                    ),
                ],
                'by_priority' => $this->getSlaByPriority($violations),
                'by_policy' => $this->getSlaByPolicy($metrics),
                'top_offending_tickets' => $this->getTopOffendingTickets($tenantId, $startDate, $endDate),
                'trend' => $metrics->groupBy('metric_date')->map(fn ($group, $date) => [
                    'date' => $date,
                    'first_response_compliance' => $this->calcPercent($group->where('metric_type', 'first_response')->sum('on_time_count'), $group->where('metric_type', 'first_response')->sum('total_count')),
                    'resolution_compliance' => $this->calcPercent($group->where('metric_type', 'resolution')->sum('on_time_count'), $group->where('metric_type', 'resolution')->sum('total_count')),
                    'violations_count' => $violations->whereBetween('breached_at', [$date . ' 00:00:00', $date . ' 23:59:59'])->count(),
                ])->values()->toArray(),
            ];
        });
    }

    protected function getSlaByPriority($violations): array
    {
        $byPriority = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
        foreach ($violations as $v) {
            $p = $v->ticket?->priority ?? 3;
            $byPriority[$p] = ($byPriority[$p] ?? 0) + 1;
        }
        $result = [];
        foreach ($byPriority as $p => $c) {
            $result[] = [
                'priority' => $p,
                'priority_name' => Ticket::getPriorityName($p),
                'violations' => $c,
            ];
        }
        return $result;
    }

    protected function getSlaByPolicy($metrics): array
    {
        return $metrics->groupBy('policy_id')->map(function ($group, $policyId) {
            return [
                'policy_id' => (int) $policyId,
                'policy_name' => $group->first()->policy?->name,
                'total_count' => $group->sum('total_count'),
                'on_time_count' => $group->sum('on_time_count'),
                'breach_count' => $group->sum('breach_count'),
                'compliance_rate' => $this->calcPercent($group->sum('on_time_count'), $group->sum('total_count')),
                'avg_minutes' => $this->calcAvg($group->sum('total_minutes'), $group->sum('total_count')),
            ];
        })->values()->toArray();
    }

    protected function getTopOffendingTickets(int $tenantId, string $startDate, string $endDate, int $limit = 10): array
    {
        return SLAViolation::where('tenant_id', $tenantId)
            ->whereBetween('breached_at', [$startDate, $endDate])
            ->with('ticket:id,uuid,ticket_number,subject')
            ->selectRaw('ticket_id, COUNT(*) as violation_count, MAX(level) as max_level')
            ->groupBy('ticket_id')
            ->orderByDesc('violation_count')
            ->orderByDesc('max_level')
            ->limit($limit)
            ->get()
            ->map(fn ($v) => [
                'ticket_id' => $v->ticket_id,
                'ticket_number' => $v->ticket?->ticket_number,
                'subject' => $v->ticket?->subject,
                'uuid' => $v->ticket?->uuid,
                'violation_count' => (int) $v->violation_count,
                'max_level' => (int) $v->max_level,
            ])->toArray();
    }

    public function getCustomerSatisfaction(int $tenantId, string $startDate, string $endDate): array
    {
        $cacheKey = "report:csat:{$tenantId}:{$startDate}:{$endDate}";
        return Cache::remember($cacheKey, $this->cacheTtl, function () use ($tenantId, $startDate, $endDate) {
            $tickets = Ticket::forTenant($tenantId)
                ->whereNotNull('satisfaction_score')
                ->whereBetween('rated_at', [$startDate, $endDate])
                ->get();

            $total = $tickets->count();
            $scoreSum = $tickets->sum('satisfaction_score');
            $positive = $tickets->where('satisfaction_score', '>=', 4)->count();
            $neutral = $tickets->where('satisfaction_score', 3)->count();
            $negative = $tickets->where('satisfaction_score', '<=', 2)->count();
            $comments = $tickets->whereNotNull('satisfaction_comment')->pluck('satisfaction_comment', 'id')->take(100);

            $distribution = [];
            for ($i = 1; $i <= 5; $i++) {
                $c = $tickets->where('satisfaction_score', $i)->count();
                $distribution[] = [
                    'score' => $i,
                    'count' => $c,
                    'percent' => $this->calcPercent($c, $total),
                ];
            }

            return [
                'period' => ['start' => $startDate, 'end' => $endDate],
                'summary' => [
                    'total_responses' => $total,
                    'response_rate' => null,
                    'average_score' => $this->calcAvg($scoreSum, $total),
                    'csat_percent' => $this->calcPercent($positive, $total),
                    'positive_count' => $positive,
                    'neutral_count' => $neutral,
                    'negative_count' => $negative,
                ],
                'distribution' => $distribution,
                'trend' => $tickets->groupBy(fn ($t) => optional($t->rated_at)->format('Y-m-d'))
                    ->map(fn ($group, $date) => [
                        'date' => $date,
                        'count' => $group->count(),
                        'average_score' => $this->calcAvg($group->sum('satisfaction_score'), $group->count()),
                        'positive_count' => $group->where('satisfaction_score', '>=', 4)->count(),
                    ])->values()->toArray(),
                'by_assignee' => $tickets->groupBy('assignee_id')
                    ->filter(fn ($g) => $g->count() >= 5)
                    ->map(fn ($group, $userId) => [
                        'user_id' => (int) $userId,
                        'name' => $group->first()->assignee?->name,
                        'response_count' => $group->count(),
                        'average_score' => $this->calcAvg($group->sum('satisfaction_score'), $group->count()),
                    ])->sortByDesc('average_score')->values()->take(20)->toArray(),
                'recent_comments' => $comments->map(fn ($c, $ticketId) => [
                    'ticket_id' => (int) $ticketId,
                    'comment' => $c,
                ])->values()->toArray(),
            ];
        });
    }

    public function getCategoryDistribution(int $tenantId, string $startDate, string $endDate): array
    {
        $tickets = Ticket::forTenant($tenantId)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->with('category:id,name,slug')
            ->selectRaw('category_id, COUNT(*) as count, SUM(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) as resolved_count')
            ->groupBy('category_id')
            ->orderByDesc('count')
            ->get();

        $total = $tickets->sum('count');
        return $tickets->map(fn ($t) => [
            'category_id' => $t->category_id,
            'category_name' => $t->category?->name ?? '未分类',
            'category_slug' => $t->category?->slug,
            'count' => (int) $t->count,
            'resolved_count' => (int) $t->resolved_count,
            'percent' => $this->calcPercent($t->count, $total),
            'resolution_rate' => $this->calcPercent($t->resolved_count, $t->count),
        ])->toArray();
    }

    public function getSourceDistribution(int $tenantId, string $startDate, string $endDate): array
    {
        $tickets = Ticket::forTenant($tenantId)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('source, COUNT(*) as count')
            ->groupBy('source')
            ->orderByDesc('count')
            ->get();

        $total = $tickets->sum('count');
        return $tickets->map(fn ($t) => [
            'source' => (int) $t->source,
            'source_name' => Ticket::getSourceName((int) $t->source),
            'count' => (int) $t->count,
            'percent' => $this->calcPercent($t->count, $total),
        ])->toArray();
    }

    public function forecastTrend(int $tenantId, int $days = 7): array
    {
        $cacheKey = "report:forecast:{$tenantId}:{$days}";
        return Cache::remember($cacheKey, 3600, function () use ($tenantId, $days) {
            $histDays = max(14, $days * 4);
            $start = now()->subDays($histDays)->format('Y-m-d');
            $end = now()->format('Y-m-d');

            $stats = ReportStat::where('tenant_id', $tenantId)
                ->whereBetween('stat_date', [$start, $end])
                ->orderBy('stat_date')
                ->get(['stat_date', 'tickets_created', 'tickets_resolved']);

            if ($stats->count() < 3) {
                return ['available' => false, 'message' => '历史数据不足，无法预测'];
            }

            $created = $stats->pluck('tickets_created')->toArray();
            $resolved = $stats->pluck('tickets_resolved')->toArray();

            $forecast = [];
            $baseDay = now();

            for ($i = 1; $i <= $days; $i++) {
                $dayIdx = count($created) + $i;
                $forecastDate = (clone $baseDay)->addDays($i)->format('Y-m-d');
                $dow = (int) (clone $baseDay)->addDays($i)->format('w');

                $sameDow = [];
                foreach ($stats as $idx => $s) {
                    if ((int) date('w', strtotime($s->stat_date)) === $dow) {
                        $sameDow[] = (int) $s->tickets_created;
                    }
                }

                $historicAvg = !empty($sameDow) ? array_sum($sameDow) / count($sameDow) : array_sum($created) / count($created);

                $trend = $this->linearTrend($created);
                $trendComponent = $trend * $dayIdx;

                $forecastCreated = (int) round(max(0, $historicAvg + $trendComponent * 0.3));
                $forecastResolved = (int) round($forecastCreated * 0.92);

                $forecast[] = [
                    'date' => $forecastDate,
                    'day_of_week' => $dow,
                    'day_name' => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][$dow],
                    'forecast_created' => $forecastCreated,
                    'forecast_resolved' => $forecastResolved,
                    'backlog_delta' => $forecastCreated - $forecastResolved,
                    'confidence' => $this->calcConfidence($sameDow),
                ];
            }

            $totalCreated = array_sum(array_column($forecast, 'forecast_created'));
            $totalResolved = array_sum(array_column($forecast, 'forecast_resolved'));

            return [
                'available' => true,
                'period' => ['days' => $days],
                'summary' => [
                    'total_forecast_created' => $totalCreated,
                    'total_forecast_resolved' => $totalResolved,
                    'projected_backlog_change' => $totalCreated - $totalResolved,
                    'current_open_count' => Ticket::forTenant($tenantId)->open()->count(),
                    'avg_daily_created' => (int) round($totalCreated / $days),
                ],
                'daily' => $forecast,
                'recommendations' => $this->generateForecastRecommendations($forecast),
            ];
        });
    }

    protected function linearTrend(array $data): float
    {
        $n = count($data);
        if ($n < 2) {
            return 0;
        }
        $xSum = $ySum = $xySum = $x2Sum = 0;
        for ($i = 0; $i < $n; $i++) {
            $x = $i + 1;
            $y = (int) $data[$i];
            $xSum += $x;
            $ySum += $y;
            $xySum += $x * $y;
            $x2Sum += $x * $x;
        }
        $denominator = ($n * $x2Sum - $xSum * $xSum);
        if ($denominator === 0) {
            return 0;
        }
        return ($n * $xySum - $xSum * $ySum) / $denominator;
    }

    protected function calcConfidence(array $sameDow): float
    {
        if (count($sameDow) < 2) {
            return 50;
        }
        $avg = array_sum($sameDow) / count($sameDow);
        $variance = 0;
        foreach ($sameDow as $v) {
            $variance += pow($v - $avg, 2);
        }
        $stddev = sqrt($variance / count($sameDow));
        $cv = $avg > 0 ? $stddev / $avg : 1;
        $confidence = max(0, min(100, 100 - $cv * 100));
        return round($confidence, 1);
    }

    protected function generateForecastRecommendations(array $forecast): array
    {
        $recommendations = [];
        $peakDay = collect($forecast)->sortByDesc('forecast_created')->first();
        $backlogGrowth = array_sum(array_column($forecast, 'backlog_delta'));

        if ($peakDay && $peakDay['forecast_created'] > 50) {
            $recommendations[] = [
                'severity' => 'warning',
                'message' => "{$peakDay['day_name']}（{$peakDay['date']}）预计工单量较高（{$peakDay['forecast_created']}张），建议增派客服。",
            ];
        }
        if ($backlogGrowth > 20) {
            $recommendations[] = [
                'severity' => 'danger',
                'message' => "预测期内待处理工单预计增加{$backlogGrowth}张，建议调配处理资源或加强自动化分流。",
            ];
        }
        if ($backlogGrowth < -50) {
            $recommendations[] = [
                'severity' => 'success',
                'message' => "预测积压将减少" . abs($backlogGrowth) . "张，可考虑分配人员进行工单质检和知识库整理。",
            ];
        }

        return $recommendations;
    }

    public function getBillingReport(int $tenantId, string $startDate, string $endDate): array
    {
        $records = BillingRecord::where('tenant_id', $tenantId)
            ->whereBetween('period_start', [$startDate, $endDate])
            ->orderBy('period_start', 'desc')
            ->get();

        $summary = [
            'total_amount' => $records->sum('total_amount'),
            'paid_amount' => $records->sum('paid_amount'),
            'outstanding_amount' => $records->sum('outstanding_amount'),
            'invoice_count' => $records->count(),
            'paid_count' => $records->where('status', BillingRecord::STATUS_PAID)->count(),
            'overdue_count' => $records->where('status', BillingRecord::STATUS_OVERDUE)->count(),
        ];

        return [
            'period' => ['start' => $startDate, 'end' => $endDate],
            'summary' => $summary,
            'records' => $records->map(fn ($r) => [
                'id' => $r->id,
                'invoice_number' => $r->invoice_number,
                'period_start' => $r->period_start,
                'period_end' => $r->period_end,
                'plan' => $r->billing_plan,
                'total_amount' => (float) $r->total_amount,
                'paid_amount' => (float) $r->paid_amount,
                'outstanding_amount' => (float) $r->outstanding_amount,
                'status' => $r->status,
                'usage' => $r->usage_summary,
            ])->toArray(),
        ];
    }

    public function aggregateDailyStats(int $tenantId, string $date): ReportStat
    {
        return DB::transaction(function () use ($tenantId, $date) {
            $start = "{$date} 00:00:00";
            $end = "{$date} 23:59:59";

            $ticketsCreated = Ticket::forTenant($tenantId)->whereBetween('created_at', [$start, $end])->count();
            $ticketsResolved = Ticket::forTenant($tenantId)->whereBetween('resolved_at', [$start, $end])->count();
            $ticketsClosed = Ticket::forTenant($tenantId)->whereBetween('closed_at', [$start, $end])->count();
            $ticketsFirstResponded = Ticket::forTenant($tenantId)->whereBetween('first_response_at', [$start, $end])->count();
            $ticketsReopened = Ticket::forTenant($tenantId)->whereBetween('updated_at', [$start, $end])
                ->where('reopen_count', '>', 0)->count();

            $resolvedTickets = Ticket::forTenant($tenantId)
                ->whereBetween('resolved_at', [$start, $end])
                ->select('id', 'created_at', 'resolved_at', 'first_response_at', 'assignee_id', 'group_id', 'priority', 'satisfaction_score')
                ->get();

            $totalFirstMinutes = 0;
            $totalResolutionMinutes = 0;
            $satisfactionTotal = 0;
            $satisfactionCount = 0;
            $satisfactionPositive = 0;
            $byAssignee = [];
            $hourly = array_fill(0, 24, 0);

            foreach ($resolvedTickets as $t) {
                $fr = $t->first_response_at?->getTimestamp();
                $cr = $t->created_at->getTimestamp();
                $re = $t->resolved_at->getTimestamp();
                if ($fr && $cr) {
                    $totalFirstMinutes += (int) ceil(($fr - $cr) / 60);
                }
                if ($re && $cr) {
                    $totalResolutionMinutes += (int) ceil(($re - $cr) / 60);
                }
                if ($t->satisfaction_score) {
                    $satisfactionCount++;
                    $satisfactionTotal += (int) $t->satisfaction_score;
                    if ($t->satisfaction_score >= 4) {
                        $satisfactionPositive++;
                    }
                }
                if ($t->assignee_id) {
                    $key = (string) $t->assignee_id;
                    if (!isset($byAssignee[$key])) {
                        $byAssignee[$key] = [
                            'tickets_resolved' => 0,
                            'total_first_response_minutes' => 0,
                            'total_resolution_minutes' => 0,
                            'sla_violations' => 0,
                            'satisfaction_total' => 0,
                            'satisfaction_count' => 0,
                        ];
                    }
                    $byAssignee[$key]['tickets_resolved']++;
                    if ($fr && $cr) {
                        $byAssignee[$key]['total_first_response_minutes'] += (int) ceil(($fr - $cr) / 60);
                    }
                    if ($re && $cr) {
                        $byAssignee[$key]['total_resolution_minutes'] += (int) ceil(($re - $cr) / 60);
                    }
                    if ($t->satisfaction_score) {
                        $byAssignee[$key]['satisfaction_count']++;
                        $byAssignee[$key]['satisfaction_total'] += (int) $t->satisfaction_score;
                    }
                }
            }

            $allCreated = Ticket::forTenant($tenantId)->whereBetween('created_at', [$start, $end])->get();
            foreach ($allCreated as $t) {
                $h = (int) $t->created_at->format('G');
                $hourly[$h] = ($hourly[$h] ?? 0) + 1;
            }

            $violations = SLAViolation::where('tenant_id', $tenantId)
                ->whereBetween('breached_at', [$start, $end])
                ->get();

            $slaViolations = $violations->count();
            $mild = $violations->where('level', SLAViolation::LEVEL_MILD)->count();
            $severe = $violations->where('level', SLAViolation::LEVEL_SEVERE)->count();
            $critical = $violations->where('level', SLAViolation::LEVEL_CRITICAL)->count();

            foreach ($violations as $v) {
                $aid = (string) ($v->ticket?->assignee_id ?? '0');
                if (isset($byAssignee[$aid])) {
                    $byAssignee[$aid]['sla_violations']++;
                }
            }

            $ticketsEscalated = Ticket::forTenant($tenantId)
                ->whereBetween('updated_at', [$start, $end])
                ->where('escalation_count', '>', 0)
                ->count();

            return ReportStat::updateOrCreate(
                ['tenant_id' => $tenantId, 'stat_date' => $date],
                [
                    'tickets_created' => $ticketsCreated,
                    'tickets_resolved' => $ticketsResolved,
                    'tickets_closed' => $ticketsClosed,
                    'tickets_reopened' => $ticketsReopened,
                    'tickets_first_responded' => $ticketsFirstResponded,
                    'tickets_escalated' => $ticketsEscalated,
                    'total_first_response_minutes' => $totalFirstMinutes,
                    'total_resolution_minutes' => $totalResolutionMinutes,
                    'satisfaction_count' => $satisfactionCount,
                    'satisfaction_total' => $satisfactionTotal,
                    'satisfaction_positive' => $satisfactionPositive,
                    'sla_violations' => $slaViolations,
                    'sla_violations_mild' => $mild,
                    'sla_violations_severe' => $severe,
                    'sla_violations_critical' => $critical,
                    'hourly_breakdown' => $hourly,
                    'by_assignee' => $byAssignee,
                    'by_category' => $this->aggregateByCategory($tenantId, $start, $end),
                    'by_group' => $this->aggregateByGroup($tenantId, $start, $end),
                    'by_source' => $this->aggregateBySource($tenantId, $start, $end),
                    'by_priority' => $this->aggregateByPriority($tenantId, $start, $end),
                ]
            );
        });
    }

    protected function aggregateByField(int $tenantId, string $field, string $start, string $end): array
    {
        $items = Ticket::forTenant($tenantId)
            ->whereBetween('created_at', [$start, $end])
            ->whereNotNull($field)
            ->selectRaw("{$field} as item_id, COUNT(*) as total")
            ->groupBy($field)
            ->get();
        $result = [];
        foreach ($items as $i) {
            $result[(int) $i->item_id] = ['total' => (int) $i->total];
        }
        return $result;
    }

    protected function aggregateByCategory(int $tenantId, string $start, string $end): array
    {
        return $this->aggregateByField($tenantId, 'category_id', $start, $end);
    }

    protected function aggregateByGroup(int $tenantId, string $start, string $end): array
    {
        return $this->aggregateByField($tenantId, 'group_id', $start, $end);
    }

    protected function aggregateBySource(int $tenantId, string $start, string $end): array
    {
        return Ticket::forTenant($tenantId)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('source as item_id, COUNT(*) as total')
            ->groupBy('source')
            ->get()
            ->mapWithKeys(fn ($i) => [(int) $i->item_id => ['total' => (int) $i->total]])
            ->toArray();
    }

    protected function aggregateByPriority(int $tenantId, string $start, string $end): array
    {
        return Ticket::forTenant($tenantId)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('priority as item_id, COUNT(*) as total')
            ->groupBy('priority')
            ->get()
            ->mapWithKeys(fn ($i) => [(int) $i->item_id => ['total' => (int) $i->total]])
            ->toArray();
    }
}
