<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportStat extends Model
{
    use HasFactory, BelongsToTenant;

    public const TYPE_DAILY = 'daily';
    public const TYPE_HOURLY = 'hourly';
    public const TYPE_AGENT = 'agent';
    public const TYPE_GROUP = 'group';
    public const TYPE_CATEGORY = 'category';
    public const TYPE_SOURCE = 'source';
    public const TYPE_PRIORITY = 'priority';

    protected $fillable = [
        'tenant_id', 'user_id', 'group_id', 'category_id',
        'stat_type', 'stat_date', 'stat_hour',
        'tickets_created', 'tickets_updated', 'tickets_resolved',
        'tickets_closed', 'tickets_reopened', 'tickets_deleted',
        'tickets_open', 'tickets_in_progress', 'tickets_pending', 'tickets_overdue',
        'replies_sent', 'notes_added', 'comments_total',
        'avg_first_response_minutes', 'avg_response_minutes',
        'avg_resolution_minutes', 'avg_wait_time_minutes',
        'avg_touches', 'avg_reopens',
        'sla_breached_first_response', 'sla_breached_resolution',
        'sla_compliance_rate', 'fcr_rate',
        'avg_satisfaction_score', 'satisfaction_responses',
        'satisfaction_positive', 'satisfaction_negative',
        'breakdown_data',
        'first_response_total_seconds', 'response_total_seconds',
        'resolution_total_seconds', 'satisfaction_score_sum', 'fcr_count',
    ];

    protected $casts = [
        'stat_date' => 'date',
        'breakdown_data' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(TicketGroup::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TicketCategory::class);
    }

    public function calculateAverages(): void
    {
        if ($this->tickets_created > 0 && $this->first_response_total_seconds > 0) {
            $withFr = $this->tickets_created - ($this->tickets_open ?? 0);
            if ($withFr > 0) {
                $this->avg_first_response_minutes = round(($this->first_response_total_seconds / 60) / $withFr, 2);
            }
        }
        if ($this->tickets_resolved > 0 && $this->resolution_total_seconds > 0) {
            $this->avg_resolution_minutes = round(($this->resolution_total_seconds / 60) / $this->tickets_resolved, 2);
        }
        if ($this->satisfaction_responses > 0 && $this->satisfaction_score_sum > 0) {
            $this->avg_satisfaction_score = round($this->satisfaction_score_sum / $this->satisfaction_responses, 1);
        }
        if ($this->tickets_resolved > 0) {
            $this->fcr_rate = round(($this->fcr_count / $this->tickets_resolved) * 100, 2);
        }
        $totalSla = $this->sla_breached_first_response + $this->tickets_created;
        if ($totalSla > 0) {
            $this->sla_compliance_rate = round((($this->tickets_created - $this->sla_breached_first_response) / $totalSla) * 100, 2);
        }
    }
}
