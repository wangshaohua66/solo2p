<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * @OA\Schema(
 *     schema="Ticket",
 *     type="object",
 *     required={"subject", "requester_id"},
 *     @OA\Property(property="id", type="integer"),
 *     @OA\Property(property="tenant_id", type="integer"),
 *     @OA\Property(property="uuid", type="string"),
 *     @OA\Property(property="number", type="string"),
 *     @OA\Property(property="subject", type="string"),
 *     @OA\Property(property="content", type="string"),
 *     @OA\Property(property="source", type="string"),
 *     @OA\Property(property="priority", type="integer"),
 *     @OA\Property(property="status", type="string"),
 *     @OA\Property(property="requester_id", type="integer"),
 *     @OA\Property(property="assignee_id", type="integer"),
 *     @OA\Property(property="group_id", type="integer"),
 *     @OA\Property(property="tags", type="array", @OA\Items(type="string")),
 *     @OA\Property(property="due_at", type="string", format="datetime"),
 *     @OA\Property(property="satisfaction_score", type="number"),
 *     @OA\Property(property="created_at", type="string", format="datetime")
 * )
 */
class Ticket extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    public const PRIORITY_LOW = 1;
    public const PRIORITY_MEDIUM = 2;
    public const PRIORITY_HIGH = 3;
    public const PRIORITY_URGENT = 4;

    public const STATUS_OPEN = 'open';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_PENDING = 'pending';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_REOPENED = 'reopened';

    public const SOURCE_WEB = 'web';
    public const SOURCE_EMAIL = 'email';
    public const SOURCE_PHONE = 'phone';
    public const SOURCE_API = 'api';
    public const SOURCE_CHAT = 'chat';
    public const SOURCE_SOCIAL = 'social';

    public const STATUSES = [
        self::STATUS_OPEN,
        self::STATUS_IN_PROGRESS,
        self::STATUS_PENDING,
        self::STATUS_RESOLVED,
        self::STATUS_CLOSED,
        self::STATUS_REOPENED,
    ];

    public const ACTIVE_STATUSES = [
        self::STATUS_OPEN,
        self::STATUS_IN_PROGRESS,
        self::STATUS_PENDING,
        self::STATUS_REOPENED,
    ];

    protected $fillable = [
        'tenant_id', 'uuid', 'ticket_number', 'number', 'subject', 'description', 'content',
        'category_id', 'subcategory_id', 'source', 'channel',
        'priority', 'status',
        'requester_id', 'assignee_id', 'group_id',
        'workflow_id', 'current_state_id', 'sla_policy_id',
        'satisfaction_rating', 'satisfaction_score',
        'satisfaction_comment', 'satisfaction_submitted_at', 'rated_at',
        'due_at', 'first_response_at', 'last_assigned_at', 'assigned_at',
        'resolved_at', 'closed_at', 'reopen_count',
        'comment_count', 'attachment_count',
        'custom_fields', 'tags',
        'created_by', 'updated_by',
        'escalation_level',
    ];

    protected $casts = [
        'custom_fields' => 'array',
        'tags' => 'array',
        'due_at' => 'datetime',
        'first_response_at' => 'datetime',
        'last_assigned_at' => 'datetime',
        'assigned_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
        'rated_at' => 'datetime',
        'satisfaction_submitted_at' => 'datetime',
        'satisfaction_rating' => 'integer',
        'escalation_level' => 'integer',
    ];

    protected $appends = ['is_overdue'];

    public static function boot(): void
    {
        parent::boot();

        static::creating(function (self $ticket) {
            if (empty($ticket->uuid)) {
                $ticket->uuid = (string) Str::uuid();
            }
            if (empty($ticket->number)) {
                $ticket->number = self::generateTicketNumber($ticket->tenant_id);
            }
        });

        static::saved(function (self $ticket) {
            Cache::forget("ticket:{$ticket->id}:detail");
            Cache::forget("tenant:{$ticket->tenant_id}:ticket_list:cache");
        });

        static::deleted(function (self $ticket) {
            Cache::forget("ticket:{$ticket->id}:detail");
        });
    }

    public static function generateTicketNumber(int $tenantId): string
    {
        $date = now()->format('Ymd');
        $key = "tenant:{$tenantId}:ticket_counter:{$date}";
        $counter = app('redis')->incr($key);
        if ($counter === 1) {
            app('redis')->expire($key, 86400);
        }
        return "TK{$date}" . str_pad($counter, 6, '0', STR_PAD_LEFT);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(TicketGroup::class, 'group_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TicketCategory::class, 'category_id');
    }

    public function subcategory(): BelongsTo
    {
        return $this->belongsTo(TicketCategory::class, 'subcategory_id');
    }

    public function slaPolicy(): BelongsTo
    {
        return $this->belongsTo(SLAPolicy::class, 'sla_policy_id');
    }

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    public function currentState(): BelongsTo
    {
        return $this->belongsTo(WorkflowState::class, 'current_state_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TicketComment::class)->orderBy('created_at');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(TicketHistory::class)->orderBy('created_at');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TicketAttachment::class);
    }

    public function slaTimers(): HasMany
    {
        return $this->hasMany(SLATimer::class);
    }

    public function slaViolations(): HasMany
    {
        return $this->hasMany(SLAViolation::class);
    }

    public function pendingApprovals(): HasMany
    {
        return $this->hasMany(WorkflowApproval::class)->where('status', WorkflowApproval::STATUS_PENDING);
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    public function scopeOverdue(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES)
            ->whereNotNull('due_at')
            ->where('due_at', '<', now());
    }

    public function scopeByPriority(Builder $query): Builder
    {
        return $query->orderByRaw('FIELD(priority, 4, 3, 2, 1)');
    }

    public function scopeCreatedBetween(Builder $query, string $start, string $end): Builder
    {
        return $query->whereBetween('created_at', [$start, $end]);
    }

    public function scopeResolvedBetween(Builder $query, string $start, string $end): Builder
    {
        return $query->whereBetween('resolved_at', [$start, $end]);
    }

    public function getIsOverdueAttribute(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES)
            && $this->due_at
            && $this->due_at->isPast();
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES);
    }

    public function isClosed(): bool
    {
        return $this->status === self::STATUS_CLOSED;
    }

    public function isResolved(): bool
    {
        return $this->status === self::STATUS_RESOLVED;
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function addComment(array $data): TicketComment
    {
        $comment = $this->comments()->create($data);
        $this->increment('comment_count');
        if (empty($this->first_response_at) && $comment->type === 'reply' && !$this->requester()->is($comment->user)) {
            $this->update(['first_response_at' => now()]);
        }
        return $comment;
    }

    public function addHistory(string $action, ?string $oldValue = null, ?string $newValue = null, ?array $metadata = null): TicketHistory
    {
        return $this->histories()->create([
            'tenant_id' => $this->tenant_id,
            'user_id' => $metadata['user_id'] ?? auth()->id(),
            'action' => $action,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'metadata' => $metadata,
        ]);
    }

    public function assignTo(?int $assigneeId = null, ?int $groupId = null): void
    {
        $changes = [];
        $oldAssignee = $this->assignee_id;
        $oldGroup = $this->group_id;

        if ($assigneeId !== null && $assigneeId !== $this->assignee_id) {
            $this->assignee_id = $assigneeId;
            $this->last_assigned_at = now();
            $changes['assignee_id'] = [$oldAssignee, $assigneeId];
        }
        if ($groupId !== null && $groupId !== $this->group_id) {
            $this->group_id = $groupId;
            $changes['group_id'] = [$oldGroup, $groupId];
        }
        if ($changes) {
            $this->save();
            $this->addHistory('assign', json_encode([
                'assignee_id' => $oldAssignee,
                'group_id' => $oldGroup,
            ]), json_encode([
                'assignee_id' => $this->assignee_id,
                'group_id' => $this->group_id,
            ]));
        }
    }
}
