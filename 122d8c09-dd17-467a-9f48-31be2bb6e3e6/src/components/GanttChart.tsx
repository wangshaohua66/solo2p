import React, { memo, useMemo, useRef, useEffect } from 'react';
import type { TaskNode, TimelineGranularity } from '@/types';
import { useGanttStore } from '@/store/useGanttStore';
import { TaskBar } from './TaskBar';
import { DependencyLayer } from './DependencyLayer';
import { addDays, formatDate, formatDateKey, isToday, startOfDay, today, DAY_MS } from '@/utils/dateUtils';
import { today as todayMs } from '@/utils/dateUtils';

interface GanttChartProps {
  rowHeight: number;
}

function buildTimeHeaders(viewStart: number, viewEnd: number, granularity: TimelineGranularity): {
  major: Array<{ label: string; start: number; widthPx: number }>;
  minor: Array<{ label: string; start: number; widthPx: number; dayKey: string; isToday: boolean; isWeekend: boolean }>;
  dateToPixel: (d: number) => number;
  pixelToDate: (p: number) => number;
  totalWidth: number;
  dayWidth: number;
} {
  const PX_PER_DAY: Record<TimelineGranularity, number> = {
    day: 60,
    week: 28,
    month: 10,
    quarter: 3,
  };
  const dayWidth = PX_PER_DAY[granularity];
  const vStart = startOfDay(viewStart);
  const vEnd = startOfDay(viewEnd);
  const totalDays = Math.max(1, Math.round((vEnd - vStart) / DAY_MS));
  const totalWidth = totalDays * dayWidth;

  const dateToPixel = (d: number) => Math.round(((startOfDay(d) - vStart) / DAY_MS) * dayWidth);
  const pixelToDate = (p: number) => vStart + Math.round((p / dayWidth) * DAY_MS);

  const minor: ReturnType<typeof buildTimeHeaders>['minor'] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(vStart, i);
    const dow = new Date(d).getDay();
    minor.push({
      label: granularity === 'day' ? formatDate(d, 'day') : formatDate(d, 'day'),
      start: i * dayWidth,
      widthPx: dayWidth,
      dayKey: formatDateKey(d),
      isToday: isToday(d),
      isWeekend: dow === 0 || dow === 6,
    });
  }

  const major: ReturnType<typeof buildTimeHeaders>['major'] = [];
  let curMonth = -1;
  let curYear = -1;
  let monthStart = 0;
  let monthDays = 0;
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(vStart, i);
    const dt = new Date(d);
    const m = dt.getMonth();
    const y = dt.getFullYear();
    if (curMonth === -1) {
      curMonth = m;
      curYear = y;
      monthStart = i;
      monthDays = 1;
    } else if (m === curMonth && y === curYear) {
      monthDays++;
    } else {
      major.push({
        label: `${curYear}年${curMonth + 1}月`,
        start: monthStart * dayWidth,
        widthPx: monthDays * dayWidth,
      });
      curMonth = m;
      curYear = y;
      monthStart = i;
      monthDays = 1;
    }
  }
  if (curMonth !== -1) {
    major.push({
      label: `${curYear}年${curMonth + 1}月`,
      start: monthStart * dayWidth,
      widthPx: monthDays * dayWidth,
    });
  }

  return { major, minor, dateToPixel, pixelToDate, totalWidth, dayWidth };
}

export const GanttChart = memo(function GanttChart({ rowHeight }: GanttChartProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const getTaskTree = useGanttStore(s => s.getTaskTree);
  const granularity = useGanttStore(s => s.timeline.granularity);
  const viewStart = useGanttStore(s => s.timeline.viewStart);
  const viewEnd = useGanttStore(s => s.timeline.viewEnd);
  const setSelectedTask = useGanttStore(s => s.setSelectedTask);
  const tasks = useGanttStore(s => s.tasks);
  const scrollX = useGanttStore(s => s.timeline.scrollX);
  const setTimelineScroll = useGanttStore(s => s.setTimelineScroll);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => getTaskTree(), [getTaskTree, tasks]);

  const timeInfo = useMemo(
    () => buildTimeHeaders(viewStart, viewEnd, granularity),
    [viewStart, viewEnd, granularity]
  );

  const { major, minor, dateToPixel, pixelToDate, totalWidth, dayWidth } = timeInfo;
  const totalHeight = rows.length * rowHeight;

  const taskTopMap = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.id, i * rowHeight));
    return m;
  }, [rows, rowHeight]);

  const getTaskTop = (taskId: string) => taskTopMap.get(taskId) ?? 0;

  const todayPx = dateToPixel(todayMs());
  const todayVisible = todayPx >= 0 && todayPx <= totalWidth;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = scrollX;
  }, [scrollX]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setTimelineScroll(e.currentTarget.scrollLeft, e.currentTarget.scrollTop);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}
      onClick={() => setSelectedTask(null)}
    >
      <div className={`sticky top-0 z-30 border-b ${theme === 'dark' ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-white/95'} backdrop-blur`}>
        <div className="flex border-b" style={{ height: 28 }}>
          <div
            className={`flex items-center text-[11px] font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
            style={{ width: '100%' }}
          >
            {major.map(m => (
              <div
                key={`${m.label}-${m.start}`}
                className={`h-full flex items-center px-2 border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}
                style={{ width: m.widthPx }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>
        <div className="flex" style={{ height: 28 }}>
          <div
            className={`flex items-center text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}
            style={{ width: '100%' }}
          >
            {minor.map(m => (
              <div
                key={m.dayKey}
                className={`h-full flex items-center justify-center border-r tabular-nums ${
                  theme === 'dark' ? 'border-slate-800/70' : 'border-slate-100'
                } ${m.isToday ? 'bg-rose-500/10 text-rose-400 font-bold' : ''} ${
                  m.isWeekend ? (theme === 'dark' ? 'bg-slate-900/40' : 'bg-slate-50') : ''
                }`}
                style={{ width: m.widthPx }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        <div className="relative" style={{ width: totalWidth, minHeight: '100%' }}>
          <div
            className={`absolute top-0 pointer-events-none z-0 ${theme === 'dark' ? 'bg-slate-900/30' : 'bg-slate-100/60'}`}
            style={{ left: 0, width: totalWidth, height: totalHeight }}
          >
            {minor.map((m, i) => (
              <div
                key={m.dayKey}
                className={`absolute top-0 h-full border-r ${
                  m.isWeekend
                    ? (theme === 'dark' ? 'bg-slate-800/20 border-slate-800/40' : 'bg-slate-100/80 border-slate-200/60')
                    : (theme === 'dark' ? 'border-slate-800/30' : 'border-slate-200/40')
                } ${m.isToday ? '!bg-rose-500/5' : ''}`}
                style={{ left: i * dayWidth, width: dayWidth }}
              />
            ))}
            {rows.map((_, i) => (
              <div
                key={i}
                className={`absolute left-0 w-full border-b ${theme === 'dark' ? 'border-slate-800/40' : 'border-slate-200/40'}`}
                style={{ top: i * rowHeight, height: rowHeight }}
              />
            ))}
          </div>

          {todayVisible && (
            <div
              className="absolute top-0 z-10 pointer-events-none"
              style={{ left: todayPx, height: totalHeight }}
            >
              <div className="w-px h-full bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
              <div className="absolute -top-[3.75rem] left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white whitespace-nowrap shadow">
                今天
              </div>
            </div>
          )}

          {rows.map(task => (
            <TaskBar
              key={task.id}
              task={task}
              top={getTaskTop(task.id)}
              height={rowHeight}
              dateToPixel={dateToPixel}
              pixelToDate={pixelToDate}
              dayWidth={dayWidth}
            />
          ))}

          <DependencyLayer
            tasks={tasks}
            dateToPixel={dateToPixel}
            rowHeight={rowHeight}
            getTaskTop={getTaskTop}
            totalWidth={totalWidth}
            totalHeight={totalHeight}
          />
        </div>
      </div>
    </div>
  );
});
