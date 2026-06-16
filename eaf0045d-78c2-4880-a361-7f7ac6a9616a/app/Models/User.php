<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    const ROLE_GENERATOR = 'generator';
    const ROLE_PURCHASER = 'purchaser';
    const ROLE_EXCHANGE = 'exchange';
    const ROLE_REGULATOR = 'regulator';

    protected $fillable = [
        'username',
        'name',
        'email',
        'password',
        'phone',
        'company_name',
        'role',
        'credit_score',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function isGenerator(): bool
    {
        return $this->role === self::ROLE_GENERATOR;
    }

    public function isPurchaser(): bool
    {
        return $this->role === self::ROLE_PURCHASER;
    }

    public function isExchange(): bool
    {
        return $this->role === self::ROLE_EXCHANGE;
    }

    public function isRegulator(): bool
    {
        return $this->role === self::ROLE_REGULATOR;
    }

    public function powerStations()
    {
        return $this->hasMany(PowerStation::class, 'owner_id');
    }

    public function certificateBalances()
    {
        return $this->hasMany(CertificateBalance::class);
    }

    public function soldListings()
    {
        return $this->hasMany(Listing::class, 'seller_id');
    }

    public function boughtTrades()
    {
        return $this->hasMany(Trade::class, 'buyer_id');
    }

    public function soldTrades()
    {
        return $this->hasMany(Trade::class, 'seller_id');
    }

    public function boughtContracts()
    {
        return $this->hasMany(Contract::class, 'buyer_id');
    }

    public function soldContracts()
    {
        return $this->hasMany(Contract::class, 'seller_id');
    }

    public function creditScoreLogs()
    {
        return $this->hasMany(CreditScoreLog::class);
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }
}
