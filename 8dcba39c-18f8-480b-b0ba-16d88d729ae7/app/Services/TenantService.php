<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\TenantQuota;
use App\Models\User;
use App\Models\Role;
use App\Models\Permission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class TenantService
{
    public function createTenant(array $data): Tenant
    {
        return DB::transaction(function () use ($data) {
            $tenant = Tenant::create([
                'uuid' => (string) Str::uuid(),
                'name' => $data['name'],
                'subdomain' => $this->generateSubdomain($data['name'], $data['subdomain'] ?? null),
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'industry' => $data['industry'] ?? null,
                'company_size' => $data['company_size'] ?? null,
                'timezone' => $data['timezone'] ?? 'Asia/Shanghai',
                'language' => $data['language'] ?? 'zh-CN',
                'billing_plan' => $data['billing_plan'] ?? Tenant::PLAN_STARTER,
                'trial_ends_at' => now()->addDays(14),
                'settings' => $this->getDefaultSettings(),
                'status' => Tenant::STATUS_ACTIVE,
            ]);

            $this->initializeTenantResources($tenant, $data);

            return $tenant->fresh();
        });
    }

    protected function generateSubdomain(string $name, ?string $preferred = null): string
    {
        if ($preferred && !Tenant::where('subdomain', $preferred)->exists()) {
            return $preferred;
        }
        $base = Str::slug($name, '-');
        $base = preg_replace('/[^a-z0-9-]/', '', strtolower($base));
        if (empty($base)) {
            $base = Str::random(8);
        }
        $candidate = $base;
        $counter = 1;
        while (Tenant::where('subdomain', $candidate)->exists()) {
            $candidate = $base . '-' . $counter++;
        }
        return $candidate;
    }

    protected function getDefaultSettings(): array
    {
        return [
            'ticket' => [
                'auto_assign' => true,
                'auto_close_hours' => 72,
                'default_priority' => 2,
                'allow_reopen' => true,
                'reopen_window_days' => 30,
                'number_prefix' => 'TK',
            ],
            'notification' => [
                'enabled' => true,
                'default_channels' => ['email', 'in_app'],
            ],
            'sla' => [
                'enabled' => true,
                'pause_on_pending' => true,
            ],
            'appearance' => [
                'primary_color' => '#4F46E5',
                'logo_url' => null,
            ],
            'security' => [
                'password_min_length' => 8,
                'require_2fa' => false,
                'session_timeout_minutes' => 60,
            ],
        ];
    }

    protected function initializeTenantResources(Tenant $tenant, array $data): void
    {
        $this->createOwnerUser($tenant, $data);
        $this->createDefaultRoles($tenant);
        $this->createDefaultWorkflow($tenant);
        $this->createDefaultSLAPolicy($tenant);
        $this->createDefaultCategories($tenant);
        $this->createDefaultGroups($tenant);
        $this->createDefaultNotificationTemplates($tenant);
    }

    protected function createOwnerUser(Tenant $tenant, array $data): void
    {
        $user = User::create([
            'tenant_id' => $tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => $data['owner_name'] ?? $data['name'],
            'email' => $data['owner_email'] ?? $data['email'],
            'password' => Hash::make($data['owner_password'] ?? Str::random(16)),
            'type' => User::TYPE_OWNER,
            'status' => User::STATUS_ACTIVE,
        ]);

        $tenant->update(['created_by' => $user->id]);
    }

    protected function createDefaultRoles(Tenant $tenant): void
    {
        Permission::seedDefaults();

        $roles = [
            'owner' => ['name' => '超级管理员', 'is_system' => true],
            'admin' => ['name' => '管理员', 'is_system' => true],
            'agent' => ['name' => '客服', 'is_system' => true],
            'supervisor' => ['name' => '主管', 'is_system' => true],
            'customer' => ['name' => '客户', 'is_system' => true],
        ];

        foreach ($roles as $slug => $roleData) {
            Role::create([
                'tenant_id' => $tenant->id,
                'slug' => $slug,
                'name' => $roleData['name'],
                'is_system' => $roleData['is_system'],
            ]);
        }

        $owner = Role::where('tenant_id', $tenant->id)->where('slug', 'owner')->first();
        if ($owner) {
            $ownerUser = User::where('tenant_id', $tenant->id)->where('type', User::TYPE_OWNER)->first();
            if ($ownerUser) {
                $owner->users()->syncWithoutDetaching([$ownerUser->id => ['tenant_id' => $tenant->id]]);
            }
            $permissions = Permission::pluck('id');
            $owner->permissions()->syncWithoutDetaching($permissions);
        }

        $agentPermissions = [
            'tickets.view', 'tickets.create', 'tickets.update', 'tickets.assign',
            'tickets.status', 'tickets.priority',
        ];
        $agentRole = Role::where('tenant_id', $tenant->id)->where('slug', 'agent')->first();
        if ($agentRole) {
            foreach ($agentPermissions as $perm) {
                $agentRole->givePermissionTo($perm);
            }
        }
    }

    protected function createDefaultWorkflow(Tenant $tenant): void
    {
        app('workflow.engine')->createDefaultWorkflow($tenant->id);
    }

    protected function createDefaultSLAPolicy(Tenant $tenant): void
    {
        app('sla.monitor')->createDefaultPolicy($tenant->id);
    }

    protected function createDefaultCategories(Tenant $tenant): void
    {
        $categories = [
            ['name' => '技术支持', 'slug' => 'technical-support'],
            ['name' => '账户问题', 'slug' => 'account-issues'],
            ['name' => '账单咨询', 'slug' => 'billing'],
            ['name' => '功能建议', 'slug' => 'feature-request'],
            ['name' => '投诉建议', 'slug' => 'complaint'],
            ['name' => '其他', 'slug' => 'other'],
        ];

        foreach ($categories as $i => $cat) {
            \App\Models\TicketCategory::create([
                'tenant_id' => $tenant->id,
                'name' => $cat['name'],
                'slug' => $cat['slug'],
                'sort_order' => $i,
                'status' => 1,
            ]);
        }
    }

    protected function createDefaultGroups(Tenant $tenant): void
    {
        $groups = [
            ['name' => '一线客服组', 'escalation_email' => 'support@example.com'],
            ['name' => '技术支持组', 'escalation_email' => 'tech@example.com'],
            ['name' => '客服主管组', 'escalation_email' => 'supervisor@example.com'],
        ];

        foreach ($groups as $i => $group) {
            \App\Models\TicketGroup::create([
                'tenant_id' => $tenant->id,
                'name' => $group['name'],
                'escalation_email' => $group['escalation_email'],
                'sort_order' => $i,
                'status' => 1,
            ]);
        }
    }

    protected function createDefaultNotificationTemplates(Tenant $tenant): void
    {
        app('notification.service')->createDefaultTemplates($tenant->id);
    }

    public function checkQuota(int $tenantId, string $resource, int $amount = 1): bool
    {
        return TenantQuota::checkAndRecord($tenantId, $resource, $amount);
    }

    public function getUsageReport(int $tenantId): array
    {
        $tenant = Tenant::findOrFail($tenantId);
        $limits = $tenant->getQuotaLimits();
        $report = [];

        foreach ($limits as $resource => $limit) {
            $usage = TenantQuota::getUsage($tenantId, $resource);
            $report[$resource] = [
                'limit' => $limit,
                'used' => $usage?->usage_current ?? 0,
                'percent' => $usage?->getUsagePercent() ?? 0,
                'remaining' => max(0, $limit - ($usage?->usage_current ?? 0)),
                'exceeded' => $usage?->isExceeded() ?? false,
                'near_limit' => $usage?->isNearLimit() ?? false,
            ];
        }

        return $report;
    }

    public function suspendTenant(int $tenantId, string $reason = ''): Tenant
    {
        $tenant = Tenant::findOrFail($tenantId);
        $tenant->update([
            'status' => Tenant::STATUS_SUSPENDED,
            'settings' => array_merge($tenant->settings ?? [], [
                'suspension_reason' => $reason,
                'suspended_at' => now()->toIso8601String(),
            ]),
        ]);

        User::where('tenant_id', $tenantId)->update(['status' => User::STATUS_INACTIVE]);

        return $tenant;
    }

    public function activateTenant(int $tenantId): Tenant
    {
        $tenant = Tenant::findOrFail($tenantId);
        $tenant->update(['status' => Tenant::STATUS_ACTIVE]);
        return $tenant;
    }

    public function updateBillingPlan(int $tenantId, string $plan, ?array $settings = null): Tenant
    {
        $tenant = Tenant::findOrFail($tenantId);
        $tenant->update([
            'billing_plan' => $plan,
            'settings' => $settings ?? $tenant->settings,
        ]);
        return $tenant;
    }

    public function getTenantStats(int $tenantId, string $startDate, string $endDate): array
    {
        $tenant = Tenant::findOrFail($tenantId);

        return app('report.service')->getTenantOverview($tenantId, $startDate, $endDate) + [
            'quota_usage' => $this->getUsageReport($tenantId),
            'members_count' => User::where('tenant_id', $tenantId)->count(),
            'agents_count' => User::where('tenant_id', $tenantId)
                ->whereIn('type', [User::TYPE_OWNER, User::TYPE_AGENT])
                ->count(),
            'customers_count' => User::where('tenant_id', $tenantId)
                ->where('type', User::TYPE_CUSTOMER)
                ->count(),
        ];
    }
}
