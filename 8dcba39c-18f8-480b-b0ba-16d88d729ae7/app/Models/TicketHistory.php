<?php

namespace App\Models;

use App\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketHistory extends Model
{
    use HasFactory, BelongsToTenant;

    public $timestamps = false;

    public const ACTION_CREATE = 'create';
    public const ACTION_UPDATE = 'update';
    public const ACTION_EDIT = 'edit';
    public const ACTION_STATUS_CHANGE = 'status_change';
    public const ACTION_PRIORITY_CHANGE = 'priority_change';
    public const ACTION_CATEGORY_CHANGE = 'category_change';
    public const ACTION_DUE_DATE_CHANGE = 'due_date_change';
    public const ACTION_ASSIGN = 'assign';
    public const ACTION_COMMENT = 'comment';
    public const ACTION_ATTACHMENT = 'attachment';
    public const ACTION_TAG = 'tag';
    public const ACTION_RESOLVE = 'resolve';
    public const ACTION_CLOSE = 'close';
    public const ACTION_REOPEN = 'reopen';
    public const ACTION_SATISFACTION = 'satisfaction';
    public const ACTION_SLA_BREACH = 'sla_breach';
    public const ACTION_ESCALATION = 'escalation';
    public const ACTION_APPROVAL = 'approval';
    public const ACTION_WORKFLOW_TRANSITION = 'workflow_transition';
    public const ACTION_DELETE = 'delete';
    public const ACTION_RESTORE = 'restore';

    public const ACTION_NAMES = [
        self::ACTION_CREATE => '创建工单',
        self::ACTION_UPDATE => '更新工单',
        self::ACTION_EDIT => '编辑工单',
        self::ACTION_STATUS_CHANGE => '状态变更',
        self::ACTION_PRIORITY_CHANGE => '优先级变更',
        self::ACTION_CATEGORY_CHANGE => '分类变更',
        self::ACTION_DUE_DATE_CHANGE => '截止日期变更',
        self::ACTION_ASSIGN => '分配工单',
        self::ACTION_COMMENT => '添加评论',
        self::ACTION_ATTACHMENT => '添加附件',
        self::ACTION_TAG => '标签变更',
        self::ACTION_RESOLVE => '解决工单',
        self::ACTION_CLOSE => '关闭工单',
        self::ACTION_REOPEN => '重新打开',
        self::ACTION_SATISFACTION => '满意度评价',
        self::ACTION_SLA_BREACH => 'SLA超时',
        self::ACTION_ESCALATION => '工单升级',
        self::ACTION_APPROVAL => '审批操作',
        self::ACTION_WORKFLOW_TRANSITION => '工作流流转',
        self::ACTION_DELETE => '删除工单',
        self::ACTION_RESTORE => '恢复工单',
    ];

    protected $fillable = [
        'tenant_id', 'ticket_id', 'user_id', 'action',
        'old_value', 'new_value', 'metadata', 'created_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->created_at)) {
                $model->created_at = now();
            }
        });
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function getActionName(string $action): string
    {
        return self::ACTION_NAMES[$action] ?? $action;
    }

    public function getActionLabelAttribute(): string
    {
        return self::getActionName($this->action);
    }
}
