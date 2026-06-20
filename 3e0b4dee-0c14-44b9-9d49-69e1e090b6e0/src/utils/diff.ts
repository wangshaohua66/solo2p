import type { DiffNode } from '@/types';

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return (obj as unknown[]).map(x => deepClone(x)) as T;
  const result: Record<string, unknown> = {};
  for (const k in obj as Record<string, unknown>) {
    result[k] = deepClone((obj as Record<string, unknown>)[k]);
  }
  return result as T;
}

export function diffSnapshots(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  path: string[] = []
): DiffNode[] {
  const diffs: DiffNode[] = [];
  const keys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  for (const k of keys) {
    const curPath = [...path, k];
    const oldV = (oldObj || {})[k];
    const newV = (newObj || {})[k];
    if (oldV === undefined && newV !== undefined) {
      diffs.push({ type: 'add', path: curPath, new: newV });
    } else if (newV === undefined && oldV !== undefined) {
      diffs.push({ type: 'remove', path: curPath, old: oldV });
    } else if (isObject(oldV) && isObject(newV)) {
      diffs.push(...diffSnapshots(oldV as Record<string, unknown>, newV as Record<string, unknown>, curPath));
    } else if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
      diffs.push({ type: 'update', path: curPath, old: oldV, new: newV });
    }
  }
  return diffs;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
