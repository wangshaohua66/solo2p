<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkflowTransition extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'workflow_id', 'from_state_id', 'to_state_id', 'name',
        'conditions', 'actions', 'requires_approval', 'approver_roles',
        'approval_group_id', 'approval_timeout_minutes', 'notifications', 'sort_order',
    ];

    protected $casts = [
        'conditions' => 'array',
        'actions' => 'array',
        'approver_roles' => 'array',
        'notifications' => 'array',
        'requires_approval' => 'boolean',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    public function fromState(): BelongsTo
    {
        return $this->belongsTo(WorkflowState::class, 'from_state_id');
    }

    public function toState(): BelongsTo
    {
        return $this->belongsTo(WorkflowState::class, 'to_state_id');
    }

    public function approvalGroup(): BelongsTo
    {
        return $this->belongsTo(TicketGroup::class, 'approval_group_id');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(WorkflowApproval::class, 'transition_id');
    }

    public function checkConditions(array $context): bool
    {
        if (empty($this->conditions)) {
            return true;
        }
        return app('workflow.condition_evaluator')
            ->evaluate($this->conditions, $context);
    }

    public function needsApproval(): bool
    {
        return $this->requires_approval
            && (!empty($this->approver_roles) || !empty($this->approval_group_id));
    }

    public function getApprovalTimeout(): ?int
    {
        return $this->approval_timeout_minutes;
    }
}
