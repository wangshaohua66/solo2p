import { create } from 'zustand';
import type { Project, WorkflowTemplate } from '@/types';
import {
  generateId,
  saveProjects,
  loadProjects,
  saveTemplates,
  loadTemplates,
  saveCurrentProjectId,
  loadCurrentProjectId,
} from '@/utils/storage';

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  templates: WorkflowTemplate[];
  searchQuery: string;
  isLoading: boolean;
  toasts: Array<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }>;

  init: () => Promise<void>;
  createProject: (name: string, description?: string) => Project;
  duplicateProject: (id: string) => Project | null;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  setCurrentProject: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  getCurrentProject: () => Project | null;
  setSearchQuery: (query: string) => void;
  getFilteredProjects: () => Project[];
  
  saveTemplate: (tpl: Omit<WorkflowTemplate, 'id' | 'createdAt'>) => WorkflowTemplate;
  deleteTemplate: (id: string) => void;
  updateTemplate: (id: string, patch: Partial<WorkflowTemplate>) => void;

  exportProject: (id: string) => string | null;
  importProject: (input: string | File) => Promise<Project | null>;

  addToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  removeToast: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  templates: [],
  searchQuery: '',
  isLoading: true,
  toasts: [],

  init: async () => {
    try {
      const [projects, templates, currentId] = await Promise.all([
        loadProjects(),
        loadTemplates(),
        loadCurrentProjectId(),
      ]);
      set({ projects, templates, currentProjectId: currentId, isLoading: false });
    } catch (e) {
      console.error('Failed to load data from storage', e);
      set({ isLoading: false });
    }
  },

  createProject: (name, description) => {
    const newProject: Project = {
      id: generateId('proj_'),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mutations: [],
      primers: [],
      annotations: [],
    };
    set((state) => {
      const projects = [...state.projects, newProject];
      void saveProjects(projects);
      return { projects, currentProjectId: newProject.id };
    });
    void saveCurrentProjectId(newProject.id);
    return newProject;
  },

  duplicateProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return null;
    const duplicated: Project = {
      ...project,
      id: generateId('proj_'),
      name: `${project.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => {
      const projects = [...state.projects, duplicated];
      void saveProjects(projects);
      return { projects };
    });
    return duplicated;
  },

  deleteProject: (id) => {
    set((state) => {
      const projects = state.projects.filter((p) => p.id !== id);
      void saveProjects(projects);
      const currentProjectId = state.currentProjectId === id 
        ? (projects[0]?.id ?? null) 
        : state.currentProjectId;
      if (currentProjectId !== state.currentProjectId) {
        void saveCurrentProjectId(currentProjectId);
      }
      return { projects, currentProjectId };
    });
  },

  renameProject: (id, name) => {
    set((state) => {
      const projects = state.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p
      );
      void saveProjects(projects);
      return { projects };
    });
  },

  updateProject: (id, patch) => {
    set((state) => {
      const projects = state.projects.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      );
      void saveProjects(projects);
      return { projects };
    });
  },

  setCurrentProject: (id) => {
    set({ currentProjectId: id });
    void saveCurrentProjectId(id);
  },

  setCurrentProjectId: (id) => {
    set({ currentProjectId: id });
    void saveCurrentProjectId(id);
  },

  getCurrentProject: () => {
    const { projects, currentProjectId } = get();
    return projects.find((p) => p.id === currentProjectId) ?? null;
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  getFilteredProjects: () => {
    const { projects, searchQuery } = get();
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description?.toLowerCase() ?? '').includes(q)
    );
  },

  saveTemplate: (tpl) => {
    const newTpl: WorkflowTemplate = {
      ...tpl,
      id: generateId('tpl_'),
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const templates = [...state.templates, newTpl];
      void saveTemplates(templates);
      return { templates };
    });
    return newTpl;
  },

  deleteTemplate: (id) => {
    set((state) => {
      const templates = state.templates.filter((t) => t.id !== id);
      void saveTemplates(templates);
      return { templates };
    });
  },

  updateTemplate: (id, patch) => {
    set((state) => {
      const templates = state.templates.map((t) => (t.id === id ? { ...t, ...patch } : t));
      void saveTemplates(templates);
      return { templates };
    });
  },

  exportProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return null;
    return JSON.stringify(project, null, 2);
  },

  importProject: async (input: string | File) => {
    try {
      let json: string;
      if (typeof input === 'string') {
        json = input;
      } else {
        json = await input.text();
      }
      const parsed = JSON.parse(json) as Project;
      if (!parsed.name) return null;
      const imported: Project = {
        ...parsed,
        id: generateId('proj_'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => {
        const projects = [...state.projects, imported];
        void saveProjects(projects);
        return { projects, currentProjectId: imported.id };
      });
      void saveCurrentProjectId(imported.id);
      return imported;
    } catch {
      return null;
    }
  },

  addToast: (type, message) => {
    const id = generateId('toast_');
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
