<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TicketGroup extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'description', 'leader_id',
        'escalation_email', 'sort_order', 'status',
    ];

    public function leader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'leader_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'group_members', 'group_id', 'user_id')
            ->withTimestamps();
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    public function openTickets(): HasMany
    {
        return $this->tickets()->whereIn('status', Ticket::ACTIVE_STATUSES);
    }

    public function getLoad(): int
    {
        return $this->openTickets()->count();
    }

    public function getLeastLoadedMember(): ?User
    {
        return $this->members()
            ->withCount(['assigneeTickets' => function ($q) {
                $q->whereIn('status', Ticket::ACTIVE_STATUSES);
            }])
            ->orderBy('assignee_tickets_count')
            ->first();
    }
}
