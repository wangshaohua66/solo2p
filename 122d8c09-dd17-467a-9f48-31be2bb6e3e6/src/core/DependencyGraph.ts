import type { TaskNode, Dependency, DependencyGraphResult } from '@/types';
import { addDays, DAY_MS } from '@/utils/dateUtils';

export class DependencyGraph {
  private tasks: Map<string, TaskNode>;
  private dependencies: Dependency[];
  private incoming: Map<string, Dependency[]>;
  private outgoing: Map<string, Dependency[]>;

  constructor(tasks: Record<string, TaskNode>, dependencies: Dependency[]) {
    this.tasks = new Map(Object.entries(tasks));
    this.dependencies = dependencies;
    this.incoming = new Map();
    this.outgoing = new Map();
    for (const t of this.tasks.keys()) {
      this.incoming.set(t, []);
      this.outgoing.set(t, []);
    }
    for (const dep of dependencies) {
      if (this.tasks.has(dep.fromTaskId) && this.tasks.has(dep.toTaskId)) {
        this.outgoing.get(dep.fromTaskId)!.push(dep);
        this.incoming.get(dep.toTaskId)!.push(dep);
      }
    }
  }

  compute(): DependencyGraphResult {
    const topo = this.kahnTopoSort();
    const hasCycle = topo.length < this.tasks.size;

    const earliestStart = new Map<string, number>();
    const earliestFinish = new Map<string, number>();
    const latestStart = new Map<string, number>();
    const latestFinish = new Map<string, number>();
    const slack = new Map<string, number>();

    for (const id of this.tasks.keys()) {
      const t = this.tasks.get(id)!;
      earliestStart.set(id, t.startDate);
      earliestFinish.set(id, t.endDate);
    }

    for (const id of topo) {
      const inDeps = this.incoming.get(id) || [];
      for (const dep of inDeps) {
        const fromEF = earliestFinish.get(dep.fromTaskId)!;
        const fromES = earliestStart.get(dep.fromTaskId)!;
        const fromDuration = fromEF - fromES;
        let candidateStart: number;
        const lag = dep.lagDays * DAY_MS;
        switch (dep.type) {
          case 'FS':
            candidateStart = fromEF + lag;
            break;
          case 'SS':
            candidateStart = fromES + lag;
            break;
          case 'FF':
            candidateStart = fromEF + lag - (earliestFinish.get(id)! - earliestStart.get(id)!);
            break;
          case 'SF':
            candidateStart = fromES + lag - (earliestFinish.get(id)! - earliestStart.get(id)!);
            break;
        }
        if (candidateStart > earliestStart.get(id)!) {
          const dur = earliestFinish.get(id)! - earliestStart.get(id)!;
          earliestStart.set(id, candidateStart);
          earliestFinish.set(id, candidateStart + dur);
        }
      }
    }

    let maxEF = 0;
    for (const ef of earliestFinish.values()) if (ef > maxEF) maxEF = ef;

    for (const id of this.tasks.keys()) {
      latestFinish.set(id, maxEF);
    }

    const reverseTopo = [...topo].reverse();
    for (const id of reverseTopo) {
      const outDeps = this.outgoing.get(id) || [];
      for (const dep of outDeps) {
        const toLS = latestStart.get(dep.toTaskId)!;
        const toLF = latestFinish.get(dep.toTaskId)!;
        const toDuration = toLF - toLS;
        const myDuration = earliestFinish.get(id)! - earliestStart.get(id)!;
        const lag = dep.lagDays * DAY_MS;
        let candidateLF: number;
        switch (dep.type) {
          case 'FS':
            candidateLF = toLS - lag;
            break;
          case 'SS':
            candidateLF = toLS - lag + myDuration;
            break;
          case 'FF':
            candidateLF = toLF - lag;
            break;
          case 'SF':
            candidateLF = toLF - lag - toDuration + myDuration;
            break;
        }
        if (candidateLF < latestFinish.get(id)!) {
          latestFinish.set(id, candidateLF);
        }
      }
      latestStart.set(id, latestFinish.get(id)! - (earliestFinish.get(id)! - earliestStart.get(id)!));
    }

    for (const id of this.tasks.keys()) {
      const s = (latestFinish.get(id)! - earliestFinish.get(id)!) / DAY_MS;
      slack.set(id, Math.max(0, Math.round(s * 100) / 100));
    }

    const criticalPath: string[] = [];
    for (const [id, s] of slack.entries()) {
      if (s <= 0.01) criticalPath.push(id);
    }

    return {
      topologicalOrder: topo,
      criticalPath,
      earliestStart,
      earliestFinish,
      latestStart,
      latestFinish,
      slack,
      hasCycle,
    };
  }

  getCascadedUpdates(taskId: string, newStartDate: number): Array<{ id: string; startDate: number; endDate: number }> {
    const updates: Array<{ id: string; startDate: number; endDate: number }> = [];
    const task = this.tasks.get(taskId);
    if (!task) return updates;
    const duration = task.endDate - task.startDate;
    updates.push({ id: taskId, startDate: newStartDate, endDate: newStartDate + duration });

    const visited = new Set<string>([taskId]);
    const queue: string[] = [taskId];

    while (queue.length) {
      const cur = queue.shift()!;
      const curStart = updates.find(u => u.id === cur)?.startDate ?? this.tasks.get(cur)!.startDate;
      const curEnd = updates.find(u => u.id === cur)?.endDate ?? this.tasks.get(cur)!.endDate;
      const curDuration = curEnd - curStart;

      for (const dep of this.outgoing.get(cur) || []) {
        if (visited.has(dep.toTaskId)) continue;
        const toTask = this.tasks.get(dep.toTaskId);
        if (!toTask) continue;
        const toDuration = toTask.endDate - toTask.startDate;
        const lag = dep.lagDays * DAY_MS;
        let newToStart: number;
        switch (dep.type) {
          case 'FS': newToStart = curEnd + lag; break;
          case 'SS': newToStart = curStart + lag; break;
          case 'FF': newToStart = curEnd + lag - toDuration; break;
          case 'SF': newToStart = curStart + lag - toDuration; break;
        }
        if (newToStart > toTask.startDate || updates.some(u => u.id === dep.toTaskId)) {
          const existing = updates.find(u => u.id === dep.toTaskId);
          if (!existing || newToStart > existing.startDate) {
            if (existing) {
              existing.startDate = newToStart;
              existing.endDate = newToStart + toDuration;
            } else {
              updates.push({ id: dep.toTaskId, startDate: newToStart, endDate: newToStart + toDuration });
            }
            visited.add(dep.toTaskId);
            queue.push(dep.toTaskId);
          }
        }
      }
    }

    return updates;
  }

  private kahnTopoSort(): string[] {
    const indegree = new Map<string, number>();
    for (const id of this.tasks.keys()) indegree.set(id, 0);
    for (const dep of this.dependencies) {
      if (this.tasks.has(dep.fromTaskId) && this.tasks.has(dep.toTaskId)) {
        indegree.set(dep.toTaskId, (indegree.get(dep.toTaskId) || 0) + 1);
      }
    }
    const queue: string[] = [];
    for (const [id, d] of indegree.entries()) if (d === 0) queue.push(id);
    const result: string[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      result.push(cur);
      for (const dep of this.outgoing.get(cur) || []) {
        indegree.set(dep.toTaskId, (indegree.get(dep.toTaskId) || 0) - 1);
        if (indegree.get(dep.toTaskId) === 0) queue.push(dep.toTaskId);
      }
    }
    return result;
  }
}
