<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
        'college_id',
        'major_id',
        'code',
        'name',
        'credits',
        'hours',
        'type',
        'category',
        'description',
        'status',
    ];

    protected $casts = [
        'college_id' => 'integer',
        'major_id' => 'integer',
        'credits' => 'float',
        'hours' => 'integer',
        'status' => 'integer',
    ];

    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function major()
    {
        return $this->belongsTo(Major::class);
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function gradeComponents()
    {
        return $this->hasMany(GradeComponent::class);
    }

    public function teacherCoursePreferences()
    {
        return $this->hasMany(TeacherCoursePreference::class);
    }
}
