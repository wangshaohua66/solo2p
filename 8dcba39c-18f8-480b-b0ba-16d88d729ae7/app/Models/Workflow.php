<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

class Workflow extends Model
{
    use HasFactory, SoftDeletes, BelongsToTenant;

    public const TRIGGER_MANUAL = 'manual';
    public const TRIGGER_AUTO = 'auto';
    public const TRIGGER_CONDITION = 'condition';

    protected $fillable = [
        'tenant_id', 'name', 'description', 'trigger_type', 'trigger_conditions',
        'entity_type', 'initial_state_id', 'is_default', 'status', 'sort_order',
    ];

    protected $casts = [
        'trigger_conditions' => 'array',
        'is_default' => 'boolean',
    ];

    public function states(): HasMany
    {
        return $this->hasMany(WorkflowState::class)->orderBy('sort_order');
    }

    public function transitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class)->orderBy('sort_order');
    }

    public function initialState()
    {
        return $this->belongsTo(WorkflowState::class, 'initial_state_id');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    public function getStateMachine(): array
    {
        return Cache::remember("workflow:{$this->id}:state_machine", 600, function () {
            $states = $this->states->keyBy('id');
            $transitions = $this->transitions->groupBy('from_state_id');
            return [
                'states' => $states->toArray(),
                'transitions' => $transitions->toArray(),
                'initial_state' => $this->initial_state_id,
            ];
        });
    }

    public function getInitialState(): ?WorkflowState
    {
        if ($this->initial_state_id) {
            return $this->states->find($this->initial_state_id);
        }
        return $this->states()->where('is_initial', true)->first();
    }

    public function getTransitionsFrom(int $stateId): \Illuminate\Database\Eloquent\Collection
    {
        return $this->transitions()->where('from_state_id', $stateId)->get();
    }

    public function getTransition(int $fromStateId, int $toStateId): ?WorkflowTransition
    {
        return $this->transitions()
            ->where('from_state_id', $fromStateId)
            ->where('to_state_id', $toStateId)
            ->first();
    }

    public function isActive(): bool
    {
        return $this->status === 1;
    }

    public function matchesTrigger(array $data): bool
    {
        if ($this->trigger_type === self::TRIGGER_MANUAL) {
            return false;
        }
        if (empty($this->trigger_conditions)) {
            return true;
        }
        return app('workflow.condition_evaluator')
            ->evaluate($this->trigger_conditions, $data);
    }
}
