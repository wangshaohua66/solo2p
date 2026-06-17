<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SLAMetric extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'sla_policy_id', 'metric_date',
        'total_tickets',
        'first_response_met', 'first_response_violated',
        'resolution_met', 'resolution_violated',
        'avg_first_response_minutes', 'avg_resolution_minutes', 'avg_wait_time_minutes',
        'fcr_rate', 'sla_compliance_rate',
    ];

    protected $casts = [
        'metric_date' => 'date',
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

    public static function aggregateForDay(int $tenantId, string $date): self
    {
        $start = "{$date} 00:00:00";
        $end = "{$date} 23:59:59";

        $query = Ticket::forTenant($tenantId)
            ->whereBetween('created_at', [$start, $end]);

        $stats = clone $query;
        $totalTickets = $stats->count();

        $violationQuery = SLAViolation::forTenant($tenantId)
            ->whereBetween('violated_at', [$start, $end]);

        $firstResponseViolated = (clone $violationQuery)
            ->where('violation_type', SLATimer::TYPE_FIRST_RESPONSE)
            ->count();

        $resolutionViolated = (clone $violationQuery)
            ->where('violation_type', SLATimer::TYPE_RESOLUTION)
            ->count();

        $resolvedQuery = Ticket::forTenant($tenantId)
            ->whereBetween('resolved_at', [$start, $end]);

        $resolvedCount = (clone $resolvedQuery)->count();

        $avgFirstResponse = (clone $query)
            ->whereNotNull('first_response_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(MINUTE, created_at, first_response_at)) as avg_fr')
            ->value('avg_fr') ?: 0;

        $avgResolution = $resolvedCount > 0
            ? (clone $resolvedQuery)
                ->selectRaw('AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at)) as avg_res')
                ->value('avg_res') ?: 0
            : 0;

        $fcrCount = (clone $resolvedQuery)
            ->where('reopen_count', 0)
            ->where('comment_count', '<=', 2)
            ->count();

        $firstResponseMet = max(0, $totalTickets - $firstResponseViolated);
        $resolutionMet = max(0, $resolvedCount - $resolutionViolated);

        $totalWithSla = $firstResponseMet + $firstResponseViolated;
        $slaCompliance = $totalWithSla > 0
            ? round(($firstResponseMet / $totalWithSla) * 100, 2)
            : 100;

        $fcrRate = $resolvedCount > 0
            ? round(($fcrCount / $resolvedCount) * 100, 2)
            : 0;

        return self::updateOrCreate(
            ['tenant_id' => $tenantId, 'metric_date' => $date, 'sla_policy_id' => null],
            [
                'total_tickets' => $totalTickets,
                'first_response_met' => $firstResponseMet,
                'first_response_violated' => $firstResponseViolated,
                'resolution_met' => $resolutionMet,
                'resolution_violated' => $resolutionViolated,
                'avg_first_response_minutes' => round($avgFirstResponse, 2),
                'avg_resolution_minutes' => round($avgResolution, 2),
                'fcr_rate' => $fcrRate,
                'sla_compliance_rate' => $slaCompliance,
            ]
        );
    }
}
