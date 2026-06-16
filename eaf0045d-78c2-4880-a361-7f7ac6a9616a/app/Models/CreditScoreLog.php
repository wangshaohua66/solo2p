<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CreditScoreLog extends Model
{
    protected $fillable = [
        'user_id',
        'score_before',
        'score_change',
        'score_after',
        'reason',
        'related_type',
        'related_id',
        'operator_id',
    ];

    protected $casts = [
        'score_before' => 'integer',
        'score_change' => 'integer',
        'score_after' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function operator()
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    public function scopeOfUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }
}
