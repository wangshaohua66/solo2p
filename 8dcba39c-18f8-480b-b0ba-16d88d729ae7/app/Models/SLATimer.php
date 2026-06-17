<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SLATimer extends Model
{
    use HasFactory, BelongsToTenant;

    public const TYPE_FIRST_RESPONSE = 'first_response';
    public const TYPE_RESPONSE = 'response';
    public const TYPE_RESOLUTION = 'resolution';

    public const STATUS_RUNNING = 1;
    public const STATUS_PAUSED = 2;
    public const STATUS_COMPLETED = 3;
    public const STATUS_BREACHED = 4;

    protected $fillable = [
        'tenant_id', 'ticket_id', 'sla_policy_id', 'timer_type',
        'started_at', 'paused_at', 'resumed_at', 'target_at', 'completed_at',
        'elapsed_seconds', 'paused_seconds', 'breach_percent', 'status',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'paused_at' => 'datetime',
        'resumed_at' => 'datetime',
        'target_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(SLAPolicy::class, 'sla_policy_id');
    }

    public function violations(): HasMany
    {
        return $this->hasMany(SLAViolation::class, 'timer_id');
    }

    public function isRunning(): bool
    {
        return $this->status === self::STATUS_RUNNING;
    }

    public function isPaused(): bool
    {
        return $this->status === self::STATUS_PAUSED;
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function isBreached(): bool
    {
        return $this->status === self::STATUS_BREACHED;
    }

    public function pause(): void
    {
        if (!$this->isRunning()) {
            return;
        }
        $this->forceFill([
            'status' => self::STATUS_PAUSED,
            'paused_at' => now(),
            'elapsed_seconds' => $this->calculateElapsedSeconds(),
        ])->save();
    }

    public function resume(SLAPolicy $policy): void
    {
        if (!$this->isPaused()) {
            return;
        }
        $pausedDuration = $this->paused_at ? now()->diffInSeconds($this->paused_at) : 0;

        $this->forceFill([
            'status' => self::STATUS_RUNNING,
            'resumed_at' => now(),
            'paused_seconds' => $this->paused_seconds + $pausedDuration,
            'target_at' => $policy->calculateTargetTime(
                $this->timer_type,
                now()->subSeconds($this->elapsed_seconds)
            ),
        ])->save();
    }

    public function complete(): void
    {
        $elapsed = $this->calculateElapsedSeconds();
        $targetSeconds = max(1, $this->target_at->getTimestamp() - $this->started_at->getTimestamp());
        $breachPercent = ($elapsed / $targetSeconds) * 100;

        $this->forceFill([
            'status' => $this->target_at->isPast() ? self::STATUS_BREACHED : self::STATUS_COMPLETED,
            'completed_at' => now(),
            'elapsed_seconds' => $elapsed,
            'breach_percent' => min(999.99, round($breachPercent, 2)),
        ])->save();
    }

    public function calculateElapsedSeconds(): int
    {
        if ($this->isCompleted() || $this->isBreached()) {
            return $this->elapsed_seconds;
        }
        $refTime = $this->isPaused() && $this->paused_at ? $this->paused_at : now();
        $baseElapsed = $this->started_at ? $refTime->diffInSeconds($this->started_at) : 0;
        return max(0, $baseElapsed - $this->paused_seconds);
    }

    public function getRemainingSeconds(): int
    {
        return max(0, $this->target_at->getTimestamp() - time() + $this->paused_seconds);
    }

    public function getBreachSeconds(): int
    {
        $elapsed = $this->calculateElapsedSeconds();
        $targetSeconds = $this->target_at->getTimestamp() - $this->started_at->getTimestamp();
        return max(0, $elapsed - $targetSeconds);
    }

    public function markBreached(): SLAViolation
    {
        $this->forceFill(['status' => self::STATUS_BREACHED])->save();

        return SLAViolation::create([
            'tenant_id' => $this->tenant_id,
            'ticket_id' => $this->ticket_id,
            'timer_id' => $this->id,
            'sla_policy_id' => $this->sla_policy_id,
            'violation_type' => $this->timer_type,
            'violated_at' => now(),
            'breach_seconds' => $this->getBreachSeconds(),
            'escalation_level' => 1,
        ]);
    }

    public static function startTimersForTicket(Ticket $ticket, SLAPolicy $policy): void
    {
        $types = [
            self::TYPE_FIRST_RESPONSE => $policy->first_response_minutes,
            self::TYPE_RESPONSE => $policy->response_minutes,
            self::TYPE_RESOLUTION => $policy->resolution_minutes,
        ];

        foreach ($types as $type => $minutes) {
            if ($minutes) {
                self::create([
                    'tenant_id' => $ticket->tenant_id,
                    'ticket_id' => $ticket->id,
                    'sla_policy_id' => $policy->id,
                    'timer_type' => $type,
                    'started_at' => $ticket->created_at,
                    'target_at' => $policy->calculateTargetTime($type, $ticket->created_at),
                    'status' => self::STATUS_RUNNING,
                ]);
            }
        }
    }
}
