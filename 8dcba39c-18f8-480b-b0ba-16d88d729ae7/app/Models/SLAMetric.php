<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class SLAMetric extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'sla_policy_id', 'metric_date', 'metric_type',
        'total_count', 'on_time_count', 'breach_count', 'total_minutes',
        'total_tickets',
        'first_response_met', 'first_response_violated',
        'resolution_met', 'resolution_violated',
        'avg_first_response_minutes', 'avg_resolution_minutes', 'avg_wait_time_minutes',
        'fcr_rate', 'sla_compliance_rate',
    ];

    protected $casts = [
        'metric_date' => 'date',
        'metric_type' => 'string',
    ];

    public function policy(): BelongsTo
    {
        return $this->belongsTo(SLAPolicy::class, 'sla_policy_id');
    }

    public function getSlaCompliancePercentage(): float
    {
        return (float) $this->sla_compliance_rate;
    }

    public function getFcrPercentage(): float
    {
        return (float) $this->fcr_rate;
    }

    public function getFirstResponseMetRate(): float
    {
        $total = $this->first_response_met + $this->first_response_violated;
        if ($total === 0) {
            return 100.0;
        }
        return round(($this->first_response_met / $total) * 100, 2);
    }

    public function getResolutionMetRate(): float
    {
        $total = $this->resolution_met + $this->resolution_violated;
        if ($total === 0) {
            return 100.0;
        }
        return round(($this->resolution_met / $total) * 100, 2);
    }

    public static function aggregateForTimer(SLATimer $timer, int $day): self
    {
        $metricDate = substr_replace(substr_replace((string) $day, '-', 4, 0), '-', 7, 0);
        $metricType = $timer->timer_type;
        $isOnTime = !$timer->isBreached();
        $elapsedMinutes = (int) ceil($timer->calculateElapsedSeconds() / 60);

        return self::updateOrCreate(
            [
                'tenant_id' => $timer->tenant_id,
                'metric_date' => $metricDate,
                'sla_policy_id' => $timer->sla_policy_id,
                'metric_type' => $metricType,
            ],
            [
                'total_count' => DB::raw('total_count + 1'),
                'on_time_count' => DB::raw('on_time_count + ' . ($isOnTime ? 1 : 0)),
                'breach_count' => DB::raw('breach_count + ' . ($isOnTime ? 0 : 1)),
                'total_minutes' => DB::raw('total_minutes + ' . $elapsedMinutes),
                'total_tickets' => DB::raw('total_tickets + 1'),
            ]
        );
    }
}
