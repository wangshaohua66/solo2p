<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AutomationRule extends Model
{
    use HasFactory, BelongsToTenant;

    public const TRIGGER_EVENT = 'event';
    public const TRIGGER_SCHEDULE = 'schedule';
    public const TRIGGER_CONDITION = 'condition';

    protected $fillable = [
        'tenant_id', 'name', 'description', 'trigger_type',
        'schedule_cron', 'trigger_conditions', 'trigger_config',
        'conditions', 'actions',
        'stop_on_error', 'stop_on_match', 'priority', 'status',
        'last_run_at', 'last_triggered_at', 'trigger_count',
    ];

    protected $casts = [
        'trigger_config' => 'array',
        'trigger_conditions' => 'array',
        'conditions' => 'array',
        'actions' => 'array',
        'stop_on_error' => 'boolean',
        'stop_on_match' => 'boolean',
        'last_run_at' => 'datetime',
        'last_triggered_at' => 'datetime',
    ];

    public function logs(): HasMany
    {
        return $this->hasMany(AutomationLog::class, 'rule_id');
    }

    public function isActive(): bool
    {
        return $this->status === 1;
    }

    public function shouldTriggerForEvent(string $event): bool
    {
        if ($this->trigger_type !== self::TRIGGER_EVENT) {
            return false;
        }
        $eventName = $this->trigger_conditions['event'] ?? ($this->trigger_config['event'] ?? null);
        return $eventName === $event || $eventName === '*';
    }

    public function shouldTriggerOnSchedule(\DateTimeInterface $time): bool
    {
        if ($this->trigger_type !== self::TRIGGER_SCHEDULE) {
            return false;
        }
        $cron = $this->schedule_cron ?? ($this->trigger_config['cron'] ?? null);
        if (!$cron) {
            return true;
        }
        return app('cron.expression')->isDue($cron, $time);
    }

    public function evaluateConditions(array $context): bool
    {
        if (empty($this->conditions)) {
            return true;
        }
        return app('workflow.condition_evaluator')
            ->evaluate($this->conditions, $context);
    }

    public function getActions(): array
    {
        return $this->actions ?? [];
    }

    public function recordTrigger(): void
    {
        $this->forceFill([
            'trigger_count' => $this->trigger_count + 1,
            'last_triggered_at' => now(),
        ])->save();
    }

    public static function findByEventType(int $tenantId, string $eventType): \Illuminate\Database\Eloquent\Collection
    {
        return self::forTenant($tenantId)
            ->where('status', 1)
            ->where('trigger_type', self::TRIGGER_EVENT)
            ->where(function ($q) use ($eventType) {
                $q->whereJsonContains('trigger_conditions->event', $eventType)
                    ->orWhereJsonContains('trigger_conditions->event', '*')
                    ->orWhereJsonContains('trigger_config->event', $eventType)
                    ->orWhereJsonContains('trigger_config->event', '*');
            })
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();
    }
}
