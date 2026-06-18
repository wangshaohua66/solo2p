<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreditRecord extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id',
        'booking_id',
        'type',
        'score_change',
        'balance_before',
        'balance_after',
        'reason',
        'is_violation',
        'is_blacklist_trigger',
    ];

    protected $casts = [
        'is_violation' => 'boolean',
        'is_blacklist_trigger' => 'boolean',
    ];

    const TYPE_REWARD = 'reward';
    const TYPE_PENALTY = 'penalty';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
