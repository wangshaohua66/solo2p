import { create } from 'zustand';
import type {
  TaskNode,
  Dependency,
  Resource,
  Baseline,
  TimelineGranularity,
  Theme,
  TimelineState,
  UIState,
} from '@/types';
import { DependencyGraph } from '@/core/DependencyGraph';
import { snapToDay } from '@/utils/dateUtils';

export interface GanttState {
  tasks: Record<string, TaskNode>;
  taskOrder: string[];
  dependencies: Dependency[];
  resources: Resource[];
  baselines: Baseline[];
  activeBaselineId: string | null;
  timeline: TimelineState;
  ui: UIState;

  addTask: (task: TaskNode) => void;
  updateTask: (id: string, patch: Partial<TaskNode>) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string, offsetDays?: number) => void;
  moveTask: (id: string, newStartDate: number, cascade?: boolean) => void;
  reorderTask: (id: string, newParentId: string | null, newOrder: number) => void;
  reorderTreeRow: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  toggleTaskCollapsed: (id: string) => void;
  addDependency: (dep: Omit<Dependency, 'id'>) => void;
  removeDependency: (id: string) => void;
  saveBaseline: (name: string) => void;
  deleteBaseline: (id: string) => void;
  setActiveBaseline: (id: string | null) => void;
  toggleTheme: () => void;
  setTimelineGranularity: (g: TimelineGranularity) => void;
  setTimelineScroll: (x: number, y: number) => void;
  setTimelineView: (start: number, end: number) => void;
  wheelZoomTimeline: (deltaY: number, anchorX?: number) => void;
  setSelectedTask: (id: string | null) => void;
  setShowResourcePanel: (show: boolean) => void;
  setShowTaskTree: (show: boolean) => void;
  scrollToToday: () => void;
  setDraggingDepFrom: (id: string | null) => void;
  setDetailTaskId: (id: string | null) => void;
  importData: (data: string | Partial<GanttState>) => void;
  exportData: () => string;
  hydrate: (data: Partial<GanttState>) => void;
  getTaskTree: () => TaskNode[];
  computeCriticalPath: () => string[];
}

function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useGanttStore = create<GanttState>((set, get) => ({
  tasks: {},
  taskOrder: [],
  dependencies: [],
  resources: [],
  baselines: [],
  activeBaselineId: null,
  timeline: {
    viewStart: Date.now() - 14 * 24 * 60 * 60 * 1000,
    viewEnd: Date.now() + 90 * 24 * 60 * 60 * 1000,
    granularity: 'week',
    scrollX: 0,
    scrollY: 0,
  },
  ui: {
    theme: 'dark',
    showResourcePanel: true,
    showTaskTree: true,
    selectedTaskId: null,
    highlightedDependencyIds: [],
    criticalPathIds: [],
    draggingDepFrom: null,
    detailTaskId: null,
  },

  addTask: (task) => {
    set(state => {
      const parentId = task.parentId;
      let newOrder = state.taskOrder;
      if (!parentId) {
        newOrder = [...state.taskOrder, task.id];
      }
      return {
        tasks: { ...state.tasks, [task.id]: task },
        taskOrder: newOrder,
      };
    });
  },

  updateTask: (id, patch) => {
    set(state => ({
      tasks: {
        ...state.tasks,
        [id]: { ...state.tasks[id], ...patch },
      },
    }));
  },

  deleteTask: (id) => {
    set(state => {
      const newTasks = { ...state.tasks };
      delete newTasks[id];
      return {
        tasks: newTasks,
        taskOrder: state.taskOrder.filter(t => t !== id),
        dependencies: state.dependencies.filter(d => d.fromTaskId !== id && d.toTaskId !== id),
        ui: state.ui.selectedTaskId === id ? { ...state.ui, selectedTaskId: null, detailTaskId: state.ui.detailTaskId === id ? null : state.ui.detailTaskId } : state.ui,
      };
    });
  },

  duplicateTask: (id, offsetDays = 1) => {
    set(state => {
      const src = state.tasks[id];
      if (!src) return state;
      const DAY = 24 * 60 * 60 * 1000;
      const newId = uid(src.level === 1 ? 'p' : src.level === 2 ? 's' : 't');
      const copy: TaskNode = {
        ...src,
        id: newId,
        name: `${src.name} (副本)`,
        startDate: src.startDate + offsetDays * DAY,
        endDate: src.endDate + offsetDays * DAY,
        progress: 0,
        status: 'not-started',
        order: src.order + 0.5,
      };
      const newTasks = { ...state.tasks, [newId]: copy };
      let newTaskOrder = state.taskOrder;
      if (!src.parentId && !newTaskOrder.includes(newId)) {
        const idx = newTaskOrder.indexOf(id);
        newTaskOrder = idx >= 0
          ? [...newTaskOrder.slice(0, idx + 1), newId, ...newTaskOrder.slice(idx + 1)]
          : [...newTaskOrder, newId];
      }
      return {
        tasks: newTasks,
        taskOrder: newTaskOrder,
        ui: { ...state.ui, selectedTaskId: newId },
      };
    });
  },

  moveTask: (id, newStartDate, cascade = true) => {
    set(state => {
      const task = state.tasks[id];
      if (!task) return state;
      const snapped = snapToDay(newStartDate);
      const duration = task.endDate - task.startDate;
      const newEnd = snapped + duration;

      const updates: Record<string, TaskNode> = { ...state.tasks };
      updates[id] = { ...task, startDate: snapped, endDate: newEnd };

      if (cascade) {
        const graph = new DependencyGraph(updates, state.dependencies);
        const cascaded = graph.getCascadedUpdates(id, snapped);
        for (const u of cascaded) {
          if (u.id !== id && updates[u.id]) {
            updates[u.id] = { ...updates[u.id], startDate: u.startDate, endDate: u.endDate };
          }
        }
      }

      return { tasks: updates };
    });
  },

  reorderTask: (id, newParentId, newOrder) => {
    set(state => {
      const task = state.tasks[id];
      if (!task) return state;
      return {
        tasks: {
          ...state.tasks,
          [id]: { ...task, parentId: newParentId, order: newOrder },
        },
      };
    });
  },

  reorderTreeRow: (sourceId, targetId, position) => {
    set(state => {
      const src = state.tasks[sourceId];
      const tgt = state.tasks[targetId];
      if (!src || !tgt || src.id === tgt.id) return state;
      const sameParent = src.parentId === tgt.parentId;
      const DAY = 24 * 60 * 60 * 1000;
      const siblings = Object.values(state.tasks)
        .filter(t => t.parentId === tgt.parentId && t.id !== sourceId)
        .sort((a, b) => a.order - b.order);
      const tgtIdx = siblings.findIndex(s => s.id === tgt.id);
      const insertIdx = position === 'before' ? tgtIdx : tgtIdx + 1;
      let newOrder = 0;
      if (siblings.length === 0) newOrder = 0;
      else if (insertIdx <= 0) newOrder = (siblings[0]?.order ?? 0) - 1;
      else if (insertIdx >= siblings.length) newOrder = (siblings[siblings.length - 1]?.order ?? siblings.length) + 1;
      else {
        const before = siblings[insertIdx - 1].order;
        const after = siblings[insertIdx].order;
        newOrder = (before + after) / 2;
      }
      const newTasks = { ...state.tasks };
      newTasks[sourceId] = { ...src, parentId: tgt.parentId, order: newOrder };
      let newTaskOrder = state.taskOrder;
      if (!sameParent) {
        const wasRoot = !src.parentId;
        const nowRoot = !tgt.parentId;
        if (wasRoot) newTaskOrder = newTaskOrder.filter(t => t !== sourceId);
        if (nowRoot && !newTaskOrder.includes(sourceId)) {
          const targetRootIdx = newTaskOrder.indexOf(tgt.id);
          const insert = targetRootIdx >= 0 ? (position === 'before' ? targetRootIdx : targetRootIdx + 1) : newTaskOrder.length;
          newTaskOrder = [...newTaskOrder.slice(0, insert), sourceId, ...newTaskOrder.slice(insert)];
        }
      }
      return { tasks: newTasks, taskOrder: newTaskOrder };
    });
  },

  toggleTaskCollapsed: (id) => {
    set(state => ({
      tasks: {
        ...state.tasks,
        [id]: { ...state.tasks[id], collapsed: !state.tasks[id].collapsed },
      },
    }));
  },

  addDependency: (dep) => {
    set(state => ({
      dependencies: [...state.dependencies, { ...dep, id: uid('dep') }],
    }));
  },

  removeDependency: (id) => {
    set(state => ({
      dependencies: state.dependencies.filter(d => d.id !== id),
    }));
  },

  saveBaseline: (name) => {
    set(state => {
      const bl: Baseline = {
        id: uid('bl'),
        name,
        createdAt: Date.now(),
        tasks: Object.values(state.tasks).map(t => ({
          taskId: t.id,
          startDate: t.startDate,
          endDate: t.endDate,
        })),
      };
      return { baselines: [...state.baselines, bl], activeBaselineId: bl.id };
    });
  },

  deleteBaseline: (id) => {
    set(state => ({
      baselines: state.baselines.filter(b => b.id !== id),
      activeBaselineId: state.activeBaselineId === id ? null : state.activeBaselineId,
    }));
  },

  setActiveBaseline: (id) => {
    set({ activeBaselineId: id });
  },

  toggleTheme: () => {
    set(state => ({ ui: { ...state.ui, theme: state.ui.theme === 'dark' ? 'light' : 'dark' } }));
  },

  setTimelineGranularity: (g) => {
    set(state => ({ timeline: { ...state.timeline, granularity: g } }));
  },

  setTimelineScroll: (x, y) => {
    set(state => ({ timeline: { ...state.timeline, scrollX: x, scrollY: y } }));
  },

  setTimelineView: (start, end) => {
    set(state => ({ timeline: { ...state.timeline, viewStart: start, viewEnd: end } }));
  },

  wheelZoomTimeline: (deltaY, anchorX) => {
    const ORDER: TimelineGranularity[] = ['day', 'week', 'month', 'quarter'];
    set(state => {
      const idx = ORDER.indexOf(state.timeline.granularity);
      if (deltaY < 0 && idx > 0) {
        return { timeline: { ...state.timeline, granularity: ORDER[idx - 1] } };
      }
      if (deltaY > 0 && idx < ORDER.length - 1) {
        return { timeline: { ...state.timeline, granularity: ORDER[idx + 1] } };
      }
      const DAY = 24 * 60 * 60 * 1000;
      const factor = deltaY > 0 ? 1.1 : 0.9;
      const range = state.timeline.viewEnd - state.timeline.viewStart;
      const newRange = Math.max(7 * DAY, Math.min(365 * DAY, range * factor));
      const ratio = anchorX != null ? anchorX / 800 : 0.5;
      const anchor = state.timeline.viewStart + range * Math.max(0, Math.min(1, ratio));
      const newStart = Math.round(anchor - (newRange * ratio));
      const newEnd = newStart + newRange;
      return { timeline: { ...state.timeline, viewStart: newStart, viewEnd: newEnd } };
    });
  },

  setSelectedTask: (id) => {
    set(state => ({ ui: { ...state.ui, selectedTaskId: id } }));
  },

  setShowResourcePanel: (show) => {
    set(state => ({ ui: { ...state.ui, showResourcePanel: show } }));
  },

  setShowTaskTree: (show) => {
    set(state => ({ ui: { ...state.ui, showTaskTree: show } }));
  },

  setDraggingDepFrom: (id) => {
    set(state => ({ ui: { ...state.ui, draggingDepFrom: id } }));
  },

  setDetailTaskId: (id) => {
    set(state => ({ ui: { ...state.ui, detailTaskId: id } }));
  },

  scrollToToday: () => {
    const state = get();
    const todayTs = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    if (todayTs < state.timeline.viewStart || todayTs > state.timeline.viewEnd) {
      set({ timeline: { ...state.timeline, viewStart: todayTs - 14 * DAY, viewEnd: todayTs + 60 * DAY } });
    }
    const pxPerDay: Record<string, number> = { day: 60, week: 28, month: 10, quarter: 3 };
    const pw = pxPerDay[state.timeline.granularity] || 28;
    const daysSinceStart = Math.floor((todayTs - state.timeline.viewStart) / DAY);
    set({ timeline: { ...state.timeline, scrollX: Math.max(0, daysSinceStart * pw - 400) } });
  },

  importData: (data) => {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    set(state => ({ ...state, ...parsed }));
  },

  exportData: () => {
    const s = get();
    return JSON.stringify({
      tasks: s.tasks,
      taskOrder: s.taskOrder,
      dependencies: s.dependencies,
      resources: s.resources,
      baselines: s.baselines,
    }, null, 2);
  },

  hydrate: (data) => {
    set(state => ({ ...state, ...data }));
  },

  getTaskTree: () => {
    const s = get();
    const roots = s.taskOrder.map(id => s.tasks[id]).filter(Boolean);
    const sortFn = (a: TaskNode, b: TaskNode) => a.order - b.order;
    function collect(parentId: string | null): TaskNode[] {
      return Object.values(s.tasks)
        .filter(t => t.parentId === parentId)
        .sort(sortFn);
    }
    function build(nodes: TaskNode[]): TaskNode[] {
      const result: TaskNode[] = [];
      for (const node of nodes) {
        result.push(node);
        if (!node.collapsed) {
          result.push(...build(collect(node.id)));
        }
      }
      return result;
    }
    return build(roots.sort(sortFn));
  },

  computeCriticalPath: () => {
    const s = get();
    const graph = new DependencyGraph(s.tasks, s.dependencies);
    return graph.compute().criticalPath;
  },
}));
