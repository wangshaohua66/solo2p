import React, { memo, useRef } from 'react';
import type { TaskNode } from '@/types';
import { useGanttStore } from '@/store/useGanttStore';
import { ChevronRight, ChevronDown, Diamond, Circle, User, GripVertical } from 'lucide-react';
import { statusColor, initials } from '@/utils/colorUtils';
import { formatDate } from '@/utils/dateUtils';

interface TaskTreeProps {
  rowHeight: number;
  onTaskClick?: () => void;
}

interface TaskNodeRowProps {
  task: TaskNode;
  depth: number;
  rowHeight: number;
  onTaskClick?: () => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
}

const TaskNodeRow = memo(function TaskNodeRow({
  task,
  depth,
  rowHeight,
  onTaskClick,
  draggingId,
  setDraggingId,
}: TaskNodeRowProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const selectedId = useGanttStore(s => s.ui.selectedTaskId);
  const tasks = useGanttStore(s => s.tasks);
  const toggleCollapsed = useGanttStore(s => s.toggleTaskCollapsed);
  const setSelectedTask = useGanttStore(s => s.setSelectedTask);
  const setDetailTaskId = useGanttStore(s => s.setDetailTaskId);
  const reorderTreeRow = useGanttStore(s => s.reorderTreeRow);
  const resources = useGanttStore(s => s.resources);
  const rowRef = useRef<HTMLDivElement>(null);

  const hasChildren = Object.values(tasks).some(t => t.parentId === task.id);
  const colors = statusColor(task.status, theme);
  const assignee = task.assigneeId ? resources.find(r => r.id === task.assigneeId) : null;
  const isSelected = selectedId === task.id;
  const isDragging = draggingId === task.id;

  function handlePointerDown(e: React.PointerEvent) {
    setDraggingId(task.id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!draggingId || draggingId === task.id) return;
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position: 'before' | 'after' = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
    reorderTreeRow(draggingId, task.id, position);
    setDraggingId(null);
  }

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        setDraggingId(task.id);
      }}
      onDragEnd={() => setDraggingId(null)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`group flex items-center gap-1.5 px-2 border-b transition-all cursor-pointer ${
        isDragging ? 'opacity-40 scale-[0.99]' : ''
      } ${
        isSelected
          ? theme === 'dark' ? 'bg-blue-900/30 border-blue-700/40' : 'bg-blue-50 border-blue-200'
          : theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-200 hover:bg-slate-50'
      }`}
      style={{ height: rowHeight, paddingLeft: 8 + depth * 16 }}
      onClick={() => {
        setSelectedTask(task.id);
        onTaskClick?.();
      }}
      onDoubleClick={() => setDetailTaskId(task.id)}
    >
      <div
        onPointerDown={handlePointerDown}
        className={`shrink-0 cursor-grab active:cursor-grabbing rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
          theme === 'dark' ? 'hover:bg-slate-700 text-slate-500' : 'hover:bg-slate-200 text-slate-400'
        }`}
        title="拖拽调整顺序"
      >
        <GripVertical size={12} />
      </div>

      <button
        className={`w-4 h-4 flex items-center justify-center rounded hover:bg-slate-700/50 transition-colors ${!hasChildren ? 'opacity-0 pointer-events-none' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) toggleCollapsed(task.id);
        }}
      >
        {task.collapsed ? (
          <ChevronRight size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} />
        ) : (
          <ChevronDown size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} />
        )}
      </button>

      {task.isMilestone ? (
        <Diamond size={12} className="text-violet-500 shrink-0" fill="currentColor" />
      ) : (
        <Circle size={8} className={`shrink-0`} fill={task.level === 1 ? '#6366F1' : task.level === 2 ? '#0EA5E9' : '#64748B'} />
      )}

      <span
        className={`truncate text-sm font-medium flex-1 ${
          theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
        } ${task.level === 1 ? 'text-base font-semibold' : task.level === 2 ? '' : 'text-xs opacity-90'}`}
      >
        {task.name}
      </span>

      {task.level === 3 && (
        <>
          <div
            className={`w-12 h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}
          >
            <div className={`h-full ${colors.bgProgress}`} style={{ width: `${task.progress}%` }} />
          </div>
          <span className={`text-[10px] tabular-nums w-7 text-right ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            {task.progress}%
          </span>
        </>
      )}

      {assignee && (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600"
          title={assignee.name}
        >
          {initials(assignee.name)}
        </div>
      )}
      {!assignee && task.level === 3 && (
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
            theme === 'dark' ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400'
          }`}
        >
          <User size={10} />
        </div>
      )}

      {task.level <= 2 && (
        <span className={`text-[10px] tabular-nums opacity-60 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          {formatDate(task.startDate, 'short')}
        </span>
      )}
    </div>
  );
});

export const TaskTree = memo(function TaskTree({ rowHeight, onTaskClick }: TaskTreeProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const getTaskTree = useGanttStore(s => s.getTaskTree);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  const rows = getTaskTree();

  function getDepth(task: TaskNode): number {
    let d = 0;
    let cur = task;
    while (cur.parentId) {
      d++;
      const parent = rows.find(r => r.id === cur.parentId);
      if (!parent) break;
      cur = parent;
    }
    return d;
  }

  const depthCache = new Map<string, number>();
  for (const t of rows) depthCache.set(t.id, getDepth(t));

  return (
    <div className={`h-full overflow-auto ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
      <div
        className={`sticky top-0 z-10 h-12 flex items-center justify-between px-3 border-b text-xs font-semibold uppercase tracking-wider ${
          theme === 'dark' ? 'bg-slate-900/95 border-slate-800 text-slate-400' : 'bg-white/95 border-slate-200 text-slate-500'
        } backdrop-blur`}
      >
        <span>任务结构</span>
        <span className={`text-[9px] font-normal normal-case opacity-60 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
          拖拽手柄排序
        </span>
      </div>
      <div>
        {rows.map(task => (
          <TaskNodeRow
            key={task.id}
            task={task}
            depth={depthCache.get(task.id) ?? 0}
            rowHeight={rowHeight}
            onTaskClick={onTaskClick}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
          />
        ))}
      </div>
    </div>
  );
});
