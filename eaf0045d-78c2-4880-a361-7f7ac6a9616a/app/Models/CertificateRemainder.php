<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CertificateRemainder extends Model
{
    protected $fillable = [
        'station_id',
        'report_month',
        'remainder_kwh',
        'original_generation_kwh',
        'total_kwh',
        'issued_quantity',
    ];

    protected $casts = [
        'remainder_kwh' => 'decimal:2',
        'original_generation_kwh' => 'decimal:2',
        'total_kwh' => 'decimal:2',
        'issued_quantity' => 'integer',
    ];

    public function station()
    {
        return $this->belongsTo(PowerStation::class);
    }

    public function scopeOfStation($query, int $stationId)
    {
        return $query->where('station_id', $stationId);
    }

    public function scopeOfMonth($query, string $month)
    {
        return $query->where('report_month', $month);
    }

    public static function getPreviousMonthRemainder(int $stationId, string $currentMonth): float
    {
        $prevMonth = date('Y-m', strtotime($currentMonth . ' -1 month'));

        $record = self::where('station_id', $stationId)
            ->where('report_month', $prevMonth)
            ->first();

        return $record?->remainder_kwh ?? 0;
    }
}
