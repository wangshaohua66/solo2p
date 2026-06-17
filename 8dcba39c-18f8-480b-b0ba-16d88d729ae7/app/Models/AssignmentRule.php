<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentRule extends Model
{
    use HasFactory, BelongsToTenant;

    public const TYPE_AGENT = 'agent';
    public const TYPE_GROUP = 'group';
    public const TYPE_ROUND_ROBIN = 'round_robin';
    public const TYPE_SKILL_BASED = 'skill_based';
    public const TYPE_LEAST_LOADED = 'least_loaded';

    protected $fillable = [
        'tenant_id', 'name', 'description', 'conditions', 'assignment_type',
        'assigned_user_id', 'assigned_group_id', 'user_ids', 'group_ids',
        'reassign_if_unavailable', 'max_tickets_per_agent', 'priority', 'status',
    ];

    protected $casts = [
        'conditions' => 'array',
        'user_ids' => 'array',
        'group_ids' => 'array',
        'reassign_if_unavailable' => 'boolean',
    ];

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function assignedGroup(): BelongsTo
    {
        return $this->belongsTo(TicketGroup::class, 'assigned_group_id');
    }

    public function isActive(): bool
    {
        return $this->status === 1;
    }

    public function matches(array $ticketData): bool
    {
        if (empty($this->conditions)) {
            return true;
        }
        return app('workflow.condition_evaluator')
            ->evaluate($this->conditions, $ticketData);
    }

    public function execute(array $ticketData): array
    {
        $result = ['user_id' => null, 'group_id' => null];

        switch ($this->assignment_type) {
            case self::TYPE_AGENT:
                $result['user_id'] = $this->assigned_user_id;
                if ($this->assigned_group_id) {
                    $result['group_id'] = $this->assigned_group_id;
                }
                break;

            case self::TYPE_GROUP:
                $result['group_id'] = $this->assigned_group_id;
                break;

            case self::TYPE_ROUND_ROBIN:
                $result = $this->roundRobinAssign();
                break;

            case self::TYPE_LEAST_LOADED:
                $result = $this->leastLoadedAssign();
                break;

            case self::TYPE_SKILL_BASED:
                $result = $this->skillBasedAssign($ticketData);
                break;
        }

        return $result;
    }

    protected function roundRobinAssign(): array
    {
        $userIds = $this->user_ids ?? [];
        if (empty($userIds)) {
            return ['user_id' => null, 'group_id' => $this->assigned_group_id];
        }
        $key = "assignment_rule:{$this->id}:round_robin_index";
        $index = app('redis')->incr($key) % count($userIds);
        return ['user_id' => $userIds[$index], 'group_id' => $this->assigned_group_id];
    }

    protected function leastLoadedAssign(): array
    {
        $query = User::whereIn('type', [User::TYPE_OWNER, User::TYPE_AGENT])
            ->where('status', User::STATUS_ACTIVE);

        if (!empty($this->user_ids)) {
            $query->whereIn('id', $this->user_ids);
        } elseif ($this->assigned_group_id) {
            $query->whereHas('groups', fn ($q) => $q->where('id', $this->assigned_group_id));
        }

        $userId = $query->withCount(['assigneeTickets' => function ($q) {
            $q->whereIn('status', Ticket::ACTIVE_STATUSES);
        }])
            ->orderByRaw("CASE WHEN is_online THEN 0 ELSE 1 END")
            ->orderBy('assignee_tickets_count')
            ->when($this->max_tickets_per_agent, function ($q) {
                $q->having('assignee_tickets_count', '<', $this->max_tickets_per_agent);
            })
            ->value('id');

        return ['user_id' => $userId, 'group_id' => $this->assigned_group_id];
    }

    protected function skillBasedAssign(array $ticketData): array
    {
        $categoryId = $ticketData['category_id'] ?? null;
        $userId = null;

        if ($categoryId && !empty($this->user_ids)) {
            $userSkillsKey = "user_skills:";
            $bestMatch = null;
            $bestScore = -1;

            foreach ($this->user_ids as $uid) {
                $skills = json_decode(app('redis')->get($userSkillsKey . $uid) ?: '[]', true);
                $score = in_array($categoryId, $skills) ? 100 : 0;
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestMatch = $uid;
                }
            }
            $userId = $bestMatch;
        }

        if (!$userId && !empty($this->user_ids)) {
            $userId = $this->user_ids[0];
        }

        return ['user_id' => $userId, 'group_id' => $this->assigned_group_id];
    }
}
