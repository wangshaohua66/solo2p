<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationLog extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'rule_id', 'trigger_type', 'event',
        'entity_type', 'entity_id', 'triggered',
        'actions_executed', 'actions_total',
        'execution_ms', 'errors',
    ];

    protected $casts = [
        'triggered' => 'boolean',
        'actions_executed' => 'integer',
        'actions_total' => 'integer',
        'execution_ms' => 'integer',
        'errors' => 'array',
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomationRule::class, 'rule_id');
    }

    public function isTriggered(): bool
    {
        return (bool) $this->triggered;
    }
}
