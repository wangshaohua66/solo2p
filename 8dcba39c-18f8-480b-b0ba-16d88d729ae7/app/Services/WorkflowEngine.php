<?php

namespace App\Services;

use App\Models\Workflow;
use App\Models\WorkflowState;
use App\Models\WorkflowTransition;
use App\Models\WorkflowApproval;
use App\Models\Ticket;
use App\Models\AssignmentRule;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WorkflowEngine
{
    protected $conditionEvaluator;

    public function __construct(ConditionEvaluator $conditionEvaluator)
    {
        $this->conditionEvaluator = $conditionEvaluator;
    }

    public function createDefaultWorkflow(int $tenantId): Workflow
    {
        return DB::transaction(function () use ($tenantId) {
            $workflow = Workflow::create([
                'tenant_id' => $tenantId,
                'name' => '默认工单流程',
                'description' => '系统默认的工单处理流程',
                'trigger_type' => Workflow::TRIGGER_AUTO,
                'entity_type' => 'ticket',
                'is_default' => true,
                'status' => 1,
            ]);

            $states = $this->createDefaultStates($workflow);
            $this->createDefaultTransitions($workflow, $states);

            $initialState = $states['open'] ?? $states->first();
            $workflow->update(['initial_state_id' => $initialState->id]);

            return $workflow;
        });
    }

    protected function createDefaultStates(Workflow $workflow): \Illuminate\Support\Collection
    {
        $stateDefs = [
            ['key' => 'open', 'name' => '待处理', 'color' => '#EF4444', 'category' => WorkflowState::CATEGORY_ACTIVE, 'is_initial' => true],
            ['key' => 'in_progress', 'name' => '处理中', 'color' => '#F59E0B', 'category' => WorkflowState::CATEGORY_ACTIVE],
            ['key' => 'pending_customer', 'name' => '待客户回复', 'color' => '#8B5CF6', 'category' => WorkflowState::CATEGORY_PENDING],
            ['key' => 'pending_third_party', 'name' => '待第三方', 'color' => '#8B5CF6', 'category' => WorkflowState::CATEGORY_PENDING],
            ['key' => 'pending_approval', 'name' => '待审批', 'color' => '#6366F1', 'category' => WorkflowState::CATEGORY_PENDING],
            ['key' => 'resolved', 'name' => '已解决', 'color' => '#10B981', 'category' => WorkflowState::CATEGORY_RESOLVED],
            ['key' => 'closed', 'name' => '已关闭', 'color' => '#6B7280', 'category' => WorkflowState::CATEGORY_CLOSED, 'is_final' => true],
        ];

        $states = collect();
        foreach ($stateDefs as $i => $def) {
            $state = WorkflowState::create([
                'tenant_id' => $workflow->tenant_id,
                'workflow_id' => $workflow->id,
                'key' => $def['key'],
                'name' => $def['name'],
                'color' => $def['color'],
                'category' => $def['category'],
                'is_initial' => $def['is_initial'] ?? false,
                'is_final' => $def['is_final'] ?? false,
                'sort_order' => $i,
            ]);
            $states[$def['key']] = $state;
        }
        return $states;
    }

    protected function createDefaultTransitions(Workflow $workflow, \Illuminate\Support\Collection $states): void
    {
        $transitionDefs = [
            ['from' => 'open', 'to' => 'in_progress', 'name' => '开始处理'],
            ['from' => 'open', 'to' => 'resolved', 'name' => '直接解决'],
            ['from' => 'in_progress', 'to' => 'pending_customer', 'name' => '等待客户回复'],
            ['from' => 'in_progress', 'to' => 'pending_third_party', 'name' => '等待第三方'],
            ['from' => 'in_progress', 'to' => 'pending_approval', 'name' => '提交审批', 'requires_approval' => true],
            ['from' => 'in_progress', 'to' => 'resolved', 'name' => '标记解决'],
            ['from' => 'in_progress', 'to' => 'closed', 'name' => '直接关闭'],
            ['from' => 'pending_customer', 'to' => 'in_progress', 'name' => '客户已回复'],
            ['from' => 'pending_customer', 'to' => 'resolved', 'name' => '自动解决'],
            ['from' => 'pending_customer', 'to' => 'closed', 'name' => '自动关闭'],
            ['from' => 'pending_third_party', 'to' => 'in_progress', 'name' => '第三方已回复'],
            ['from' => 'pending_approval', 'to' => 'in_progress', 'name' => '审批通过'],
            ['from' => 'pending_approval', 'to' => 'open', 'name' => '审批驳回'],
            ['from' => 'resolved', 'to' => 'closed', 'name' => '关闭工单'],
            ['from' => 'resolved', 'to' => 'in_progress', 'name' => '重新打开'],
            ['from' => 'closed', 'to' => 'in_progress', 'name' => '重新打开'],
        ];

        foreach ($transitionDefs as $i => $def) {
            $fromState = $states[$def['from']] ?? null;
            $toState = $states[$def['to']] ?? null;
            if (!$fromState || !$toState) {
                continue;
            }
            WorkflowTransition::create([
                'tenant_id' => $workflow->tenant_id,
                'workflow_id' => $workflow->id,
                'from_state_id' => $fromState->id,
                'to_state_id' => $toState->id,
                'name' => $def['name'],
                'requires_approval' => $def['requires_approval'] ?? false,
                'sort_order' => $i,
            ]);
        }
    }

    public function initializeTicket(Ticket $ticket): void
    {
        $workflow = $this->findWorkflowForTicket($ticket);
        if (!$workflow) {
            return;
        }
        $initialState = $workflow->getInitialState();
        if ($initialState) {
            $ticket->forceFill([
                'workflow_id' => $workflow->id,
                'current_state_id' => $initialState->id,
                'status' => $initialState->toTicketStatus(),
            ])->save();

            $this->executeStateEnterActions($ticket, $initialState);
        }
    }

    public function findWorkflowForTicket(Ticket $ticket): ?Workflow
    {
        if ($ticket->workflow_id) {
            $workflow = Workflow::find($ticket->workflow_id);
            if ($workflow && $workflow->isActive()) {
                return $workflow;
            }
        }

        $data = $ticket->toArray();
        $workflows = Workflow::forTenant($ticket->tenant_id)
            ->where('status', 1)
            ->where('entity_type', 'ticket')
            ->orderByDesc('is_default')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        foreach ($workflows as $wf) {
            if ($wf->matchesTrigger($data)) {
                return $wf;
            }
        }

        return $workflows->firstWhere('is_default', true) ?? $workflows->first();
    }

    public function getAvailableTransitions(Ticket $ticket): \Illuminate\Database\Eloquent\Collection
    {
        if (!$ticket->workflow_id || !$ticket->current_state_id) {
            return collect();
        }
        return WorkflowTransition::where('workflow_id', $ticket->workflow_id)
            ->where('from_state_id', $ticket->current_state_id)
            ->orderBy('sort_order')
            ->get()
            ->filter(function (WorkflowTransition $transition) use ($ticket) {
                return $transition->checkConditions(['ticket' => $ticket->toArray()]);
            });
    }

    public function canTransition(Ticket $ticket, int $toStateId): bool
    {
        if (!$ticket->workflow_id || !$ticket->current_state_id) {
            return false;
        }
        $transition = WorkflowTransition::where('workflow_id', $ticket->workflow_id)
            ->where('from_state_id', $ticket->current_state_id)
            ->where('to_state_id', $toStateId)
            ->first();

        if (!$transition) {
            return false;
        }
        return $transition->checkConditions(['ticket' => $ticket->toArray()]);
    }

    public function transition(Ticket $ticket, int $toStateId, ?User $byUser = null, array $context = []): array
    {
        return DB::transaction(function () use ($ticket, $toStateId, $byUser, $context) {
            $user = $byUser ?? auth()->user();
            $result = [
                'success' => false,
                'message' => '',
                'needs_approval' => false,
                'approval' => null,
            ];

            if (!$ticket->workflow_id || !$ticket->current_state_id) {
                $this->initializeTicket($ticket);
                $ticket = $ticket->fresh();
            }

            $transition = WorkflowTransition::where('workflow_id', $ticket->workflow_id)
                ->where('from_state_id', $ticket->current_state_id)
                ->where('to_state_id', $toStateId)
                ->first();

            if (!$transition) {
                $result['message'] = '无效的状态转换';
                return $result;
            }

            if (!$transition->checkConditions(['ticket' => $ticket->toArray(), 'context' => $context])) {
                $result['message'] = '转换条件不满足';
                return $result;
            }

            if ($transition->needsApproval()) {
                $approval = $this->requestApproval($ticket, $transition, $user, $context);
                $result['needs_approval'] = true;
                $result['approval'] = $approval;
                $result['message'] = '审批请求已提交';
                $result['success'] = true;
                return $result;
            }

            return $this->executeTransition($ticket, $transition, $user, $context);
        });
    }

    protected function executeTransition(Ticket $ticket, WorkflowTransition $transition, ?User $user, array $context): array
    {
        $fromState = $transition->fromState;
        $toState = $transition->toState;
        $userId = $user?->id;

        $this->executeStateExitActions($ticket, $fromState);

        $oldStatus = $ticket->status;
        $oldStateId = $ticket->current_state_id;

        $ticket->forceFill([
            'current_state_id' => $toState->id,
            'status' => $toState->toTicketStatus(),
            'updated_by' => $userId,
        ]);

        if ($toState->isResolvedCategory() && !$ticket->resolved_at) {
            $ticket->resolved_at = now();
        }
        if ($toState->isClosedCategory()) {
            if (!$ticket->resolved_at) {
                $ticket->resolved_at = now();
            }
            $ticket->closed_at = now();
        }
        if ($fromState->isClosedCategory() || $fromState->isResolvedCategory()) {
            if ($toState->isActiveCategory() || $toState->isPendingCategory()) {
                $ticket->increment('reopen_count');
                $ticket->closed_at = null;
            }
        }

        $ticket->save();

        $this->executeTransitionActions($ticket, $transition, $context);
        $this->executeStateEnterActions($ticket, $toState);

        $ticket->addHistory(
            \App\Models\TicketHistory::ACTION_WORKFLOW_TRANSITION,
            $oldStateId,
            $toState->id,
            array_merge(['user_id' => $userId, 'transition_id' => $transition->id], $context)
        );

        if ($oldStatus !== $ticket->status) {
            $ticket->addHistory(
                \App\Models\TicketHistory::ACTION_STATUS_CHANGE,
                $oldStatus,
                $ticket->status,
                ['user_id' => $userId]
            );
        }

        app('sla.monitor')->onTicketStatusChanged($ticket, $oldStatus, $toState);
        app('automation.engine')->triggerEvent('ticket.transition', $ticket, [
            'transition_id' => $transition->id,
            'from_state_id' => $oldStateId,
            'to_state_id' => $toState->id,
        ]);

        return [
            'success' => true,
            'message' => '状态转换成功',
            'needs_approval' => false,
            'from_state' => $fromState,
            'to_state' => $toState,
        ];
    }

    protected function requestApproval(Ticket $ticket, WorkflowTransition $transition, ?User $user, array $context): WorkflowApproval
    {
        $timeout = $transition->getApprovalTimeout();
        $expiresAt = $timeout ? now()->addMinutes($timeout) : null;

        $approval = WorkflowApproval::create([
            'tenant_id' => $ticket->tenant_id,
            'ticket_id' => $ticket->id,
            'transition_id' => $transition->id,
            'requested_by' => $user?->id,
            'expires_at' => $expiresAt,
            'status' => WorkflowApproval::STATUS_PENDING,
        ]);

        $ticket->addHistory(
            \App\Models\TicketHistory::ACTION_APPROVAL,
            null,
            WorkflowApproval::STATUS_PENDING,
            ['approval_id' => $approval->id, 'user_id' => $user?->id]
        );

        app('notification.service')->notifyApprovalRequested($approval);

        return $approval;
    }

    public function approveTransition(WorkflowApproval $approval, User $approver, bool $approve, ?string $reason = ''): array
    {
        return DB::transaction(function () use ($approval, $approver, $approve, $reason) {
            if (!$approval->isPending()) {
                return ['success' => false, 'message' => '审批请求已处理'];
            }
            if (!$approval->canBeApprovedBy($approver)) {
                return ['success' => false, 'message' => '无权限审批此请求'];
            }

            $ticket = $approval->ticket;
            $transition = $approval->transition;

            if ($approve) {
                $approval->approve($approver->id);
                $result = $this->executeTransition($ticket, $transition, $approver, ['approved_by' => $approver->id]);
                app('notification.service')->notifyApprovalResult($approval, true);
                return array_merge($result, ['approval_status' => 'approved']);
            } else {
                $approval->reject($approver->id, $reason);
                $ticket->addHistory(
                    \App\Models\TicketHistory::ACTION_APPROVAL,
                    WorkflowApproval::STATUS_PENDING,
                    WorkflowApproval::STATUS_REJECTED,
                    ['approval_id' => $approval->id, 'user_id' => $approver->id, 'reason' => $reason]
                );
                app('notification.service')->notifyApprovalResult($approval, false, $reason);
                return [
                    'success' => true,
                    'message' => '已驳回审批',
                    'approval_status' => 'rejected',
                ];
            }
        });
    }

    protected function executeStateEnterActions(Ticket $ticket, WorkflowState $state): void
    {
        $actions = $state->on_enter_actions ?? [];
        $this->executeActions($ticket, $actions, ['event' => 'state_enter', 'state_id' => $state->id]);
    }

    protected function executeStateExitActions(Ticket $ticket, WorkflowState $state): void
    {
        $actions = $state->on_exit_actions ?? [];
        $this->executeActions($ticket, $actions, ['event' => 'state_exit', 'state_id' => $state->id]);
    }

    protected function executeTransitionActions(Ticket $ticket, WorkflowTransition $transition, array $context): void
    {
        $actions = $transition->actions ?? [];
        $this->executeActions($ticket, $actions, array_merge(['event' => 'transition', 'transition_id' => $transition->id], $context));

        if (!empty($transition->notifications)) {
            app('notification.service')->sendWorkflowNotifications($ticket, $transition);
        }
    }

    public function executeActions(Ticket $ticket, array $actions, array $context = []): void
    {
        foreach ($actions as $action) {
            try {
                $this->executeAction($ticket, $action, $context);
            } catch (\Exception $e) {
                Log::error('Workflow action failed', [
                    'ticket_id' => $ticket->id,
                    'action' => $action,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    protected function executeAction(Ticket $ticket, array $action, array $context): void
    {
        $type = $action['type'] ?? null;
        $params = $action['params'] ?? [];

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
            case 'change_priority':
                if (!empty($params['priority'])) {
                    $ticket->update(['priority' => (int) $params['priority']]);
                }
                break;
            case 'set_due_date':
                if (!empty($params['minutes'])) {
                    $ticket->update(['due_at' => now()->addMinutes((int) $params['minutes'])]);
                }
                break;
            case 'add_tag':
                if (!empty($params['tags'])) {
                    $currentTags = $ticket->tags ?? [];
                    $ticket->update(['tags' => array_unique(array_merge($currentTags, (array) $params['tags']))]);
                }
                break;
            case 'notify':
                if (!empty($params['template_key']) && !empty($params['channels'])) {
                    app('notification.service')->notify(
                        $ticket,
                        $params['template_key'],
                        (array) $params['channels'],
                        $params['recipients'] ?? null
                    );
                }
                break;
            case 'webhook':
                if (!empty($params['event'])) {
                    app('notification.service')->dispatchWebhook(
                        $ticket->tenant_id,
                        $params['event'],
                        ['ticket' => $ticket->toArray(), 'context' => $context]
                    );
                }
                break;
            case 'escalate':
                app('sla.monitor')->escalateTicket($ticket, $params);
                break;
            case 'apply_sla_policy':
                if (!empty($params['policy_id'])) {
                    app('sla.monitor')->applyPolicy($ticket, (int) $params['policy_id']);
                }
                break;
        }
    }

    public function findAutoAssignment(Ticket $ticket): array
    {
        $rules = AssignmentRule::forTenant($ticket->tenant_id)
            ->where('status', 1)
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();

        $data = $ticket->toArray();
        foreach ($rules as $rule) {
            if ($rule->matches($data)) {
                return $rule->execute($data);
            }
        }
        return ['user_id' => null, 'group_id' => null];
    }

    public function applyAutoAssignment(Ticket $ticket): bool
    {
        $result = $this->findAutoAssignment($ticket);
        if (!empty($result['user_id']) || !empty($result['group_id'])) {
            $ticket->assignTo(
                $result['user_id'] ?? null,
                $result['group_id'] ?? null
            );
            return true;
        }
        return false;
    }
}
