<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class TimeSlot extends Model
{
    use HasFactory;
    protected $fillable = [
        'venue_id',
        'date',
        'start_time',
        'end_time',
        'total_courts',
        'booked_courts',
        'price',
        'is_peak',
        'is_active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_peak' => 'boolean',
        'is_active' => 'boolean',
        'date' => 'date',
    ];

    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class)->where('status', '!=', 'cancelled');
    }

    public function getAvailableCourtsAttribute(): int
    {
        return $this->total_courts - $this->booked_courts;
    }

    public function isAvailable(): bool
    {
        return $this->is_active
            && $this->available_courts > 0
            && $this->getStartTimeCarbon()->isFuture();
    }

    public function isExpired(): bool
    {
        return $this->getStartTimeCarbon()->isPast();
    }

    public function getStartTimeCarbon(): Carbon
    {
        $dateStr = $this->date instanceof \DateTimeInterface
            ? $this->date->format('Y-m-d')
            : (string) $this->date;

        return Carbon::parse($dateStr . ' ' . $this->start_time);
    }
}
