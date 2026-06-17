<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantQuota extends Model
{
    use HasFactory, BelongsToTenant;

    public const RESOURCE_TICKETS = 'tickets_per_month';
    public const RESOURCE_AGENTS = 'agents';
    public const RESOURCE_STORAGE = 'storage_gb';
    public const RESOURCE_API_CALLS = 'api_calls_per_minute';
    public const RESOURCE_WORKFLOWS = 'workflows';
    public const RESOURCE_SLA_POLICIES = 'sla_policies';
    public const RESOURCE_AUTOMATION_RULES = 'automation_rules';
    public const RESOURCE_EMAILS = 'emails_monthly';
    public const RESOURCE_SMS = 'sms_monthly';

    protected $fillable = [
        'tenant_id', 'resource', 'quota_limit', 'usage_current', 'usage_date',
    ];

    protected $casts = [
        'usage_date' => 'date',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function getUsagePercent(): float
    {
        if ($this->quota_limit <= 0) {
            return 100.0;
        }
        return round(($this->usage_current / $this->quota_limit) * 100, 2);
    }

    public function isExceeded(): bool
    {
        return $this->usage_current > $this->quota_limit;
    }

    public function isNearLimit(float $threshold = 0.9): bool
    {
        return $this->getUsagePercent() >= $threshold * 100;
    }

    public function incrementUsage(int $amount = 1): bool
    {
        $newUsage = $this->usage_current + $amount;
        $exceeded = $newUsage > $this->quota_limit;

        $this->forceFill(['usage_current' => $newUsage])->save();

        return !$exceeded;
    }

    public static function recordUsage(int $tenantId, string $resource, int $amount, int $limit): self
    {
        $date = now()->format('Y-m-d');

        return self::updateOrCreate(
            ['tenant_id' => $tenantId, 'resource' => $resource, 'usage_date' => $date],
            [
                'quota_limit' => $limit,
            ]
        )->tap(function (self $quota) use ($amount) {
            $quota->incrementUsage($amount);
        });
    }

    public static function getUsage(int $tenantId, string $resource): ?self
    {
        $date = now()->format('Y-m-d');

        return self::where('tenant_id', $tenantId)
            ->where('resource', $resource)
            ->where('usage_date', $date)
            ->first();
    }

    public static function checkAndRecord(int $tenantId, string $resource, int $amount = 1): bool
    {
        $tenant = Tenant::find($tenantId);
        if (!$tenant) {
            return false;
        }
        $limits = $tenant->getQuotaLimits();
        $limit = $limits[$resource] ?? PHP_INT_MAX;

        if ($limit === 0) {
            return false;
        }

        $usage = self::recordUsage($tenantId, $resource, $amount, $limit);
        return !$usage->isExceeded();
    }
}
