<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Evaluation extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'schedule_id',
        'teaching_score',
        'attitude_score',
        'content_score',
        'overall_score',
        'comment',
        'is_anonymous',
        'submitted_at',
    ];

    protected $casts = [
        'student_id' => 'integer',
        'schedule_id' => 'integer',
        'teaching_score' => 'integer',
        'attitude_score' => 'integer',
        'content_score' => 'integer',
        'overall_score' => 'float',
        'is_anonymous' => 'boolean',
        'submitted_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function schedule()
    {
        return $this->belongsTo(Schedule::class);
    }
}
