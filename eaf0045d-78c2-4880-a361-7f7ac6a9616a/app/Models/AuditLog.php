<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'username',
        'role',
        'action',
        'business_type',
        'business_id',
        'ip_address',
        'user_agent',
        'before_data',
        'after_data',
        'remark',
    ];

    protected $casts = [
        'before_data' => 'json',
        'after_data' => 'json',
    ];

    public function scopeOfUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeOfBusinessType($query, $type)
    {
        return $query->where('business_type', $type);
    }

    public function scopeOfAction($query, $action)
    {
        return $query->where('action', $action);
    }

    public function scopeBetweenDates($query, $startDate, $endDate)
    {
        return $query->whereBetween('created_at', [$startDate, $endDate]);
    }

    public function scopeOfBusiness($query, $type, $id)
    {
        return $query->where('business_type', $type)->where('business_id', $id);
    }
}
