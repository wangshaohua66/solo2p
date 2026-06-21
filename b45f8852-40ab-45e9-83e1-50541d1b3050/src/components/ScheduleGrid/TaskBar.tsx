import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Popover, Tag } from 'antd';
import {
  AlertTriangle,
  Clock,
  User,
  Building2,
  Gauge,
  AlertCircle,
} from 'lucide-react';
import type {
  MaintenanceTask,
  GanttZoom,
  ConflictInfo,
  ApprovalStatus,
  MaintenanceCategory,
} from '@/types';
import { usePlanStore } from '@/store/planStore';
import { useEquipmentStore } from '@/store/equipmentStore';
import {
  formatDateTime,
  formatDuration,
  HOUR_MS,
  DAY_MS,
  debounce,
} from '@/utils/dateUtils';
import {
  getConflictTypeLabel,
  getConflictSeverityLabel,
} from '@/utils/conflictDetector';
import { cn } from '@/lib/utils';

export interface TaskBarProps {
  task: MaintenanceTask;
  rowIndex: number;
  zoom: GanttZoom;
  viewStart: number;
  viewEnd: number;
  rowHeight: number;
  columnWidth: number;
  conflicts: ConflictInfo[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  onEdit: (task: MaintenanceTask) => void;
}

const TASK_BAR_HEIGHT = 24;
const TASK_BAR_MARGIN = 4;
const DRAG_THRESHOLD_PX = 5;
const DRAG_DEBOUNCE_MS = 100;

const CATEGORY_STYLES: Record<
  MaintenanceCategory,
  { bg: string; bgGradient: string; border: string; text: string }
> = {
  primary_outage: {
    bg: 'bg-red-50',
    bgGradient: 'from-red-50 to-red-100',
    border: 'border-red-400',
    text: 'text-red-700',
  },
  secondary_calibration: {
    bg: 'bg-blue-50',
    bgGradient: 'from-blue-50 to-blue-100',
    border: 'border-blue-400',
    text: 'text-blue-700',
  },
  corridor_clearing: {
    bg: 'bg-green-50',
    bgGradient: 'from-green-50 to-green-100',
    border: 'border-green-400',
    text: 'text-green-700',
  },
  technical_reform: {
    bg: 'bg-orange-50',
    bgGradient: 'from-orange-50 to-orange-100',
    border: 'border-orange-400',
    text: 'text-orange-700',
  },
};

const STATUS_INFO: Record<
  ApprovalStatus,
  { label: string; color: string }
> = {
  draft: { label: '草稿', color: 'default' },
  submitted: { label: '待审核', color: 'processing' },
  reviewing: { label: '审核中', color: 'processing' },
  approved: { label: '已批准', color: 'success' },
  rejected: { label: '已驳回', color: 'error' },
  completed: { label: '已完成', color: 'default' },
};

export default function TaskBar({
  task,
  rowIndex,
  zoom,
  viewStart,
  viewEnd,
  rowHeight,
  columnWidth,
  conflicts,
  selectedTaskId,
  onSelect,
  onEdit,
}: TaskBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [originalStartTime, setOriginalStartTime] = useState<number>(task.startTime);
  const [originalEndTime, setOriginalEndTime] = useState<number>(task.endTime);
  const containerRef = useRef<HTMLDivElement>(null);

  const { substations, equipments, lines } = useEquipmentStore((state) => ({
    substations: state.substations,
    equipments: state.equipments,
    lines: state.lines,
  }));

  const updateTask = usePlanStore((state) => state.updateTask);
  const recomputeConflicts = usePlanStore((state) => state.recomputeConflicts);

  const isSelected = selectedTaskId === task.id;

  const taskConflicts = useMemo(() => {
    return conflicts.filter(
      (c) =>
        !c.resolved &&
        (c.taskAId === task.id || c.taskBId === task.id)
    );
  }, [conflicts, task.id]);

  const hasCriticalConflict = taskConflicts.some(
    (c) => c.severity === 'critical'
  );

  const pxPerMs = useMemo(() => {
    const totalMs = viewEnd - viewStart;
    if (totalMs <= 0) return 0.0001;
    const totalCols = getColumnCount(zoom, viewStart, viewEnd);
    return Math.max(0.0001, (totalCols * columnWidth) / totalMs);
  }, [zoom, viewStart, viewEnd, columnWidth]);

  const position = useMemo(() => {
    const safePxPerMs = Number.isFinite(pxPerMs) && pxPerMs > 0 ? pxPerMs : 0.0001;
    const left = Math.max(0, (task.startTime - viewStart) * safePxPerMs);
    const width = Math.max(
      8,
      Math.max(0, (task.endTime - task.startTime) * safePxPerMs)
    );
    const top = rowIndex * rowHeight + TASK_BAR_MARGIN;
    return {
      left: Number.isFinite(left) ? left : 0,
      width: Number.isFinite(width) ? width : 8,
      top: Number.isFinite(top) ? top : TASK_BAR_MARGIN,
    };
  }, [task.startTime, task.endTime, viewStart, pxPerMs, rowIndex, rowHeight]);

  const displayPosition = useMemo(() => {
    if (!isDragging) return position;

    const safePxPerMs = Number.isFinite(pxPerMs) && pxPerMs > 0 ? pxPerMs : 0.0001;
    const msDelta = dragOffset / safePxPerMs;
    const snapMs = getSnapMs(zoom);
    const snappedDelta = Math.round((Number.isFinite(msDelta) ? msDelta : 0) / snapMs) * snapMs;

    const newLeft =
      (originalStartTime + snappedDelta - viewStart) * safePxPerMs;
    const duration = originalEndTime - originalStartTime;
    const newWidth = Math.max(8, duration * safePxPerMs);

    return {
      left: Number.isFinite(newLeft) ? Math.max(0, newLeft) : position.left,
      width: Number.isFinite(newWidth) ? newWidth : position.width,
      top: position.top,
    };
  }, [isDragging, dragOffset, position, originalStartTime, originalEndTime, viewStart, pxPerMs, zoom]);

  const debouncedDragRef = useRef<((a: number, b: number) => void) | null>(null);
  if (!debouncedDragRef.current) {
    debouncedDragRef.current = debounce(
      (newStartTime: number, newEndTime: number) => {
        updateTask(task.id, {
          startTime: newStartTime,
          endTime: newEndTime,
        });
        recomputeConflicts();
      },
      DRAG_DEBOUNCE_MS
    );
  }
  const debouncedDrag = debouncedDragRef.current;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      setIsDragging(true);
      setDragStartX(e.clientX);
      setDragOffset(0);
      setOriginalStartTime(task.startTime);
      setOriginalEndTime(task.endTime);

      onSelect(task.id);
    },
    [task, onSelect]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
      setDragOffset(deltaX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      if (Math.abs(dragOffset) >= DRAG_THRESHOLD_PX) {
        const msDelta = dragOffset / pxPerMs;
        const snapMs = getSnapMs(zoom);
        const snappedDelta = Math.round(msDelta / snapMs) * snapMs;

        const newStartTime = originalStartTime + snappedDelta;
        const newEndTime = originalEndTime + snappedDelta;

        if (newStartTime >= viewStart && newEndTime <= viewEnd) {
          debouncedDrag(newStartTime, newEndTime);
        }
      }

      setDragOffset(0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartX, dragOffset, pxPerMs, zoom, originalStartTime, originalEndTime, viewStart, viewEnd, debouncedDrag]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      e.stopPropagation();
      if (!isSelected) {
        onSelect(task.id);
      } else {
        onEdit(task);
      }
    },
    [isDragging, isSelected, task, onSelect, onEdit]
  );

  const styles = CATEGORY_STYLES[task.category];

  const popoverContent = (
    <div className="w-80">
      <div className="mb-3 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-gray-900 text-base leading-tight">
            {task.title}
          </h4>
          <Tag color={STATUS_INFO[task.approvalStatus].color as any}>
            {STATUS_INFO[task.approvalStatus].label}
          </Tag>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2 text-gray-600">
          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <div>
              {formatDateTime(task.startTime)} ~{' '}
              {formatDateTime(task.endTime)}
            </div>
            <div className="text-gray-500 text-xs mt-0.5">
              时长：{formatDuration(task.outageDurationH)}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-gray-600">
          <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            {task.applicant}
            <span className="text-gray-400 mx-1">·</span>
            {task.department}
          </div>
        </div>

        <div className="flex items-start gap-2 text-gray-600">
          <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            {getEquipmentName(task, equipments, lines, substations)}
          </div>
        </div>

        <div className="flex items-start gap-2 text-gray-600">
          <Gauge className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            影响 {task.affectedStationIds.length} 座变电站 · 损失{' '}
            {task.lostCapacity} MVA
          </div>
        </div>
      </div>

      {taskConflicts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle
              className={cn(
                'w-4 h-4',
                hasCriticalConflict ? 'text-red-500' : 'text-orange-500'
              )}
            />
            <span
              className={cn(
                'font-medium text-sm',
                hasCriticalConflict ? 'text-red-600' : 'text-orange-600'
              )}
            >
              检测到 {taskConflicts.length} 个冲突
            </span>
          </div>
          <div className="space-y-1.5">
            {taskConflicts.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className={cn(
                  'text-xs p-2 rounded-md',
                  c.severity === 'critical'
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : c.severity === 'warning'
                    ? 'bg-orange-50 text-orange-700 border border-orange-100'
                    : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                )}
              >
                <div className="font-medium">
                  {getConflictTypeLabel(c.type)}
                  <Tag
                    className="ml-2"
                    color={
                      c.severity === 'critical'
                        ? 'error'
                        : c.severity === 'warning'
                        ? 'warning'
                        : 'default'
                    }
                    style={{ fontSize: 10, padding: '0 4px' }}
                  >
                    {getConflictSeverityLabel(c.severity)}
                  </Tag>
                </div>
                <div className="mt-0.5 opacity-80">{c.description}</div>
              </div>
            ))}
            {taskConflicts.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                还有 {taskConflicts.length - 3} 个冲突...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      title={null}
      trigger="hover"
      placement="topLeft"
      mouseEnterDelay={0.2}
      zIndex={1000}
    >
      <div
        ref={containerRef}
        className={cn(
          'absolute rounded-md cursor-pointer select-none',
          'bg-gradient-to-b',
          styles.bgGradient,
          styles.border,
          'border',
          'transition-all duration-100',
          isSelected && 'ring-2 ring-blue-500 ring-offset-1 shadow-lg',
          isDragging && 'opacity-60 z-50',
          hasCriticalConflict && '!border-l-[6px] !border-l-red-600'
        )}
        style={{
          left: displayPosition.left,
          top: displayPosition.top,
          width: displayPosition.width,
          height: TASK_BAR_HEIGHT,
          zIndex: isDragging ? 100 : isSelected ? 50 : 2,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {hasCriticalConflict && (
          <div className="absolute left-0 top-0 bottom-0 flex items-center pl-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          </div>
        )}

        {displayPosition.width > 40 && (
          <div
            className={cn(
              'h-full flex items-center text-xs font-medium truncate',
              styles.text,
              hasCriticalConflict ? 'pl-6 pr-2' : 'px-2'
            )}
          >
            {task.title}
          </div>
        )}
      </div>

      {isDragging && (
        <div
          className="absolute rounded-md border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-30 pointer-events-none"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            height: TASK_BAR_HEIGHT,
            zIndex: 10,
          }}
        />
      )}
    </Popover>
  );
}

function getColumnCount(zoom: GanttZoom, start: number, end: number): number {
  const span = end - start;
  switch (zoom) {
    case 'day':
      return Math.ceil(span / (2 * HOUR_MS));
    case 'week':
      return Math.ceil(span / DAY_MS);
    case 'month':
      return Math.ceil(span / (2 * DAY_MS));
  }
}

function getSnapMs(zoom: GanttZoom): number {
  switch (zoom) {
    case 'day':
      return 30 * 60 * 1000;
    case 'week':
      return HOUR_MS;
    case 'month':
      return 2 * HOUR_MS;
  }
}

function getEquipmentName(
  task: MaintenanceTask,
  equipments: { id: string; name: string }[],
  lines: { id: string; name: string }[],
  substations: { id: string; name: string }[]
): string {
  if (task.equipmentId) {
    const eq = equipments.find((e) => e.id === task.equipmentId);
    if (eq) return eq.name;
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
  return '未指定';
}
