<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permission extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'name', 'slug', 'module', 'description',
    ];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'permission_role')
            ->withTimestamps();
    }

    public static function seedDefaults(): void
    {
        $modules = [
            'tickets' => [
                'tickets.view' => '查看工单',
                'tickets.create' => '创建工单',
                'tickets.update' => '更新工单',
                'tickets.delete' => '删除工单',
                'tickets.assign' => '分配工单',
                'tickets.status' => '修改工单状态',
                'tickets.priority' => '修改工单优先级',
                'tickets.bulk' => '批量操作工单',
                'tickets.export' => '导出工单',
                'tickets.merge' => '合并工单',
            ],
            'workflow' => [
                'workflow.view' => '查看工作流',
                'workflow.create' => '创建工作流',
                'workflow.update' => '更新工作流',
                'workflow.delete' => '删除工作流',
            ],
            'sla' => [
                'sla.view' => '查看SLA策略',
                'sla.create' => '创建SLA策略',
                'sla.update' => '更新SLA策略',
                'sla.delete' => '删除SLA策略',
            ],
            'users' => [
                'users.view' => '查看用户',
                'users.create' => '创建用户',
                'users.update' => '更新用户',
                'users.delete' => '删除用户',
                'users.roles' => '管理用户角色',
            ],
            'reports' => [
                'reports.view' => '查看报表',
                'reports.export' => '导出报表',
            ],
            'automation' => [
                'automation.view' => '查看自动化规则',
                'automation.create' => '创建自动化规则',
                'automation.update' => '更新自动化规则',
                'automation.delete' => '删除自动化规则',
            ],
            'settings' => [
                'settings.general' => '系统设置',
                'settings.notifications' => '通知设置',
                'settings.templates' => '模板管理',
                'settings.api' => 'API密钥管理',
                'settings.webhooks' => 'Webhook管理',
            ],
        ];

        foreach ($modules as $module => $permissions) {
            foreach ($permissions as $slug => $name) {
                self::firstOrCreate(
                    ['slug' => $slug],
                    ['name' => $name, 'module' => $module]
                );
            }
        }
    }
}
