import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  Button,
  Input,
  Select,
  Space,
  Badge,
  Tag,
} from 'antd';
import {
  Plus,
  Search,
  Filter,
  Zap,
  Building2,
} from 'lucide-react';
import type {
  MaintenanceTask,
  GanttZoom,
  MaintenanceCategory,
  ApprovalStatus,
  VoltageLevel,
} from '@/types';
import { usePlanSelector } from '@/store/planStore';
import { useEquipmentSelector } from '@/store/equipmentStore';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';
import { useUIStore } from '@/store/uiStore';
import { DAY_MS } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import PlanForm from '@/components/PlanForm';
import GanttCanvas from './GanttCanvas';
import TaskBar from './TaskBar';
import TimelineHeader from './TimelineHeader';

const ROW_HEIGHT = 32;
const LEFT_COL_WIDTH = 240;
const TIMELINE_HEADER_HEIGHT = 112;
const DEFAULT_CONTAINER_HEIGHT = 600;
const DEFAULT_COLUMN_WIDTH = 80;

const CATEGORY_COLORS: Record<MaintenanceCategory, string> = {
  primary_outage: 'bg-red-500',
  secondary_calibration: 'bg-blue-500',
  corridor_clearing: 'bg-green-500',
  technical_reform: 'bg-orange-500',
};

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  draft: 'default',
  submitted: 'processing',
  reviewing: 'processing',
  approved: 'success',
  rejected: 'error',
  completed: 'default',
};

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: '草稿',
  submitted: '待审核',
  reviewing: '审核中',
  approved: '已批准',
  rejected: '已驳回',
  completed: '已完成',
};

const CATEGORY_FILTERS: Array<{
  value: MaintenanceCategory;
  label: string;
}> = [
  { value: 'primary_outage', label: '一次停电' },
  { value: 'secondary_calibration', label: '二次校验' },
  { value: 'corridor_clearing', label: '走廊清障' },
  { value: 'technical_reform', label: '技术改造' },
];

const STATUS_FILTERS: Array<{
  value: ApprovalStatus;
  label: string;
}> = [
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '待审核' },
  { value: 'reviewing', label: '审核中' },
  { value: 'approved', label: '已批准' },
  { value: 'rejected', label: '已驳回' },
  { value: 'completed', label: '已完成' },
];

const VOLTAGE_FILTERS: Array<{
  value: VoltageLevel;
  label: string;
}> = [
  { value: '500kV', label: '500kV' },
  { value: '220kV', label: '220kV' },
  { value: '110kV', label: '110kV' },
];

export default function ScheduleGrid() {
  const [planFormVisible, setPlanFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTopState, setScrollTopState] = useState(0);
  const [columnWidth, setColumnWidth] = useState(DEFAULT_COLUMN_WIDTH);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MaintenanceCategory[]>([]);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus[]>([]);
  const [voltageFilter, setVoltageFilter] = useState<VoltageLevel[]>([]);
  const [containerHeight, setContainerHeight] = useState(DEFAULT_CONTAINER_HEIGHT);
  const [zoom, setZoom] = useState<GanttZoom>('week');

  const rightScrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    filteredTasks: tasks,
    conflicts,
    filters,
    setFilters,
    selectedTaskId,
    setSelectedTask,
  } = usePlanSelector((state) => ({
    filteredTasks: state.filteredTasks,
    conflicts: state.conflicts,
    filters: state.filters,
    setFilters: state.setFilters,
    selectedTaskId: state.selectedTaskId,
    setSelectedTask: state.setSelectedTask,
  }));

  const ganttZoom = useUIStore((state) => state.ganttZoom);

  const { substations, equipments, lines } = useEquipmentSelector((state) => ({
    substations: state.substations,
    equipments: state.equipments,
    lines: state.lines,
  }));

  useEffect(() => {
    setZoom(ganttZoom);
  }, [ganttZoom]);

  useEffect(() => {
    const applyFilters = () => {
      setFilters({
        ...filters,
        keyword: searchKeyword || undefined,
        categories: categoryFilter.length > 0 ? categoryFilter : undefined,
        statuses: statusFilter.length > 0 ? statusFilter : undefined,
        voltageLevels: voltageFilter.length > 0 ? voltageFilter : undefined,
      });
    };

    const timer = setTimeout(applyFilters, 200);
    return () => clearTimeout(timer);
  }, [searchKeyword, categoryFilter, statusFilter, voltageFilter, setFilters, filters]);

  const { viewStart, viewEnd } = useMemo(() => {
    const now = Date.now();
    switch (zoom) {
      case 'day':
        return {
          viewStart: now - 1 * DAY_MS,
          viewEnd: now + 3 * DAY_MS,
        };
      case 'week':
        return {
          viewStart: now - 3 * DAY_MS,
          viewEnd: now + 11 * DAY_MS,
        };
      case 'month':
        return {
          viewStart: now - 7 * DAY_MS,
          viewEnd: now + 45 * DAY_MS,
        };
    }
  }, [zoom]);

  const totalWidth = useMemo(() => {
    const totalMs = viewEnd - viewStart;
    const colsPerDay = zoom === 'day' ? 12 : zoom === 'week' ? 1 : 0.5;
    const totalDays = totalMs / DAY_MS;
    return Math.ceil(totalDays * colsPerDay * columnWidth);
  }, [viewStart, viewEnd, zoom, columnWidth]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
      return a.title.localeCompare(b.title);
    });
  }, [tasks]);

  const {
    virtualItems,
    totalHeight,
    onScroll: onVirtualScroll,
  } = useVirtualScroll({
    items: sortedTasks,
    rowHeight: ROW_HEIGHT,
    containerHeight: containerHeight,
    overscan: 8,
  });
  const virtualContainerRef = containerRef;

  const handleScrollSync = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target === rightScrollRef.current) {
        const newScrollLeft = target.scrollLeft;
        const newScrollTop = target.scrollTop;
        setScrollLeft(newScrollLeft);
        setScrollTopState(newScrollTop);
        if (leftScrollRef.current) {
          leftScrollRef.current.scrollTop = newScrollTop;
        }
      } else if (target === leftScrollRef.current && rightScrollRef.current) {
        rightScrollRef.current.scrollTop = target.scrollTop;
      }

      onVirtualScroll(e);
    },
    [onVirtualScroll]
  );

  const handleZoomChange = useCallback((newZoom: GanttZoom) => {
    setZoom(newZoom);
  }, []);

  const handleTodayClick = useCallback(() => {
    if (rightScrollRef.current) {
      const now = Date.now();
      const pxPerMs = totalWidth / (viewEnd - viewStart);
      const targetScrollLeft = Math.max(
        0,
        (now - viewStart) * pxPerMs - rightScrollRef.current.clientWidth / 2
      );
      rightScrollRef.current.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      });
    }
  }, [totalWidth, viewStart, viewEnd]);

  const handleColumnWidthChange = useCallback((width: number) => {
    setColumnWidth(width);
  }, []);

  const handleCreateTask = useCallback(() => {
    setEditingTask(null);
    setPlanFormVisible(true);
  }, []);

  const handleEditTask = useCallback((task: MaintenanceTask) => {
    setEditingTask(task);
    setPlanFormVisible(true);
  }, []);

  const handleSelectTask = useCallback(
    (taskId: string) => {
      setSelectedTask(selectedTaskId === taskId ? null : taskId);
    },
    [selectedTaskId, setSelectedTask]
  );

  const handleBlankClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setSelectedTask(null);
      }
    },
    [setSelectedTask]
  );

  const handleFormClose = useCallback(() => {
    setPlanFormVisible(false);
    setEditingTask(null);
  }, []);

  const getTaskEquipmentLabel = useCallback(
    (task: MaintenanceTask): string => {
      if (task.equipmentId) {
        const eq = equipments.find((e) => e.id === task.equipmentId);
        if (eq) {
          const station = substations.find(
            (s) => s.id === eq.substationId
          );
          return station ? `${station.name}·${eq.name}` : eq.name;
        }
      }
      if (task.lineId) {
        const line = lines.find((l) => l.id === task.lineId);
        if (line) return line.name;
      }
      if (task.affectedStationIds.length > 0) {
        const station = substations.find(
          (s) => s.id === task.affectedStationIds[0]
        );
        if (station) return station.name;
      }
      return '未指定设备';
    },
    [equipments, lines, substations]
  );

  const conflictCountByTask = useMemo(() => {
    const map = new Map<string, number>();
    conflicts.forEach((c) => {
      if (!c.resolved) {
        map.set(c.taskAId, (map.get(c.taskAId) || 0) + 1);
        if (c.taskBId) {
          map.set(c.taskBId, (map.get(c.taskBId) || 0) + 1);
        }
      }
    });
    return map;
  }, [conflicts]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-white rounded-lg border border-gray-200 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              检修计划编排
            </h2>
            <Badge
              count={sortedTasks.length}
              showZero
              color="blue"
              offset={[4, 0]}
            />
          </div>
        </div>

        <Space size="middle">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="搜索任务名称、申请人、部门"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              allowClear
              className="w-64 pl-9"
            />
          </div>

          <Select
            mode="multiple"
            placeholder={
              <span className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> 检修类型
              </span>
            }
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={CATEGORY_FILTERS.map((c) => ({
              value: c.value,
              label: (
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      CATEGORY_COLORS[c.value]
                    )}
                  />
                  {c.label}
                </span>
              ),
            }))}
            style={{ minWidth: 140 }}
            maxTagCount="responsive"
          />

          <Select
            mode="multiple"
            placeholder="审批状态"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS.map((s) => ({
              value: s.value,
              label: s.label,
            }))}
            style={{ minWidth: 140 }}
            maxTagCount="responsive"
          />

          <Select
            mode="multiple"
            placeholder="电压等级"
            value={voltageFilter}
            onChange={setVoltageFilter}
            options={VOLTAGE_FILTERS.map((v) => ({
              value: v.value,
              label: v.label,
            }))}
            style={{ minWidth: 120 }}
            maxTagCount="responsive"
          />

          <Button
            type="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleCreateTask}
          >
            新建计划
          </Button>
        </Space>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex flex-col border-r border-gray-200 flex-shrink-0 bg-gray-50"
          style={{ width: LEFT_COL_WIDTH }}
        >
          <div
            className="flex items-center px-3 border-b border-gray-200 bg-white text-xs font-medium text-gray-500"
            style={{ height: TIMELINE_HEADER_HEIGHT }}
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            任务 / 设备
          </div>

          <div
            ref={leftScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden"
            onScroll={handleScrollSync}
          >
            <div style={{ height: totalHeight, position: 'relative' }}>
              {virtualItems.map(({ item: task, offsetTop, index }) => {
                const hasConflict = (conflictCountByTask.get(task.id) || 0) > 0;
                const isSelected = selectedTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'absolute left-0 right-0 flex flex-col justify-center px-3 cursor-pointer transition-colors border-b border-gray-100',
                      isSelected
                        ? 'bg-blue-50 border-blue-200'
                        : index % 2 === 0
                        ? 'bg-white hover:bg-gray-50'
                        : 'bg-gray-50/50 hover:bg-gray-100/70'
                    )}
                    style={{
                      top: offsetTop,
                      height: ROW_HEIGHT,
                    }}
                    onClick={() => {
                      handleSelectTask(task.id);
                      if (isSelected) handleEditTask(task);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          CATEGORY_COLORS[task.category]
                        )}
                      />
                      {hasConflict && (
                        <Badge
                          count={conflictCountByTask.get(task.id)}
                          size="small"
                          color="red"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {task.title}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Tag
                        color={STATUS_COLORS[task.approvalStatus] as any}
                        style={{ fontSize: 10, padding: '0 4px', margin: 0 }}
                      >
                        {STATUS_LABELS[task.approvalStatus]}
                      </Tag>
                      <span className="text-[11px] text-gray-400 truncate">
                        {getTaskEquipmentLabel(task)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="flex-1 flex flex-col overflow-hidden bg-white"
          onClick={handleBlankClick}
        >
          <div style={{ height: TIMELINE_HEADER_HEIGHT, flexShrink: 0 }}>
            <TimelineHeader
              zoom={zoom}
              onZoomChange={handleZoomChange}
              viewStart={viewStart}
              viewEnd={viewEnd}
              columnWidth={columnWidth}
              scrollLeft={scrollLeft}
              onTodayClick={handleTodayClick}
              onColumnWidthChange={handleColumnWidthChange}
            />
          </div>

          <div
            ref={rightScrollRef}
            className="flex-1 overflow-auto relative"
            onScroll={handleScrollSync}
            style={{
              maxHeight: containerHeight,
            }}
          >
            <div
              style={{
                width: totalWidth,
                height: totalHeight,
                position: 'relative',
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  height: totalHeight,
                }}
              >
                <GanttCanvas
                  tasks={sortedTasks}
                  conflicts={conflicts}
                  selectedTaskId={selectedTaskId}
                  zoom={zoom}
                  viewStart={viewStart}
                  viewEnd={viewEnd}
                  rowHeight={ROW_HEIGHT}
                  columnWidth={columnWidth}
                  scrollLeft={scrollLeft}
                  scrollTop={scrollTopState}
                />
              </div>

              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  transform: `translateX(${-scrollLeft}px)`,
                }}
              >
                {virtualItems.map(({ item: task, index }) => (
                  <div
                    key={`taskbar-${task.id}`}
                    className="absolute pointer-events-auto"
                    style={{
                      top: index * ROW_HEIGHT,
                      left: 0,
                      right: 0,
                      height: ROW_HEIGHT,
                    }}
                  >
                    <TaskBar
                      task={task}
                      rowIndex={index}
                      zoom={zoom}
                      viewStart={viewStart}
                      viewEnd={viewEnd}
                      rowHeight={ROW_HEIGHT}
                      columnWidth={columnWidth}
                      conflicts={conflicts}
                      selectedTaskId={selectedTaskId}
                      onSelect={handleSelectTask}
                      onEdit={handleEditTask}
                    />
                  </div>
                ))}
              </div>

              {sortedTasks.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">暂无检修计划</p>
                    <p className="text-xs mt-1">
                      点击右上角"新建计划"按钮创建
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PlanForm
        open={planFormVisible}
        onClose={handleFormClose}
        editingTask={editingTask}
      />
    </div>
  );
}
