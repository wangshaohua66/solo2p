import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { message } from 'antd';
import type {
  MaintenanceTask,
  ConflictInfo,
  PlanFilters,
  ApprovalEntry,
  ApprovalRole,
  UserLevel,
  OutageLevel,
  ReportFile,
  VoltageLevel,
  MaintenanceCategory,
  OnlineUser,
  CollaborationState,
} from '@/types';
import { MockWebSocket } from '@/mock/mockWebSocket';
import { getCurrentUser } from '@/mock/mockUsers';
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
import { mockReports } from '@/data/mockReports';
import { useEquipmentStore } from './equipmentStore';

interface PlanState {
  tasks: MaintenanceTask[];
  conflicts: ConflictInfo[];
  filters: PlanFilters;
  selectedTaskId: string | null;
  editingTask: Partial<MaintenanceTask> | null;
  loading: boolean;
  filteredTasks: MaintenanceTask[];
  reports: ReportFile[];
  collaboration: CollaborationState;
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
  initReports: () => void;
  getReportsByTaskId: (taskId: string) => ReportFile[];
  addReport: (report: ReportFile) => void;
  connectCollaboration: () => void;
  disconnectCollaboration: () => void;
  broadcastTaskUpdate: (taskId: string, patch: Partial<MaintenanceTask>) => void;
}

export type PlanStore = PlanState & PlanActions;

const PLAN_CACHE_KEY = 'plan_store_tasks_v2_202607';
const PLAN_ARCHIVE_KEY = 'plan_store_archive_v2_202607';
const MAX_ARCHIVE_ITEMS = 5000;
const TASK_VERSION_KEY = 'plan_store_task_versions_v1';
const WS_URL = 'ws://mock-server/collaboration';

const WINDOW_PERIOD_HOURS: Record<MaintenanceCategory, number | Record<VoltageLevel, number>> = {
  primary_outage: {
    '500kV': 72,
    '220kV': 72,
    '110kV': 48,
  },
  secondary_calibration: 24,
  corridor_clearing: 8,
  technical_reform: 168,
};

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export const validateWindowPeriod = (
  task: Partial<MaintenanceTask> & { category: MaintenanceCategory; outageDurationH?: number; startTime?: number; endTime?: number },
  equipmentVoltage?: VoltageLevel
): ValidationResult => {
  const { category, outageDurationH, startTime, endTime } = task;
  
  let duration = outageDurationH;
  if (!duration && startTime && endTime) {
    duration = calculateDurationH(startTime, endTime);
  }
  if (!duration) {
    return { valid: true, message: '' };
  }

  const windowConfig = WINDOW_PERIOD_HOURS[category];
  let maxHours: number;

  if (typeof windowConfig === 'number') {
    maxHours = windowConfig;
  } else {
    if (!equipmentVoltage) {
      return { valid: true, message: '' };
    }
    maxHours = windowConfig[equipmentVoltage] || 72;
  }

  if (duration > maxHours) {
    return {
      valid: false,
      message: `检修时长超过规定窗口期（${maxHours}小时），请核实时限`,
    };
  }

  return { valid: true, message: '' };
};

const initialFilters: PlanFilters = {
  timeRange: undefined,
  voltageLevels: undefined,
  categories: undefined,
  statuses: undefined,
  keyword: undefined,
  department: undefined,
  equipmentTypes: undefined,
};

const initialState: PlanState = {
  tasks: [],
  conflicts: [],
  filters: initialFilters,
  selectedTaskId: null,
  editingTask: null,
  loading: false,
  filteredTasks: [],
  reports: [],
  collaboration: {
    connected: false,
    users: [],
    lastSyncAt: 0,
    currentUserId: getCurrentUser().id,
  },
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
  substations: { id: string; voltageLevel: string }[] = [],
  equipments: { id: string; type: string }[] = []
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

  if (filters.equipmentTypes && filters.equipmentTypes.length > 0) {
    const equipmentTypes = filters.equipmentTypes;
    result = result.filter((task) => {
      if (task.equipmentId) {
        const eq = equipments.find((e) => e.id === task.equipmentId);
        return eq && equipmentTypes.includes(eq.type as any);
      }
      if (task.lineId) {
        return equipmentTypes.includes('line' as any);
      }
      return false;
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

let wsInstance: MockWebSocket | null = null;
let taskVersionMap: Map<string, number> = new Map();

const loadTaskVersions = (): void => {
  try {
    const stored = localStorage.getItem(TASK_VERSION_KEY);
    if (stored) {
      const versions = JSON.parse(stored);
      taskVersionMap = new Map(Object.entries(versions));
    }
  } catch {
    taskVersionMap = new Map();
  }
};

const saveTaskVersions = (): void => {
  try {
    const versions = Object.fromEntries(taskVersionMap);
    localStorage.setItem(TASK_VERSION_KEY, JSON.stringify(versions));
  } catch {
    // ignore
  }
};

const getTaskVersion = (taskId: string): number => {
  return taskVersionMap.get(taskId) || 0;
};

const setTaskVersion = (taskId: string, version: number): void => {
  taskVersionMap.set(taskId, version);
  saveTaskVersions();
};

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
          const { substations, equipments } = useEquipmentStore.getState();

          set({
            tasks,
            conflicts,
            filteredTasks: computeFilteredTasks(tasks, get().filters, substations, equipments),
            loading: false,
          });

          saveTasksToCache(tasks);
        },

        setFilters: (partial) => {
          const newFilters = { ...get().filters, ...partial };
          const { substations, equipments } = useEquipmentStore.getState();
          set({
            filters: newFilters,
            filteredTasks: computeFilteredTasks(get().tasks, newFilters, substations, equipments),
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

          let equipmentVoltage: VoltageLevel | undefined;
          if (partialTask.equipmentId) {
            const eq = equipments.find((e) => e.id === partialTask.equipmentId);
            if (eq) {
              const station = substations.find((s) => s.id === eq.substationId);
              if (station) {
                equipmentVoltage = station.voltageLevel;
              }
            }
          } else if (partialTask.lineId) {
            const line = lines.find((l) => l.id === partialTask.lineId);
            if (line) {
              equipmentVoltage = line.voltageLevel;
            }
          }

          const validation = validateWindowPeriod(
            { ...newTask, category: newTask.category },
            equipmentVoltage
          );
          if (!validation.valid) {
            message.warning(validation.message);
          }

          const newTasks = [...get().tasks, newTask];
          const newConflicts = detectConflicts(newTasks);

          set({
            tasks: newTasks,
            conflicts: newConflicts,
            filteredTasks: computeFilteredTasks(newTasks, get().filters, substations, equipments),
          });

          saveTasksToCache(newTasks);

          if (get().collaboration.connected && wsInstance) {
            const newVersion = 1;
            setTaskVersion(taskId, newVersion);
            wsInstance.send({
              type: 'task:create',
              senderId: get().collaboration.currentUserId,
              data: {
                task: newTask,
                version: newVersion,
              },
              timestamp: Date.now(),
              version: newVersion,
            });
          }
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

          const needsValidate =
            patch.startTime !== undefined ||
            patch.endTime !== undefined ||
            patch.equipmentId !== undefined ||
            patch.lineId !== undefined ||
            patch.category !== undefined;

          if (needsValidate) {
            let equipmentVoltage: VoltageLevel | undefined;
            if (updatedTask.equipmentId) {
              const eq = equipments.find((e) => e.id === updatedTask.equipmentId);
              if (eq) {
                const station = substations.find((s) => s.id === eq.substationId);
                if (station) {
                  equipmentVoltage = station.voltageLevel;
                }
              }
            } else if (updatedTask.lineId) {
              const line = lines.find((l) => l.id === updatedTask.lineId);
              if (line) {
                equipmentVoltage = line.voltageLevel;
              }
            }

            const validation = validateWindowPeriod(
              { ...updatedTask, category: updatedTask.category },
              equipmentVoltage
            );
            if (!validation.valid) {
              message.warning(validation.message);
            }
          }

          set({
            tasks: newTasks,
            filteredTasks: computeFilteredTasks(newTasks, state.filters, substations, equipments),
          });

          saveTasksToCache(newTasks);
          debouncedConflictDetection?.(newTasks);

          if (get().collaboration.connected && wsInstance) {
            const newVersion = getTaskVersion(id) + 1;
            setTaskVersion(id, newVersion);
            wsInstance.send({
              type: 'task:update',
              senderId: get().collaboration.currentUserId,
              data: {
                taskId: id,
                patch,
                version: newVersion,
              },
              timestamp: Date.now(),
              version: newVersion,
            });
          }
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
          const { substations: delSubstations, equipments: delEquipments } = useEquipmentStore.getState();

          set({
            tasks: newTasks,
            conflicts: newConflicts,
            selectedTaskId:
              state.selectedTaskId === id ? null : state.selectedTaskId,
            editingTask:
              state.editingTask && state.editingTask.id === id
                ? null
                : state.editingTask,
            filteredTasks: computeFilteredTasks(newTasks, state.filters, delSubstations, delEquipments),
          });

          saveTasksToCache(newTasks);

          if (get().collaboration.connected && wsInstance) {
            const newVersion = getTaskVersion(id) + 1;
            setTaskVersion(id, newVersion);
            wsInstance.send({
              type: 'task:delete',
              senderId: get().collaboration.currentUserId,
              data: {
                taskId: id,
                version: newVersion,
              },
              timestamp: Date.now(),
              version: newVersion,
            });
          }
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
          const { substations: subSubstations, equipments: subEquipments } = useEquipmentStore.getState();

          set({
            tasks: newTasks,
            filteredTasks: computeFilteredTasks(newTasks, state.filters, subSubstations, subEquipments),
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
          const { substations: rejSubstations, equipments: rejEquipments } = useEquipmentStore.getState();

          set({
            tasks: newTasks,
            filteredTasks: computeFilteredTasks(newTasks, state.filters, rejSubstations, rejEquipments),
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

        initReports: () => {
          set({ reports: [...mockReports] });
        },

        getReportsByTaskId: (taskId) => {
          return get().reports.filter((r) => r.taskId === taskId);
        },

        addReport: (report) => {
          const newReports = [...get().reports, report];
          set({ reports: newReports });
        },

        connectCollaboration: () => {
          if (wsInstance && wsInstance.isConnected()) {
            return;
          }

          loadTaskVersions();

          try {
            const ws = new MockWebSocket(WS_URL);
            wsInstance = ws;

            ws.onOpen = () => {
              set({
                collaboration: {
                  ...get().collaboration,
                  connected: true,
                  currentUserId: ws.getUserId(),
                },
              });
            };

            ws.onMessage = (message) => {
              const state = get();
              const { collaboration } = state;

              set({
                collaboration: {
                  ...collaboration,
                  lastSyncAt: message.timestamp,
                },
              });

              switch (message.type) {
                case 'presence':
                  set({
                    collaboration: {
                      ...get().collaboration,
                      users: message.data as OnlineUser[],
                    },
                  });
                  break;

                case 'task:update': {
                  const { taskId, patch, version } = message.data as {
                    taskId: string;
                    patch: Partial<MaintenanceTask>;
                    version: number;
                  };

                  const currentVersion = getTaskVersion(taskId);
                  if (version > currentVersion) {
                    setTaskVersion(taskId, version);
                    const task = state.tasks.find((t) => t.id === taskId);
                    if (task) {
                      get().updateTask(taskId, patch);
                    }
                  }
                  break;
                }

                case 'task:create': {
                  const { task, version } = message.data as {
                    task: MaintenanceTask;
                    version: number;
                  };

                  const currentVersion = getTaskVersion(task.id);
                  if (version > currentVersion) {
                    setTaskVersion(task.id, version);
                    const exists = state.tasks.some((t) => t.id === task.id);
                    if (!exists) {
                      const newTasks = [...state.tasks, task];
                      const { substations, equipments } =
                        useEquipmentStore.getState();
                      const newConflicts = detectConflicts(newTasks);
                      set({
                        tasks: newTasks,
                        conflicts: newConflicts,
                        filteredTasks: computeFilteredTasks(
                          newTasks,
                          state.filters,
                          substations,
                          equipments
                        ),
                      });
                      saveTasksToCache(newTasks);
                    }
                  }
                  break;
                }

                case 'task:delete': {
                  const { taskId, version } = message.data as {
                    taskId: string;
                    version: number;
                  };

                  const currentVersion = getTaskVersion(taskId);
                  if (version > currentVersion) {
                    setTaskVersion(taskId, version);
                    get().deleteTask(taskId);
                  }
                  break;
                }
              }
            };

            ws.onClose = () => {
              set({
                collaboration: {
                  ...get().collaboration,
                  connected: false,
                },
              });
            };

            ws.onError = () => {
              set({
                collaboration: {
                  ...get().collaboration,
                  connected: false,
                },
              });
            };
          } catch (error) {
            console.error('Failed to connect collaboration:', error);
          }
        },

        disconnectCollaboration: () => {
          if (wsInstance) {
            wsInstance.close();
            wsInstance = null;
          }
          set({
            collaboration: {
              ...get().collaboration,
              connected: false,
              users: [],
            },
          });
        },

        broadcastTaskUpdate: (taskId, patch) => {
          if (!wsInstance || !wsInstance.isConnected()) {
            return;
          }

          const newVersion = getTaskVersion(taskId) + 1;
          setTaskVersion(taskId, newVersion);

          wsInstance.send({
            type: 'task:update',
            senderId: get().collaboration.currentUserId,
            data: {
              taskId,
              patch,
              version: newVersion,
            },
            timestamp: Date.now(),
            version: newVersion,
          });
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
