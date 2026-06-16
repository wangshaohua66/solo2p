<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Contract extends Model
{
    const STATUS_SIGNED = 'signed';
    const STATUS_PERFORMING = 'performing';
    const STATUS_DELIVERED = 'delivered';
    const STATUS_COMPLETED = 'completed';
    const STATUS_BREACHED = 'breached';
    const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'contract_no',
        'trade_id',
        'seller_id',
        'buyer_id',
        'energy_type',
        'quantity',
        'unit_price',
        'total_amount',
        'delivery_deadline',
        'status',
        'signed_at',
        'delivery_at',
        'completed_at',
        'reminder_3d_sent',
        'reminder_1d_sent',
        'breach_reason',
        'remark',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'delivery_deadline' => 'date',
        'signed_at' => 'datetime',
        'delivery_at' => 'datetime',
        'completed_at' => 'datetime',
        'reminder_3d_sent' => 'boolean',
        'reminder_1d_sent' => 'boolean',
    ];

    public function trade()
    {
        return $this->belongsTo(Trade::class);
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function buyer()
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function settlements()
    {
        return $this->hasMany(Settlement::class);
    }

    public function scopeOfBuyer($query, $buyerId)
    {
        return $query->where('buyer_id', $buyerId);
    }

    public function scopeOfSeller($query, $sellerId)
    {
        return $query->where('seller_id', $sellerId);
    }

    public function scopeOfUser($query, $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('buyer_id', $userId)
                ->orWhere('seller_id', $userId);
        });
    }

    public function scopeOfStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopePendingDelivery($query)
    {
        return $query->whereIn('status', [self::STATUS_SIGNED, self::STATUS_PERFORMING]);
    }

    public function scopeExpiringInDays($query, $days)
    {
        return $query->where('delivery_deadline', '=', now()->addDays($days)->toDateString());
    }

    public function scopeOverdue($query)
    {
        return $query->whereIn('status', [self::STATUS_SIGNED, self::STATUS_PERFORMING])
            ->where('delivery_deadline', '<', today());
    }

    public function isOverdue(): bool
    {
        return in_array($this->status, [self::STATUS_SIGNED, self::STATUS_PERFORMING])
            && $this->delivery_deadline < today();
    }

    public function canDeliver(): bool
    {
        return in_array($this->status, [self::STATUS_SIGNED, self::STATUS_PERFORMING]);
    }
}
