<?php

namespace App\Services;

use App\Models\SLAPolicy;
use App\Models\SLATimer;
use App\Models\SLAViolation;
use App\Models\SLAMetric;
use App\Models\Ticket;
use App\Models\WorkflowState;
use App\Models\BusinessHour;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SlaMonitor
{
    protected $conditionEvaluator;

    public function __construct(ConditionEvaluator $conditionEvaluator)
    {
        $this->conditionEvaluator = $conditionEvaluator;
    }

    public function createDefaultPolicy(int $tenantId): SLAPolicy
    {
        return DB::transaction(function () use ($tenantId) {
            $this->createDefaultBusinessHours($tenantId);

            $priorityMap = [
                5 => ['name' => '紧急工单SLA', 'first_response_minutes' => 15, 'resolution_minutes' => 240, 'warning_percent' => 50],
                4 => ['name' => '高优先级SLA', 'first_response_minutes' => 60, 'resolution_minutes' => 480, 'warning_percent' => 50],
                3 => ['name' => '中优先级SLA', 'first_response_minutes' => 240, 'resolution_minutes' => 1440, 'warning_percent' => 60],
                2 => ['name' => '低优先级SLA', 'first_response_minutes' => 480, 'resolution_minutes' => 2880, 'warning_percent' => 70],
                1 => ['name' => '最低优先级SLA', 'first_response_minutes' => 1440, 'resolution_minutes' => 10080, 'warning_percent' => 70],
            ];

            $lastPolicy = null;
            foreach ($priorityMap as $priority => $config) {
                $lastPolicy = SLAPolicy::create([
                    'tenant_id' => $tenantId,
                    'name' => $config['name'],
                    'description' => "优先级 {$priority} - {$config['name']}",
                    'priority' => $priority,
                    'conditions' => [
                        'logical' => 'and',
                        'rules' => [
                            ['field' => 'priority', 'operator' => 'equals', 'value' => $priority],
                        ],
                    ],
                    'first_response_minutes' => $config['first_response_minutes'],
                    'resolution_minutes' => $config['resolution_minutes'],
                    'warning_percent' => $config['warning_percent'],
                    'pause_on_pending' => true,
                    'use_business_hours' => true,
                    'escalation_levels' => $this->getDefaultEscalations($config),
                    'is_default' => $priority === 3,
                    'status' => 1,
                ]);
            }

            return $lastPolicy;
        });
    }

    protected function createDefaultBusinessHours(int $tenantId): void
    {
        $hourDefs = [
            1 => ['day' => 1, 'start' => '09:00:00', 'end' => '18:00:00', 'name' => '周一'],
            2 => ['day' => 2, 'start' => '09:00:00', 'end' => '18:00:00', 'name' => '周二'],
            3 => ['day' => 3, 'start' => '09:00:00', 'end' => '18:00:00', 'name' => '周三'],
            4 => ['day' => 4, 'start' => '09:00:00', 'end' => '18:00:00', 'name' => '周四'],
            5 => ['day' => 5, 'start' => '09:00:00', 'end' => '18:00:00', 'name' => '周五'],
            6 => ['day' => 6, 'start' => null, 'end' => null, 'name' => '周六'],
            0 => ['day' => 0, 'start' => null, 'end' => null, 'name' => '周日'],
        ];

        foreach ($hourDefs as $def) {
            BusinessHour::create([
                'tenant_id' => $tenantId,
                'day_of_week' => $def['day'],
                'name' => $def['name'],
                'start_time' => $def['start'],
                'end_time' => $def['end'],
                'is_workday' => !empty($def['start']) && !empty($def['end']),
            ]);
        }
    }

    protected function getDefaultEscalations(array $config): array
    {
        $warningMinutes = (int) ($config['first_response_minutes'] * 0.6);
        $breachMinutes = $config['first_response_minutes'];

        return [
            [
                'level' => 1,
                'name' => '首次响应警告',
                'trigger_at_percent' => $config['warning_percent'],
                'action' => 'notify_agent',
                'channels' => ['email', 'in_app'],
                'message' => '工单即将超过首次响应时间，请尽快处理！',
            ],
            [
                'level' => 2,
                'name' => '首次响应超时',
                'trigger_at_percent' => 100,
                'action' => 'notify_agent_and_supervisor',
                'channels' => ['email', 'sms', 'in_app'],
                'message' => '工单已超过首次响应时间！',
            ],
            [
                'level' => 3,
                'name' => '解决超时升级',
                'trigger_at_percent' => 100,
                'action' => 'escalate_to_group',
                'channels' => ['email', 'sms', 'in_app', 'webhook'],
                'message' => '工单已超过解决时间，自动升级至主管组！',
                'target_group' => 'supervisors',
            ],
        ];
    }

    public function startTimersForTicket(Ticket $ticket): array
    {
        $policy = SLAPolicy::findBestMatch($ticket);
        if (!$policy) {
            return [];
        }

        $createdAt = $ticket->created_at ?? now();
        $timers = [];

        if ($policy->first_response_minutes && !$ticket->first_response_at) {
            $target = $this->calculateTargetTime($createdAt, $policy->first_response_minutes, $policy->use_business_hours, $ticket->tenant_id);
            $warningAt = $this->calculateWarningTarget($createdAt, $target, $policy->warning_percent ?? 50);

            $timers[] = SLATimer::create([
                'tenant_id' => $ticket->tenant_id,
                'ticket_id' => $ticket->id,
                'policy_id' => $policy->id,
                'timer_type' => SLATimer::TYPE_FIRST_RESPONSE,
                'started_at' => $createdAt,
                'target_at' => $target,
                'warning_at' => $warningAt,
                'paused_total_seconds' => 0,
                'status' => SLATimer::STATUS_RUNNING,
            ]);
        }

        if ($policy->resolution_minutes) {
            $target = $this->calculateTargetTime($createdAt, $policy->resolution_minutes, $policy->use_business_hours, $ticket->tenant_id);
            $warningAt = $this->calculateWarningTarget($createdAt, $target, $policy->warning_percent ?? 50);

            $timers[] = SLATimer::create([
                'tenant_id' => $ticket->tenant_id,
                'ticket_id' => $ticket->id,
                'policy_id' => $policy->id,
                'timer_type' => SLATimer::TYPE_RESOLUTION,
                'started_at' => $createdAt,
                'target_at' => $target,
                'warning_at' => $warningAt,
                'paused_total_seconds' => 0,
                'status' => SLATimer::STATUS_RUNNING,
            ]);
        }

        $ticket->sla_policy_id = $policy->id;
        $ticket->save();

        foreach ($timers as $timer) {
            $this->scheduleTimerChecks($timer);
        }

        return $timers;
    }

    public function calculateTargetTime(\DateTimeInterface $start, int $minutes, bool $useBusinessHours, int $tenantId): \DateTimeInterface
    {
        if (!$useBusinessHours) {
            return (clone $start)->modify("+{$minutes} minutes");
        }
        return $this->calculateBusinessTimeForward($start, $minutes, $tenantId);
    }

    protected function calculateBusinessTimeForward(\DateTimeInterface $start, int $minutes, int $tenantId): \DateTimeInterface
    {
        $hours = BusinessHour::where('tenant_id', $tenantId)->get()->keyBy('day_of_week');
        $current = clone $start;
        $remaining = $minutes * 60;

        while ($remaining > 0) {
            $dow = (int) $current->format('w');
            $businessHour = $hours[$dow] ?? null;

            if (!$businessHour || !$businessHour->is_workday) {
                $current->modify('+1 day');
                $current->setTime(0, 0, 0);
                continue;
            }

            $workStart = clone $current;
            [$h, $m, $s] = explode(':', $businessHour->start_time);
            $workStart->setTime((int) $h, (int) $m, (int) $s);

            $workEnd = clone $current;
            [$h, $m, $s] = explode(':', $businessHour->end_time);
            $workEnd->setTime((int) $h, (int) $m, (int) $s);

            $effectiveStart = $current > $workStart ? $current : $workStart;

            if ($effectiveStart >= $workEnd) {
                $current->modify('+1 day');
                $current->setTime(0, 0, 0);
                continue;
            }

            $availableSeconds = $workEnd->getTimestamp() - $effectiveStart->getTimestamp();

            if ($remaining <= $availableSeconds) {
                $current = (clone $effectiveStart)->modify("+{$remaining} seconds");
                $remaining = 0;
            } else {
                $remaining -= $availableSeconds;
                $current = clone $workEnd;
            }

            if ($remaining > 0) {
                $current->modify('+1 day');
                $current->setTime(0, 0, 0);
            }
        }

        return $current;
    }

    protected function calculateWarningTarget(\DateTimeInterface $start, \DateTimeInterface $target, int $percent): \DateTimeInterface
    {
        $totalSeconds = $target->getTimestamp() - $start->getTimestamp();
        $warningSeconds = (int) ($totalSeconds * $percent / 100);
        return (clone $start)->modify("+{$warningSeconds} seconds");
    }

    protected function scheduleTimerChecks(SLATimer $timer): void
    {
        $now = now();

        if ($timer->warning_at && $timer->warning_at > $now) {
            $warningDelay = $timer->warning_at->diffInSeconds($now, false);
            if ($warningDelay > 0 && $warningDelay < 86400) {
                \App\Jobs\CheckSLATimerWarning::dispatch($timer->id)->delay($timer->warning_at);
            }
        }

        if ($timer->target_at) {
            $breachDelay = $timer->target_at->diffInSeconds($now, false);
            if ($breachDelay > 0 && $breachDelay < 86400 * 7) {
                \App\Jobs\CheckSLATimerBreach::dispatch($timer->id)->delay($timer->target_at);
            }
        }
    }

    public function onTicketStatusChanged(Ticket $ticket, int $oldStatus, WorkflowState $newState): void
    {
        $policy = SLAPolicy::find($ticket->sla_policy_id);
        $shouldPause = $policy?->pause_on_pending && $newState->isPendingCategory();
        $shouldResume = $shouldPause === false && in_array($oldStatus, [Ticket::STATUS_PENDING, Ticket::STATUS_ON_HOLD]);
        $shouldComplete = $newState->isResolvedCategory() || $newState->isClosedCategory();

        $timers = SLATimer::forTenant($ticket->tenant_id)
            ->where('ticket_id', $ticket->id)
            ->whereIn('status', [SLATimer::STATUS_RUNNING, SLATimer::STATUS_PAUSED])
            ->get();

        foreach ($timers as $timer) {
            if ($timer->timer_type === SLATimer::TYPE_FIRST_RESPONSE) {
                if ($ticket->first_response_at && $timer->isRunning()) {
                    $this->markCompleted($timer, $ticket->first_response_at);
                    continue;
                }
            }

            if ($shouldPause && $timer->isRunning()) {
                $this->pauseTimer($timer);
            } elseif ($shouldResume && $timer->isPaused()) {
                $this->resumeTimer($timer, $policy);
            } elseif ($shouldComplete && $timer->isRunningOrPaused()) {
                $this->markCompleted($timer, $ticket->resolved_at ?? now());
            }
        }
    }

    public function pauseTimer(SLATimer $timer): void
    {
        if ($timer->isRunning()) {
            $timer->update([
                'paused_at' => now(),
                'status' => SLATimer::STATUS_PAUSED,
            ]);
            app('notification.service')->notifySLAPaused($timer);
        }
    }

    public function resumeTimer(SLATimer $timer, ?SLAPolicy $policy = null): void
    {
        if (!$timer->isPaused() || !$timer->paused_at) {
            return;
        }
        $policy = $policy ?? SLAPolicy::find($timer->policy_id);
        $pausedSeconds = now()->getTimestamp() - $timer->paused_at->getTimestamp();
        $newPausedTotal = ($timer->paused_total_seconds ?? 0) + $pausedSeconds;

        $totalMinutes = $policy
            ? ($timer->timer_type === SLATimer::TYPE_FIRST_RESPONSE ? $policy->first_response_minutes : $policy->resolution_minutes)
            : 0;

        $newTarget = null;
        if ($totalMinutes && $policy) {
            $newTarget = $this->calculateTargetTime($timer->started_at, $totalMinutes + (int) ($newPausedTotal / 60), $policy->use_business_hours, $timer->tenant_id);
        }

        $timer->update([
            'paused_total_seconds' => $newPausedTotal,
            'paused_at' => null,
            'target_at' => $newTarget ?? $timer->target_at,
            'status' => SLATimer::STATUS_RUNNING,
        ]);

        if ($newTarget) {
            $this->scheduleTimerChecks($timer);
        }

        app('notification.service')->notifySLAResumed($timer);
    }

    public function markCompleted(SLATimer $timer, \DateTimeInterface $completedAt): void
    {
        $elapsed = $completedAt->getTimestamp() - $timer->started_at->getTimestamp() - ($timer->paused_total_seconds ?? 0);
        $targetElapsed = $timer->target_at ? $timer->target_at->getTimestamp() - $timer->started_at->getTimestamp() : null;
        $breached = $targetElapsed !== null && $elapsed > $targetElapsed;

        $timer->update([
            'completed_at' => $completedAt,
            'actual_minutes' => (int) ceil($elapsed / 60),
            'target_minutes' => $targetElapsed !== null ? (int) ceil($targetElapsed / 60) : null,
            'status' => $breached ? SLATimer::STATUS_BREACHED : SLATimer::STATUS_COMPLETED,
        ]);

        if ($breached) {
            $this->createViolation($timer, SLAViolation::LEVEL_MILD);
        }

        $this->recordMetric($timer);
    }

    public function checkWarning(SLATimer $timer): void
    {
        if (!$timer->isRunning()) {
            return;
        }

        $now = now()->getTimestamp();
        $warningAt = $timer->warning_at?->getTimestamp();

        if ($warningAt && $now >= $warningAt && !$timer->warning_triggered_at) {
            $timer->update(['warning_triggered_at' => now()]);

            $policy = SLAPolicy::find($timer->policy_id);
            $escalation = $this->findMatchingEscalation($policy, 1);
            if ($escalation) {
                $this->executeEscalation($timer, $escalation);
            }

            app('notification.service')->notifySLAWarning($timer);
            app('automation.engine')->triggerEvent('sla.warning', $timer->ticket, ['timer_id' => $timer->id]);
        }
    }

    public function checkBreach(SLATimer $timer): void
    {
        if (!$timer->isRunningOrPaused()) {
            return;
        }

        $now = now()->getTimestamp();
        $targetAt = $timer->target_at?->getTimestamp();

        if ($targetAt && $now >= $targetAt) {
            $elapsed = $now - $timer->started_at->getTimestamp() - ($timer->paused_total_seconds ?? 0);

            $timer->update([
                'status' => SLATimer::STATUS_BREACHED,
                'breached_at' => now(),
                'actual_minutes' => (int) ceil($elapsed / 60),
                'target_minutes' => (int) ceil(($targetAt - $timer->started_at->getTimestamp()) / 60),
            ]);

            $level = $this->calculateBreachLevel($elapsed, $targetAt - $timer->started_at->getTimestamp());
            $this->createViolation($timer, $level);

            $policy = SLAPolicy::find($timer->policy_id);
            $escalation = $this->findMatchingEscalation($policy, 2);
            if ($escalation) {
                $this->executeEscalation($timer, $escalation);
            }

            $secondEscalation = $this->findMatchingEscalation($policy, 3);
            if ($secondEscalation && $level >= SLAViolation::LEVEL_SEVERE) {
                $this->executeEscalation($timer, $secondEscalation);
            }

            app('notification.service')->notifySLABreach($timer, $level);
            app('automation.engine')->triggerEvent('sla.breach', $timer->ticket, [
                'timer_id' => $timer->id,
                'level' => $level,
            ]);

            $this->recordMetric($timer);
        }
    }

    protected function calculateBreachLevel(int $actualSeconds, int $targetSeconds): int
    {
        if ($targetSeconds <= 0) {
            return SLAViolation::LEVEL_MILD;
        }
        $overrunPercent = ($actualSeconds - $targetSeconds) / $targetSeconds * 100;

        if ($overrunPercent >= 100) {
            return SLAViolation::LEVEL_CRITICAL;
        }
        if ($overrunPercent >= 50) {
            return SLAViolation::LEVEL_SEVERE;
        }
        return SLAViolation::LEVEL_MILD;
    }

    protected function createViolation(SLATimer $timer, int $level): SLAViolation
    {
        $existing = SLAViolation::where('tenant_id', $timer->tenant_id)
            ->where('timer_id', $timer->id)
            ->where('level', $level)
            ->first();
        if ($existing) {
            return $existing;
        }

        return SLAViolation::create([
            'tenant_id' => $timer->tenant_id,
            'ticket_id' => $timer->ticket_id,
            'timer_id' => $timer->id,
            'policy_id' => $timer->policy_id,
            'type' => $timer->timer_type === SLATimer::TYPE_FIRST_RESPONSE ? 'first_response' : 'resolution',
            'level' => $level,
            'breached_at' => now(),
            'target_minutes' => $timer->target_minutes,
            'actual_minutes' => $timer->actual_minutes,
            'acknowledged' => false,
        ]);
    }

    protected function findMatchingEscalation(?SLAPolicy $policy, int $level): ?array
    {
        if (!$policy || empty($policy->escalation_levels)) {
            return null;
        }
        foreach ($policy->escalation_levels as $esc) {
            if (($esc['level'] ?? 0) === $level) {
                return $esc;
            }
        }
        return null;
    }

    protected function executeEscalation(SLATimer $timer, array $escalation): void
    {
        $ticket = $timer->ticket;
        $action = $escalation['action'] ?? '';
        $channels = $escalation['channels'] ?? ['email'];
        $message = $escalation['message'] ?? '';

        switch ($action) {
            case 'notify_agent':
                app('notification.service')->notifyEscalation($ticket, $timer, $escalation, [$ticket->assignee_id]);
                break;
            case 'notify_agent_and_supervisor':
                $recipients = array_filter([$ticket->assignee_id]);
                if (!empty($ticket->group?->escalation_email)) {
                    $recipients[] = $ticket->group->escalation_email;
                }
                app('notification.service')->notifyEscalation($ticket, $timer, $escalation, $recipients);
                break;
            case 'escalate_to_group':
                $groupName = $escalation['target_group'] ?? 'supervisors';
                $group = \App\Models\TicketGroup::forTenant($timer->tenant_id)
                    ->where('name', 'like', "%{$groupName}%")
                    ->first();
                if ($group) {
                    $ticket->assignTo(null, $group->id);
                }
                $recipients = array_filter([$ticket->assignee_id, $ticket->group?->escalation_email]);
                app('notification.service')->notifyEscalation($ticket, $timer, $escalation, $recipients);
                break;
            case 'reassign':
                if (!empty($escalation['target_user_id'])) {
                    $ticket->assignTo((int) $escalation['target_user_id']);
                }
                app('notification.service')->notifyEscalation($ticket, $timer, $escalation, array_filter([$ticket->assignee_id]));
                break;
        }

        $ticket->increment('escalation_count');
        $ticket->addHistory(
            \App\Models\TicketHistory::ACTION_ESCALATION,
            null,
            $level ?? 1,
            ['escalation' => $escalation]
        );
    }

    public function escalateTicket(Ticket $ticket, array $params): void
    {
        $level = $params['level'] ?? 1;
        $note = $params['note'] ?? '';
        $targetGroupId = $params['group_id'] ?? null;
        $targetUserId = $params['user_id'] ?? null;

        if ($targetGroupId || $targetUserId) {
            $ticket->assignTo($targetUserId, $targetGroupId);
        }

        $ticket->increment('escalation_count');
        $ticket->addHistory(
            \App\Models\TicketHistory::ACTION_ESCALATION,
            null,
            $level,
            ['note' => $note]
        );
    }

    public function applyPolicy(Ticket $ticket, int $policyId): void
    {
        SLATimer::forTenant($ticket->tenant_id)
            ->where('ticket_id', $ticket->id)
            ->whereIn('status', [SLATimer::STATUS_RUNNING, SLATimer::STATUS_PAUSED])
            ->delete();

        $ticket->update(['sla_policy_id' => $policyId]);

        $this->startTimersForTicket($ticket->fresh());
    }

    public function onFirstResponse(Ticket $ticket, ?\DateTimeInterface $at = null): void
    {
        if ($ticket->first_response_at) {
            return;
        }
        $responseAt = $at ?? now();
        $ticket->update(['first_response_at' => $responseAt]);

        $timer = SLATimer::forTenant($ticket->tenant_id)
            ->where('ticket_id', $ticket->id)
            ->where('timer_type', SLATimer::TYPE_FIRST_RESPONSE)
            ->whereIn('status', [SLATimer::STATUS_RUNNING, SLATimer::STATUS_PAUSED])
            ->first();

        if ($timer) {
            $this->markCompleted($timer, $responseAt);
        }
    }

    protected function recordMetric(SLATimer $timer): void
    {
        $day = (int) $timer->started_at->format('Ymd');

        try {
            SLAMetric::aggregateForTimer($timer, $day);
        } catch (\Exception $e) {
            Log::error('SLA metric aggregation failed', ['timer_id' => $timer->id, 'error' => $e->getMessage()]);
        }
    }

    public function runScheduledChecks(int $limit = 1000): array
    {
        $now = now();
        $processed = ['warnings' => 0, 'breaches' => 0];

        SLATimer::whereIn('status', [SLATimer::STATUS_RUNNING, SLATimer::STATUS_PAUSED])
            ->whereNotNull('warning_at')
            ->where('warning_at', '<=', $now)
            ->whereNull('warning_triggered_at')
            ->take($limit)
            ->get()
            ->each(function (SLATimer $timer) use (&$processed) {
                try {
                    $this->checkWarning($timer);
                    $processed['warnings']++;
                } catch (\Exception $e) {
                    Log::error('SLA warning check failed', ['timer_id' => $timer->id, 'error' => $e->getMessage()]);
                }
            });

        SLATimer::whereIn('status', [SLATimer::STATUS_RUNNING, SLATimer::STATUS_PAUSED])
            ->whereNotNull('target_at')
            ->where('target_at', '<=', $now)
            ->take($limit)
            ->get()
            ->each(function (SLATimer $timer) use (&$processed) {
                try {
                    $this->checkBreach($timer);
                    $processed['breaches']++;
                } catch (\Exception $e) {
                    Log::error('SLA breach check failed', ['timer_id' => $timer->id, 'error' => $e->getMessage()]);
                }
            });

        return $processed;
    }

    public function acknowledgeViolation(int $violationId, int $userId, string $note = ''): ?SLAViolation
    {
        $violation = SLAViolation::find($violationId);
        if (!$violation) {
            return null;
        }
        $violation->update([
            'acknowledged' => true,
            'acknowledged_by' => $userId,
            'acknowledged_at' => now(),
            'acknowledgment_note' => $note,
        ]);
        return $violation;
    }
}
