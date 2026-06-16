<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PowerStation extends Model
{
    use SoftDeletes;

    const ENERGY_SOLAR = 'solar';
    const ENERGY_WIND = 'wind';

    const STATUS_ACTIVE = 'active';
    const STATUS_SUSPENDED = 'suspended';

    protected $fillable = [
        'station_code',
        'station_name',
        'energy_type',
        'installed_capacity',
        'province',
        'city',
        'address',
        'latitude',
        'longitude',
        'owner_id',
        'status',
        'grid_connection_date',
        'remark',
    ];

    protected $casts = [
        'installed_capacity' => 'decimal:2',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'grid_connection_date' => 'date',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function meterReadings()
    {
        return $this->hasMany(MeterReading::class);
    }

    public function certificates()
    {
        return $this->hasMany(Certificate::class);
    }

    public function scopeOfEnergyType($query, $type)
    {
        return $query->where('energy_type', $type);
    }

    public function scopeOfProvince($query, $province)
    {
        return $query->where('province', $province);
    }

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function getTheoreticalMonthlyMaxKwh(): float
    {
        $hours = match($this->energy_type) {
            self::ENERGY_SOLAR => 120,
            self::ENERGY_WIND => 200,
            default => 150,
        };

        return $this->installed_capacity * $hours;
    }
}
