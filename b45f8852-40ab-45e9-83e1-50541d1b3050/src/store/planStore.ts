import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import type {
  MaintenanceTask,
  ConflictInfo,
  PlanFilters,
  ApprovalEntry,
  ApprovalRole,
  UserLevel,
  OutageLevel,
} from '@/types';
import {
  detectConflicts,
  filterTasksByStatus,
  filterTasksByCategory,
  filterTasksByTimeRange,
  filterTasksByKeyword,
  filterTasksByDepartment,
} from '@/utils/conflictDetector';
import { calculateOutageScope } from '@/utils/topologyAnalyzer';
import {
  generateId,
  calculateDurationH,
  debounce,
} from '@/utils/dateUtils';
import { mockTasks } from '@/data/mockTasks';
import { useEquipmentStore } from './equipmentStore';

interface PlanState {
  tasks: MaintenanceTask[];
  conflicts: ConflictInfo[];
  filters: PlanFilters;
  selectedTaskId: string | null;
  editingTask: Partial<MaintenanceTask> | null;
  loading: boolean;
  filteredTasks: MaintenanceTask[];
}

interface PlanActions {
  initTasks: () => Promise<void>;
  setFilters: (partial: Partial<PlanFilters>) => void;
  createTask: (partialTask: Partial<MaintenanceTask>) => Promise<void>;
  updateTask: (id: string, patch: Partial<MaintenanceTask>) => void;
  deleteTask: (id: string) => void;
  submitForApproval: (id: string) => void;
  approve: (id: string, role: ApprovalRole, comment?: string) => void;
  reject: (id: string, comment: string, role: ApprovalRole) => void;
  setSelectedTask: (id: string | null) => void;
  setEditingTask: (partial: Partial<MaintenanceTask> | null) => void;
  commitEditing: () => void;
  recomputeConflicts: () => void;
}

export type PlanStore = PlanState & PlanActions;

const PLAN_CACHE_KEY = 'plan_store_tasks_v2_202607';
const PLAN_ARCHIVE_KEY = 'plan_store_archive_v2_202607';
const MAX_ARCHIVE_ITEMS = 5000;

const initialFilters: PlanFilters = {
  timeRange: undefined,
  voltageLevels: undefined,
  categories: undefined,
  statuses: undefined,
  keyword: undefined,
  department: undefined,
};

const initialState: PlanState = {
  tasks: [],
  conflicts: [],
  filters: initialFilters,
  selectedTaskId: null,
  editingTask: null,
  loading: false,
  filteredTasks: [],
};

const loadTasksFromCache = (): MaintenanceTask[] | null => {
  try {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem(PLAN_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
};

const saveTasksToCache = (tasks: MaintenanceTask[]): void => {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(tasks));
  } catch {
    // ignore
  }
};

const archiveOldTask = (task: MaintenanceTask): void => {
  try {
    if (typeof window === 'undefined') return;
    const archiveData = localStorage.getItem(PLAN_ARCHIVE_KEY);
    let archive: MaintenanceTask[] = archiveData ? JSON.parse(archiveData) : [];

    archive.push(task);

    if (archive.length > MAX_ARCHIVE_ITEMS) {
      archive = archive.slice(archive.length - MAX_ARCHIVE_ITEMS);
    }

    localStorage.setItem(PLAN_ARCHIVE_KEY, JSON.stringify(archive));
  } catch {
    // ignore
  }
};

const computeFilteredTasks = (
  tasks: MaintenanceTask[],
  filters: PlanFilters,
  substations: { id: string; voltageLevel: string }[] = []
): MaintenanceTask[] => {
  let result = tasks;
  result = filterTasksByStatus(result, filters.statuses);
  result = filterTasksByCategory(result, filters.categories);
  result = filterTasksByTimeRange(result, filters.timeRange);
  result = filterTasksByKeyword(result, filters.keyword);
  result = filterTasksByDepartment(result, filters.department);

  if (filters.voltageLevels && filters.voltageLevels.length > 0) {
    const voltageLevels = filters.voltageLevels;
    result = result.filter((task) => {
      if (task.affectedStationIds.length === 0) return false;
      return task.affectedStationIds.some((sid) => {
        const station = substations.find((s) => s.id === sid);
        return station && voltageLevels.includes(station.voltageLevel as any);
      });
    });
  }

  return result;
};

const createApprovalLogEntry = (
  taskId: string,
  action: ApprovalEntry['action'],
  role?: ApprovalRole,
  comment?: string
): ApprovalEntry => {
  const operatorMap: Record<ApprovalRole, { id: string; name: string }> = {
    reviewer: { id: 'user-010', name: '李审核' },
    approver: { id: 'user-020', name: '王批准' },
  };

  const isSubmitAction = action === 'submit';
  const operator = isSubmitAction
    ? { id: 'user-001', name: '张工' }
    : operatorMap[role!];

  return {
    id: generateId('log'),
    taskId,
    operatorId: operator.id,
    operatorName: operator.name,
    action,
    role,
    comment,
    operatedAt: Date.now(),
  };
};

interface OutageScopeResult {
  affectedStationIds: string[];
  lostCapacity: number;
  outageLevel: OutageLevel;
}

let debouncedConflictDetection: ((tasks: MaintenanceTask[]) => void) | null =
  null;

export const usePlanStore = create<PlanStore>()(
  devtools(
    (set, get) => {
      if (!debouncedConflictDetection) {
        debouncedConflictDetection = debounce((tasks: MaintenanceTask[]) => {
          const newConflicts = detectConflicts(tasks);
          set({ conflicts: newConflicts });
        }, 200);
      }

      return {
        ...initialState,

        initTasks: async () => {
          set({ loading: true });

          await new Promise((resolve) => setTimeout(resolve, 80));

          const cachedTasks = loadTasksFromCache();
          const tasks = cachedTasks && cachedTasks.length > 0 ? cachedTasks : [...mockTasks];
          const conflicts = detectConflicts(tasks);
          const { substations } = useEquipmentStore.getState();

          set({
            tasks,
            conflicts,
            filteredTasks: computeFilteredTasks(tasks, get().filters, substations),
            loading: false,
          });

          saveTasksToCache(tasks);
        },

        setFilters: (partial) => {
          const newFilters = { ...get().filters, ...partial };
          const { substations } = useEquipmentStore.getState();
          set({
            filters: newFilters,
            filteredTasks: computeFilteredTasks(get().tasks, newFilters, substations),
          });
        },

        createTask: async (partialTask) => {
          const { substations, lines, equipments, adjacencyMap } =
            useEquipmentStore.getState();

          const now = Date.now();
          const taskId = generateId('task');

          let outageScope: OutageScopeResult = {
            affectedStationIds: [],
            lostCapacity: 0,
            outageLevel: 'level3',
          };

          const targetId = partialTask.equipmentId || partialTask.lineId;
          if (targetId && adjacencyMap.size > 0) {
            const scope = calculateOutageScope(
              targetId,
              adjacencyMap,
              substations,
              equipments,
              lines
            );
            outageScope = {
              affectedStationIds: scope.affectedStations,
              lostCapacity: scope.lostCapacity,
              outageLevel: scope.outageLevel,
            };
          }

          const startTime = partialTask.startTime || now;
          const endTime = partialTask.endTime || now + 4 * 3600 * 1000;
          const duration = calculateDurationH(startTime, endTime);

          const newTask: MaintenanceTask = {
            id: taskId,
            title: partialTask.title || '未命名检修任务',
            category: partialTask.category || 'primary_outage',
            equipmentId: partialTask.equipmentId,
            lineId: partialTask.lineId,
            startTime,
            endTime,
            outageDurationH: duration,
            outageLevel: outageScope.outageLevel,
            applicant: partialTask.applicant || '当前用户',
            applicantId: partialTask.applicantId || 'user-current',
            department: partialTask.department || '检修一工区',
            workContent: partialTask.workContent || '',
            approvalStatus: 'draft',
            approvalLog: [],
            affectedStationIds: outageScope.affectedStationIds,
            lostCapacity: outageScope.lostCapacity,
            affectedUserLevel:
              partialTask.affectedUserLevel ||
              (outageScope.outageLevel === 'level1'
                ? 'A'
                : outageScope.outageLevel === 'level2'
                ? 'B'
                : 'C') as UserLevel,
            loadTransferPlan: partialTask.loadTransferPlan,
            createdAt: now,
            updatedAt: now,
          };

          const newTasks = [...get().tasks, newTask];
          const newConflicts = detectConflicts(newTasks);

          set({
            tasks: newTasks,
            conflicts: newConflicts,
            filteredTasks: computeFilteredTasks(newTasks, get().filters, substations),
          });

          saveTasksToCache(newTasks);
        },

        updateTask: (id, patch) => {
          const state = get();
          const taskIndex = state.tasks.findIndex((t) => t.id === id);
          if (taskIndex === -1) return;

          const existingTask = state.tasks[taskIndex];
          const { substations, lines, equipments, adjacencyMap } =
            useEquipmentStore.getState();

          const needsRecompute =
            patch.startTime !== undefined ||
            patch.endTime !== undefined ||
            patch.equipmentId !== undefined ||
            patch.lineId !== undefined;

          const updatedTask: MaintenanceTask = {
            ...existingTask,
            ...patch,
            updatedAt: Date.now(),
          };

          if (
            (patch.startTime !== undefined || patch.endTime !== undefined) &&
            (patch.startTime !== existingTask.startTime ||
              patch.endTime !== existingTask.endTime)
          ) {
            const startTime = patch.startTime ?? existingTask.startTime;
            const endTime = patch.endTime ?? existingTask.endTime;
            updatedTask.outageDurationH = calculateDurationH(startTime, endTime);
          }

          if (
            needsRecompute &&
            (updatedTask.equipmentId || updatedTask.lineId) &&
            adjacencyMap.size > 0
          ) {
            const targetId = updatedTask.equipmentId || updatedTask.lineId!;
            const scope = calculateOutageScope(
              targetId,
              adjacencyMap,
              substations,
              equipments,
              lines
            );
            updatedTask.affectedStationIds = scope.affectedStations;
            updatedTask.lostCapacity = scope.lostCapacity;
            updatedTask.outageLevel = scope.outageLevel;
            updatedTask.affectedUserLevel =
              scope.outageLevel === 'level1'
                ? 'A'
                : scope.outageLevel === 'level2'
                ? 'B'
                : 'C';
          }

          const newTasks = [...state.tasks];
          newTasks[taskIndex] = updatedTask;

          set({
            tasks: newTasks,
            filteredTasks: computeFilteredTasks(newTasks, state.filters, substations),
          });

          saveTasksToCache(newTasks);
          debouncedConflictDetection?.(newTasks);
        },

        deleteTask: (id) => {
          const state = get();
          const taskToDelete = state.tasks.find((t) => t.id === id);
          if (!taskToDelete) return;

          if (
            taskToDelete.approvalStatus === 'approved' ||
            taskToDelete.approvalStatus === 'completed'
          ) {
            archiveOldTask(taskToDelete);
          }

          const newTasks = state.tasks.filter((t) => t.id !== id);
          const newConflicts = detectConflicts(newTasks);
          const { substations: delSubstations } = useEquipmentStore.getState();

          set({
            tasks: newTasks,
            conflicts: newConflicts,
            selectedTaskId:
              state.selectedTaskId === id ? null : state.selectedTaskId,
            editingTask:
              state.editingTask && state.editingTask.id === id
                ? null
                : state.editingTask,
            filteredTasks: computeFilteredTasks(newTasks, state.filters, delSubstations),
          });

          saveTasksToCache(newTasks);
        },

        submitForApproval: (id) => {
          const state = get();
          const taskIndex = state.tasks.findIndex((t) => t.id === id);
          if (taskIndex === -1) return;

          const existingTask = state.tasks[taskIndex];
          if (existingTask.approvalStatus !== 'draft') return;

          const logEntry = createApprovalLogEntry(id, 'submit');
          const updatedTask: MaintenanceTask = {
            ...existingTask,
            approvalStatus: 'submitted',
            approvalLog: [...existingTask.approvalLog, logEntry],
            updatedAt: Date.now(),
          };

          const newTasks = [...state.tasks];
          newTasks[taskIndex] = updatedTask;
          const { substations: subSubstations } = useEquipmentStore.getState();

          set({
            tasks: newTasks,
            filteredTasks: computeFilteredTasks(newTasks, state.filters, subSubstations),
          });

          saveTasksToCache(newTasks);
        },

        approve: (id, role, comment) => {
          const state = get();
          const taskIndex = state.tasks.findIndex((t) => t.id === id);
          if (taskIndex === -1) return;

          const existingTask = state.tasks[taskIndex];

          let newStatus = existingTask.approvalStatus;
          let action: ApprovalEntry['action'];

          if (role === 'reviewer') {
            if (
              existingTask.approvalStatus !== 'submitted' &&
              existingTask.approvalStatus !== 'rejected'
            )
              return;
            newStatus = 'reviewing';
            action = 'review_pass';
          } else {
            if (existingTask.approvalStatus !== 'reviewing') return;
            newStatus = 'approved';
            action = 'approve';
          }

          const logEntry = createApprovalLogEntry(id, action, role, comment);
          const updatedTask: MaintenanceTask = {
            ...existingTask,
            approvalStatus: newStatus,
            approvalLog: [...existingTask.approvalLog, logEntry],
            updatedAt: Date.now(),
          };

          const newTasks = [...state.tasks];
          newTasks[taskIndex] = updatedTask;
          const { substations: appSubstations } = useEquipmentStore.getState();

          set({
            tasks: newTasks,
            filteredTasks: computeFilteredTasks(newTasks, state.filters, appSubstations),
          });

          saveTasksToCache(newTasks);
        },

        reject: (id, comment, role) => {
          const state = get();
          const taskIndex = state.tasks.findIndex((t) => t.id === id);
          if (taskIndex === -1) return;

          const existingTask = state.tasks[taskIndex];

          let action: ApprovalEntry['action'];
          if (role === 'reviewer') {
            if (
              existingTask.approvalStatus !== 'submitted' &&
              existingTask.approvalStatus !== 'reviewing'
            )
              return;
            action = 'review_reject';
          } else {
            if (existingTask.approvalStatus !== 'reviewing') return;
            action = 'approve_reject';
          }

          const logEntry = createApprovalLogEntry(id, action, role, comment);
          const updatedTask: MaintenanceTask = {
            ...existingTask,
            approvalStatus: 'rejected',
            approvalLog: [...existingTask.approvalLog, logEntry],
            updatedAt: Date.now(),
          };

          const newTasks = [...state.tasks];
          newTasks[taskIndex] = updatedTask;
          const { substations: rejSubstations } = useEquipmentStore.getState();

          set({
            tasks: newTasks,
            filteredTasks: computeFilteredTasks(newTasks, state.filters, rejSubstations),
          });

          saveTasksToCache(newTasks);
        },

        setSelectedTask: (id) => {
          set({ selectedTaskId: id });
        },

        setEditingTask: (partial) => {
          set({ editingTask: partial });
        },

        commitEditing: () => {
          const state = get();
          if (!state.editingTask || !state.editingTask.id) return;

          const taskId = state.editingTask.id;
          const patch: Partial<MaintenanceTask> = { ...state.editingTask };
          delete (patch as any).id;
          delete (patch as any).createdAt;
          delete (patch as any).updatedAt;
          delete (patch as any).approvalLog;

          get().updateTask(taskId, patch);
          set({ editingTask: null });
        },

        recomputeConflicts: () => {
          const conflicts = detectConflicts(get().tasks);
          set({ conflicts });
        },
      };
    },
    {
      name: 'plan-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

export const usePlanSelector = <T,>(
  selector: (state: PlanStore) => T
): T => usePlanStore(selector, shallow);
