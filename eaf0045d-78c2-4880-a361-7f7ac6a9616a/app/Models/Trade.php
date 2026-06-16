<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Trade extends Model
{
    const STATUS_PENDING = 'pending';
    const STATUS_PERFORMING = 'performing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_BREACHED = 'breached';

    protected $fillable = [
        'trade_no',
        'listing_id',
        'seller_id',
        'buyer_id',
        'energy_type',
        'quantity',
        'unit_price',
        'total_amount',
        'status',
        'matched_at',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'matched_at' => 'datetime',
    ];

    public function listing()
    {
        return $this->belongsTo(Listing::class);
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function buyer()
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function contract()
    {
        return $this->hasOne(Contract::class);
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

    public function scopeOfEnergyType($query, $type)
    {
        return $query->where('energy_type', $type);
    }

    public function scopeOfStatus($query, $status)
    {
        return $query->where('status', $status);
    }
}
