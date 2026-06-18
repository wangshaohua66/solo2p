<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Teacher extends Model
{
    use HasFactory;

    protected $fillable = [
        'college_id',
        'name',
        'employee_no',
        'gender',
        'title',
        'phone',
        'email',
        'status',
    ];

    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function teacherCoursePreferences()
    {
        return $this->hasMany(TeacherCoursePreference::class);
    }

    public function examProctors()
    {
        return $this->hasMany(ExamProctor::class);
    }

    public function grades()
    {
        return $this->hasMany(Grade::class, 'graded_by');
    }
}
