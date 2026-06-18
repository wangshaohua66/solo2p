<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Student extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'major_id',
        'name',
        'student_no',
        'gender',
        'enrollment_year',
        'class_name',
        'phone',
        'email',
        'status',
    ];

    protected $casts = [
        'major_id' => 'integer',
        'enrollment_year' => 'integer',
    ];

    public function major()
    {
        return $this->belongsTo(Major::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }

    public function evaluations()
    {
        return $this->hasMany(Evaluation::class);
    }

    public function studentStatusChanges()
    {
        return $this->hasMany(StudentStatusChange::class);
    }
}
