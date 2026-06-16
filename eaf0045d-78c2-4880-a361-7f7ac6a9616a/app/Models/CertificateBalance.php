<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CertificateBalance extends Model
{
    protected $fillable = [
        'user_id',
        'energy_type',
        'available_balance',
        'frozen_balance',
        'total_issued',
        'total_traded',
    ];

    protected $casts = [
        'available_balance' => 'integer',
        'frozen_balance' => 'integer',
        'total_issued' => 'integer',
        'total_traded' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeOfUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeOfEnergyType($query, $type)
    {
        return $query->where('energy_type', $type);
    }

    public function getTotalBalanceAttribute(): int
    {
        return $this->available_balance + $this->frozen_balance;
    }
}
