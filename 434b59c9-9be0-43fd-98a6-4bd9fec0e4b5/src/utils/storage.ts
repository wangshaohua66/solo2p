import localforage from 'localforage';
import type { Project, WorkflowTemplate, ToastItem } from '@/types';

const PROJECTS_STORE = 'gene_workstation_projects';
const TEMPLATES_STORE = 'gene_workstation_templates';
const CURRENT_PROJECT_KEY = 'gene_workstation_current_project';

localforage.config({
  name: 'GeneWorkstation',
  version: 1.0,
  storeName: 'geneWorkstationDB',
  description: 'Gene Workstation offline storage',
});

export async function saveProjects(projects: Project[]): Promise<void> {
  await localforage.setItem(PROJECTS_STORE, projects);
}

export async function loadProjects(): Promise<Project[]> {
  const data = await localforage.getItem<Project[]>(PROJECTS_STORE);
  return data ?? [];
}

export async function saveTemplates(templates: WorkflowTemplate[]): Promise<void> {
  await localforage.setItem(TEMPLATES_STORE, templates);
}

export async function loadTemplates(): Promise<WorkflowTemplate[]> {
  const data = await localforage.getItem<WorkflowTemplate[]>(TEMPLATES_STORE);
  return data ?? [];
}

export async function saveCurrentProjectId(id: string | null): Promise<void> {
  if (id) {
    await localforage.setItem(CURRENT_PROJECT_KEY, id);
  } else {
    await localforage.removeItem(CURRENT_PROJECT_KEY);
  }
}

export async function loadCurrentProjectId(): Promise<string | null> {
  return await localforage.getItem<string>(CURRENT_PROJECT_KEY);
}

export function generateId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function exportProjectToJSON(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function importProjectFromJSON(json: string): Project | null {
  try {
    const parsed = JSON.parse(json) as Project;
    if (!parsed.id || !parsed.name) {
      return null;
    }
    return {
      ...parsed,
      id: generateId('proj_'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
