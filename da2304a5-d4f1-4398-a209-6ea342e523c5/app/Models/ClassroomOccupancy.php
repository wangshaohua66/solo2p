<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClassroomOccupancy extends Model
{
    use HasFactory;

    protected $fillable = [
        'classroom_id',
        'semester',
        'day_of_week',
        'start_period',
        'end_period',
        'occupant_type',
        'occupant_id',
        'weeks',
    ];

    protected $casts = [
        'classroom_id' => 'integer',
        'day_of_week' => 'integer',
        'start_period' => 'integer',
        'end_period' => 'integer',
    ];

    public function classroom()
    {
        return $this->belongsTo(Classroom::class);
    }

    public function occupant()
    {
        return $this->morphTo();
    }
}
