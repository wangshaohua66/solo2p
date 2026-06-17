<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketTag extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'color', 'usage_count',
    ];

    protected $casts = [
        'usage_count' => 'integer',
    ];

    public function incrementUsage(int $count = 1): void
    {
        $this->increment('usage_count', $count);
    }

    public function decrementUsage(int $count = 1): void
    {
        $this->decrement('usage_count', $count);
        if ($this->usage_count < 0) {
            $this->forceFill(['usage_count' => 0])->save();
        }
    }
}
