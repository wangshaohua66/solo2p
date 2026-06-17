<?php

namespace App\Jobs;

use App\Models\ReportStat;
use App\Models\Ticket;
use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AggregateDailyStats implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 2;
    public $timeout = 900;

    public function __construct(
        public ?string $dateStr = null,
        public ?int $targetTenantId = null
    ) {}

    public function handle(): void
    {
        try {
            $start = microtime(true);
            $date = $this->dateStr ? new \DateTime($this->dateStr) : new \DateTime('yesterday');
            $dateStr = $date->format('Y-m-d');

            $tenantsQuery = Tenant::withoutGlobalScopes()->where('is_active', true);
            if ($this->targetTenantId) {
                $tenantsQuery->where('id', $this->targetTenantId);
            }

            $tenants = $tenantsQuery->get(['id', 'name']);
            $tenantsProcessed = 0;
            $totalStatsInserted = 0;

            foreach ($tenants as $tenant) {
                $tenantId = $tenant->id;
                app()->instance('currentTenantId', $tenantId);

                $dayStart = $dateStr . ' 00:00:00';
                $dayEnd = $dateStr . ' 23:59:59';

                $createdCount = Ticket::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('created_at', [$dayStart, $dayEnd])
                    ->count();

                if ($createdCount === 0) {
                    $tenantsProcessed++;
                    continue;
                }

                $baseQuery = Ticket::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('created_at', [$dayStart, $dayEnd]);

                $resolvedCount = Ticket::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('resolved_at', [$dayStart, $dayEnd])
                    ->count();

                $closedCount = Ticket::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('closed_at', [$dayStart, $dayEnd])
                    ->count();

                $priorityDist = (clone $baseQuery)
                    ->select('priority', DB::raw('COUNT(*) as count'))
                    ->groupBy('priority')
                    ->pluck('count', 'priority')
                    ->toArray();

                $statusDist = (clone $baseQuery)
                    ->select('status', DB::raw('COUNT(*) as count'))
                    ->groupBy('status')
                    ->pluck('count', 'status')
                    ->toArray();

                $assigneeDist = Ticket::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('assigned_at', [$dayStart, $dayEnd])
                    ->select('assignee_id', DB::raw('COUNT(*) as count'))
                    ->groupBy('assignee_id')
                    ->whereNotNull('assignee_id')
                    ->pluck('count', 'assignee_id')
                    ->toArray();

                $resolvedTickets = Ticket::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('resolved_at', [$dayStart, $dayEnd])
                    ->get(['created_at', 'resolved_at', 'first_response_at', 'assignee_id']);

                $avgResolutionMinutes = 0;
                $avgFirstResponseMinutes = 0;
                $assigneeResolution = [];

                if ($resolvedTickets->count() > 0) {
                    $totalResolution = 0;
                    $totalFirstResponse = 0;
                    $frCount = 0;

                    foreach ($resolvedTickets as $t) {
                        $resMin = $t->created_at && $t->resolved_at
                            ? $t->created_at->diffInMinutes($t->resolved_at) : 0;
                        $totalResolution += $resMin;

                        if ($t->created_at && $t->first_response_at) {
                            $totalFirstResponse += $t->created_at->diffInMinutes($t->first_response_at);
                            $frCount++;
                        }

                        if ($t->assignee_id) {
                            if (!isset($assigneeResolution[$t->assignee_id])) {
                                $assigneeResolution[$t->assignee_id] = ['sum' => 0, 'count' => 0];
                            }
                            $assigneeResolution[$t->assignee_id]['sum'] += $resMin;
                            $assigneeResolution[$t->assignee_id]['count']++;
                        }
                    }

                    $avgResolutionMinutes = (int)round($totalResolution / $resolvedTickets->count());
                    $avgFirstResponseMinutes = $frCount > 0 ? (int)round($totalFirstResponse / $frCount) : 0;
                }

                $assigneeStats = [];
                foreach ($assigneeResolution as $aid => $data) {
                    if ($data['count'] > 0) {
                        $assigneeStats[$aid] = (int)round($data['sum'] / $data['count']);
                    }
                }

                $ratedTickets = Ticket::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('rated_at', [$dayStart, $dayEnd])
                    ->whereNotNull('satisfaction_rating');

                $csatCount = $ratedTickets->count();
                $csatAvg = $csatCount > 0 ? round($ratedTickets->avg('satisfaction_rating'), 2) : 0;

                $categoryDist = (clone $baseQuery)
                    ->select('category_id', DB::raw('COUNT(*) as count'))
                    ->groupBy('category_id')
                    ->whereNotNull('category_id')
                    ->pluck('count', 'category_id')
                    ->toArray();

                $sourceDist = (clone $baseQuery)
                    ->select('source', DB::raw('COUNT(*) as count'))
                    ->groupBy('source')
                    ->whereNotNull('source')
                    ->pluck('count', 'source')
                    ->toArray();

                $hourDist = [];
                for ($h = 0; $h < 24; $h++) {
                    $hourStart = sprintf('%s %02d:00:00', $dateStr, $h);
                    $hourEnd = sprintf('%s %02d:59:59', $dateStr, $h);
                    $hc = Ticket::withoutGlobalScopes()
                        ->where('tenant_id', $tenantId)
                        ->whereBetween('created_at', [$hourStart, $hourEnd])
                        ->count();
                    if ($hc > 0) {
                        $hourDist[(string)$h] = $hc;
                    }
                }

                $rawMetrics = [
                    'tickets_created' => $createdCount,
                    'tickets_resolved' => $resolvedCount,
                    'tickets_closed' => $closedCount,
                    'avg_resolution_minutes' => $avgResolutionMinutes,
                    'avg_first_response_minutes' => $avgFirstResponseMinutes,
                    'csat_count' => $csatCount,
                    'csat_average' => $csatAvg,
                    'priority_distribution' => $priorityDist,
                    'status_distribution' => $statusDist,
                    'assignee_distribution' => $assigneeDist,
                    'assignee_resolution_avg' => $assigneeStats,
                    'category_distribution' => $categoryDist,
                    'source_distribution' => $sourceDist,
                    'hour_distribution' => $hourDist,
                ];

                ReportStat::withoutGlobalScopes()->updateOrCreate(
                    [
                        'tenant_id' => $tenantId,
                        'stat_date' => $dateStr,
                        'dimension' => 'overview',
                        'entity_id' => null,
                    ],
                    [
                        'metric_name' => 'daily_overview',
                        'metric_value' => $createdCount,
                        'raw_metrics' => $rawMetrics,
                    ]
                );

                $totalStatsInserted++;
                $tenantsProcessed++;

                if ($tenantsProcessed % 50 === 0) {
                    Log::info('[Aggregate Daily] Progress', [
                        'date' => $dateStr,
                        'tenants_processed' => $tenantsProcessed,
                        'tenants_total' => $tenants->count(),
                    ]);
                }
            }

            $executionMs = (int)((microtime(true) - $start) * 1000);

            Log::info('[Aggregate Daily] Completed', [
                'date' => $dateStr,
                'tenants_processed' => $tenantsProcessed,
                'stats_created' => $totalStatsInserted,
                'duration_ms' => $executionMs,
            ]);
        } catch (\Throwable $e) {
            Log::error('[Aggregate Daily] Fatal error: ' . $e->getMessage(), [
                'date' => $this->dateStr,
                'tenant_id' => $this->targetTenantId,
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }
}
