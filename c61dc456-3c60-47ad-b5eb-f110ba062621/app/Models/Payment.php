<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class Payment extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id',
        'booking_id',
        'payment_no',
        'payment_method',
        'amount',
        'refund_amount',
        'status',
        'transaction_id',
        'paid_at',
        'callback_data',
        'refunded_at',
        'refund_reason',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'refund_amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'refunded_at' => 'datetime',
    ];

    const STATUS_PENDING = 'pending';
    const STATUS_PAID = 'paid';
    const STATUS_FAILED = 'failed';
    const STATUS_REFUNDED = 'refunded';
    const STATUS_REFUNDING = 'refunding';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function generatePaymentNo(): string
    {
        return 'PAY' . date('YmdHis') . str_pad($this->id ?? 0, 6, '0', STR_PAD_LEFT) . rand(1000, 9999);
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    public function markPaid(string $transactionId, ?string $callbackData = null): void
    {
        $this->update([
            'status' => self::STATUS_PAID,
            'transaction_id' => $transactionId,
            'paid_at' => Carbon::now(),
            'callback_data' => $callbackData,
        ]);
    }

    public function markRefunded(float $amount, string $reason): void
    {
        $this->update([
            'status' => self::STATUS_REFUNDED,
            'refund_amount' => $amount,
            'refund_reason' => $reason,
            'refunded_at' => Carbon::now(),
        ]);
    }
}
