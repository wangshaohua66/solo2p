import { Tag, Button, Tooltip } from 'antd';
import {
  Copy,
  Layers,
  Shield,
  Thermometer,
  CalendarRange,
  ListTodo,
  CheckCircle2,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import dayjs from 'dayjs';
import type {
  ConflictInfo,
  ConflictType,
  ConflictSeverity,
} from '@/types';

interface ConflictListProps {
  conflicts: ConflictInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onResolve: (id: string) => void;
  onLocateGantt?: (taskIds: string[]) => void;
}

const severityColors: Record<ConflictSeverity, { bg: string; text: string; bar: string; label: string }> = {
  critical: {
    bg: 'bg-red-50',
    text: 'text-conflict-critical',
    bar: 'bg-conflict-critical',
    label: '严重',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-conflict-warning',
    bar: 'bg-conflict-warning',
    label: '一般',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-conflict-info',
    bar: 'bg-conflict-info',
    label: '提示',
  },
};

const typeIcons: Record<ConflictType, React.ReactNode> = {
  duplicate_equipment: <Copy className="w-5 h-5" />,
  area_overlap: <Layers className="w-5 h-5" />,
  protection_window: <Shield className="w-5 h-5" />,
  peak_load: <Thermometer className="w-5 h-5" />,
};

const typeLabels: Record<ConflictType, string> = {
  duplicate_equipment: '设备重复检修',
  area_overlap: '片区多重停电',
  protection_window: '保供电冲突',
  peak_load: '高峰负荷冲突',
};

const ConflictList = ({
  conflicts,
  selectedId,
  onSelect,
  onResolve,
  onLocateGantt,
}: ConflictListProps) => {
  const formatTimeRange = (start?: number, end?: number) => {
    if (!start || !end) return '--';
    const s = dayjs(start);
    const e = dayjs(end);
    const sameDay = s.isSame(e, 'day');
    if (sameDay) {
      return `${s.format('MM-DD')} ${s.format('HH:mm')}~${e.format('HH:mm')}`;
    }
    return `${s.format('MM-DD HH:mm')} ~ ${e.format('MM-DD HH:mm')}`;
  };

  const countTasks = (conflict: ConflictInfo) => {
    let count = 1;
    if (conflict.taskBId) count = 2;
    return count;
  };

  if (conflicts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white p-8">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">
          未检测到冲突
        </h3>
        <p className="text-sm text-gray-500 text-center">
          当前筛选条件下，所有检修计划安排合理
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-4 space-y-3">
      {conflicts.map((conflict) => {
        const sevCfg = severityColors[conflict.severity];
        const isSelected = selectedId === conflict.id;

        return (
          <div
            key={conflict.id}
            onClick={() => onSelect(conflict.id)}
            className={`relative bg-white rounded-lg overflow-hidden cursor-pointer transition-all duration-200
              hover:shadow-card-hover hover:-translate-y-0.5
              ${isSelected ? 'ring-2 ring-dispatch-500 shadow-card-hover' : 'shadow-card'}
              ${conflict.resolved ? 'opacity-60' : ''}
            `}
          >
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 ${sevCfg.bar} transition-all duration-200`}
              style={{ width: isSelected ? 4 : 4 }}
            />

            <div className="pl-4 pr-4 py-4">
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${sevCfg.bg} ${sevCfg.text} transition-all duration-200 ${isSelected ? 'scale-105' : ''}`}
                >
                  {typeIcons[conflict.type]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-gray-800">
                      {typeLabels[conflict.type]}
                    </span>
                    <Tag
                      color={
                        conflict.severity === 'critical'
                          ? 'red'
                          : conflict.severity === 'warning'
                          ? 'orange'
                          : 'blue'
                      }
                      className="!text-xs !px-2 !py-0 !m-0 !font-medium"
                    >
                      {sevCfg.label}
                    </Tag>
                    {conflict.resolved && (
                      <Tag color="green" className="!text-xs !px-2 !py-0 !m-0">
                        已解决
                      </Tag>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                    {conflict.description}
                  </p>
                </div>
              </div>

              <div className="ml-13 space-y-2">
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <CalendarRange className="w-3.5 h-3.5" />
                    <span className="text-gray-600">
                      {formatTimeRange(conflict.overlapStart, conflict.overlapEnd)}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ListTodo className="w-3.5 h-3.5" />
                    <span className="text-gray-600">
                      涉及 {countTasks(conflict)} 个任务
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Tooltip title="在甘特图中定位">
                    <Button
                      size="small"
                      type={isSelected ? 'primary' : 'default'}
                      icon={<MapPin className="w-3.5 h-3.5" />}
                      className="!h-7 !text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        const taskIds = [conflict.taskAId];
                        if (conflict.taskBId) taskIds.push(conflict.taskBId);
                        onLocateGantt?.(taskIds);
                      }}
                    >
                      定位甘特图
                    </Button>
                  </Tooltip>

                  {!conflict.resolved ? (
                    <Tooltip title="标记为已解决">
                      <Button
                        size="small"
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        className="!h-7 !text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolve(conflict.id);
                        }}
                      >
                        标记已解决
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip title="已处理">
                      <Button
                        size="small"
                        disabled
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        className="!h-7 !text-xs"
                      >
                        已处理
                      </Button>
                    </Tooltip>
                  )}

                  <div className="flex-1" />

                  <span className="text-xs text-gray-400">
                    {dayjs(conflict.detectedAt).fromNow()}
                  </span>
                </div>
              </div>
            </div>

            {isSelected && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <AlertCircle className="w-4 h-4 text-dispatch-500 animate-pulse" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ConflictList;
