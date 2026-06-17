<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

/**
 * @OA\Schema(
 *     schema="Tenant",
 *     type="object",
 *     required={"name", "subdomain", "email"},
 *     @OA\Property(property="id", type="integer"),
 *     @OA\Property(property="uuid", type="string"),
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="subdomain", type="string"),
 *     @OA\Property(property="email", type="string"),
 *     @OA\Property(property="phone", type="string"),
 *     @OA\Property(property="industry", type="string"),
 *     @OA\Property(property="status", type="integer"),
 *     @OA\Property(property="billing_plan", type="string"),
 *     @OA\Property(property="settings", type="object"),
 *     @OA\Property(property="created_at", type="string", format="datetime"),
 *     @OA\Property(property="updated_at", type="string", format="datetime")
 * )
 */
class Tenant extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_ACTIVE = 1;
    public const STATUS_SUSPENDED = 2;
    public const STATUS_CANCELLED = 3;

    public const PLAN_FREE = 'free';
    public const PLAN_STARTER = 'starter';
    public const PLAN_PROFESSIONAL = 'professional';
    public const PLAN_ENTERPRISE = 'enterprise';

    protected $fillable = [
        'uuid', 'name', 'subdomain', 'email', 'phone', 'industry', 'company_size',
        'timezone', 'language', 'status', 'trial_ends_at', 'subscription_ends_at',
        'billing_plan', 'settings', 'created_by',
    ];

    protected $casts = [
        'settings' => 'array',
        'trial_ends_at' => 'datetime',
        'subscription_ends_at' => 'datetime',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    public function slaPolicies(): HasMany
    {
        return $this->hasMany(SLAPolicy::class);
    }

    public function workflows(): HasMany
    {
        return $this->hasMany(Workflow::class);
    }

    public function quotas(): HasMany
    {
        return $this->hasMany(TenantQuota::class);
    }

    public function billingRecords(): HasMany
    {
        return $this->hasMany(BillingRecord::class);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isSuspended(): bool
    {
        return $this->status === self::STATUS_SUSPENDED;
    }

    public function getSetting(string $key, mixed $default = null): mixed
    {
        $settings = $this->settings ?? [];
        return data_get($settings, $key, $default);
    }

    public function getQuotaLimits(): array
    {
        return Cache::remember("tenant:{$this->id}:quota_limits", 3600, function () {
            $planQuotas = config('saas.quotas', []);
            return $planQuotas[$this->billing_plan] ?? $planQuotas['free'] ?? [
                'agents' => 5,
                'tickets_per_month' => 1000,
                'storage_gb' => 1,
                'api_calls_per_minute' => 60,
                'workflows' => 3,
                'sla_policies' => 3,
                'automation_rules' => 10,
                'custom_fields' => 20,
            ];
        });
    }

    public function can(string $resource, int $usage): bool
    {
        $limits = $this->getQuotaLimits();
        $limit = $limits[$resource] ?? 0;
        return $usage <= $limit;
    }
}
