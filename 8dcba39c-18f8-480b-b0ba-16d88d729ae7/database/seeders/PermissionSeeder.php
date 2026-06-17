<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['module' => 'tickets', 'name' => 'tickets.view', 'display_name' => '查看工单'],
            ['module' => 'tickets', 'name' => 'tickets.create', 'display_name' => '创建工单'],
            ['module' => 'tickets', 'name' => 'tickets.edit', 'display_name' => '编辑工单'],
            ['module' => 'tickets', 'name' => 'tickets.delete', 'display_name' => '删除工单'],
            ['module' => 'tickets', 'name' => 'tickets.assign', 'display_name' => '分配工单'],
            ['module' => 'tickets', 'name' => 'tickets.status', 'display_name' => '状态流转'],
            ['module' => 'tickets', 'name' => 'tickets.comment', 'display_name' => '添加评论'],
            ['module' => 'tickets', 'name' => 'tickets.upload', 'display_name' => '上传附件'],
            ['module' => 'tickets', 'name' => 'tickets.export', 'display_name' => '导出工单'],
            ['module' => 'tickets', 'name' => 'tickets.approve', 'display_name' => '审批工单'],
            ['module' => 'tickets', 'name' => 'tickets.batch', 'display_name' => '批量操作'],
            ['module' => 'users', 'name' => 'users.view', 'display_name' => '查看用户'],
            ['module' => 'users', 'name' => 'users.create', 'display_name' => '创建用户'],
            ['module' => 'users', 'name' => 'users.edit', 'display_name' => '编辑用户'],
            ['module' => 'users', 'name' => 'users.delete', 'display_name' => '删除用户'],
            ['module' => 'users', 'name' => 'users.roles', 'display_name' => '分配角色'],
            ['module' => 'reports', 'name' => 'reports.view', 'display_name' => '查看报表'],
            ['module' => 'reports', 'name' => 'reports.export', 'display_name' => '导出报表'],
            ['module' => 'reports', 'name' => 'reports.billing', 'display_name' => '查看账单'],
            ['module' => 'sla', 'name' => 'sla.view', 'display_name' => '查看SLA'],
            ['module' => 'sla', 'name' => 'sla.create', 'display_name' => '创建SLA策略'],
            ['module' => 'sla', 'name' => 'sla.edit', 'display_name' => '编辑SLA策略'],
            ['module' => 'sla', 'name' => 'sla.delete', 'display_name' => '删除SLA策略'],
            ['module' => 'sla', 'name' => 'sla.acknowledge', 'display_name' => '确认违规'],
            ['module' => 'workflows', 'name' => 'workflows.view', 'display_name' => '查看工作流'],
            ['module' => 'workflows', 'name' => 'workflows.create', 'display_name' => '创建工作流'],
            ['module' => 'workflows', 'name' => 'workflows.edit', 'display_name' => '编辑工作流'],
            ['module' => 'workflows', 'name' => 'workflows.delete', 'display_name' => '删除工作流'],
            ['module' => 'automations', 'name' => 'automations.view', 'display_name' => '查看自动化'],
            ['module' => 'automations', 'name' => 'automations.create', 'display_name' => '创建自动化规则'],
            ['module' => 'automations', 'name' => 'automations.edit', 'display_name' => '编辑自动化规则'],
            ['module' => 'automations', 'name' => 'automations.delete', 'display_name' => '删除自动化规则'],
            ['module' => 'automations', 'name' => 'automations.execute', 'display_name' => '执行自动化规则'],
            ['module' => 'notifications', 'name' => 'notifications.view', 'display_name' => '查看通知'],
            ['module' => 'notifications', 'name' => 'notifications.templates', 'display_name' => '管理通知模板'],
            ['module' => 'notifications', 'name' => 'notifications.subscriptions', 'display_name' => '管理订阅'],
            ['module' => 'webhooks', 'name' => 'webhooks.view', 'display_name' => '查看Webhook'],
            ['module' => 'webhooks', 'name' => 'webhooks.create', 'display_name' => '创建Webhook'],
            ['module' => 'webhooks', 'name' => 'webhooks.edit', 'display_name' => '编辑Webhook'],
            ['module' => 'webhooks', 'name' => 'webhooks.delete', 'display_name' => '删除Webhook'],
            ['module' => 'webhooks', 'name' => 'webhooks.test', 'display_name' => '测试Webhook'],
            ['module' => 'tenants', 'name' => 'tenants.view', 'display_name' => '查看租户信息'],
            ['module' => 'tenants', 'name' => 'tenants.edit', 'display_name' => '编辑租户设置'],
            ['module' => 'tenants', 'name' => 'tenants.billing', 'display_name' => '管理账单'],
            ['module' => 'tenants', 'name' => 'tenants.suspend', 'display_name' => '暂停/启用租户'],
        ];

        foreach ($permissions as $p) {
            Permission::firstOrCreate(
                ['name' => $p['name']],
                $p
            );
        }

        $this->command->info("✅ 已确保 " . count($permissions) . " 个权限项存在");
    }
}
