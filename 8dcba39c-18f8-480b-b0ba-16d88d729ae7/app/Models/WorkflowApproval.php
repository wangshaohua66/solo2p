<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowApproval extends Model
{
    use HasFactory, BelongsToTenant;

    public const STATUS_PENDING = 1;
    public const STATUS_APPROVED = 2;
    public const STATUS_REJECTED = 3;
    public const STATUS_EXPIRED = 4;

    protected $fillable = [
        'tenant_id', 'ticket_id', 'transition_id', 'requested_by',
        'approved_by', 'status', 'reject_reason', 'expires_at', 'approved_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function transition(): BelongsTo
    {
        return $this->belongsTo(WorkflowTransition::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }

    public function isExpired(): bool
    {
        return $this->status === self::STATUS_EXPIRED
            || ($this->isPending() && $this->expires_at && now()->greaterThan($this->expires_at));
    }

    public function approve(int $approverId): void
    {
        $this->forceFill([
            'status' => self::STATUS_APPROVED,
            'approved_by' => $approverId,
            'approved_at' => now(),
        ])->save();
    }

    public function reject(int $approverId, string $reason): void
    {
        $this->forceFill([
            'status' => self::STATUS_REJECTED,
            'approved_by' => $approverId,
            'reject_reason' => $reason,
        ])->save();
    }

    public function expire(): void
    {
        $this->forceFill(['status' => self::STATUS_EXPIRED])->save();
    }

    public function canBeApprovedBy(User $user): bool
    {
        if (!$this->isPending()) {
            return false;
        }
        $transition = $this->transition;

        if (!empty($transition->approver_roles)) {
            foreach ($transition->approver_roles as $role) {
                if ($user->hasRole($role)) {
                    return true;
                }
            }
        }
        if ($transition->approval_group_id) {
            return $transition->approvalGroup->members()->where('user_id', $user->id)->exists()
                || $transition->approvalGroup->leader_id === $user->id;
        }
        return false;
    }
}
