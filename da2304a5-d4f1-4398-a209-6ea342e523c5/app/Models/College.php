<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class College extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'dean_name',
        'status',
    ];

    protected $casts = [
        'status' => 'integer',
    ];

    public function majors()
    {
        return $this->hasMany(Major::class);
    }

    public function teachers()
    {
        return $this->hasMany(Teacher::class);
    }

    public function courses()
    {
        return $this->hasMany(Course::class);
    }
}
