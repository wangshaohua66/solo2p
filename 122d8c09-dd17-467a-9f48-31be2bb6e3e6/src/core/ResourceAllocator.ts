import type { TaskNode, Resource, ResourceAllocResult, ResourceLoad, ResourceConflict } from '@/types';
import { eachDay, formatDateKey, startOfDay, DAY_MS } from '@/utils/dateUtils';

export class ResourceAllocator {
  private tasks: TaskNode[];
  private resources: Resource[];

  constructor(tasks: Record<string, TaskNode>, resources: Resource[]) {
    this.tasks = Object.values(tasks).filter(t => t.level === 3 && t.assigneeId);
    this.resources = resources;
  }

  compute(rangeStart: number, rangeEnd: number): ResourceAllocResult {
    const loads = new Map<string, Map<string, ResourceLoad>>();
    const resMap = new Map(this.resources.map(r => [r.id, r]));

    for (const r of this.resources) {
      loads.set(r.id, new Map());
    }

    const days = eachDay(startOfDay(rangeStart), startOfDay(rangeEnd));
    for (const r of this.resources) {
      for (const d of days) {
        const key = formatDateKey(d);
        loads.get(r.id)!.set(key, {
          resourceId: r.id,
          date: key,
          workload: 0,
          overload: false,
          taskIds: [],
        });
      }
    }

    for (const task of this.tasks) {
      if (!task.assigneeId) continue;
      const taskStart = startOfDay(task.startDate);
      const taskEnd = startOfDay(task.endDate);
      const spanDays = Math.max(1, Math.round((taskEnd - taskStart) / DAY_MS) + 1);
      const hoursPerDay = 8;
      const totalHours = spanDays * hoursPerDay * (task.progress / 100);
      const perDay = totalHours / spanDays;

      const resLoads = loads.get(task.assigneeId);
      if (!resLoads) continue;

      let cur = taskStart;
      while (cur <= taskEnd) {
        const key = formatDateKey(cur);
        const entry = resLoads.get(key);
        if (entry) {
          entry.workload += perDay;
          entry.taskIds.push(task.id);
        }
        cur += DAY_MS;
      }
    }

    for (const [rid, daily] of loads.entries()) {
      const res = resMap.get(rid);
      if (!res) continue;
      for (const entry of daily.values()) {
        entry.overload = entry.workload > res.capacityPerDay;
      }
    }

    const conflicts: ResourceConflict[] = [];
    for (const [rid, daily] of loads.entries()) {
      for (const entry of daily.values()) {
        if (entry.overload) {
          conflicts.push({
            resourceId: rid,
            date: entry.date,
            tasks: entry.taskIds,
            workload: entry.workload,
          });
        }
      }
    }

    return { loads, conflicts };
  }
}
