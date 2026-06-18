<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Grade extends Model
{
    use HasFactory;

    protected $fillable = [
        'enrollment_id',
        'component_id',
        'score',
        'is_absent',
        'graded_by',
        'graded_at',
    ];

    protected $casts = [
        'enrollment_id' => 'integer',
        'component_id' => 'integer',
        'score' => 'float',
        'is_absent' => 'boolean',
        'graded_by' => 'integer',
        'graded_at' => 'datetime',
    ];

    public function enrollment()
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function component()
    {
        return $this->belongsTo(GradeComponent::class);
    }

    public function grader()
    {
        return $this->belongsTo(Teacher::class, 'graded_by');
    }
}
