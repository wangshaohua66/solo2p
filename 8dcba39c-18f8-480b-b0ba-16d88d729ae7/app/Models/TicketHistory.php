<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketHistory extends Model
{
    use HasFactory, BelongsToTenant;

    public $timestamps = false;

    public const ACTION_CREATE = 'create';
    public const ACTION_UPDATE = 'update';
    public const ACTION_STATUS_CHANGE = 'status_change';
    public const ACTION_PRIORITY_CHANGE = 'priority_change';
    public const ACTION_ASSIGN = 'assign';
    public const ACTION_COMMENT = 'comment';
    public const ACTION_ATTACHMENT = 'attachment';
    public const ACTION_TAG = 'tag';
    public const ACTION_RESOLVE = 'resolve';
    public const ACTION_CLOSE = 'close';
    public const ACTION_REOPEN = 'reopen';
    public const ACTION_SATISFACTION = 'satisfaction';
    public const ACTION_SLA_BREACH = 'sla_breach';
    public const ACTION_ESCALATION = 'escalation';
    public const ACTION_APPROVAL = 'approval';
    public const ACTION_WORKFLOW_TRANSITION = 'workflow_transition';
    public const ACTION_DELETE = 'delete';
    public const ACTION_RESTORE = 'restore';

    protected $fillable = [
        'tenant_id', 'ticket_id', 'user_id', 'action',
        'old_value', 'new_value', 'metadata', 'created_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->created_at)) {
                $model->created_at = now();
            }
        });
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
