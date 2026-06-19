import { useRef, useCallback, useEffect } from 'react';
import type { TaskNode } from '@/types';

interface DragState {
  isDragging: boolean;
  mode: 'move' | 'resize-left' | 'resize-right' | 'copy' | null;
  startX: number;
  startY: number;
  originalStart: number;
  originalEnd: number;
  originalOrder: number;
  taskId: string;
  shiftPressed: boolean;
}

interface UseDragTaskOptions {
  onMove?: (taskId: string, newStartDate: number, newEndDate?: number) => void;
  onDuplicate?: (taskId: string, offsetDays: number) => void;
  onReorder?: (taskId: string, dropIndex: number) => void;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: (taskId: string) => void;
  pixelToDate: (px: number) => number;
  dateToPixel: (date: number) => number;
  dayWidth: number;
}

export function useDragTask(options: UseDragTaskOptions) {
  const dragState = useRef<DragState>({
    isDragging: false,
    mode: null,
    startX: 0,
    startY: 0,
    originalStart: 0,
    originalEnd: 0,
    originalOrder: 0,
    taskId: '',
    shiftPressed: false,
  });
  const rafId = useRef<number>(0);
  const listenersAttached = useRef(false);

  const DAY = 24 * 60 * 60 * 1000;

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragState.current.isDragging) return;
    const state = dragState.current;
    const dx = e.clientX - state.startX;
    const isShift = e.shiftKey || state.shiftPressed;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (state.mode === 'move' || state.mode === 'copy') {
        const snapDays = Math.round(dx / options.dayWidth);
        if (isShift || state.mode === 'copy') {
          // copy 模式下不实时修改，只在 dragEnd 处理副本创建
        } else {
          const deltaMs = snapDays * DAY;
          options.onMove?.(state.taskId, state.originalStart + deltaMs, state.originalEnd + deltaMs);
        }
      } else if (state.mode === 'resize-left') {
        const snapDays = Math.round(dx / options.dayWidth);
        const deltaMs = snapDays * DAY;
        const newStart = Math.max(state.originalStart + deltaMs, state.originalEnd - DAY);
        options.onMove?.(state.taskId, newStart, state.originalEnd);
      } else if (state.mode === 'resize-right') {
        const snapDays = Math.round(dx / options.dayWidth);
        const deltaMs = snapDays * DAY;
        const newEnd = Math.max(state.originalEnd + deltaMs, state.originalStart + DAY);
        options.onMove?.(state.taskId, state.originalStart, newEnd);
      }
    });
  }, [options, DAY]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const state = dragState.current;
    const isShift = e.shiftKey || state.shiftPressed;
    const isCopy = state.mode === 'copy' || (state.mode === 'move' && isShift);

    if (state.isDragging && isCopy && state.mode !== 'resize-left' && state.mode !== 'resize-right') {
      const dx = e.clientX - state.startX;
      const offsetDays = Math.max(1, Math.round(dx / options.dayWidth));
      options.onDuplicate?.(state.taskId, offsetDays || 1);
    }

    if (state.isDragging) {
      options.onDragEnd?.(state.taskId);
    }

    dragState.current = {
      isDragging: false,
      mode: null,
      startX: 0,
      startY: 0,
      originalStart: 0,
      originalEnd: 0,
      originalOrder: 0,
      taskId: '',
      shiftPressed: false,
    };
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    listenersAttached.current = false;
    if (rafId.current) cancelAnimationFrame(rafId.current);
  }, [options, handlePointerMove]);

  const startDrag = useCallback((
    e: React.PointerEvent,
    task: TaskNode,
    mode: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      isDragging: true,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      originalStart: task.startDate,
      originalEnd: task.endDate,
      originalOrder: task.order,
      taskId: task.id,
      shiftPressed: e.shiftKey,
    };
    options.onDragStart?.(task.id);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    listenersAttached.current = true;
  }, [options, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    return () => {
      if (listenersAttached.current) {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      }
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [handlePointerMove, handlePointerUp]);

  return { startDrag, isDragging: dragState.current.isDragging };
}
