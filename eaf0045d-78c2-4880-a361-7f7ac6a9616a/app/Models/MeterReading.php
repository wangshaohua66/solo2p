<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeterReading extends Model
{
    const STATUS_PENDING = 'pending';
    const STATUS_NORMAL = 'normal';
    const STATUS_ABNORMAL = 'abnormal';
    const STATUS_APPROVED = 'approved';
    const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'station_id',
        'report_month',
        'generation_kwh',
        'theoretical_max_kwh',
        'status',
        'abnormal_reason',
        'reported_by',
        'reviewed_by',
        'reviewed_at',
        'review_remark',
    ];

    protected $casts = [
        'generation_kwh' => 'decimal:2',
        'theoretical_max_kwh' => 'decimal:2',
        'reviewed_at' => 'datetime',
    ];

    public function station()
    {
        return $this->belongsTo(PowerStation::class, 'station_id');
    }

    public function reportedBy()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function reviewedBy()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function scopeOfStation($query, $stationId)
    {
        return $query->where('station_id', $stationId);
    }

    public function scopeOfMonth($query, $month)
    {
        return $query->where('report_month', $month);
    }

    public function scopeOfStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function isAbnormal(): bool
    {
        return $this->status === self::STATUS_ABNORMAL;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }
}
