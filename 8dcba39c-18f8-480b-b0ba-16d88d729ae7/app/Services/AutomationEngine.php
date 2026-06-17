<?php

namespace App\Services;

use App\Models\AutomationRule;
use App\Models\AutomationLog;
use App\Models\Ticket;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutomationEngine
{
    protected $conditionEvaluator;

    public function __construct(ConditionEvaluator $conditionEvaluator)
    {
        $this->conditionEvaluator = $conditionEvaluator;
    }

    public function triggerEvent(string $eventType, $entity, array $extra = []): void
    {
        if ($entity instanceof Ticket) {
            $tenantId = $entity->tenant_id;
            $rules = AutomationRule::findByEventType($tenantId, $eventType);
        } else {
            $tenantId = app('currentTenantId') ?? 0;
            $rules = collect();
        }

        $context = [
            'event' => $eventType,
            'timestamp' => now()->toIso8601String(),
            'extra' => $extra,
            'ticket' => $entity instanceof Ticket ? $entity->toArray() : null,
            'entity' => is_object($entity) ? $entity->toArray() : $entity,
        ];

        foreach ($rules as $rule) {
            try {
                $this->executeRule($rule, $context, $entity);
            } catch (\Exception $e) {
                Log::error('Automation rule execution failed', [
                    'rule_id' => $rule->id,
                    'event' => $eventType,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    public function executeRule(AutomationRule $rule, array $context, $entity = null): array
    {
        $startTime = microtime(true);
        $result = [
            'rule_id' => $rule->id,
            'triggered' => false,
            'actions_executed' => 0,
            'actions_total' => 0,
            'errors' => [],
            'duration_ms' => 0,
        ];

        if (!$rule->evaluateConditions($context)) {
            return $result;
        }

        $result['triggered'] = true;
        $actions = $rule->actions ?? [];
        $result['actions_total'] = count($actions);

        foreach ($actions as $index => $action) {
            try {
                $this->executeAction($rule, $action, $context, $entity);
                $result['actions_executed']++;
            } catch (\Exception $e) {
                $result['errors'][] = [
                    'action_index' => $index,
                    'error' => $e->getMessage(),
                ];
                Log::error('Automation action failed', [
                    'rule_id' => $rule->id,
                    'action_index' => $index,
                    'error' => $e->getMessage(),
                ]);
                if (($rule->stop_on_error ?? true)) {
                    break;
                }
            }
        }

        $result['duration_ms'] = (int) ((microtime(true) - $startTime) * 1000);

        AutomationLog::create([
            'tenant_id' => $rule->tenant_id,
            'rule_id' => $rule->id,
            'trigger_type' => $rule->trigger_type,
            'event' => $context['event'] ?? null,
            'entity_type' => $entity ? get_class($entity) : null,
            'entity_id' => $entity->id ?? null,
            'triggered' => $result['triggered'],
            'actions_executed' => $result['actions_executed'],
            'actions_total' => $result['actions_total'],
            'execution_ms' => $result['duration_ms'],
            'errors' => $result['errors'] ?: null,
        ]);

        return $result;
    }

    public function runScheduledRules(): array
    {
        $rules = AutomationRule::where('trigger_type', AutomationRule::TRIGGER_SCHEDULE)
            ->where('status', 1)
            ->get();

        $report = ['total' => $rules->count(), 'triggered' => 0, 'actions' => 0];

        foreach ($rules as $rule) {
            if (!$this->shouldRunScheduledRule($rule)) {
                continue;
            }
            $entities = $this->fetchScheduledRuleEntities($rule);
            foreach ($entities as $entity) {
                $context = [
                    'event' => 'schedule:' . $rule->schedule_cron,
                    'timestamp' => now()->toIso8601String(),
                    'ticket' => $entity->toArray(),
                    'entity' => $entity->toArray(),
                ];
                $result = $this->executeRule($rule, $context, $entity);
                if ($result['triggered']) {
                    $report['triggered']++;
                    $report['actions'] += $result['actions_executed'];
                }
            }
            DB::table('automation_rules')
                ->where('id', $rule->id)
                ->update(['last_run_at' => now()]);
        }

        return $report;
    }

    protected function shouldRunScheduledRule(AutomationRule $rule): bool
    {
        if (!$rule->schedule_cron) {
            return true;
        }
        $lastRun = $rule->last_run_at;
        if (!$lastRun) {
            return true;
        }

        $cron = $rule->schedule_cron;
        if ($cron === '* * * * *') {
            return true;
        }
        if ($cron === '*/5 * * * *' && $lastRun->diffInMinutes(now()) >= 5) {
            return true;
        }
        if ($cron === '*/15 * * * *' && $lastRun->diffInMinutes(now()) >= 15) {
            return true;
        }
        if ($cron === '0 * * * *' && $lastRun->diffInHours(now()) >= 1) {
            return true;
        }
        if ($cron === '0 0 * * *' && $lastRun->diffInDays(now()) >= 1) {
            return true;
        }
        return true;
    }

    protected function fetchScheduledRuleEntities(AutomationRule $rule): \Illuminate\Support\Collection
    {
        $query = Ticket::forTenant($rule->tenant_id)->limit(1000);
        $conditions = $rule->trigger_conditions ?? [];
        if (!empty($conditions['status_in'])) {
            $query->whereIn('status', (array) $conditions['status_in']);
        }
        if (!empty($conditions['overdue'])) {
            $query->overdue();
        }
        if (!empty($conditions['no_activity_hours'])) {
            $hours = (int) $conditions['no_activity_hours'];
            $query->where('updated_at', '<=', now()->subHours($hours));
        }
        return $query->get();
    }

    protected function executeAction(AutomationRule $rule, array $action, array $context, $entity): void
    {
        $type = $action['type'] ?? null;
        $params = $action['params'] ?? [];

        if ($entity instanceof Ticket) {
            $this->executeTicketAction($entity, $type, $params, $context);
        }
    }

    protected function executeTicketAction(Ticket $ticket, ?string $type, array $params, array $context): void
    {
        switch ($type) {
            case 'assign_user':
                if (!empty($params['user_id'])) {
                    $ticket->assignTo((int) $params['user_id']);
                }
                break;
            case 'assign_group':
                if (!empty($params['group_id'])) {
                    $ticket->assignTo(null, (int) $params['group_id']);
                }
                break;
            case 'auto_assign':
                app('workflow.engine')->applyAutoAssignment($ticket);
                break;
            case 'change_status':
                if (!empty($params['state_id'])) {
                    app('workflow.engine')->transition($ticket, (int) $params['state_id']);
                }
                break;
            case 'change_priority':
                if (!empty($params['priority'])) {
                    $oldPriority = $ticket->priority;
                    $ticket->update(['priority' => (int) $params['priority']]);
                    $ticket->addHistory(
                        \App\Models\TicketHistory::ACTION_PRIORITY_CHANGE,
                        $oldPriority,
                        (int) $params['priority']
                    );
                }
                break;
            case 'set_due_date':
                if (!empty($params['hours'])) {
                    $ticket->update(['due_at' => now()->addHours((int) $params['hours'])]);
                }
                break;
            case 'add_tag':
                if (!empty($params['tags'])) {
                    $tags = array_unique(array_merge($ticket->tags ?? [], (array) $params['tags']));
                    $ticket->update(['tags' => $tags]);
                }
                break;
            case 'remove_tag':
                if (!empty($params['tags'])) {
                    $tags = array_diff($ticket->tags ?? [], (array) $params['tags']);
                    $ticket->update(['tags' => array_values($tags)]);
                }
                break;
            case 'escalate':
                app('sla.monitor')->escalateTicket($ticket, $params);
                break;
            case 'send_notification':
                if (!empty($params['template_key'])) {
                    app('notification.service')->notify(
                        $ticket,
                        $params['template_key'],
                        (array) ($params['channels'] ?? ['email']),
                        $params['recipients'] ?? null
                    );
                }
                break;
            case 'trigger_webhook':
                if (!empty($params['event'])) {
                    app('notification.service')->dispatchWebhook(
                        $ticket->tenant_id,
                        $params['event'],
                        ['ticket' => $ticket->toArray(), 'context' => $context]
                    );
                }
                break;
            case 'apply_sla_policy':
                if (!empty($params['policy_id'])) {
                    app('sla.monitor')->applyPolicy($ticket, (int) $params['policy_id']);
                }
                break;
            case 'add_comment':
                if (!empty($params['content'])) {
                    $ticket->addComment(
                        $params['content'],
                        $params['author_id'] ?? null,
                        \App\Models\TicketComment::TYPE_INTERNAL
                    );
                }
                break;
            case 'create_follow_up':
                break;
            case 'cc_users':
                if (!empty($params['watchers'])) {
                    $existing = $ticket->watchers ?? [];
                    $newWatchers = array_unique(array_merge($existing, (array) $params['watchers']));
                    $ticket->update(['watchers' => $newWatchers]);
                }
                break;
        }
    }

    public function runConditionChecks(): array
    {
        $rules = AutomationRule::where('trigger_type', AutomationRule::TRIGGER_CONDITION)
            ->where('status', 1)
            ->get();

        $report = ['total' => $rules->count(), 'triggered' => 0, 'actions' => 0];

        foreach ($rules as $rule) {
            $context = [
                'event' => 'condition_check',
                'timestamp' => now()->toIso8601String(),
            ];
            if (!$rule->evaluateConditions($context)) {
                continue;
            }
            $entities = $this->fetchScheduledRuleEntities($rule);
            foreach ($entities as $entity) {
                $ctx = ['event' => 'condition_check', 'timestamp' => now()->toIso8601String(), 'ticket' => $entity->toArray()];
                if (!$rule->evaluateConditions($ctx)) {
                    continue;
                }
                $result = $this->executeRule($rule, $ctx, $entity);
                if ($result['triggered']) {
                    $report['triggered']++;
                    $report['actions'] += $result['actions_executed'];
                }
            }
            DB::table('automation_rules')
                ->where('id', $rule->id)
                ->update(['last_run_at' => now()]);
        }

        return $report;
    }
}
