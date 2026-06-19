import { useRef, useCallback, useEffect } from 'react';
import type { TaskNode } from '@/types';

interface DragState {
  isDragging: boolean;
  mode: 'move' | 'resize-left' | 'resize-right' | 'reorder' | null;
  startX: number;
  startY: number;
  originalStart: number;
  originalEnd: number;
  originalOrder: number;
  taskId: string;
}

interface UseDragTaskOptions {
  onMove?: (taskId: string, newStartDate: number, newEndDate?: number) => void;
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
  });
  const rafId = useRef<number>(0);
  const listenersAttached = useRef(false);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragState.current.isDragging) return;
    const state = dragState.current;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (state.mode === 'move') {
        const snapDays = Math.round(dx / options.dayWidth);
        const deltaMs = snapDays * 24 * 60 * 60 * 1000;
        options.onMove?.(state.taskId, state.originalStart + deltaMs, state.originalEnd + deltaMs);
      } else if (state.mode === 'resize-left') {
        const snapDays = Math.round(dx / options.dayWidth);
        const deltaMs = snapDays * 24 * 60 * 60 * 1000;
        const newStart = Math.max(state.originalStart + deltaMs, state.originalEnd - 24 * 60 * 60 * 1000);
        options.onMove?.(state.taskId, newStart, state.originalEnd);
      } else if (state.mode === 'resize-right') {
        const snapDays = Math.round(dx / options.dayWidth);
        const deltaMs = snapDays * 24 * 60 * 60 * 1000;
        const newEnd = Math.max(state.originalEnd + deltaMs, state.originalStart + 24 * 60 * 60 * 1000);
        options.onMove?.(state.taskId, state.originalStart, newEnd);
      }
    });
  }, [options]);

  const handlePointerUp = useCallback(() => {
    const state = dragState.current;
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
    };
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    listenersAttached.current = false;
    if (rafId.current) cancelAnimationFrame(rafId.current);
  }, [options, handlePointerMove]);

  const startDrag = useCallback((e: React.PointerEvent, task: TaskNode, mode: 'move' | 'resize-left' | 'resize-right') => {
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
