<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Classroom extends Model
{
    use HasFactory;

    protected $fillable = [
        'building',
        'room_number',
        'capacity',
        'type',
        'status',
    ];

    protected $casts = [
        'capacity' => 'integer',
        'status' => 'integer',
    ];

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function exams()
    {
        return $this->hasMany(Exam::class);
    }

    public function classroomOccupancies()
    {
        return $this->hasMany(ClassroomOccupancy::class);
    }
}
