<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Enrollment extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'schedule_id',
        'status',
        'enrolled_at',
        'dropped_at',
    ];

    protected $casts = [
        'student_id' => 'integer',
        'schedule_id' => 'integer',
        'enrolled_at' => 'datetime',
        'dropped_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function schedule()
    {
        return $this->belongsTo(Schedule::class);
    }

    public function grades()
    {
        return $this->hasMany(Grade::class);
    }

    public function studentGrade()
    {
        return $this->hasOne(StudentGrade::class);
    }
}
