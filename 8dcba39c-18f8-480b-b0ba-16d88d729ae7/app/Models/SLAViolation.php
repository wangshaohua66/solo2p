<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SLAViolation extends Model
{
    use HasFactory, BelongsToTenant;

    public const LEVEL_MILD = 1;
    public const LEVEL_SEVERE = 2;
    public const LEVEL_CRITICAL = 3;

    protected $fillable = [
        'tenant_id', 'ticket_id', 'timer_id', 'sla_policy_id', 'violation_type',
        'violated_at', 'breach_seconds', 'escalation_level',
        'notified', 'notified_at', 'notified_users',
        'level', 'type', 'policy_id', 'breached_at',
        'target_minutes', 'actual_minutes', 'acknowledged',
    ];

    protected $casts = [
        'violated_at' => 'datetime',
        'breached_at' => 'datetime',
        'notified_at' => 'datetime',
        'notified_users' => 'array',
        'notified' => 'boolean',
        'acknowledged' => 'boolean',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function timer(): BelongsTo
    {
        return $this->belongsTo(SLATimer::class);
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(SLAPolicy::class, 'sla_policy_id');
    }

    public function getLevelName(): string
    {
        return match ((int) $this->level) {
            self::LEVEL_MILD => '轻微',
            self::LEVEL_SEVERE => '严重',
            self::LEVEL_CRITICAL => '危急',
            default => '未知',
        };
    }

    public function getBreachMinutes(): int
    {
        return (int) ceil($this->breach_seconds / 60);
    }

    public function markNotified(array $userIds = []): void
    {
        $this->forceFill([
            'notified' => true,
            'notified_at' => now(),
            'notified_users' => $userIds,
        ])->save();
    }

    public function escalateIfNeeded(): ?int
    {
        $policy = $this->policy;
        if (!$policy) {
            return null;
        }
        $levels = $policy->getEscalationLevels($this->getBreachMinutes());
        if (count($levels) > $this->escalation_level) {
            $newLevel = $this->escalation_level + 1;
            $this->forceFill([
                'escalation_level' => $newLevel,
                'notified' => false,
            ])->save();
            return $newLevel;
        }
        return null;
    }
}
