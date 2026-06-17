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
        'tenant_id', 'rule_id', 'trigger_type', 'ticket_id', 'user_id',
        'conditions_met', 'actions_executed', 'actions_failed', 'success', 'error',
    ];

    protected $casts = [
        'conditions_met' => 'boolean',
        'actions_executed' => 'array',
        'actions_failed' => 'array',
        'success' => 'boolean',
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomationRule::class);
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(
        AutomationRule $rule,
        string $triggerType,
        bool $conditionsMet,
        ?int $ticketId = null,
        ?int $userId = null,
        array $actionsExecuted = [],
        array $actionsFailed = [],
        ?string $error = null
    ): self {
        return self::create([
            'tenant_id' => $rule->tenant_id,
            'rule_id' => $rule->id,
            'trigger_type' => $triggerType,
            'ticket_id' => $ticketId,
            'user_id' => $userId,
            'conditions_met' => $conditionsMet,
            'actions_executed' => $actionsExecuted,
            'actions_failed' => $actionsFailed,
            'success' => $conditionsMet && empty($actionsFailed) && empty($error),
            'error' => $error,
        ]);
    }
}
