import { create } from 'zustand';
import { db } from '@/db';
import { generateId } from '@/utils/idGenerator';
import { createDefaultLayers } from '@/utils/konvaSerializer';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import type {
  Project,
  Scene,
  Shot,
  Dialogue,
  CameraMove,
  TransitionType,
  Layer,
  ReferenceImage,
} from '@/types';
import { MIN_DURATION, MAX_DURATION, MAX_HISTORY, MAX_DIALOGUES } from '@/types';

interface HistoryState {
  scenes: Scene[];
  shots: Shot[];
  project: Project | null;
}

export interface ExportProjectJSON {
  version: number;
  project: Project;
  scenes: Scene[];
  shots: Shot[];
  exportedAt: number;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  scenes: Scene[];
  shots: Shot[];
  currentSceneId: string | null;
  currentShotId: string | null;
  searchKeyword: string;
  filterCameraMove: string | null;
  filterTransition: string | null;

  _historyStack: HistoryState[];
  _historyIndex: number;

  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  importProject: (data: { project: Project; scenes: Scene[]; shots: Shot[] }) => Promise<string>;
  exportProject: () => ExportProjectJSON;

  loadProject: (projectId: string) => Promise<void>;

  selectScene: (sceneId: string) => void;
  addScene: (name: string) => Promise<void>;
  renameScene: (sceneId: string, name: string) => void;
  deleteScene: (sceneId: string) => Promise<void>;
  reorderScenes: (orderedSceneIds: string[]) => void;

  selectShot: (shotId: string) => void;
  addShot: (sceneId: string) => Promise<void>;
  deleteShot: (shotId: string) => Promise<void>;
  updateShot: (shotId: string, patch: Partial<Shot>) => void;
  reorderShotInScene: (sceneId: string, orderedShotIds: string[]) => void;
  moveShotToScene: (
    shotId: string,
    fromSceneId: string,
    toSceneId: string,
    targetIndex: number
  ) => void;
  getCurrentShot: () => Shot | undefined;
  updateShotLayersData: (shotId: string, layers: Layer[], thumbnail?: string) => void;

  addDialogue: (shotId: string, dlg: Omit<Dialogue, 'id'>) => void;
  updateDialogue: (shotId: string, dialogueId: string, patch: Partial<Dialogue>) => void;
  deleteDialogue: (shotId: string, dialogueId: string) => void;

  toggleSfxTag: (shotId: string, type: string) => void;

  uploadReferenceImage: (shotId: string, ref: ReferenceImage) => void;
  removeReferenceImage: (shotId: string) => void;
  updateReferenceOpacity: (shotId: string, opacity: number) => void;

  setSearchKeyword: (kw: string) => void;
  setFilterCameraMove: (v: string | null) => void;
  setFilterTransition: (v: string | null) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  _commitHistory: () => void;
}

const clampDuration = (d: number) => Math.min(Math.max(d, MIN_DURATION), MAX_DURATION);

const buildInitialShot = (sceneId: string, projectId: string, orderIndex: number): Shot => ({
  id: generateId(),
  sceneId,
  projectId,
  orderIndex,
  title: '',
  duration: 3,
  cameraMovement: 'static',
  transition: 'cut',
  layers: createDefaultLayers(),
  thumbnail: undefined,
  referenceImage: null,
  dialogues: [],
  sfxTags: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const snapshotHistory = (state: ProjectState): HistoryState => ({
  project: state.currentProject ? JSON.parse(JSON.stringify(state.currentProject)) : null,
  scenes: state.scenes.map((s) => JSON.parse(JSON.stringify(s))),
  shots: state.shots.map((s) => JSON.parse(JSON.stringify(s))),
});

const applyHistory = (state: ProjectState, history: HistoryState): Partial<ProjectState> => ({
  currentProject: history.project,
  scenes: history.scenes,
  shots: history.shots,
});

let _debounceTimer: NodeJS.Timeout | null = null;
const debouncedPersist = (state: ProjectState) => {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    if (!state.currentProject) return;
    const pid = state.currentProject.id;
    try {
      await db.transaction('rw', db.projects, db.scenes, db.shots, async () => {
        await db.projects.put(state.currentProject!);
        for (const s of state.scenes) await db.scenes.put(s);
        for (const s of state.shots) {
          const flat: any = {
            ...s,
            layersData: JSON.stringify(s.layers),
            dialoguesData: JSON.stringify(s.dialogues),
            sfxData: JSON.stringify(s.sfxTags),
            referenceData: s.referenceImage ? JSON.stringify(s.referenceImage) : null,
          };
          delete flat.layers;
          delete flat.dialogues;
          delete flat.sfxTags;
          delete flat.referenceImage;
          await db.shots.put(flat);
        }
      });
    } catch (e) {
      console.warn('Persist failed', e);
    }
  }, 600);
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  scenes: [],
  shots: [],
  currentSceneId: null,
  currentShotId: null,
  searchKeyword: '',
  filterCameraMove: null,
  filterTransition: null,

  _historyStack: [],
  _historyIndex: -1,

  loadProjects: async () => {
    try {
      const list = await db.projects.orderBy('updatedAt').reverse().toArray();
      set({ projects: list });
    } catch (e) {
      console.error(e);
    }
  },

  createProject: async (name, description = '') => {
    const project: Project = {
      id: generateId(),
      name,
      description,
      thumbnail: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fps: 24,
    };
    await db.projects.add(project);

    const scene: Scene = {
      id: generateId(),
      projectId: project.id,
      name: '第 1 幕',
      orderIndex: 0,
      createdAt: Date.now(),
    };
    await db.scenes.add(scene);

    const shot = buildInitialShot(scene.id, project.id, 0);
    shot.thumbnail = await generateThumbnail(shot, 480, 270);
    const flat: any = {
      ...shot,
      layersData: JSON.stringify(shot.layers),
      dialoguesData: JSON.stringify(shot.dialogues),
      sfxData: JSON.stringify(shot.sfxTags),
      referenceData: null,
    };
    delete flat.layers;
    delete flat.dialogues;
    delete flat.sfxTags;
    delete flat.referenceImage;
    await db.shots.add(flat);

    project.thumbnail = shot.thumbnail || '';
    await db.projects.update(project.id, { thumbnail: project.thumbnail, updatedAt: Date.now() });

    set((s) => ({
      projects: [project, ...s.projects],
    }));

    return project.id;
  },

  deleteProject: async (id) => {
    try {
      await db.transaction('rw', db.projects, db.scenes, db.shots, async () => {
        await db.shots.where('projectId').equals(id).delete();
        await db.scenes.where('projectId').equals(id).delete();
        await db.projects.delete(id);
      });
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        currentProject: s.currentProject?.id === id ? null : s.currentProject,
      }));
    } catch (e) {
      console.error(e);
    }
  },

  importProject: async (data) => {
    const idMap: Record<string, string> = {};
    const newProject: Project = {
      ...data.project,
      id: generateId(),
      name: `${data.project.name} (副本)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    idMap[data.project.id] = newProject.id;

    const newScenes: Scene[] = data.scenes.map((s) => {
      const newId = generateId();
      idMap[s.id] = newId;
      return {
        ...s,
        id: newId,
        projectId: newProject.id,
        createdAt: Date.now(),
      };
    });

    const newShots: Shot[] = data.shots.map((s) => {
      const newId = generateId();
      idMap[s.id] = newId;
      return {
        ...s,
        id: newId,
        projectId: newProject.id,
        sceneId: idMap[s.sceneId] || s.sceneId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    try {
      await db.transaction('rw', db.projects, db.scenes, db.shots, async () => {
        await db.projects.add(newProject);
        for (const scene of newScenes) await db.scenes.add(scene);
        for (const s of newShots) {
          const flat: any = {
            ...s,
            layersData: JSON.stringify(s.layers),
            dialoguesData: JSON.stringify(s.dialogues),
            sfxData: JSON.stringify(s.sfxTags),
            referenceData: s.referenceImage ? JSON.stringify(s.referenceImage) : null,
          };
          delete flat.layers;
          delete flat.dialogues;
          delete flat.sfxTags;
          delete flat.referenceImage;
          await db.shots.add(flat);
        }
      });
    } catch (e) {
      console.error(e);
    }

    set((s) => ({
      projects: [newProject, ...s.projects],
    }));

    return newProject.id;
  },

  exportProject: () => {
    const s = get();
    if (!s.currentProject) throw new Error('项目未加载');
    return {
      version: 1,
      project: s.currentProject,
      scenes: s.scenes,
      shots: s.shots,
      exportedAt: Date.now(),
    };
  },

  loadProject: async (projectId) => {
    const [project, scenes, shotRows] = await Promise.all([
      db.projects.get(projectId),
      db.scenes.where('projectId').equals(projectId).sortBy('orderIndex'),
      db.shots.where('projectId').equals(projectId).sortBy('sceneId'),
    ]);
    if (!project) throw new Error('Project not found');

    const shots: Shot[] = shotRows.map((row: any) => ({
      ...row,
      layers: row.layersData ? JSON.parse(row.layersData) : createDefaultLayers(),
      dialogues: row.dialoguesData ? JSON.parse(row.dialoguesData) : [],
      sfxTags: row.sfxData ? JSON.parse(row.sfxData) : [],
      referenceImage: row.referenceData ? JSON.parse(row.referenceData) : null,
    }));

    shots.sort((a, b) => {
      if (a.sceneId !== b.sceneId) return 0;
      return a.orderIndex - b.orderIndex;
    });

    const firstScene = scenes[0];
    const firstShot = shots.find((s) => s.sceneId === firstScene?.id);

    set({
      currentProject: project,
      scenes,
      shots,
      currentSceneId: firstScene?.id || null,
      currentShotId: firstShot?.id || null,
      _historyStack: [],
      _historyIndex: -1,
    });
    setTimeout(() => get()._commitHistory(), 50);
  },

  selectScene: (sceneId) => {
    const firstShot = get().shots.find((s) => s.sceneId === sceneId);
    set({
      currentSceneId: sceneId,
      currentShotId: firstShot?.id || null,
    });
  },

  addScene: async (name) => {
    const state = get();
    if (!state.currentProject) return;
    const maxOrder = state.scenes.reduce((m, s) => Math.max(m, s.orderIndex), -1);
    const scene: Scene = {
      id: generateId(),
      projectId: state.currentProject.id,
      name,
      orderIndex: maxOrder + 1,
      createdAt: Date.now(),
    };
    await db.scenes.add(scene);

    const firstShot = buildInitialShot(scene.id, state.currentProject.id, 0);
    firstShot.thumbnail = await generateThumbnail(firstShot, 480, 270);
    const flat: any = {
      ...firstShot,
      layersData: JSON.stringify(firstShot.layers),
      dialoguesData: JSON.stringify(firstShot.dialogues),
      sfxData: JSON.stringify(firstShot.sfxTags),
      referenceData: null,
    };
    delete flat.layers;
    delete flat.dialogues;
    delete flat.sfxTags;
    delete flat.referenceImage;
    await db.shots.add(flat);

    set((s) => ({
      scenes: [...s.scenes, scene],
      shots: [...s.shots, firstShot],
      currentSceneId: scene.id,
      currentShotId: firstShot.id,
    }));
    get()._commitHistory();
    debouncedPersist(get());
  },

  renameScene: (sceneId, name) => {
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === sceneId ? { ...sc, name } : sc)),
    }));
    get()._commitHistory();
    debouncedPersist(get());
  },

  deleteScene: async (sceneId) => {
    const state = get();
    const sceneShots = state.shots.filter((s) => s.sceneId === sceneId);
    try {
      await db.transaction('rw', db.scenes, db.shots, async () => {
        for (const sh of sceneShots) await db.shots.delete(sh.id);
        await db.scenes.delete(sceneId);
      });
    } catch (e) {
      console.error(e);
    }
    const remainingScenes = state.scenes.filter((s) => s.id !== sceneId);
    const remainingShots = state.shots.filter((s) => s.sceneId !== sceneId);
    const firstScene = remainingScenes[0];
    const firstShot = remainingShots.find((s) => s.sceneId === firstScene?.id);
    set({
      scenes: remainingScenes,
      shots: remainingShots,
      currentSceneId: firstScene?.id || null,
      currentShotId: firstShot?.id || null,
    });
    get()._commitHistory();
  },

  reorderScenes: (orderedIds) => {
    set((s) => {
      const idOrder = new Map(orderedIds.map((id, i) => [id, i]));
      const newScenes = [...s.scenes]
        .sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999))
        .map((sc, i) => ({ ...sc, orderIndex: i }));
      return { scenes: newScenes };
    });
    get()._commitHistory();
    debouncedPersist(get());
  },

  selectShot: (shotId) => {
    const shot = get().shots.find((s) => s.id === shotId);
    set({
      currentSceneId: shot?.sceneId || null,
      currentShotId: shotId,
    });
  },

  addShot: async (sceneId) => {
    const state = get();
    if (!state.currentProject) return;
    const sceneShots = state.shots.filter((s) => s.sceneId === sceneId);
    const newOrder = sceneShots.length;
    const shot = buildInitialShot(sceneId, state.currentProject.id, newOrder);
    shot.thumbnail = await generateThumbnail(shot, 480, 270);
    const flat: any = {
      ...shot,
      layersData: JSON.stringify(shot.layers),
      dialoguesData: JSON.stringify(shot.dialogues),
      sfxData: JSON.stringify(shot.sfxTags),
      referenceData: null,
    };
    delete flat.layers;
    delete flat.dialogues;
    delete flat.sfxTags;
    delete flat.referenceImage;
    await db.shots.add(flat);

    set((s) => ({
      shots: [...s.shots, shot],
      currentSceneId: sceneId,
      currentShotId: shot.id,
    }));
    get()._commitHistory();
    debouncedPersist(get());
  },

  deleteShot: async (shotId) => {
    try {
      await db.shots.delete(shotId);
    } catch (e) {
      console.error(e);
    }
    const state = get();
    const deletedShot = state.shots.find((s) => s.id === shotId);
    let remaining = state.shots.filter((s) => s.id !== shotId);
    if (deletedShot) {
      remaining = remaining.map((s) =>
        s.sceneId === deletedShot.sceneId && s.orderIndex > deletedShot.orderIndex
          ? { ...s, orderIndex: s.orderIndex - 1 }
          : s
      );
    }
    const nextShot = remaining.find((s) => s.sceneId === deletedShot?.sceneId);
    set({
      shots: remaining,
      currentShotId: nextShot?.id || remaining[0]?.id || null,
      currentSceneId: nextShot?.sceneId || remaining[0]?.sceneId || null,
    });
    get()._commitHistory();
    debouncedPersist(get());
  },

  updateShot: (shotId, patch) => {
    set((s) => ({
      shots: s.shots.map((sh) => {
        if (sh.id !== shotId) return sh;
        const updated: Shot = { ...sh, ...patch, updatedAt: Date.now() };
        if (patch.duration !== undefined) updated.duration = clampDuration(patch.duration);
        return updated;
      }),
    }));
    debouncedPersist(get());
  },

  reorderShotInScene: (sceneId, orderedIds) => {
    set((s) => {
      const idOrder = new Map(orderedIds.map((id, i) => [id, i]));
      return {
        shots: s.shots.map((sh) =>
          sh.sceneId === sceneId
            ? { ...sh, orderIndex: idOrder.get(sh.id) ?? sh.orderIndex }
            : sh
        ),
      };
    });
    get()._commitHistory();
    debouncedPersist(get());
  },

  moveShotToScene: (shotId, fromSceneId, toSceneId, targetIndex) => {
    set((s) => {
      let targetShot = s.shots.find((x) => x.id === shotId);
      if (!targetShot) return {};
      const updated: Shot[] = s.shots
        .filter((sh) => sh.id !== shotId)
        .map((sh) => {
          if (sh.sceneId === fromSceneId && sh.orderIndex > (targetShot?.orderIndex ?? -1)) {
            return { ...sh, orderIndex: sh.orderIndex - 1 };
          }
          if (sh.sceneId === toSceneId && sh.orderIndex >= targetIndex) {
            return { ...sh, orderIndex: sh.orderIndex + 1 };
          }
          return sh;
        });
      targetShot = { ...targetShot, sceneId: toSceneId, orderIndex: targetIndex };
      updated.push(targetShot);
      return {
        shots: updated,
        currentShotId: shotId,
        currentSceneId: toSceneId,
      };
    });
    get()._commitHistory();
    debouncedPersist(get());
  },

  getCurrentShot: () => {
    const { shots, currentShotId } = get();
    return shots.find((s) => s.id === currentShotId);
  },

  updateShotLayersData: (shotId, layers, thumbnail) => {
    set((s) => ({
      shots: s.shots.map((sh) =>
        sh.id === shotId
          ? {
              ...sh,
              layers,
              thumbnail: thumbnail ?? sh.thumbnail,
              updatedAt: Date.now(),
            }
          : sh
      ),
    }));
    debouncedPersist(get());
  },

  addDialogue: (shotId, dlg) => {
    set((s) => ({
      shots: s.shots.map((sh) => {
        if (sh.id !== shotId) return sh;
        if ((sh.dialogues?.length || 0) >= MAX_DIALOGUES) return sh;
        return {
          ...sh,
          dialogues: [...(sh.dialogues || []), { ...dlg, id: generateId() }],
          updatedAt: Date.now(),
        };
      }),
    }));
    debouncedPersist(get());
  },

  updateDialogue: (shotId, dialogueId, patch) => {
    set((s) => ({
      shots: s.shots.map((sh) =>
        sh.id === shotId
          ? {
              ...sh,
              dialogues: sh.dialogues.map((d) =>
                d.id === dialogueId ? { ...d, ...patch } : d
              ),
              updatedAt: Date.now(),
            }
          : sh
      ),
    }));
  },

  deleteDialogue: (shotId, dialogueId) => {
    set((s) => ({
      shots: s.shots.map((sh) =>
        sh.id === shotId
          ? {
              ...sh,
              dialogues: sh.dialogues.filter((d) => d.id !== dialogueId),
              updatedAt: Date.now(),
            }
          : sh
      ),
    }));
    debouncedPersist(get());
  },

  toggleSfxTag: (shotId, type) => {
    set((s) => ({
      shots: s.shots.map((sh) => {
        if (sh.id !== shotId) return sh;
        const existing = sh.sfxTags || [];
        const has = existing.includes(type);
        return {
          ...sh,
          sfxTags: has ? existing.filter((t) => t !== type) : [...existing, type],
          updatedAt: Date.now(),
        };
      }),
    }));
    debouncedPersist(get());
  },

  uploadReferenceImage: (shotId, ref) => {
    set((s) => ({
      shots: s.shots.map((sh) =>
        sh.id === shotId
          ? { ...sh, referenceImage: ref, updatedAt: Date.now() }
          : sh
      ),
    }));
    get()._commitHistory();
    debouncedPersist(get());
  },

  removeReferenceImage: (shotId) => {
    set((s) => ({
      shots: s.shots.map((sh) =>
        sh.id === shotId
          ? { ...sh, referenceImage: null, updatedAt: Date.now() }
          : sh
      ),
    }));
    get()._commitHistory();
    debouncedPersist(get());
  },

  updateReferenceOpacity: (shotId, opacity) => {
    set((s) => ({
      shots: s.shots.map((sh) =>
        sh.id === shotId && sh.referenceImage
          ? {
              ...sh,
              referenceImage: { ...sh.referenceImage, opacity },
              updatedAt: Date.now(),
            }
          : sh
      ),
    }));
    debouncedPersist(get());
  },

  setSearchKeyword: (kw) => set({ searchKeyword: kw }),
  setFilterCameraMove: (v) => set({ filterCameraMove: v }),
  setFilterTransition: (v) => set({ filterTransition: v }),

  undo: () => {
    const state = get();
    if (state._historyIndex <= 0) return;
    const targetIndex = state._historyIndex - 1;
    const history = state._historyStack[targetIndex];
    if (!history) return;
    set((s) => ({
      ...applyHistory(s, history),
      _historyIndex: targetIndex,
    }));
    debouncedPersist(get());
  },

  redo: () => {
    const state = get();
    if (state._historyIndex >= state._historyStack.length - 1) return;
    const targetIndex = state._historyIndex + 1;
    const history = state._historyStack[targetIndex];
    if (!history) return;
    set((s) => ({
      ...applyHistory(s, history),
      _historyIndex: targetIndex,
    }));
    debouncedPersist(get());
  },

  canUndo: () => get()._historyIndex > 0,
  canRedo: () => get()._historyIndex < get()._historyStack.length - 1,

  _commitHistory: () => {
    const state = get();
    const snap = snapshotHistory(state);
    let newStack = state._historyStack.slice(0, state._historyIndex + 1);
    newStack.push(snap);
    if (newStack.length > MAX_HISTORY) {
      newStack = newStack.slice(newStack.length - MAX_HISTORY);
    }
    set({
      _historyStack: newStack,
      _historyIndex: newStack.length - 1,
    });
  },
}));
