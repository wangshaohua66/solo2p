<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GradeComponent extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'name',
        'weight',
        'sort_order',
    ];

    protected $casts = [
        'course_id' => 'integer',
        'weight' => 'float',
        'sort_order' => 'integer',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function grades()
    {
        return $this->hasMany(Grade::class);
    }
}
