import { useMemo, useCallback } from 'react';
import { Radio, Button, Tooltip, Slider, Space } from 'antd';
import { Target } from 'lucide-react';
import type { GanttZoom, TimeAxisItem } from '@/types';
import { useUIStore } from '@/store/uiStore';
import { HOUR_MS, DAY_MS } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';

export interface TimelineHeaderProps {
  zoom: GanttZoom;
  onZoomChange: (zoom: GanttZoom) => void;
  viewStart: number;
  viewEnd: number;
  columnWidth: number;
  scrollLeft: number;
  onTodayClick: () => void;
  onColumnWidthChange?: (width: number) => void;
  minColumnWidth?: number;
  maxColumnWidth?: number;
}

const HEADER_ROW_HEIGHT = 28;
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function TimelineHeader({
  zoom,
  onZoomChange,
  viewStart,
  viewEnd,
  columnWidth,
  scrollLeft,
  onTodayClick,
  onColumnWidthChange,
  minColumnWidth = 40,
  maxColumnWidth = 200,
}: TimelineHeaderProps) {
  const { setGanttZoom } = useUIStore((state) => ({
    setGanttZoom: state.setGanttZoom,
  }));

  const pxPerMs = useMemo(() => {
    const totalMs = viewEnd - viewStart;
    const totalCols = getColumnCount(zoom, viewStart, viewEnd);
    return (totalCols * columnWidth) / totalMs;
  }, [zoom, viewStart, viewEnd, columnWidth]);

  const timeAxis = useMemo(() => {
    return generateTimeAxis(viewStart, viewEnd, zoom);
  }, [viewStart, viewEnd, zoom]);

  const totalWidth = useMemo(() => {
    return (viewEnd - viewStart) * pxPerMs;
  }, [viewStart, viewEnd, pxPerMs]);

  const handleZoomChange = useCallback(
    (value: GanttZoom) => {
      onZoomChange(value);
      setGanttZoom(value);
    },
    [onZoomChange, setGanttZoom]
  );

  const handleColumnWidthChange = useCallback(
    (value: number) => {
      onColumnWidthChange?.(value);
    },
    [onColumnWidthChange]
  );

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-4">
          <Space.Compact>
            <Radio.Group
              value={zoom}
              onChange={(e) => handleZoomChange(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value="day">日视图</Radio.Button>
              <Radio.Button value="week">周视图</Radio.Button>
              <Radio.Button value="month">月视图</Radio.Button>
            </Radio.Group>
          </Space.Compact>

          {onColumnWidthChange && (
            <div className="flex items-center gap-2 w-40">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                列宽
              </span>
              <Slider
                min={minColumnWidth}
                max={maxColumnWidth}
                value={columnWidth}
                onChange={handleColumnWidthChange}
                tooltip={{ formatter: (value) => `${value}px` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tooltip title="定位到今日">
            <Button
              size="small"
              icon={<Target className="w-3.5 h-3.5" />}
              onClick={onTodayClick}
            >
              今日
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="relative overflow-hidden" style={{ height: HEADER_ROW_HEIGHT * 2 }}>
        <div
          className="absolute top-0 left-0"
          style={{
            width: totalWidth,
            transform: `translateX(${-scrollLeft}px)`,
          }}
        >
          <div
            className="flex border-b border-gray-200"
            style={{ height: HEADER_ROW_HEIGHT }}
          >
            {timeAxis.topLevel.map((item, index) => (
              <TopLevelCell
                key={`top-${index}`}
                item={item}
                columnWidth={columnWidth}
                zoom={zoom}
                index={index}
              />
            ))}
          </div>

          <div className="flex" style={{ height: HEADER_ROW_HEIGHT }}>
            {timeAxis.bottomLevel.map((item, index) => (
              <BottomLevelCell
                key={`bottom-${index}`}
                item={item}
                columnWidth={columnWidth}
                zoom={zoom}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopLevelCell({
  item,
  columnWidth,
  zoom,
  index,
}: {
  item: TimeAxisItem;
  columnWidth: number;
  zoom: GanttZoom;
  index: number;
}) {
  const date = new Date(item.ts);
  const isWeekend = item.dayOfWeek === 0 || item.dayOfWeek === 6;

  let width: number;
  let content: React.ReactNode;

  switch (zoom) {
    case 'day':
      width = columnWidth * 12;
      content = (
        <span className="font-medium text-gray-700">
          {`${date.getMonth() + 1}月${date.getDate()}日`}
        </span>
      );
      break;
    case 'week':
      width = columnWidth * 7;
      content = (
        <span className="font-medium text-gray-700">
          {`${date.getFullYear()}年第${getWeekNumber(date)}周`}
        </span>
      );
      break;
    case 'month':
      width = columnWidth * (getDaysInMonth(date) / 2);
      content = (
        <span className="font-medium text-gray-700">
          {`${date.getFullYear()}年${date.getMonth() + 1}月`}
        </span>
      );
      break;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center text-sm border-r border-gray-200',
        isWeekend && zoom !== 'day' ? 'bg-gray-50' : 'bg-white'
      )}
      style={{ width, flexShrink: 0 }}
    >
      {index % (zoom === 'day' ? 1 : 1) === 0 && content}
    </div>
  );
}

function BottomLevelCell({
  item,
  columnWidth,
  zoom,
}: {
  item: TimeAxisItem;
  columnWidth: number;
  zoom: GanttZoom;
}) {
  const date = new Date(item.ts);
  const isWeekend = item.dayOfWeek === 0 || item.dayOfWeek === 6;
  const isToday = isSameDay(date, new Date());

  let label: string;

  switch (zoom) {
    case 'day':
      label = `${date.getHours().toString().padStart(2, '0')}:00`;
      break;
    case 'week':
      label = WEEKDAY_NAMES[item.dayOfWeek];
      break;
    case 'month':
      label = `${date.getMonth() + 1}/${date.getDate()}`;
      break;
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-xs border-r border-gray-100 relative',
        isWeekend && zoom !== 'day' ? 'bg-gray-50 text-gray-400' : 'text-gray-600',
        isToday && 'bg-red-50'
      )}
      style={{ width: columnWidth, flexShrink: 0 }}
    >
      <span
        className={cn(
          isToday && 'text-red-600 font-semibold',
          zoom === 'week' && isWeekend && 'text-red-400'
        )}
      >
        {label}
      </span>
      {zoom === 'week' && (
        <span className="text-[10px] text-gray-400">
          {date.getDate()}日
        </span>
      )}
      {isToday && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" />
      )}
    </div>
  );
}

function generateTimeAxis(
  start: number,
  end: number,
  zoom: GanttZoom
): { topLevel: TimeAxisItem[]; bottomLevel: TimeAxisItem[] } {
  const topLevel: TimeAxisItem[] = [];
  const bottomLevel: TimeAxisItem[] = [];

  let stepMs: number;
  let topStepMs: number;

  switch (zoom) {
    case 'day':
      stepMs = 2 * HOUR_MS;
      topStepMs = DAY_MS;
      break;
    case 'week':
      stepMs = DAY_MS;
      topStepMs = 7 * DAY_MS;
      break;
    case 'month':
      stepMs = 2 * DAY_MS;
      topStepMs = getMonthStepMs(start);
      break;
  }

  const startDate = new Date(start);
  const alignedStart = getAlignedStart(startDate, zoom).getTime();

  for (let ts = alignedStart; ts < end + topStepMs; ts += topStepMs) {
    const d = new Date(ts);
    topLevel.push({
      ts,
      label: '',
      dayOfWeek: d.getDay(),
    });
  }

  for (let ts = alignedStart; ts < end + stepMs; ts += stepMs) {
    const d = new Date(ts);
    bottomLevel.push({
      ts,
      label: '',
      dayOfWeek: d.getDay(),
    });
  }

  return { topLevel, bottomLevel };
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

function getAlignedStart(date: Date, zoom: GanttZoom): Date {
  const d = new Date(date);

  switch (zoom) {
    case 'day':
      d.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diff);
      break;
    }
    case 'month':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
  }

  return d;
}

function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getMonthStepMs(ts: number): number {
  const d = new Date(ts);
  const days = getDaysInMonth(d);
  return days * DAY_MS;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
