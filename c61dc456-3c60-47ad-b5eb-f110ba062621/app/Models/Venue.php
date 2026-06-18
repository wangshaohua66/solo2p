<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Venue extends Model
{
    use HasFactory;
    protected $fillable = [
        'name',
        'type',
        'description',
        'address',
        'contact_phone',
        'open_time',
        'close_time',
        'slot_duration',
        'base_price',
        'peak_price',
        'peak_hours',
        'advance_booking_days',
        'daily_booking_limit',
        'is_active',
    ];

    protected $casts = [
        'base_price' => 'decimal:2',
        'peak_price' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function courts(): HasMany
    {
        return $this->hasMany(Court::class);
    }

    public function timeSlots(): HasMany
    {
        return $this->hasMany(TimeSlot::class);
    }

    public function bookings(): HasManyThrough
    {
        return $this->hasManyThrough(Booking::class, TimeSlot::class);
    }

    public function activeCourts(): HasMany
    {
        return $this->courts()->where('is_active', true);
    }

    public function getPeakHoursArray(): array
    {
        if (empty($this->peak_hours)) {
            return [];
        }
        return json_decode($this->peak_hours, true) ?? [];
    }

    public function isPeakHour(string $time): bool
    {
        $peakHours = $this->getPeakHoursArray();
        foreach ($peakHours as $range) {
            if ($time >= $range['start'] && $time < $range['end']) {
                return true;
            }
        }
        return false;
    }

    public function getPriceForTime(string $time): float
    {
        return $this->isPeakHour($time) ? (float)$this->peak_price : (float)$this->base_price;
    }
}
