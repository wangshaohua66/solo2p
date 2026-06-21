import { useMemo, useRef, useEffect } from 'react';
import { Badge, Tag, Steps, Button, Space, Card, Empty, Divider } from 'antd';
import type { StepsProps } from 'antd';
import {
  AlertTriangle,
  Clock,
  Layers,
  Zap,
  Lightbulb,
  X,
  CalendarDays,
  Eye,
  FileEdit,
  Copy,
  Layers as LayersIcon,
  Shield,
  Thermometer,
} from 'lucide-react';
import dayjs from 'dayjs';
import type {
  ConflictInfo,
  ConflictType,
  ConflictSeverity,
  MaintenanceTask,
  Substation,
} from '@/types';
import { useEquipmentSelector } from '@/store/equipmentStore';

interface ConflictDetailProps {
  conflict: ConflictInfo | null;
  tasks: MaintenanceTask[];
  onResolve: (id: string) => void;
  onIgnore: (id: string) => void;
  onAdjustTime?: (taskId: string) => void;
  onLocateGantt?: (taskIds: string[]) => void;
  getConflictTypeLabel: (type: ConflictType) => string;
  getConflictSeverityLabel: (severity: ConflictSeverity) => string;
}

const severityBadgeColors: Record<ConflictSeverity, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

const typeIconMap: Record<ConflictType, React.ReactNode> = {
  duplicate_equipment: <Copy className="w-6 h-6" />,
  area_overlap: <LayersIcon className="w-6 h-6" />,
  protection_window: <Shield className="w-6 h-6" />,
  peak_load: <Thermometer className="w-6 h-6" />,
};

const ConflictDetail = ({
  conflict,
  tasks,
  onResolve,
  onIgnore,
  onAdjustTime,
  onLocateGantt,
  getConflictTypeLabel,
  getConflictSeverityLabel,
}: ConflictDetailProps) => {
  const substations = useEquipmentSelector((s) => s.substations);
  const timelineRef = useRef<HTMLDivElement>(null);

  const taskA = useMemo(
    () => tasks.find((t) => t.id === conflict?.taskAId),
    [tasks, conflict]
  );
  const taskB = useMemo(
    () => (conflict?.taskBId ? tasks.find((t) => t.id === conflict.taskBId) : undefined),
    [tasks, conflict]
  );

  const overlapDuration = useMemo(() => {
    if (!conflict?.overlapStart || !conflict?.overlapEnd) return null;
    const totalMin = Math.round(
      (conflict.overlapEnd - conflict.overlapStart) / 60000
    );
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    return { hours, minutes, totalMin };
  }, [conflict]);

  const affectedStations = useMemo(() => {
    const ids = new Set<string>();
    taskA?.affectedStationIds.forEach((id) => ids.add(id));
    taskB?.affectedStationIds.forEach((id) => ids.add(id));
    return substations.filter((s) => ids.has(s.id));
  }, [taskA, taskB, substations]);

  const totalLostCapacity = useMemo(() => {
    const cap = (taskA?.lostCapacity || 0) + (taskB?.lostCapacity || 0);
    return cap;
  }, [taskA, taskB]);

  const solutionSteps: StepsProps['items'] = useMemo(() => {
    if (!conflict) return [];
    const steps: StepsProps['items'] = [];

    switch (conflict.type) {
      case 'duplicate_equipment':
        steps.push(
          {
            title: '评估优先级',
            description: '根据任务重要程度、保供电等级，确定优先执行任务',
            status: 'process',
          },
          {
            title: '错开时间',
            description: '将次要任务延后至另一任务完成后启动',
            status: 'wait',
          },
          {
            title: '调整方案',
            description: '若必须同期执行，制定临时供电方案并经审批',
            status: 'wait',
          }
        );
        break;
      case 'area_overlap':
        steps.push(
          {
            title: '影响范围校核',
            description: '计算叠加后N-1风险等级及受影响用户',
            status: 'process',
          },
          {
            title: '任务错峰',
            description: '将其中一任务平移至非重叠时段',
            status: 'wait',
          },
          {
            title: '转供措施',
            description: '启用备用联络线路，转移关键负荷',
            status: 'wait',
          }
        );
        break;
      case 'protection_window':
        steps.push(
          {
            title: '窗口确认',
            description: '核实保供电期起止时间与重要用户清单',
            status: 'process',
          },
          {
            title: '任务延期',
            description: '原则上任务应调整至保供电期结束后',
            status: 'wait',
          },
          {
            title: '特殊审批',
            description: '确需执行的须经上级主管部门特批',
            status: 'wait',
          }
        );
        break;
      case 'peak_load':
        steps.push(
          {
            title: '负荷预测',
            description: '获取高峰时段系统负荷及备用容量数据',
            status: 'process',
          },
          {
            title: '时段调整',
            description: '将检修时段调整至非高峰(夜间/午间)',
            status: 'wait',
          },
          {
            title: '备用保障',
            description: '部署移动电源车/应急发电设备',
            status: 'wait',
          }
        );
        break;
    }

    steps.push({
      title: '闭环验证',
      description: '调整后重新运行冲突检测，确认已消除',
      status: 'wait',
    });

    return steps;
  }, [conflict]);

  const timeLineData = useMemo(() => {
    if (!conflict || !taskA) return null;

    const allStarts = [taskA.startTime, taskB?.startTime].filter(
      (v): v is number => v !== undefined
    );
    const allEnds = [taskA.endTime, taskB?.endTime].filter(
      (v): v is number => v !== undefined
    );

    const minTime = Math.min(...allStarts);
    const maxTime = Math.max(...allEnds);
    const totalDuration = maxTime - minTime || 1;

    const taskARange = {
      start: ((taskA.startTime - minTime) / totalDuration) * 100,
      width: ((taskA.endTime - taskA.startTime) / totalDuration) * 100,
    };
    const taskBRange = taskB
      ? {
          start: ((taskB.startTime - minTime) / totalDuration) * 100,
          width: ((taskB.endTime - taskB.startTime) / totalDuration) * 100,
        }
      : null;

    const overlapRange =
      conflict.overlapStart && conflict.overlapEnd
        ? {
            start: ((conflict.overlapStart - minTime) / totalDuration) * 100,
            width:
              ((conflict.overlapEnd - conflict.overlapStart) / totalDuration) *
              100,
          }
        : null;

    const tickCount = 6;
    const ticks: Array<{ left: number; label: string }> = [];
    for (let i = 0; i <= tickCount; i++) {
      const t = minTime + (totalDuration * i) / tickCount;
      ticks.push({
        left: (i / tickCount) * 100,
        label: dayjs(t).format('MM-DD HH:mm'),
      });
    }

    return { taskARange, taskBRange, overlapRange, ticks, minTime, maxTime };
  }, [conflict, taskA, taskB]);

  useEffect(() => {
    // noop for now, reserved for future scroll sync
  }, [conflict]);

  if (!conflict) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className="text-gray-400">
              请从左侧列表选择一个冲突查看详情
            </span>
          }
          className="conflict-empty"
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-dispatch-50 to-white">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0
                ${conflict.severity === 'critical' ? 'bg-red-100 text-conflict-critical' : ''}
                ${conflict.severity === 'warning' ? 'bg-amber-100 text-conflict-warning' : ''}
                ${conflict.severity === 'info' ? 'bg-blue-100 text-conflict-info' : ''}
              `}
            >
              {typeIconMap[conflict.type]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-bold text-dispatch-900">
                  {getConflictTypeLabel(conflict.type)}
                </h3>
                <Badge
                  color={severityBadgeColors[conflict.severity]}
                  text={
                    <span className="font-semibold">
                      {getConflictSeverityLabel(conflict.severity)}
                    </span>
                  }
                />
                {conflict.resolved && (
                  <Tag color="green">已解决</Tag>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                {conflict.description}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  检测时间：{dayjs(conflict.detectedAt).format('YYYY-MM-DD HH:mm')}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  冲突编号：{conflict.id}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <Card
          size="small"
          className="!rounded-lg shadow-sm"
          title={
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Clock className="w-4 h-4 text-dispatch-500" />
              时间线对比分析
            </span>
          }
        >
          {timeLineData && (
            <div ref={timelineRef} className="conflict-timeline">
              {overlapDuration && (
                <div className="mb-4 flex items-center gap-6 p-3 bg-red-50 rounded-lg border border-red-100">
                  <AlertTriangle className="w-5 h-5 text-conflict-critical flex-shrink-0" />
                  <div>
                    <div className="text-sm text-gray-700">
                      时间重叠总时长
                    </div>
                    <div className="mt-0.5">
                      <span className="text-xl font-bold text-conflict-critical">
                        {overlapDuration.hours}
                      </span>
                      <span className="text-sm text-conflict-critical ml-1">
                        小时
                      </span>
                      <span className="text-xl font-bold text-conflict-critical ml-2">
                        {overlapDuration.minutes}
                      </span>
                      <span className="text-sm text-conflict-critical ml-1">
                        分钟
                      </span>
                      {conflict.overlapStart && conflict.overlapEnd && (
                        <span className="text-xs text-gray-500 ml-3">
                          ({dayjs(conflict.overlapStart).format('MM-DD HH:mm')} ~{' '}
                          {dayjs(conflict.overlapEnd).format('MM-DD HH:mm')})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="relative space-y-5">
                <div className="relative h-10">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-full bg-gray-50 rounded-md flex items-center px-0 relative overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 bg-dispatch-500/90 rounded-md shadow-sm flex items-center px-3"
                        style={{
                          left: `${timeLineData.taskARange.start}%`,
                          width: `${timeLineData.taskARange.width}%`,
                          minWidth: '60px',
                        }}
                      >
                        <span className="text-xs font-medium text-white truncate">
                          {taskA?.title}
                        </span>
                      </div>
                      {timeLineData.overlapRange && (
                        <div
                          className="absolute top-0 bottom-0 bg-conflict-critical/40 rounded-md animate-pulse pointer-events-none"
                          style={{
                            left: `${timeLineData.overlapRange.start}%`,
                            width: `${timeLineData.overlapRange.width}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-dispatch-500 text-white flex items-center justify-center text-xs font-bold shadow">
                    A
                  </div>
                </div>

                {timeLineData.taskBRange && taskB && (
                  <div className="relative h-10">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-full bg-gray-50 rounded-md flex items-center px-0 relative overflow-hidden">
                        <div
                          className="absolute top-0 bottom-0 bg-emerald-500/90 rounded-md shadow-sm flex items-center px-3"
                          style={{
                            left: `${timeLineData.taskBRange.start}%`,
                            width: `${timeLineData.taskBRange.width}%`,
                            minWidth: '60px',
                          }}
                        >
                          <span className="text-xs font-medium text-white truncate">
                            {taskB.title}
                          </span>
                        </div>
                        {timeLineData.overlapRange && (
                          <div
                            className="absolute top-0 bottom-0 bg-conflict-critical/40 rounded-md animate-pulse pointer-events-none"
                            style={{
                              left: `${timeLineData.overlapRange.start}%`,
                              width: `${timeLineData.overlapRange.width}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow">
                      B
                    </div>
                  </div>
                )}

                <div className="relative h-5">
                  {timeLineData.ticks.map((tick, idx) => (
                    <div
                      key={idx}
                      className="absolute top-0 -translate-x-1/2"
                      style={{ left: `${tick.left}%` }}
                    >
                      <div className="w-px h-2 bg-gray-300 mx-auto" />
                      <div className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                        {tick.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {taskA && (
                  <div className="p-3 rounded-lg border border-dispatch-100 bg-dispatch-50/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded bg-dispatch-500 text-white text-xs flex items-center justify-center font-bold">
                        A
                      </span>
                      <span className="text-xs font-semibold text-dispatch-800 truncate">
                        {taskA.title}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5 ml-7">
                      <div>
                        {dayjs(taskA.startTime).format('MM-DD HH:mm')} ~{' '}
                        {dayjs(taskA.endTime).format('MM-DD HH:mm')}
                      </div>
                      <div>申请人：{taskA.applicant} · {taskA.department}</div>
                    </div>
                  </div>
                )}
                {taskB && (
                  <div className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">
                        B
                      </span>
                      <span className="text-xs font-semibold text-emerald-800 truncate">
                        {taskB.title}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5 ml-7">
                      <div>
                        {dayjs(taskB.startTime).format('MM-DD HH:mm')} ~{' '}
                        {dayjs(taskB.endTime).format('MM-DD HH:mm')}
                      </div>
                      <div>申请人：{taskB.applicant} · {taskB.department}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card
          size="small"
          className="!rounded-lg shadow-sm"
          title={
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Layers className="w-4 h-4 text-dispatch-500" />
              拓扑影响范围
            </span>
          }
        >
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-2">受影响变电站 ({affectedStations.length}座)</div>
              <div className="flex flex-wrap gap-1.5">
                {affectedStations.length > 0 ? (
                  affectedStations.map((station: Substation) => (
                    <Tag
                      key={station.id}
                      color={
                        station.voltageLevel === '500kV'
                          ? 'red'
                          : station.voltageLevel === '220kV'
                          ? 'blue'
                          : 'green'
                      }
                      className="!text-xs !px-2 !py-0.5"
                    >
                      {station.name.replace(/变电站$/, '')}
                      <span className="opacity-60 ml-1">({station.voltageLevel})</span>
                    </Tag>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">--</span>
                )}
              </div>
            </div>
            <Divider type="vertical" className="!h-12" />
            <div className="flex-shrink-0 text-center">
              <div className="text-xs text-gray-500 mb-1">合计损失容量</div>
              <div className="flex items-baseline justify-center gap-1">
                <Zap className="w-4 h-4 text-conflict-warning" />
                <span className="text-2xl font-bold text-gray-800">
                  {totalLostCapacity || '--'}
                </span>
                <span className="text-xs text-gray-500">MVA</span>
              </div>
            </div>
          </div>
        </Card>

        <Card
          size="small"
          className="!rounded-lg shadow-sm"
          title={
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              建议解决方案
            </span>
          }
        >
          <Steps
            direction="vertical"
            size="small"
            current={solutionSteps.findIndex((s) => s.status === 'process')}
            items={solutionSteps}
            className="conflict-solution-steps"
          />
        </Card>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <Space>
          <Button
            size="middle"
            icon={<X className="w-4 h-4" />}
            onClick={() => onIgnore(conflict.id)}
            className="!h-9"
          >
            忽略此冲突
          </Button>
          {conflict.taskBId && (
            <Button
              size="middle"
              icon={<CalendarDays className="w-4 h-4" />}
              onClick={() => {
                const ids = [conflict.taskAId];
                if (conflict.taskBId) ids.push(conflict.taskBId);
                onLocateGantt?.(ids);
              }}
              className="!h-9"
            >
              在甘特图中查看
            </Button>
          )}
        </Space>
        <Space>
          <Button
            size="middle"
            type="primary"
            icon={<FileEdit className="w-4 h-4" />}
            onClick={() => onAdjustTime?.(conflict.taskAId)}
            className="!h-9 !bg-dispatch-600 hover:!bg-dispatch-700"
          >
            调整任务时间
          </Button>
          {!conflict.resolved && (
            <Button
              size="middle"
              type="primary"
              onClick={() => onResolve(conflict.id)}
              className="!h-9 !bg-emerald-600 hover:!bg-emerald-700"
            >
              确认已解决
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default ConflictDetail;
