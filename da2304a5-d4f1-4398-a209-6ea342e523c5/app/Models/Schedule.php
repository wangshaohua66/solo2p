<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'teacher_id',
        'classroom_id',
        'semester',
        'day_of_week',
        'start_period',
        'end_period',
        'weeks',
        'is_locked',
        'status',
    ];

    protected $casts = [
        'course_id' => 'integer',
        'teacher_id' => 'integer',
        'classroom_id' => 'integer',
        'day_of_week' => 'integer',
        'start_period' => 'integer',
        'end_period' => 'integer',
        'is_locked' => 'boolean',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function classroom()
    {
        return $this->belongsTo(Classroom::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }

    public function exams()
    {
        return $this->hasMany(Exam::class);
    }

    public function evaluations()
    {
        return $this->hasMany(Evaluation::class);
    }

    public function classroomOccupancies()
    {
        return $this->hasMany(ClassroomOccupancy::class);
    }
}
