import { useCallback, useMemo } from 'react';
import type {
  MaintenanceTask,
  GanttZoom,
  ConflictInfo,
  MaintenanceCategory,
} from '@/types';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { HOUR_MS, DAY_MS } from '@/utils/dateUtils';

export interface GanttCanvasProps {
  tasks: MaintenanceTask[];
  conflicts: ConflictInfo[];
  selectedTaskId: string | null;
  zoom: GanttZoom;
  viewStart: number;
  viewEnd: number;
  rowHeight: number;
  columnWidth: number;
  scrollLeft: number;
  scrollTop: number;
}

const TASK_BAR_HEIGHT = 24;
const TASK_BAR_MARGIN = 4;

const CATEGORY_GRADIENTS: Record<
  MaintenanceCategory,
  { from: string; to: string; border: string }
> = {
  primary_outage: {
    from: '#FEE2E2',
    to: '#FECACA',
    border: '#DC2626',
  },
  secondary_calibration: {
    from: '#DBEAFE',
    to: '#BFDBFE',
    border: '#2563EB',
  },
  corridor_clearing: {
    from: '#DCFCE7',
    to: '#BBF7D0',
    border: '#16A34A',
  },
  technical_reform: {
    from: '#FFEDD5',
    to: '#FED7AA',
    border: '#EA580C',
  },
};

const TODAY_LINE_COLOR = '#EF4444';
const GRID_LINE_COLOR = '#E5E7EB';
const WEEKEND_BG_COLOR = '#F9FAFB';

export default function GanttCanvas({
  tasks,
  conflicts,
  selectedTaskId,
  zoom,
  viewStart,
  viewEnd,
  rowHeight,
  columnWidth,
  scrollLeft,
  scrollTop,
}: GanttCanvasProps) {
  const conflictTaskIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      if (!c.resolved) {
        ids.add(c.taskAId);
        if (c.taskBId) ids.add(c.taskBId);
      }
    });
    return ids;
  }, [conflicts]);

  const criticalConflictTaskIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      if (!c.resolved && c.severity === 'critical') {
        ids.add(c.taskAId);
        if (c.taskBId) ids.add(c.taskBId);
      }
    });
    return ids;
  }, [conflicts]);

  const pxPerMs = useMemo(() => {
    const totalMs = viewEnd - viewStart;
    const totalCols = getColumnCount(zoom, viewStart, viewEnd);
    return (totalCols * columnWidth) / totalMs;
  }, [zoom, viewStart, viewEnd, columnWidth]);

  const render = useCallback(
    ({ ctx, width, height }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      ctx.clearRect(0, 0, width, height);

      drawGrid(ctx, width, height, viewStart, viewEnd, zoom, rowHeight, columnWidth, scrollLeft, scrollTop, pxPerMs);

      drawTodayLine(ctx, width, height, viewStart, pxPerMs, scrollLeft);

      drawTasks(
        ctx,
        tasks,
        viewStart,
        viewEnd,
        rowHeight,
        columnWidth,
        scrollLeft,
        scrollTop,
        pxPerMs,
        conflictTaskIds,
        criticalConflictTaskIds,
        selectedTaskId
      );
    },
    [
      tasks,
      viewStart,
      viewEnd,
      zoom,
      rowHeight,
      columnWidth,
      scrollLeft,
      scrollTop,
      pxPerMs,
      conflictTaskIds,
      criticalConflictTaskIds,
      selectedTaskId,
    ]
  );

  const canvasRef = useCanvasRenderer({
    render,
    deps: [
      tasks,
      viewStart,
      viewEnd,
      zoom,
      rowHeight,
      columnWidth,
      scrollLeft,
      scrollTop,
      conflictTaskIds,
      criticalConflictTaskIds,
      selectedTaskId,
    ],
  });

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
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

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewStart: number,
  viewEnd: number,
  zoom: GanttZoom,
  rowHeight: number,
  columnWidth: number,
  scrollLeft: number,
  scrollTop: number,
  pxPerMs: number
): void {
  ctx.save();
  ctx.translate(-scrollLeft, -scrollTop);

  const totalWidth = (viewEnd - viewStart) * pxPerMs;
  const visibleStart = viewStart + scrollLeft / pxPerMs;
  const visibleEnd = viewStart + (scrollLeft + width) / pxPerMs;

  const columnMs = getColumnMs(zoom);
  const firstColStart = Math.floor((visibleStart - viewStart) / columnMs) * columnMs;

  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 0.5;

  for (let ms = firstColStart; ms <= (visibleEnd - viewStart) + columnMs; ms += columnMs) {
    const x = ms * pxPerMs;
    const absTime = viewStart + ms;

    const dayOfWeek = new Date(absTime).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend && zoom !== 'day') {
      ctx.fillStyle = WEEKEND_BG_COLOR;
      const nextColStart = ms + columnMs;
      ctx.fillRect(x, 0, columnWidth, height + scrollTop * 2);
    }

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height + scrollTop * 2);
    ctx.stroke();
  }

  const totalRowHeight = rowHeight;
  const visibleRowStart = Math.floor(scrollTop / totalRowHeight);
  const visibleRowEnd = Math.ceil((scrollTop + height) / totalRowHeight) + 1;

  ctx.strokeStyle = '#F3F4F6';
  ctx.lineWidth = 0.5;

  for (let row = visibleRowStart; row <= visibleRowEnd; row++) {
    const y = row * totalRowHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(totalWidth, y);
    ctx.stroke();
  }

  ctx.restore();
}

function getColumnMs(zoom: GanttZoom): number {
  switch (zoom) {
    case 'day':
      return 2 * HOUR_MS;
    case 'week':
      return DAY_MS;
    case 'month':
      return 2 * DAY_MS;
  }
}

function drawTodayLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewStart: number,
  pxPerMs: number,
  scrollLeft: number
): void {
  const now = Date.now();
  const x = (now - viewStart) * pxPerMs - scrollLeft;

  if (x < 0 || x > width) return;

  ctx.save();

  ctx.strokeStyle = TODAY_LINE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.setLineDash([]);

  const label = '今日';
  const labelPaddingX = 8;
  const labelPaddingY = 3;
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  const labelWidth = ctx.measureText(label).width + labelPaddingX * 2;
  const labelHeight = 20;

  const bubbleX = Math.max(4, Math.min(x - labelWidth / 2, width - labelWidth - 4));
  const bubbleY = 8;

  ctx.fillStyle = TODAY_LINE_COLOR;
  roundRect(ctx, bubbleX, bubbleY, labelWidth, labelHeight, 4);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bubbleX + labelWidth / 2, bubbleY + labelHeight / 2);

  ctx.restore();
}

function drawTasks(
  ctx: CanvasRenderingContext2D,
  tasks: MaintenanceTask[],
  viewStart: number,
  viewEnd: number,
  rowHeight: number,
  columnWidth: number,
  scrollLeft: number,
  scrollTop: number,
  pxPerMs: number,
  conflictTaskIds: Set<string>,
  criticalConflictTaskIds: Set<string>,
  selectedTaskId: string | null
): void {
  ctx.save();
  ctx.translate(-scrollLeft, -scrollTop);

  const taskRowMap = new Map<string, number>();
  tasks.forEach((task, index) => {
    taskRowMap.set(task.id, index);
  });

  tasks.forEach((task) => {
    const rowIndex = taskRowMap.get(task.id);
    if (rowIndex === undefined) return;

    const startX = (task.startTime - viewStart) * pxPerMs;
    const endX = (task.endTime - viewStart) * pxPerMs;
    const width = Math.max(8, endX - startX);

    const y = rowIndex * rowHeight + TASK_BAR_MARGIN;
    const height = TASK_BAR_HEIGHT;

    const gradient = CATEGORY_GRADIENTS[task.category];
    const isSelected = selectedTaskId === task.id;
    const hasConflict = conflictTaskIds.has(task.id);
    const isCritical = criticalConflictTaskIds.has(task.id);

    ctx.save();

    if (isSelected) {
      ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }

    const taskGradient = ctx.createLinearGradient(startX, y, startX, y + height);
    taskGradient.addColorStop(0, gradient.from);
    taskGradient.addColorStop(1, gradient.to);

    roundRect(ctx, startX, y, width, height, 4);
    ctx.fillStyle = taskGradient;
    ctx.fill();

    if (hasConflict && isCritical) {
      ctx.fillStyle = '#DC2626';
      roundRect(ctx, startX, y, 6, height, [4, 0, 0, 4]);
      ctx.fill();
    }

    roundRect(ctx, startX, y, width, height, 4);
    ctx.strokeStyle = isSelected ? '#3B82F6' : gradient.border;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    if (hasConflict && isCritical) {
      const iconSize = 14;
      const iconX = startX + 12;
      const iconY = y + height / 2;

      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(iconX, iconY - iconSize / 2);
      ctx.lineTo(iconX + iconSize / 2, iconY + iconSize / 2);
      ctx.lineTo(iconX - iconSize / 2, iconY + iconSize / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', iconX, iconY + 1);
    }

    if (width > 40) {
      const maxTextWidth = width - (hasConflict && isCritical ? 32 : 16);
      if (maxTextWidth > 40) {
        ctx.fillStyle = '#1F2937';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        const textX = startX + (hasConflict && isCritical ? 28 : 8);
        const textY = y + height / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(textX, y, maxTextWidth, height);
        ctx.clip();

        const truncated = truncateText(ctx, task.title, maxTextWidth);
        ctx.fillText(truncated, textX, textY);

        ctx.restore();
      }
    }

    ctx.restore();
  });

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | number[]
): void {
  let r: number[];
  if (typeof radius === 'number') {
    r = [radius, radius, radius, radius];
  } else {
    r = radius;
  }

  ctx.beginPath();
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + width - r[1], y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r[1]);
  ctx.lineTo(x + width, y + height - r[2]);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r[2], y + height);
  ctx.lineTo(x + r[3], y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r[3]);
  ctx.lineTo(x, y + r[0]);
  ctx.quadraticCurveTo(x, y, x + r[0], y);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let result = text;
  const ellipsis = '...';
  const ellipsisWidth = ctx.measureText(ellipsis).width;

  while (result.length > 0 && ctx.measureText(result).width + ellipsisWidth > maxWidth) {
    result = result.slice(0, -1);
  }

  return result + ellipsis;
}
