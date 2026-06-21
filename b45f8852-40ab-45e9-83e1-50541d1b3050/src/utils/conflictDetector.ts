import type {
  MaintenanceTask,
  ConflictInfo,
  ConflictSeverity,
  ConflictType,
  MaintenanceCategory,
  ApprovalStatus,
  ProtectionWindow,
} from '@/types';
import {
  isOverlapping,
  getOverlapRange,
  getOverlapDurationH,
  generateId,
} from './dateUtils';

const DEFAULT_PROTECTION_WINDOWS: Array<{
  name: string;
  range: [number, number];
  priority: 'high' | 'medium' | 'low';
}> = [
  {
    name: '春节保供电期',
    range: [
      new Date(new Date().getFullYear(), 0, 25).getTime(),
      new Date(new Date().getFullYear(), 1, 10).getTime(),
    ],
    priority: 'high',
  },
  {
    name: '高考保供电期',
    range: [
      new Date(new Date().getFullYear(), 5, 1).getTime(),
      new Date(new Date().getFullYear(), 5, 20).getTime(),
    ],
    priority: 'high',
  },
  {
    name: '国庆保供电期',
    range: [
      new Date(new Date().getFullYear(), 9, 1).getTime(),
      new Date(new Date().getFullYear(), 9, 15).getTime(),
    ],
    priority: 'high',
  },
];

const PEAK_SEASON_RULES: Array<{
  name: string;
  months: number[];
  hours: [number, number];
}> = [
  {
    name: '夏季高峰',
    months: [6, 7, 8],
    hours: [19, 21],
  },
  {
    name: '冬季高峰',
    months: [11, 12, 0],
    hours: [19, 21],
  },
];

export function detectConflicts(
  tasks: MaintenanceTask[],
  protectionWindows?: ProtectionWindow[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const now = Date.now();

  const activeTasks = tasks.filter(
    (t) => t.approvalStatus !== 'completed' && t.approvalStatus !== 'rejected'
  );

  const duplicateConflicts = detectDuplicateEquipment(activeTasks, now);
  conflicts.push(...duplicateConflicts);

  const areaConflicts = detectAreaOverlap(activeTasks, now);
  conflicts.push(...areaConflicts);

  const protectionConflicts = detectProtectionWindow(activeTasks, now, protectionWindows);
  conflicts.push(...protectionConflicts);

  const peakConflicts = detectPeakLoad(activeTasks, now);
  conflicts.push(...peakConflicts);

  return conflicts;
}

function detectDuplicateEquipment(
  tasks: MaintenanceTask[],
  detectedAt: number
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const equipmentGroups = new Map<string, MaintenanceTask[]>();

  tasks.forEach((task) => {
    const key = task.equipmentId || task.lineId;
    if (!key) return;
    if (!equipmentGroups.has(key)) {
      equipmentGroups.set(key, []);
    }
    equipmentGroups.get(key)!.push(task);
  });

  equipmentGroups.forEach((groupTasks, key) => {
    if (groupTasks.length < 2) return;

    for (let i = 0; i < groupTasks.length; i++) {
      for (let j = i + 1; j < groupTasks.length; j++) {
        const taskA = groupTasks[i];
        const taskB = groupTasks[j];
        const rangeA: [number, number] = [taskA.startTime, taskA.endTime];
        const rangeB: [number, number] = [taskB.startTime, taskB.endTime];

        if (isOverlapping(rangeA, rangeB)) {
          const overlap = getOverlapRange(rangeA, rangeB);
          const overlapDuration = overlap
            ? getOverlapDurationH(rangeA, rangeB)
            : 0;
          const fullOverlap =
            overlapDuration >=
            Math.min(
              (taskA.endTime - taskA.startTime) / 3600000,
              (taskB.endTime - taskB.startTime) / 3600000
            );

          const severity: ConflictSeverity =
            (taskA.outageLevel === 'level1' || taskB.outageLevel === 'level1') &&
            fullOverlap
              ? 'critical'
              : overlapDuration > 4
              ? 'critical'
              : overlapDuration > 1
              ? 'warning'
              : 'info';

          conflicts.push({
            id: generateId('conflict'),
            type: 'duplicate_equipment',
            severity,
            taskAId: taskA.id,
            taskBId: taskB.id,
            overlapStart: overlap?.[0],
            overlapEnd: overlap?.[1],
            description: `设备(${key})重复检修：「${taskA.title}」与「${taskB.title}」时间重叠${overlapDuration.toFixed(1)}小时`,
            resolved: false,
            detectedAt,
          });
        }
      }
    }
  });

  return conflicts;
}

function detectAreaOverlap(
  tasks: MaintenanceTask[],
  detectedAt: number
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const taskA = tasks[i];
      const taskB = tasks[j];

      const rangeA: [number, number] = [taskA.startTime, taskA.endTime];
      const rangeB: [number, number] = [taskB.startTime, taskB.endTime];

      if (!isOverlapping(rangeA, rangeB)) continue;

      const commonStations = taskA.affectedStationIds.filter((id) =>
        taskB.affectedStationIds.includes(id)
      );

      if (commonStations.length >= 2) {
        const overlap = getOverlapRange(rangeA, rangeB);
        const overlapDuration = overlap
          ? getOverlapDurationH(rangeA, rangeB)
          : 0;

        const hasLevel1 =
          taskA.outageLevel === 'level1' || taskB.outageLevel === 'level1';

        const severity: ConflictSeverity =
          commonStations.length >= 4 && hasLevel1
            ? 'critical'
            : commonStations.length >= 3
            ? 'warning'
            : 'info';

        conflicts.push({
          id: generateId('conflict'),
          type: 'area_overlap',
          severity,
          taskAId: taskA.id,
          taskBId: taskB.id,
          overlapStart: overlap?.[0],
          overlapEnd: overlap?.[1],
          description: `片区多重停电：「${taskA.title}」与「${taskB.title}」影响${commonStations.length}个共同变电站`,
          resolved: false,
          detectedAt,
        });
      }
    }
  }

  return conflicts;
}

function detectProtectionWindow(
  tasks: MaintenanceTask[],
  detectedAt: number,
  protectionWindows?: ProtectionWindow[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  const windows = protectionWindows && protectionWindows.length > 0
    ? protectionWindows.map((w) => ({
        name: w.name,
        range: [w.start, w.end] as [number, number],
        priority: 'high' as const,
      }))
    : DEFAULT_PROTECTION_WINDOWS;

  tasks.forEach((task) => {
    const taskRange: [number, number] = [task.startTime, task.endTime];

    windows.forEach((window) => {
      if (isOverlapping(taskRange, window.range)) {
        const overlap = getOverlapRange(taskRange, window.range);
        const severity: ConflictSeverity =
          window.priority === 'high' ? 'critical' : 'warning';

        conflicts.push({
          id: generateId('conflict'),
          type: 'protection_window',
          severity,
          taskAId: task.id,
          overlapStart: overlap?.[0],
          overlapEnd: overlap?.[1],
          description: `保供电冲突：「${task.title}」与「${window.name}」时间重叠`,
          resolved: false,
          detectedAt,
        });
      }
    });
  });

  return conflicts;
}

function detectPeakLoad(
  tasks: MaintenanceTask[],
  detectedAt: number
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  tasks.forEach((task) => {
    const startDate = new Date(task.startTime);
    const endDate = new Date(task.endTime);

    const taskMonths = new Set<number>();
    const current = new Date(startDate);
    while (current <= endDate) {
      taskMonths.add(current.getMonth());
      current.setDate(current.getDate() + 1);
    }

    for (const rule of PEAK_SEASON_RULES) {
      const hasPeakMonth = rule.months.some((m) => taskMonths.has(m));
      if (!hasPeakMonth) continue;

      const startHour = startDate.getHours() + startDate.getMinutes() / 60;
      const endHour = endDate.getHours() + endDate.getMinutes() / 60;
      const taskRange: [number, number] = [startHour, endHour];

      if (isOverlapping(taskRange, rule.hours)) {
        const overlap = getOverlapRange(taskRange, rule.hours);
        const severity: ConflictSeverity =
          task.outageLevel === 'level1' ? 'warning' : 'info';

        conflicts.push({
          id: generateId('conflict'),
          type: 'peak_load',
          severity,
          taskAId: task.id,
          overlapStart: overlap ? task.startTime + (overlap[0] - startHour) * 3600000 : undefined,
          overlapEnd: overlap ? task.startTime + (overlap[1] - startHour) * 3600000 : undefined,
          description: `高峰负荷冲突：「${task.title}」落入${rule.name}时段${rule.hours[0]}:00-${rule.hours[1]}:00`,
          resolved: false,
          detectedAt,
        });
      }
    }
  });

  return conflicts;
}

export function filterTasksByStatus(
  tasks: MaintenanceTask[],
  statuses?: ApprovalStatus[]
): MaintenanceTask[] {
  if (!statuses || statuses.length === 0) return tasks;
  return tasks.filter((t) => statuses.includes(t.approvalStatus));
}

export function filterTasksByCategory(
  tasks: MaintenanceTask[],
  categories?: MaintenanceCategory[]
): MaintenanceTask[] {
  if (!categories || categories.length === 0) return tasks;
  return tasks.filter((t) => categories.includes(t.category));
}

export function filterTasksByTimeRange(
  tasks: MaintenanceTask[],
  timeRange?: [number, number]
): MaintenanceTask[] {
  if (!timeRange) return tasks;
  return tasks.filter(
    (t) =>
      isOverlapping(
        [t.startTime, t.endTime],
        timeRange
      )
  );
}

export function filterTasksByKeyword(
  tasks: MaintenanceTask[],
  keyword?: string
): MaintenanceTask[] {
  if (!keyword || keyword.trim() === '') return tasks;
  const kw = keyword.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(kw) ||
      t.workContent.toLowerCase().includes(kw) ||
      t.applicant.toLowerCase().includes(kw) ||
      t.department.toLowerCase().includes(kw)
  );
}

export function filterTasksByDepartment(
  tasks: MaintenanceTask[],
  department?: string
): MaintenanceTask[] {
  if (!department) return tasks;
  return tasks.filter((t) => t.department === department);
}

export function getConflictTypeLabel(type: ConflictType): string {
  const labels: Record<ConflictType, string> = {
    duplicate_equipment: '设备重复检修',
    area_overlap: '片区多重停电',
    protection_window: '保供电冲突',
    peak_load: '高峰负荷冲突',
  };
  return labels[type];
}

export function getConflictSeverityLabel(severity: ConflictSeverity): string {
  const labels: Record<ConflictSeverity, string> = {
    critical: '严重',
    warning: '一般',
    info: '提示',
  };
  return labels[severity];
}
