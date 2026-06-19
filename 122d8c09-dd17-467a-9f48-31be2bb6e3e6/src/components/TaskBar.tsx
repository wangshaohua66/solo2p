import React, { memo, useState, useEffect } from 'react';
import { Diamond, Link2 } from 'lucide-react';
import type { TaskNode } from '@/types';
import { useGanttStore } from '@/store/useGanttStore';
import { useDragTask } from '@/hooks/useDragTask';
import { statusColor } from '@/utils/colorUtils';

interface TaskBarProps {
  task: TaskNode;
  top: number;
  height: number;
  dateToPixel: (d: number) => number;
  pixelToDate: (p: number) => number;
  dayWidth: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const TaskBar = memo(function TaskBar({
  task,
  top,
  height,
  dateToPixel,
  pixelToDate,
  dayWidth,
  onDragStart,
  onDragEnd,
}: TaskBarProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const selectedId = useGanttStore(s => s.ui.selectedTaskId);
  const criticalPathIds = useGanttStore(s => s.ui.criticalPathIds);
  const draggingDepFrom = useGanttStore(s => s.ui.draggingDepFrom);
  const setSelectedTask = useGanttStore(s => s.setSelectedTask);
  const moveTask = useGanttStore(s => s.moveTask);
  const updateTask = useGanttStore(s => s.updateTask);
  const duplicateTask = useGanttStore(s => s.duplicateTask);
  const addDependency = useGanttStore(s => s.addDependency);
  const setDraggingDepFrom = useGanttStore(s => s.setDraggingDepFrom);

  const [hovered, setHovered] = useState(false);
  const isSelected = selectedId === task.id;
  const isCritical = criticalPathIds.includes(task.id);
  const isDepDragSource = draggingDepFrom === task.id;
  const isDepDragTarget = draggingDepFrom !== null && draggingDepFrom !== task.id;
  const colors = statusColor(task.status, theme);

  const { startDrag } = useDragTask({
    pixelToDate,
    dateToPixel,
    dayWidth,
    onDragStart: () => {
      onDragStart?.();
      setSelectedTask(task.id);
    },
    onDragEnd: () => {
      onDragEnd?.();
    },
    onMove: (id, newStart, newEnd) => {
      if (newEnd !== undefined) {
        updateTask(id, { startDate: newStart, endDate: newEnd });
      } else {
        moveTask(id, newStart, true);
      }
    },
    onDuplicate: (id, offsetDays) => {
      duplicateTask(id, offsetDays);
    },
  });

  useEffect(() => {
    function handleGlobalPointerUp(e: PointerEvent) {
      if (draggingDepFrom && draggingDepFrom !== task.id) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el) {
          const barEl = el.closest('[data-task-bar-id]') as HTMLElement | null;
          if (barEl && barEl.getAttribute('data-task-bar-id') === task.id) {
            addDependency({
              fromTaskId: draggingDepFrom,
              toTaskId: task.id,
              type: 'FS',
              lagDays: 0,
            });
          }
        }
      }
    }
    function handleGlobalKeyUp(e: KeyboardEvent) {
      if (e.key === 'Escape' && draggingDepFrom) {
        setDraggingDepFrom(null);
      }
    }
    if (draggingDepFrom) {
      window.addEventListener('pointerup', handleGlobalPointerUp);
      window.addEventListener('keyup', handleGlobalKeyUp);
      return () => {
        window.removeEventListener('pointerup', handleGlobalPointerUp);
        window.removeEventListener('keyup', handleGlobalKeyUp);
      };
    }
  }, [draggingDepFrom, task.id, addDependency, setDraggingDepFrom]);

  const left = dateToPixel(task.startDate);
  const width = Math.max(20, dateToPixel(task.endDate) - dateToPixel(task.startDate));

  if (task.level !== 3 && !task.isMilestone) {
    return null;
  }

  if (task.isMilestone) {
    return (
      <div
        className={`absolute flex items-center justify-center cursor-pointer transition-transform ${
          isSelected ? 'z-20 scale-125' : 'z-10 hover:scale-110'
        }`}
        style={{
          left: left - 10,
          top: top + height / 2 - 10,
          width: 20,
          height: 20,
        }}
        data-task-bar-id={task.id}
        onPointerDown={(e) => { e.stopPropagation(); setSelectedTask(task.id); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Diamond
          size={20}
          className={isCritical ? 'text-rose-500' : 'text-violet-500'}
          fill="currentColor"
          strokeWidth={isSelected ? 2.5 : 1.5}
        />
        {hovered && (
          <div
            className={`absolute bottom-full mb-2 px-3 py-2 rounded-lg shadow-xl whitespace-nowrap text-xs z-50 ${
              theme === 'dark' ? 'bg-slate-800 text-slate-100 border border-slate-700' : 'bg-white text-slate-800 border border-slate-200'
            }`}
          >
            <div className="font-semibold text-violet-500">◆ {task.name}</div>
          </div>
        )}
      </div>
    );
  }

  const bgClass = isCritical
    ? (theme === 'dark' ? 'bg-rose-500/70' : 'bg-rose-500/60')
    : colors.bg;

  return (
    <div
      ref={(el) => { if (el) el.dataset.taskBarId = task.id; }}
      data-task-bar-id={task.id}
      className={`absolute rounded-md overflow-hidden cursor-move select-none transition-all ${bgClass} ${
        isSelected
          ? 'ring-2 ring-offset-1 ring-offset-slate-900 ring-blue-400 z-20 shadow-lg'
          : hovered ? 'shadow-md z-10' : 'z-10'
      } ${isCritical ? 'border-2 border-rose-400' : `border ${colors.border}`} ${
        isDepDragSource ? 'ring-2 ring-amber-400 ring-offset-1 z-20 scale-[1.01]' : ''
      } ${isDepDragTarget ? 'ring-2 ring-emerald-400/60 z-20' : ''}`}
      style={{
        left,
        top: top + 4,
        width,
        height: height - 8,
      }}
      onPointerDown={(e) => {
        if (draggingDepFrom) return;
        e.stopPropagation();
        startDrag(e, task, 'move');
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedTask(task.id);
      }}
    >
      <div
        className={`h-full ${colors.bgProgress} opacity-90`}
        style={{ width: `${task.progress}%` }}
      />
      <div
        className="absolute inset-0 flex items-center px-2"
        style={{ mixBlendMode: 'normal' }}
      >
        <span
          className={`text-[11px] font-medium truncate ${colors.text} drop-shadow-sm`}
          style={{ textShadow: theme === 'dark' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none' }}
        >
          {task.name}
        </span>
      </div>

      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 transition-colors"
        onPointerDown={(e) => {
          e.stopPropagation();
          startDrag(e, task, 'resize-left');
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 transition-colors"
        onPointerDown={(e) => {
          e.stopPropagation();
          startDrag(e, task, 'resize-right');
        }}
      />

      <div
        className={`absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-crosshair z-10 transition-all ${
          isDepDragSource
            ? 'bg-amber-400 border-amber-300 scale-125'
            : theme === 'dark'
              ? 'bg-slate-700 border-slate-500 hover:bg-blue-500 hover:border-blue-400 hover:scale-110'
              : 'bg-white border-slate-400 hover:bg-blue-500 hover:border-blue-400 hover:scale-110'
        } ${hovered || draggingDepFrom ? 'opacity-100' : 'opacity-0'}`}
        title="拖拽连线到其他任务建立依赖"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setDraggingDepFrom(task.id);
          setSelectedTask(task.id);
        }}
      >
        <Link2 size={10} className={isDepDragSource ? 'text-slate-900' : theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} />
      </div>

      {hovered && (
        <div
          className={`absolute top-full mt-2 left-0 px-3 py-2 rounded-lg shadow-xl whitespace-nowrap text-xs z-50 pointer-events-none ${
            theme === 'dark' ? 'bg-slate-800 text-slate-100 border border-slate-700' : 'bg-white text-slate-800 border border-slate-200'
          }`}
        >
          <div className="font-semibold">{task.name}</div>
          <div className="opacity-70 mt-0.5">进度 {task.progress}%</div>
          <div className="opacity-50 mt-0.5 text-[10px]">提示：按住 Shift 拖动可复制任务</div>
          {isCritical && <div className="text-rose-400 font-medium mt-0.5">★ 关键路径</div>}
        </div>
      )}
    </div>
  );
});
