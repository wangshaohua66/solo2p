<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Passport\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Carbon\Carbon;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'phone',
        'password',
        'real_name',
        'id_card',
        'is_verified',
        'credit_score',
        'is_blacklisted',
        'blacklist_until',
        'violation_count',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'id_card',
    ];

    protected $casts = [
        'is_verified' => 'boolean',
        'is_blacklisted' => 'boolean',
        'blacklist_until' => 'datetime',
    ];

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function creditRecords(): HasMany
    {
        return $this->hasMany(CreditRecord::class);
    }

    public function isBlacklisted(): bool
    {
        if (!$this->is_blacklisted) {
            return false;
        }
        if ($this->blacklist_until && $this->blacklist_until->isPast()) {
            $this->update([
                'is_blacklisted' => false,
                'blacklist_until' => null,
            ]);
            return false;
        }
        return true;
    }

    public function canBook(): bool
    {
        if (!$this->is_verified) {
            return false;
        }
        if ($this->isBlacklisted()) {
            return false;
        }
        if ($this->credit_score < 60) {
            return false;
        }
        return true;
    }

    public function addCreditScore(int $points, string $reason, ?Booking $booking = null): void
    {
        $before = $this->credit_score;
        $newScore = min(120, $this->credit_score + $points);

        $this->creditRecords()->create([
            'booking_id' => $booking?->id,
            'type' => 'reward',
            'score_change' => $points,
            'balance_before' => $before,
            'balance_after' => $newScore,
            'reason' => $reason,
            'is_violation' => false,
        ]);

        $this->update(['credit_score' => $newScore]);
    }

    public function deductCreditScore(int $points, string $reason, ?Booking $booking = null, bool $severe = false): void
    {
        $before = $this->credit_score;
        $newScore = max(0, $this->credit_score - $points);
        $violationCount = $this->violation_count + 1;

        $triggerBlacklist = false;
        $blacklistDays = 0;

        if ($severe || $violationCount >= 3 || $newScore < 60) {
            $triggerBlacklist = true;
            $blacklistDays = $severe ? 30 : 7;
        }

        $this->creditRecords()->create([
            'booking_id' => $booking?->id,
            'type' => 'penalty',
            'score_change' => -$points,
            'balance_before' => $before,
            'balance_after' => $newScore,
            'reason' => $reason,
            'is_violation' => true,
            'is_blacklist_trigger' => $triggerBlacklist,
        ]);

        $updateData = [
            'credit_score' => $newScore,
            'violation_count' => $violationCount,
        ];

        if ($triggerBlacklist) {
            $updateData['is_blacklisted'] = true;
            $updateData['blacklist_until'] = Carbon::now()->addDays($blacklistDays);
        }

        $this->update($updateData);
    }

    public function getDiscountRate(): float
    {
        if ($this->credit_score >= 120) {
            return 0.9;
        }
        return 1.0;
    }
}
