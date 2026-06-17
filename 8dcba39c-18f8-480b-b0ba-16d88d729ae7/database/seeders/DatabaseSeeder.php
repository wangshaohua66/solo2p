<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (Tenant::withoutGlobalScopes()->count() === 0) {
            $this->createDemoTenant();
        }

        $this->call([
            PermissionSeeder::class,
        ]);
    }

    protected function createDemoTenant(): void
    {
        DB::beginTransaction();
        try {
            $tenant = Tenant::withoutGlobalScopes()->create([
                'uuid' => '00000000-0000-0000-0000-000000000001',
                'name' => '示例企业客户',
                'subdomain' => 'demo',
                'email' => 'admin@demo-company.example.com',
                'plan' => 'standard',
                'status' => 'active',
                'is_active' => true,
                'timezone' => 'Asia/Shanghai',
                'language' => 'zh_CN',
                'currency' => 'CNY',
                'industry' => 'e-commerce',
                'employee_count' => 50,
                'billing_email' => 'finance@demo-company.example.com',
                'trial_ends_at' => now()->addDays(14),
                'subscription_ends_at' => now()->addYear(),
                'settings' => [
                    'ticket_prefix' => 'DEMO',
                    'auto_assign' => true,
                    'csat_enabled' => true,
                ],
            ]);

            app()->instance('currentTenantId', $tenant->id);

            $ownerRole = Role::create([
                'tenant_id' => $tenant->id,
                'name' => 'owner',
                'display_name' => 'Owner',
                'description' => 'Full system access',
            ]);

            $adminRole = Role::create([
                'tenant_id' => $tenant->id,
                'name' => 'admin',
                'display_name' => '管理员',
                'description' => '系统管理与用户权限',
            ]);

            $agentRole = Role::create([
                'tenant_id' => $tenant->id,
                'name' => 'agent',
                'display_name' => '客服',
                'description' => '处理日常工单',
            ]);

            $owner = User::create([
                'tenant_id' => $tenant->id,
                'name' => '系统管理员',
                'email' => 'owner@demo-company.example.com',
                'password' => Hash::make('Owner@123456'),
                'email_verified_at' => now(),
                'timezone' => 'Asia/Shanghai',
                'language' => 'zh_CN',
                'is_active' => true,
            ]);
            $owner->roles()->attach($ownerRole->id);

            $admin = User::create([
                'tenant_id' => $tenant->id,
                'name' => '运营管理员',
                'email' => 'admin@demo-company.example.com',
                'password' => Hash::make('Admin@123456'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]);
            $admin->roles()->attach($adminRole->id);

            $agent = User::create([
                'tenant_id' => $tenant->id,
                'name' => '客服小李',
                'email' => 'agent@demo-company.example.com',
                'password' => Hash::make('Agent@123456'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]);
            $agent->roles()->attach($agentRole->id);

            DB::commit();

            $this->command->info("✅ Demo租户创建成功:");
            $this->command->line("  租户名: {$tenant->name}");
            $this->command->line("  子域名: {$tenant->subdomain}");
            $this->command->line("  Owner账号: owner@demo-company.example.com / Owner@123456");
            $this->command->line("  Admin账号: admin@demo-company.example.com / Admin@123456");
            $this->command->line("  Agent账号: agent@demo-company.example.com / Agent@123456");
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->command->error("❌ Demo租户创建失败: " . $e->getMessage());
            $this->command->line($e->getTraceAsString());
            throw $e;
        }
    }
}
