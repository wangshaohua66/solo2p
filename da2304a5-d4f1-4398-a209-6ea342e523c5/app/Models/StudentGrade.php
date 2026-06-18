<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentGrade extends Model
{
    use HasFactory;

    protected $fillable = [
        'enrollment_id',
        'total_score',
        'grade_point',
        'letter_grade',
        'is_retake',
    ];

    protected $casts = [
        'enrollment_id' => 'integer',
        'total_score' => 'float',
        'grade_point' => 'float',
        'is_retake' => 'boolean',
    ];

    public function enrollment()
    {
        return $this->belongsTo(Enrollment::class);
    }
}
