<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CertificateTransfer extends Model
{
    const UPDATED_AT = null;

    const TYPE_ISSUE = 'issue';
    const TYPE_TRADE = 'trade';
    const TYPE_TRANSFER = 'transfer';
    const TYPE_FREEZE = 'freeze';
    const TYPE_UNFREEZE = 'unfreeze';

    protected $fillable = [
        'transfer_no',
        'from_user_id',
        'to_user_id',
        'energy_type',
        'quantity',
        'transfer_type',
        'related_id',
        'related_type',
        'remark',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'created_at' => 'datetime',
    ];

    public function fromUser()
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toUser()
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function scopeOfUser($query, $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('from_user_id', $userId)
                ->orWhere('to_user_id', $userId);
        });
    }

    public function scopeOfType($query, $type)
    {
        return $query->where('transfer_type', $type);
    }

    public function scopeOfEnergyType($query, $type)
    {
        return $query->where('energy_type', $type);
    }
}
