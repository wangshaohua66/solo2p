<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Exam extends Model
{
    use HasFactory;

    protected $fillable = [
        'schedule_id',
        'exam_type',
        'exam_date',
        'start_time',
        'end_time',
        'classroom_id',
        'status',
        'notes',
    ];

    protected $casts = [
        'schedule_id' => 'integer',
        'classroom_id' => 'integer',
        'exam_date' => 'date',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
    ];

    public function schedule()
    {
        return $this->belongsTo(Schedule::class);
    }

    public function classroom()
    {
        return $this->belongsTo(Classroom::class);
    }

    public function examProctors()
    {
        return $this->hasMany(ExamProctor::class);
    }
}
