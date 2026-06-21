import { useMemo, useState } from 'react';
import { Tabs, Select, Tag, Button, message } from 'antd';
import {
  Copy,
  Layers,
  Shield,
  Thermometer,
  AlertOctagon,
  AlertTriangle,
  Info,
  CalendarRange,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import dayjs from 'dayjs';
import type { TabsProps } from 'antd';
import type { ConflictInfo, ConflictType, ConflictSeverity } from '@/types';
import { useUIStore } from '@/store/uiStore';
import { usePlanStore } from '@/store/planStore';
import ConflictDetail from './ConflictDetail';

const typeLabels: Record<ConflictType, string> = {
  duplicate_equipment: '设备重复',
  area_overlap: '片区重叠',
  protection_window: '保供电',
  peak_load: '高峰负荷',
};

const typeIcons: Record<ConflictType, React.ReactNode> = {
  duplicate_equipment: <Copy className="w-4 h-4" />,
  area_overlap: <Layers className="w-4 h-4" />,
  protection_window: <Shield className="w-4 h-4" />,
  peak_load: <Thermometer className="w-4 h-4" />,
};

const severityConfig: Record<
  ConflictSeverity,
  { icon: typeof AlertTriangle; color: string; label: string; bg: string; textColor: string }
> = {
  critical: {
    icon: AlertOctagon,
    color: 'red',
    label: '严重',
    bg: 'bg-red-50',
    textColor: 'text-red-600',
  },
  warning: {
    icon: AlertTriangle,
    color: 'orange',
    label: '一般',
    bg: 'bg-amber-50',
    textColor: 'text-amber-600',
  },
  info: {
    icon: Info,
    color: 'blue',
    label: '提示',
    bg: 'bg-blue-50',
    textColor: 'text-blue-600',
  },
};

const ConflictChecker = () => {
  const conflicts = usePlanStore((s) => s.conflicts);
  const tasks = usePlanStore((s) => s.tasks);
  const recomputeConflicts = usePlanStore((s) => s.recomputeConflicts);
  const conflictDetailId = useUIStore((s) => s.conflictDetailId);
  const setConflictDetailId = useUIStore((s) => s.setConflictDetailId);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());

  const tabItems: TabsProps['items'] = [
    { key: 'all', label: '全部' },
    { key: 'duplicate_equipment', label: '设备重复' },
    { key: 'area_overlap', label: '片区重叠' },
    { key: 'protection_window', label: '保供电' },
    { key: 'peak_load', label: '高峰负荷' },
  ];

  const filteredConflicts = useMemo(() => {
    let result = conflicts.filter((c) => !ignoredIds.has(c.id));

    if (activeTab !== 'all') {
      result = result.filter((c) => c.type === activeTab);
    }

    if (severityFilter !== 'all') {
      result = result.filter((c) => c.severity === severityFilter);
    }

    return result;
  }, [conflicts, activeTab, severityFilter, ignoredIds]);

  const displayedConflicts = useMemo(() => {
    return filteredConflicts.map((c) => ({
      ...c,
      resolved: c.resolved || resolvedIds.has(c.id),
    }));
  }, [filteredConflicts, resolvedIds]);

  const selectedConflict = useMemo(() => {
    if (!conflictDetailId) return null;
    const c = conflicts.find((item) => item.id === conflictDetailId);
    if (!c) return null;
    return {
      ...c,
      resolved: c.resolved || resolvedIds.has(c.id),
    };
  }, [conflicts, conflictDetailId, resolvedIds]);

  const totalCount = displayedConflicts.length;
  const resolvedCount = displayedConflicts.filter((c) => c.resolved).length;

  const handleSelect = (id: string) => {
    setConflictDetailId(id);
  };

  const handleResolve = (id: string) => {
    setResolvedIds((prev) => new Set(prev).add(id));
    message.success('冲突已标记为已解决');
  };

  const handleIgnore = (id: string) => {
    setIgnoredIds((prev) => new Set(prev).add(id));
    if (conflictDetailId === id) {
      setConflictDetailId(null);
    }
    message.success('冲突已忽略');
  };

  const handleAdjustTime = (taskId: string) => {
    message.info(`正在调整任务 ${taskId} 的时间...`);
  };

  const handleLocateGantt = (taskIds: string[]) => {
    message.info(`定位甘特图: ${taskIds.join(', ')}`);
  };

  const handleRecompute = () => {
    recomputeConflicts();
    message.success('冲突检测已刷新');
  };

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

  const getConflictTypeLabel = (type: ConflictType) => typeLabels[type];
  const getConflictSeverityLabel = (severity: ConflictSeverity) =>
    severityConfig[severity].label;

  return (
    <div className="h-[620px] flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-dispatch-50 to-white">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-dispatch-600" />
          <span className="text-base font-semibold text-dispatch-900">冲突检测中心</span>
        </div>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={handleRecompute}
          className="!h-7"
        >
          重新检测
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[45%] min-w-[380px] flex flex-col bg-white border-r border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 space-y-3">
            <Tabs
              size="small"
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabItems}
              className="conflict-tabs !mb-0"
            />

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">严重度：</span>
              <Select
                size="small"
                value={severityFilter}
                onChange={setSeverityFilter}
                style={{ width: 120 }}
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'critical', label: '严重' },
                  { value: 'warning', label: '一般' },
                  { value: 'info', label: '提示' },
                ]}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {displayedConflicts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  暂无冲突
                </h3>
                <p className="text-xs text-gray-500 text-center">
                  当前筛选条件下，所有检修计划安排合理
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {displayedConflicts.map((conflict) => {
                  const sevCfg = severityConfig[conflict.severity];
                  const isSelected = conflictDetailId === conflict.id;
                  const SeverityIcon = sevCfg.icon;

                  return (
                    <div
                      key={conflict.id}
                      onClick={() => handleSelect(conflict.id)}
                      className={`relative pl-3 pr-4 py-3 cursor-pointer transition-all duration-150
                        hover:bg-gray-50
                        ${isSelected ? 'bg-dispatch-50' : ''}
                        ${conflict.resolved ? 'opacity-60' : ''}
                      `}
                    >
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-150
                          ${isSelected ? 'bg-dispatch-500 w-1' : 'bg-transparent'}
                        `}
                      />

                      <div className="flex items-start gap-3">
                        <div
                          className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${sevCfg.bg} ${sevCfg.textColor}`}
                        >
                          {typeIcons[conflict.type]}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium text-gray-800">
                              {typeLabels[conflict.type]}
                            </span>
                            <Tag
                              color={sevCfg.color}
                              className="!text-xs !px-2 !py-0 !m-0 !font-medium"
                            >
                              <span className="inline-flex items-center gap-1">
                                <SeverityIcon size={10} />
                                {sevCfg.label}
                              </span>
                            </Tag>
                            {conflict.resolved && (
                              <Tag color="green" className="!text-xs !px-2 !py-0 !m-0">
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 size={10} />
                                  已解决
                                </span>
                              </Tag>
                            )}
                          </div>

                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">
                            {conflict.description}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="inline-flex items-center gap-1">
                              <CalendarRange className="w-3 h-3" />
                              <span className="text-gray-500">
                                {formatTimeRange(conflict.overlapStart, conflict.overlapEnd)}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-dispatch-100 text-dispatch-700 text-xs font-semibold">
                                {countTasks(conflict)}
                              </span>
                              <span className="text-gray-500">个任务</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                共 <span className="font-semibold text-gray-700">{totalCount}</span> 条冲突
              </span>
              <span>
                已解决{' '}
                <span className="font-semibold text-emerald-600">{resolvedCount}</span> 条
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
          <ConflictDetail
            conflict={selectedConflict}
            tasks={tasks}
            onResolve={handleResolve}
            onIgnore={handleIgnore}
            onAdjustTime={handleAdjustTime}
            onLocateGantt={handleLocateGantt}
            getConflictTypeLabel={getConflictTypeLabel}
            getConflictSeverityLabel={getConflictSeverityLabel}
          />
        </div>
      </div>
    </div>
  );
};

export default ConflictChecker;
