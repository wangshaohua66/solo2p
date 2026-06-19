export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'delayed';

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export const DEPENDENCY_TYPE_META: Record<DependencyType, { label: string; desc: string; hotkey: string; idx: number }> = {
  FS: { label: 'FS', desc: '完成到开始 (Finish→Start)', hotkey: '1 / F', idx: 0 },
  SS: { label: 'SS', desc: '开始到开始 (Start→Start)', hotkey: '2 / S', idx: 1 },
  FF: { label: 'FF', desc: '完成到完成 (Finish→Finish)', hotkey: '3 / E', idx: 2 },
  SF: { label: 'SF', desc: '开始到完成 (Start→Finish)', hotkey: '4 / U', idx: 3 },
};

export type TimelineGranularity = 'day' | 'week' | 'month' | 'quarter';

export type ResourcePool = 'product' | 'design' | 'development' | 'testing';

export type Theme = 'light' | 'dark';

export interface TaskNode {
  id: string;
  parentId: string | null;
  level: 1 | 2 | 3;
  name: string;
  startDate: number;
  endDate: number;
  progress: number;
  status: TaskStatus;
  assigneeId: string | null;
  isMilestone: boolean;
  order: number;
  collapsed: boolean;
}

export interface Dependency {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  type: DependencyType;
  lagDays: number;
}

export interface Resource {
  id: string;
  name: string;
  avatar?: string;
  pool: ResourcePool;
  capacityPerDay: number;
}

export interface Baseline {
  id: string;
  name: string;
  createdAt: number;
  tasks: Array<{ taskId: string; startDate: number; endDate: number }>;
}

export interface ResourceLoad {
  resourceId: string;
  date: string;
  workload: number;
  overload: boolean;
  taskIds: string[];
}

export interface ResourceConflict {
  resourceId: string;
  date: string;
  tasks: string[];
  workload: number;
}

export interface DependencyGraphResult {
  topologicalOrder: string[];
  criticalPath: string[];
  earliestStart: Map<string, number>;
  earliestFinish: Map<string, number>;
  latestStart: Map<string, number>;
  latestFinish: Map<string, number>;
  slack: Map<string, number>;
  hasCycle: boolean;
}

export interface ResourceAllocResult {
  loads: Map<string, Map<string, ResourceLoad>>;
  conflicts: ResourceConflict[];
}

export interface TimelineState {
  viewStart: number;
  viewEnd: number;
  granularity: TimelineGranularity;
  scrollX: number;
  scrollY: number;
}

export interface UIState {
  theme: Theme;
  showResourcePanel: boolean;
  showTaskTree: boolean;
  selectedTaskId: string | null;
  highlightedDependencyIds: string[];
  criticalPathIds: string[];
  draggingDepFrom: string | null;
  draggingDepType: DependencyType;
  detailTaskId: string | null;
}

export type TaskRow = {
  id: string;
  task: TaskNode;
  depth: number;
  visible: boolean;
};
