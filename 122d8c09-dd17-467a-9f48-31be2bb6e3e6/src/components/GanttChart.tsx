import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
import type { TaskNode, TimelineGranularity, Baseline, DependencyType } from '@/types';
import { DEPENDENCY_TYPE_META } from '@/types';
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

function getDepEndpointsByType(
  fromTask: TaskNode,
  to: { x: number; y: number },
  type: DependencyType,
  dateToPixel: (d: number) => number,
  fromTop: number,
  rowHeight: number
): { fx: number; fy: number; tx: number; ty: number } {
  const fl = dateToPixel(fromTask.startDate);
  const fr = dateToPixel(fromTask.endDate);
  const cy = fromTop + rowHeight / 2;
  switch (type) {
    case 'FS':
      return { fx: fr, fy: cy, tx: to.x, ty: to.y };
    case 'SS':
      return { fx: fl, fy: cy, tx: to.x, ty: to.y };
    case 'FF':
      return { fx: fr, fy: cy, tx: to.x, ty: to.y };
    case 'SF':
      return { fx: fl, fy: cy, tx: to.x, ty: to.y };
  }
}

export const GanttChart = memo(function GanttChart({ rowHeight }: GanttChartProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const getTaskTree = useGanttStore(s => s.getTaskTree);
  const granularity = useGanttStore(s => s.timeline.granularity);
  const viewStart = useGanttStore(s => s.timeline.viewStart);
  const viewEnd = useGanttStore(s => s.timeline.viewEnd);
  const setSelectedTask = useGanttStore(s => s.setSelectedTask);
  const tasks = useGanttStore(s => s.tasks);
  const baselines = useGanttStore(s => s.baselines);
  const activeBaselineId = useGanttStore(s => s.activeBaselineId);
  const draggingDepFrom = useGanttStore(s => s.ui.draggingDepFrom);
  const draggingDepType = useGanttStore(s => s.ui.draggingDepType);
  const setDraggingDepFrom = useGanttStore(s => s.setDraggingDepFrom);
  const setDraggingDepType = useGanttStore(s => s.setDraggingDepType);
  const scrollX = useGanttStore(s => s.timeline.scrollX);
  const scrollY = useGanttStore(s => s.timeline.scrollY);
  const setTimelineScroll = useGanttStore(s => s.setTimelineScroll);
  const wheelZoomTimeline = useGanttStore(s => s.wheelZoomTimeline);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [depDragMouse, setDepDragMouse] = useState<{ x: number; y: number } | null>(null);

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

  const activeBaseline: Baseline | undefined = useMemo(() => {
    return baselines.find(b => b.id === activeBaselineId);
  }, [baselines, activeBaselineId]);

  const baselineOverlays = useMemo(() => {
    if (!activeBaseline) return [];
    return activeBaseline.tasks.map(bt => {
      const task = tasks[bt.taskId];
      const top = taskTopMap.get(bt.taskId);
      if (top === undefined) return null;
      const blLeft = dateToPixel(bt.startDate);
      const blWidth = Math.max(8, dateToPixel(bt.endDate) - dateToPixel(bt.startDate));
      let diffDays = 0;
      if (task) {
        diffDays = Math.round((task.startDate - bt.startDate) / DAY_MS);
      }
      return {
        taskId: bt.taskId,
        top,
        left: blLeft,
        width: blWidth,
        diffDays,
        hasTask: !!task,
        isDelayed: diffDays > 0,
        isEarly: diffDays < 0,
      };
    }).filter(Boolean) as Array<{
      taskId: string; top: number; left: number; width: number;
      diffDays: number; hasTask: boolean; isDelayed: boolean; isEarly: boolean;
    }>;
  }, [activeBaseline, tasks, taskTopMap, dateToPixel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = scrollX;
    el.scrollTop = scrollY;
  }, [scrollX, scrollY]);

  useEffect(() => {
    if (!draggingDepFrom) {
      setDepDragMouse(null);
      return;
    }
    function handleMove(e: PointerEvent) {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const rect = scrollEl.getBoundingClientRect();
      setDepDragMouse({
        x: e.clientX - rect.left + scrollEl.scrollLeft,
        y: e.clientY - rect.top + scrollEl.scrollTop,
      });
    }
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, [draggingDepFrom]);

  useEffect(() => {
    if (!draggingDepFrom) return;
    const TYPE_ORDER: DependencyType[] = ['FS', 'SS', 'FF', 'SF'];
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      let next: DependencyType | null = null;
      if (e.key === '1' || k === 'f') next = 'FS';
      else if (e.key === '2' || k === 's') next = 'SS';
      else if (e.key === '3' || k === 'e') next = 'FF';
      else if (e.key === '4' || k === 'u') next = 'SF';
      else if (e.key === 'Tab') {
        e.preventDefault();
        const idx = TYPE_ORDER.indexOf(draggingDepType);
        const dir = e.shiftKey ? -1 : 1;
        next = TYPE_ORDER[(idx + dir + 4) % 4];
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const idx = TYPE_ORDER.indexOf(draggingDepType);
        next = TYPE_ORDER[(idx + 1) % 4];
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const idx = TYPE_ORDER.indexOf(draggingDepType);
        next = TYPE_ORDER[(idx + 3) % 4];
      } else if (e.key === 'Escape') {
        setDraggingDepFrom(null);
        return;
      }
      if (next && next !== draggingDepType) {
        setDraggingDepType(next);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draggingDepFrom, draggingDepType, setDraggingDepType, setDraggingDepFrom]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setTimelineScroll(e.currentTarget.scrollLeft, e.currentTarget.scrollTop);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const offsetX = e.nativeEvent.offsetX;
    wheelZoomTimeline(e.deltaY, offsetX);
  };

  const depDragLine = useMemo(() => {
    if (!draggingDepFrom || !depDragMouse) return null;
    const fromTask = tasks[draggingDepFrom];
    if (!fromTask) return null;
    const top = getTaskTop(draggingDepFrom);
    const { fx, fy, tx, ty } = getDepEndpointsByType(
      fromTask,
      { x: depDragMouse.x, y: depDragMouse.y },
      draggingDepType,
      dateToPixel,
      top,
      rowHeight
    );
    const midX = (fx + tx) / 2;
    const path = `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty}, ${tx} ${ty}`;
    const labelX = midX;
    const labelY = Math.min(fy, ty) - 14;
    return { path, labelX, labelY, fx, fy };
  }, [draggingDepFrom, depDragMouse, tasks, getTaskTop, draggingDepType, dateToPixel, rowHeight]);

  const depMeta = DEPENDENCY_TYPE_META[draggingDepType];
  const typeColor: Record<DependencyType, string> = {
    FS: '#3B82F6',
    SS: '#10B981',
    FF: '#8B5CF6',
    SF: '#F59E0B',
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

          {activeBaseline && baselineOverlays.map(b => (
            <div key={`bl-${b.taskId}`}>
              <div
                className={`absolute pointer-events-none z-[3] rounded-sm border-2 border-dashed ${
                  b.isDelayed
                    ? 'border-rose-400/70 bg-rose-500/10'
                    : b.isEarly
                      ? 'border-sky-400/70 bg-sky-500/10'
                      : 'border-emerald-400/70 bg-emerald-500/10'
                }`}
                style={{
                  left: b.left,
                  top: b.top + 2,
                  width: b.width,
                  height: rowHeight - 4,
                }}
              >
                <div className={`absolute -top-4 left-0 text-[9px] font-bold whitespace-nowrap px-1 rounded ${
                  b.isDelayed
                    ? 'bg-rose-500/80 text-white'
                    : b.isEarly
                      ? 'bg-sky-500/80 text-white'
                      : 'bg-emerald-500/80 text-white'
                }`}>
                  基线 {b.diffDays === 0 ? '✓ 如期' : b.isDelayed ? `延期 ${b.diffDays}d` : `提前 ${-b.diffDays}d`}
                </div>
              </div>
              {b.hasTask && b.diffDays !== 0 && (
                <svg
                  className="absolute inset-0 pointer-events-none z-[4]"
                  width={totalWidth}
                  height={totalHeight}
                >
                  <defs>
                    <marker id={`bl-arrow-${b.taskId}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={b.isDelayed ? '#F43F5E' : '#0EA5E9'} />
                    </marker>
                  </defs>
                  <line
                    x1={dateToPixel(tasks[b.taskId].startDate)}
                    y1={b.top + rowHeight / 2 - 8}
                    x2={b.left}
                    y2={b.top + rowHeight / 2 - 8}
                    stroke={b.isDelayed ? '#F43F5E' : '#0EA5E9'}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    markerEnd={`url(#bl-arrow-${b.taskId})`}
                    opacity={0.8}
                  />
                </svg>
              )}
            </div>
          ))}

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

          {depDragLine && (
            <svg
              className="absolute inset-0 pointer-events-none z-[50]"
              width={totalWidth}
              height={totalHeight}
            >
              <defs>
                <marker id="dep-drag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={typeColor[draggingDepType]} />
                </marker>
              </defs>
              <path
                d={depDragLine.path}
                fill="none"
                stroke={typeColor[draggingDepType]}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray="6 4"
                markerEnd="url(#dep-drag-arrow)"
                opacity={0.95}
              >
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.6s" repeatCount="indefinite" />
              </path>
              <circle
                cx={depDragLine.fx}
                cy={depDragLine.fy}
                r={6}
                fill={typeColor[draggingDepType]}
                fillOpacity={0.2}
                stroke={typeColor[draggingDepType]}
                strokeWidth={2}
              />
              {depDragMouse && (
                <circle
                  cx={depDragMouse.x}
                  cy={depDragMouse.y}
                  r={8}
                  fill={typeColor[draggingDepType]}
                  fillOpacity={0.2}
                  stroke={typeColor[draggingDepType]}
                  strokeWidth={2}
                />
              )}
              <g transform={`translate(${depDragLine.labelX}, ${depDragLine.labelY})`}>
                <rect
                  x={-30}
                  y={-10}
                  width={60}
                  height={18}
                  rx={9}
                  fill={typeColor[draggingDepType]}
                  opacity={0.92}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="#FFFFFF"
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                >
                  {depMeta.label}
                </text>
              </g>
            </svg>
          )}

          {draggingDepFrom && (
            <>
              <div
                className={`fixed top-16 left-1/2 -translate-x-1/2 z-[200] shadow-2xl rounded-xl border-2 overflow-hidden ${
                  theme === 'dark'
                    ? 'bg-slate-800/95 border-slate-700'
                    : 'bg-white/95 border-slate-200'
                } backdrop-blur animate-[fadeIn_150ms_ease-out]`}
              >
                <div className={`px-4 py-2 flex items-center gap-2 border-b ${
                  theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                }`}>
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold text-xs text-white`}
                    style={{ backgroundColor: typeColor[draggingDepType] }}
                  >
                    {depMeta.label}
                  </span>
                  <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                    {depMeta.desc}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className={`grid grid-cols-4 gap-0.5 p-2`}>
                  {(['FS', 'SS', 'FF', 'SF'] as const).map(t => {
                    const m = DEPENDENCY_TYPE_META[t];
                    const active = t === draggingDepType;
                    return (
                      <button
                        key={t}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraggingDepType(t);
                        }}
                        className={`flex flex-col items-center px-2 py-1.5 rounded-lg transition-all ${
                          active
                            ? 'text-white scale-[1.02] shadow-md'
                            : theme === 'dark'
                              ? 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                        style={active ? { backgroundColor: typeColor[t] } : undefined}
                      >
                        <span className="font-mono font-bold text-sm">{m.label}</span>
                        <span className={`text-[9px] mt-0.5 ${active ? 'opacity-90' : ''}`}>
                          {m.hotkey}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className={`px-3 py-1.5 text-[10px] border-t flex items-center justify-between ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <span>⌨ 1-4 / F S E U / Tab 切换类型</span>
                  <span>ESC 取消</span>
                </div>
              </div>
              <style>{`
                @keyframes fadeIn {
                  from { opacity: 0; transform: translate(-50%, -6px); }
                  to { opacity: 1; transform: translate(-50%, 0); }
                }
                @keyframes contextIn {
                  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
                  to { opacity: 1; transform: scale(1) translateY(0); }
                }
              `}</style>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
