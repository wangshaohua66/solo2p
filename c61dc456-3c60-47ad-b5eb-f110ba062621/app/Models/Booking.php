<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class Booking extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id',
        'venue_id',
        'court_id',
        'time_slot_id',
        'booking_date',
        'start_time',
        'end_time',
        'booking_no',
        'amount',
        'paid_amount',
        'status',
        'is_checked_in',
        'check_in_time',
        'is_violation',
        'violation_reason',
        'expires_at',
        'cancel_reason',
        'cancelled_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'is_checked_in' => 'boolean',
        'is_violation' => 'boolean',
        'expires_at' => 'datetime',
        'check_in_time' => 'datetime',
        'cancelled_at' => 'datetime',
        'booking_date' => 'date',
    ];

    const STATUS_PENDING = 'pending';
    const STATUS_PAID = 'paid';
    const STATUS_CHECKED_IN = 'checked_in';
    const STATUS_COMPLETED = 'completed';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_EXPIRED = 'expired';
    const STATUS_VIOLATION = 'violation';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }

    public function court(): BelongsTo
    {
        return $this->belongsTo(Court::class);
    }

    public function timeSlot(): BelongsTo
    {
        return $this->belongsTo(TimeSlot::class);
    }

    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function creditRecord(): HasOne
    {
        return $this->hasOne(CreditRecord::class);
    }

    public function isExpired(): bool
    {
        return $this->status === self::STATUS_PENDING
            && $this->expires_at->isPast();
    }

    public function canCancel(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_PAID])
            && !$this->is_checked_in
            && Carbon::parse($this->getBookingDateStr() . ' ' . $this->start_time)->isFuture();
    }

    public function getRefundRate(): float
    {
        $startTime = Carbon::parse($this->getBookingDateStr() . ' ' . $this->start_time);
        $hoursDiff = Carbon::now()->diffInHours($startTime, false);

        if ($hoursDiff >= 24) {
            return 1.0;
        } elseif ($hoursDiff >= 2) {
            return 0.5;
        }
        return 0.0;
    }

    public function getRefundAmount(): float
    {
        return (float)$this->paid_amount * $this->getRefundRate();
    }

    public function isLateCheckIn(): bool
    {
        $startTime = Carbon::parse($this->getBookingDateStr() . ' ' . $this->start_time);
        return Carbon::now()->gt($startTime->addMinutes(30));
    }

    public function getBookingDateStr(): string
    {
        return $this->booking_date instanceof \DateTimeInterface
            ? $this->booking_date->format('Y-m-d')
            : (string) $this->booking_date;
    }

    public static function generateBookingNo(): string
    {
        return 'BK' . date('YmdHis') . str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT) . random_int(1000, 9999);
    }
}
