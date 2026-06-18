<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Major extends Model
{
    use HasFactory;

    protected $fillable = [
        'college_id',
        'name',
        'code',
        'degree_level',
        'duration_years',
    ];

    protected $casts = [
        'college_id' => 'integer',
        'duration_years' => 'integer',
    ];

    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function students()
    {
        return $this->hasMany(Student::class);
    }

    public function courses()
    {
        return $this->hasMany(Course::class);
    }
}
