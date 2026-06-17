<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkflowState extends Model
{
    use HasFactory, BelongsToTenant;

    public const CATEGORY_ACTIVE = 'active';
    public const CATEGORY_PENDING = 'pending';
    public const CATEGORY_RESOLVED = 'resolved';
    public const CATEGORY_CLOSED = 'closed';

    protected $fillable = [
        'tenant_id', 'workflow_id', 'name', 'key', 'color', 'category',
        'is_initial', 'is_final', 'on_enter_actions', 'on_exit_actions', 'sort_order',
    ];

    protected $casts = [
        'on_enter_actions' => 'array',
        'on_exit_actions' => 'array',
        'is_initial' => 'boolean',
        'is_final' => 'boolean',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    public function incomingTransitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'to_state_id');
    }

    public function outgoingTransitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'from_state_id');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'current_state_id');
    }

    public function isActiveCategory(): bool
    {
        return $this->category === self::CATEGORY_ACTIVE;
    }

    public function isPendingCategory(): bool
    {
        return $this->category === self::CATEGORY_PENDING;
    }

    public function isResolvedCategory(): bool
    {
        return $this->category === self::CATEGORY_RESOLVED;
    }

    public function isClosedCategory(): bool
    {
        return $this->category === self::CATEGORY_CLOSED;
    }

    public function toTicketStatus(): string
    {
        return match ($this->category) {
            self::CATEGORY_ACTIVE => Ticket::STATUS_IN_PROGRESS,
            self::CATEGORY_PENDING => Ticket::STATUS_PENDING,
            self::CATEGORY_RESOLVED => Ticket::STATUS_RESOLVED,
            self::CATEGORY_CLOSED => Ticket::STATUS_CLOSED,
            default => Ticket::STATUS_OPEN,
        };
    }
}
