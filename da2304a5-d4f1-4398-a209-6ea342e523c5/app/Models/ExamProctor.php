<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExamProctor extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_id',
        'teacher_id',
        'role',
    ];

    protected $casts = [
        'exam_id' => 'integer',
        'teacher_id' => 'integer',
    ];

    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }
}
