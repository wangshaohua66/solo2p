import type { ScheduleTask, ResourceType, Resource, ConflictResult } from '@/types'

export function toMs(dateStr: string): number {
  return new Date(dateStr).getTime()
}

export function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = toMs(aStart)
  const ae = toMs(aEnd)
  const bs = toMs(bStart)
  const be = toMs(bEnd)
  return as < be && bs < ae
}

export function detectConflict(
  tasks: ScheduleTask[],
  resourceType: ResourceType,
  resourceId: number,
  start: string,
  end: string,
): ScheduleTask[] {
  const startNs = performance.now()
  const result = tasks.filter(
    (t) =>
      t.resourceType === resourceType &&
      t.resourceId === resourceId &&
      overlap(t.startTime, t.endTime, start, end),
  )
  const elapsed = performance.now() - startNs
  void elapsed
  return result
}

export function recommendAlternatives(
  resources: Resource[],
  tasks: ScheduleTask[],
  resourceType: ResourceType,
  storeId: number,
  start: string,
  end: string,
  excludeId: number,
): Resource[] {
  return resources
    .filter((r) => r.type === resourceType && r.storeId === storeId && r.id !== excludeId)
    .filter((r) => detectConflict(tasks, resourceType, r.id, start, end).length === 0)
    .slice(0, 5)
}

export function checkConflict(
  tasks: ScheduleTask[],
  resources: Resource[],
  resourceType: ResourceType,
  resourceId: number,
  storeId: number,
  start: string,
  end: string,
): ConflictResult {
  const conflicts = detectConflict(tasks, resourceType, resourceId, start, end)
  return {
    conflict: conflicts.length > 0,
    conflicts,
    alternatives: recommendAlternatives(resources, tasks, resourceType, storeId, start, end, resourceId),
  }
}

export function clampDate(d: Date): string {
  return d.toISOString().slice(0, 19)
}

export function addHours(d: Date, h: number): Date {
  const n = new Date(d)
  n.setHours(n.getHours() + h)
  return n
}
