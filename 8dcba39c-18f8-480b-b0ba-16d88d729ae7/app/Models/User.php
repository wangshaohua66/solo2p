<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Cache;
use Laravel\Passport\HasApiTokens;

/**
 * @OA\Schema(
 *     schema="User",
 *     type="object",
 *     required={"name", "email"},
 *     @OA\Property(property="id", type="integer"),
 *     @OA\Property(property="tenant_id", type="integer"),
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="email", type="string"),
 *     @OA\Property(property="type", type="integer"),
 *     @OA\Property(property="status", type="integer"),
 *     @OA\Property(property="job_title", type="string"),
 *     @OA\Property(property="department", type="string"),
 *     @OA\Property(property="is_online", type="boolean"),
 *     @OA\Property(property="created_at", type="string", format="datetime")
 * )
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, BelongsToTenant;

    public const TYPE_OWNER = 1;
    public const TYPE_AGENT = 2;
    public const TYPE_CUSTOMER = 3;

    public const STATUS_ACTIVE = 1;
    public const STATUS_INACTIVE = 2;
    public const STATUS_BANNED = 3;

    protected $fillable = [
        'tenant_id', 'uuid', 'name', 'email', 'email_verified_at', 'password',
        'phone', 'avatar', 'job_title', 'department', 'type', 'status',
        'is_active', 'is_online', 'timezone', 'language', 'last_active_at',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_active_at' => 'datetime',
        'is_online' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user', 'user_id', 'role_id')
            ->withPivot('tenant_id')
            ->withTimestamps();
    }

    public function requesterTickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'requester_id');
    }

    public function assigneeTickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'assignee_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TicketComment::class);
    }

    public function notificationSubscriptions(): HasMany
    {
        return $this->hasMany(NotificationSubscription::class);
    }

    public function isOwner(): bool
    {
        return $this->type === self::TYPE_OWNER;
    }

    public function isAgent(): bool
    {
        return $this->type === self::TYPE_AGENT || $this->type === self::TYPE_OWNER;
    }

    public function isCustomer(): bool
    {
        return $this->type === self::TYPE_CUSTOMER;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function hasRole(string $roleSlug): bool
    {
        return Cache::remember("user:{$this->id}:roles", 1800, function () use ($roleSlug) {
            return $this->roles()->where('slug', $roleSlug)->exists();
        });
    }

    public function hasPermission(string $permissionSlug): bool
    {
        if ($this->isOwner()) {
            return true;
        }
        return Cache::remember("user:{$this->id}:permissions", 1800, function () use ($permissionSlug) {
            return $this->roles()->whereHas('permissions', function ($q) use ($permissionSlug) {
                $q->where('slug', $permissionSlug);
            })->exists();
        });
    }

    public function getPermissionSlugs(): array
    {
        return Cache::remember("user:{$this->id}:permission_slugs", 1800, function () {
            return $this->roles()
                ->with('permissions:slug')
                ->get()
                ->flatMap(fn ($r) => $r->permissions->pluck('slug'))
                ->unique()
                ->values()
                ->toArray();
        });
    }
}
