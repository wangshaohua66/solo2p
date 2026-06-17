<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

class SLAPolicy extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'description', 'conditions',
        'first_response_minutes', 'response_minutes', 'resolution_minutes',
        'target_fcr_percent', 'target_resolution_percent',
        'business_hours', 'apply_holidays', 'escalation_rules',
        'use_business_hours', 'is_default',
        'pause_on_pending', 'pending_statuses', 'status', 'priority',
    ];

    protected $casts = [
        'conditions' => 'array',
        'business_hours' => 'array',
        'escalation_rules' => 'array',
        'apply_holidays' => 'boolean',
        'pause_on_pending' => 'boolean',
        'use_business_hours' => 'boolean',
        'is_default' => 'boolean',
    ];

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    public function timers(): HasMany
    {
        return $this->hasMany(SLATimer::class);
    }

    public function violations(): HasMany
    {
        return $this->hasMany(SLAViolation::class);
    }

    public function metrics(): HasMany
    {
        return $this->hasMany(SLAMetric::class);
    }

    public function isActive(): bool
    {
        return $this->status === 1;
    }

    public function matches(array $ticketData): bool
    {
        if (empty($this->conditions)) {
            return true;
        }
        return app('workflow.condition_evaluator')
            ->evaluate($this->conditions, $ticketData);
    }

    public function calculateTargetTime(string $type, \DateTimeInterface $startTime): \DateTimeInterface
    {
        $minutes = match ($type) {
            'first_response' => $this->first_response_minutes,
            'response' => $this->response_minutes,
            'resolution' => $this->resolution_minutes,
            default => 0,
        };

        if (!$minutes) {
            return (clone $startTime)->modify('+100 years');
        }

        return $this->calculateBusinessTime(clone $startTime, $minutes);
    }

    protected function calculateBusinessTime(\DateTimeInterface $start, int $totalMinutes): \DateTimeInterface
    {
        if (empty($this->business_hours)) {
            return (clone $start)->modify("+{$totalMinutes} minutes");
        }

        $schedule = $this->business_hours;
        $holidays = $this->apply_holidays ? [] : [];
        $timezone = new \DateTimeZone($schedule['timezone'] ?? 'Asia/Shanghai');
        $current = (clone $start)->setTimezone($timezone);
        $remaining = $totalMinutes;

        while ($remaining > 0) {
            $dayOfWeek = strtolower($current->format('l'));
            $dateStr = $current->format('Y-m-d');

            if (isset($schedule[$dayOfWeek]) && !in_array($dateStr, $holidays)) {
                $hours = $schedule[$dayOfWeek];
                $workStart = \DateTime::createFromFormat('H:i', $hours['start'], $timezone);
                $workEnd = \DateTime::createFromFormat('H:i', $hours['end'], $timezone);

                $dayStart = (clone $current)->setTime(
                    (int)$workStart->format('H'),
                    (int)$workStart->format('i'),
                    0
                );
                $dayEnd = (clone $current)->setTime(
                    (int)$workEnd->format('H'),
                    (int)$workEnd->format('i'),
                    0
                );

                $effectiveStart = max($current, $dayStart);

                if ($effectiveStart < $dayEnd) {
                    $availableMinutes = ($dayEnd->getTimestamp() - $effectiveStart->getTimestamp()) / 60;
                    if ($remaining <= $availableMinutes) {
                        $current = (clone $effectiveStart)->modify("+{$remaining} minutes");
                        $remaining = 0;
                    } else {
                        $remaining -= $availableMinutes;
                        $current = $dayStart->modify('+1 day');
                    }
                } else {
                    $current = $dayStart->modify('+1 day');
                }
            } else {
                $current = (clone $current)->modify('+1 day')->setTime(0, 0, 0);
            }
        }

        return $current->setTimezone($start->getTimezone());
    }

    public function shouldPauseForStatus(string $status): bool
    {
        if (!$this->pause_on_pending) {
            return false;
        }
        $pendingStatuses = explode(',', $this->pending_statuses ?? 'pending,on_hold');
        return in_array($status, $pendingStatuses, true);
    }

    public function getEscalationLevels(int $breachMinutes): array
    {
        if (empty($this->escalation_rules)) {
            return [];
        }
        $levels = [];
        foreach ($this->escalation_rules as $rule) {
            if ($breachMinutes >= ($rule['breach_minutes'] ?? 0)) {
                $levels[] = $rule;
            }
        }
        return $levels;
    }

    public static function findBestMatch(Ticket $ticket, ?int $tenantId = null, ?array $ticketData = null): ?self
    {
        $tenantId = $tenantId ?? $ticket->tenant_id;
        $ticketData = $ticketData ?? $ticket->toArray();

        return Cache::remember("tenant:{$tenantId}:sla_policies", 600, function () use ($tenantId) {
            return self::forTenant($tenantId)
                ->where('status', 1)
                ->orderByDesc('priority')
                ->orderBy('id')
                ->get();
        })->first(function (self $policy) use ($ticketData) {
            return $policy->matches($ticketData);
        });
    }
}
