<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Listing extends Model
{
    use SoftDeletes;

    const STATUS_ACTIVE = 'active';
    const STATUS_PARTIAL = 'partial';
    const STATUS_DONE = 'done';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_EXPIRED = 'expired';

    protected $fillable = [
        'listing_no',
        'seller_id',
        'energy_type',
        'total_quantity',
        'available_quantity',
        'traded_quantity',
        'unit_price',
        'status',
        'expires_at',
        'remark',
    ];

    protected $casts = [
        'total_quantity' => 'integer',
        'available_quantity' => 'integer',
        'traded_quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'expires_at' => 'datetime',
    ];

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function trades()
    {
        return $this->hasMany(Trade::class);
    }

    public function scopeOfSeller($query, $sellerId)
    {
        return $query->where('seller_id', $sellerId);
    }

    public function scopeOfEnergyType($query, $type)
    {
        return $query->where('energy_type', $type);
    }

    public function scopeOfStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', [self::STATUS_ACTIVE, self::STATUS_PARTIAL])
            ->where(function ($q) {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            });
    }

    public function scopeOrderByPriceTime($query)
    {
        return $query->orderBy('unit_price', 'asc')
            ->orderBy('created_at', 'asc');
    }

    public function isActive(): bool
    {
        return in_array($this->status, [self::STATUS_ACTIVE, self::STATUS_PARTIAL])
            && ($this->expires_at === null || $this->expires_at > now());
    }

    public function canCancel(): bool
    {
        return in_array($this->status, [self::STATUS_ACTIVE, self::STATUS_PARTIAL]);
    }
}
