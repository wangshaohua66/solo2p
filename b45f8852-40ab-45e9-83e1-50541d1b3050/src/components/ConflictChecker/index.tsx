import { Card, Tag, List, Badge, Button, Space, Tooltip, Empty } from 'antd';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Eye,
  ArrowRightLeft,
  Gauge,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import type { ConflictSeverity } from '@/types';
import { usePlanStore } from '@/store/planStore';

const severityConfig: Record<
  ConflictSeverity,
  { icon: typeof AlertTriangle; color: string; label: string; bg: string; border: string }
> = {
  critical: {
    icon: AlertOctagon,
    color: 'text-red-600',
    label: '严重',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    label: '一般',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    label: '提示',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
};

const typeLabelMap: Record<string, string> = {
  duplicate_equipment: '设备重复停电',
  area_overlap: '供电区域重叠',
  protection_window: '保护窗口冲突',
  peak_load: '高峰时段过载',
};

const ConflictChecker = () => {
  const conflicts = usePlanStore((s) => s.conflicts);
  const tasks = usePlanStore((s) => s.tasks);
  const recomputeConflicts = usePlanStore((s) => s.recomputeConflicts);

  const getTaskTitle = (taskId: string) =>
    tasks.find((t) => t.id === taskId)?.title || taskId;

  return (
    <Card
      className="!shadow-sm"
      title={
        <span className="text-base font-semibold text-slate-800 inline-flex items-center gap-2">
          <ShieldAlert size={16} className="text-dispatch-600" />
          冲突检测列表
        </span>
      }
      extra={
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={recomputeConflicts}
        >
          重新检测
        </Button>
      }
    >
      {conflicts.length === 0 ? (
        <Empty
          description={
            <div className="text-slate-500">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
              <div className="font-medium text-slate-700">暂无冲突</div>
              <div className="text-xs mt-1">当前计划中的所有任务均已通过冲突检测</div>
            </div>
          }
        />
      ) : (
        <List
          dataSource={conflicts}
          renderItem={(conflict) => {
            const cfg = severityConfig[conflict.severity];
            const Icon = cfg.icon;
            return (
              <List.Item
                className={`!px-4 !py-3 mb-2 rounded-xl ${cfg.bg} ${cfg.border} border`}
                actions={[
                  <Space key="act" size="small">
                    <Tooltip title="查看详情">
                      <Button
                        type="link"
                        size="small"
                        icon={<Eye size={14} />}
                        className="!h-auto !p-0"
                      >
                        查看
                      </Button>
                    </Tooltip>
                    {conflict.type === 'duplicate_equipment' && (
                      <Tooltip title="调整时间">
                        <Button
                          type="link"
                          size="small"
                          icon={<ArrowRightLeft size={14} />}
                          className="!h-auto !p-0"
                        >
                          调整
                        </Button>
                      </Tooltip>
                    )}
                  </Space>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Badge
                      dot={conflict.resolved}
                      status={conflict.resolved ? 'success' : 'default'}
                      offset={[-2, 34]}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm ${cfg.border} border`}
                      >
                        <Icon size={20} className={cfg.color} />
                      </div>
                    </Badge>
                  }
                  title={
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag
                        color={
                          conflict.severity === 'critical'
                            ? 'red'
                            : conflict.severity === 'warning'
                            ? 'orange'
                            : 'blue'
                        }
                        bordered={false}
                        className="!text-xs !py-0 !h-5"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Gauge size={11} />
                          {cfg.label}
                        </span>
                      </Tag>
                      <Tag color="purple" bordered={false} className="!text-xs !py-0 !h-5">
                        {typeLabelMap[conflict.type] || conflict.type}
                      </Tag>
                      {conflict.resolved && (
                        <Tag color="green" bordered={false} className="!text-xs !py-0 !h-5">
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            已解决
                          </span>
                        </Tag>
                      )}
                    </div>
                  }
                  description={
                    <div className="mt-1">
                      <div className="text-sm text-slate-700 mb-1.5">
                        {conflict.description}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-slate-400">关联任务：</span>
                        <Tag bordered className="!bg-white !text-slate-600 !py-0 !h-5 !text-xs">
                          {getTaskTitle(conflict.taskAId)}
                        </Tag>
                        {conflict.taskBId && (
                          <>
                            <ArrowRightLeft size={12} className="text-slate-400" />
                            <Tag bordered className="!bg-white !text-slate-600 !py-0 !h-5 !text-xs">
                              {getTaskTitle(conflict.taskBId)}
                            </Tag>
                          </>
                        )}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
};

export default ConflictChecker;
