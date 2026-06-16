<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Settlement extends Model
{
    const STATUS_PENDING = 'pending';
    const STATUS_SETTLED = 'settled';

    const TYPE_INCOME = 'income';
    const TYPE_EXPENDITURE = 'expenditure';

    protected $fillable = [
        'settlement_no',
        'contract_id',
        'user_id',
        'settlement_type',
        'energy_type',
        'certificate_quantity',
        'unit_price',
        'trade_amount',
        'service_fee',
        'net_amount',
        'status',
        'settlement_date',
        'settlement_month',
        'remark',
    ];

    protected $casts = [
        'certificate_quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'trade_amount' => 'decimal:2',
        'service_fee' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'settlement_date' => 'date',
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeOfUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeOfMonth($query, $month)
    {
        return $query->where('settlement_month', $month);
    }

    public function scopeOfStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeOfType($query, $type)
    {
        return $query->where('settlement_type', $type);
    }
}
