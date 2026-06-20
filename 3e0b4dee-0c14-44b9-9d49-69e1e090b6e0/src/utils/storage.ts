const PREFIX = 'pixelforge_';
const PROJECTS_KEY = PREFIX + 'projects';
const PROJECT_PREFIX = PREFIX + 'project_';

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function safeSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

export const storage = {
  getProjectList<T>(): T[] { return safeGet<T[]>(PROJECTS_KEY, []); },
  setProjectList<T>(list: T[]): void { safeSet(PROJECTS_KEY, list); },
  getProject<T>(id: string, fallback: T): T { return safeGet<T>(PROJECT_PREFIX + id, fallback); },
  setProject<T>(id: string, data: T): void { safeSet(PROJECT_PREFIX + id, data); },
  removeProject(id: string): void { localStorage.removeItem(PROJECT_PREFIX + id); },
  clearAll(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
};
