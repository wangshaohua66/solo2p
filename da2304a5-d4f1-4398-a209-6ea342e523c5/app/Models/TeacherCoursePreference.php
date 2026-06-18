<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TeacherCoursePreference extends Model
{
    use HasFactory;

    protected $fillable = [
        'teacher_id',
        'course_id',
        'semester',
        'preferred_day',
        'preferred_period',
        'preferred_classroom_type',
        'priority',
    ];

    protected $casts = [
        'teacher_id' => 'integer',
        'course_id' => 'integer',
        'preferred_day' => 'integer',
        'preferred_period' => 'integer',
        'priority' => 'integer',
    ];

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }
}
