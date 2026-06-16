<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Certificate extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'certificate_no',
        'station_id',
        'owner_id',
        'issue_month',
        'quantity',
        'generation_kwh',
        'energy_type',
        'province',
        'issuer_id',
        'remark',
        'issued_at',
    ];

    protected $casts = [
        'generation_kwh' => 'decimal:2',
        'issued_at' => 'datetime',
    ];

    public function station()
    {
        return $this->belongsTo(PowerStation::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function issuer()
    {
        return $this->belongsTo(User::class, 'issuer_id');
    }

    public function scopeOfOwner($query, $ownerId)
    {
        return $query->where('owner_id', $ownerId);
    }

    public function scopeOfEnergyType($query, $type)
    {
        return $query->where('energy_type', $type);
    }

    public function scopeOfIssueMonth($query, $month)
    {
        return $query->where('issue_month', $month);
    }

    public function scopeOfProvince($query, $province)
    {
        return $query->where('province', $province);
    }
}
