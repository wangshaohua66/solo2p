<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentStatusChange extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'type',
        'from_major_id',
        'to_major_id',
        'reason',
        'status',
        'approved_by',
        'approved_at',
        'effective_date',
        'refund_amount',
        'notes',
    ];

    protected $casts = [
        'student_id' => 'integer',
        'from_major_id' => 'integer',
        'to_major_id' => 'integer',
        'approved_at' => 'datetime',
        'effective_date' => 'date',
        'refund_amount' => 'float',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function fromMajor()
    {
        return $this->belongsTo(Major::class, 'from_major_id');
    }

    public function toMajor()
    {
        return $this->belongsTo(Major::class, 'to_major_id');
    }
}
