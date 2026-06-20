import { defineStore } from 'pinia';
import { ref, computed, watch, onUnmounted } from 'vue';
import type { Project, Snapshot, SpriteSheet, Animation, Tilemap, AudioClip, DiffNode, SnapshotPayload } from '@/types';
import { genId } from '@/utils/id';
import { storage } from '@/utils/storage';
import { deepClone, diffSnapshots } from '@/utils/diff';
import { exportToFile } from '@/utils/exporter';
import { builtInTemplates } from '@/utils/exporter';
import { HistoryStack, type HistoryAction, type HistoryGroupAction, type AnyHistoryAction } from '@/utils/history';

export type ResourceType = 'spritesheet' | 'animation' | 'tilemap' | 'audioclip';

const history = new HistoryStack<any>(200);
let autoSnapshotTimer: ReturnType<typeof setInterval> | null = null;

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>(storage.getProjectList<Project>());
  const currentProjectId = ref<string | null>(null);
  const snapshots = ref<Snapshot[]>([]);
  const lastSavedAt = ref<number>(0);
  const autoSnapshotInterval = ref<number>(5 * 60 * 1000);
  const autoSnapshotEnabled = ref<boolean>(true);
  const historyLabel = ref<string>('');

  const spriteSheets = ref<SpriteSheet[]>([]);
  const animations = ref<Animation[]>([]);
  const tilemaps = ref<Tilemap[]>([]);
  const audioClips = ref<AudioClip[]>([]);

  const currentProject = computed(() =>
    projects.value.find(p => p.id === currentProjectId.value) || null
  );

  const canUndo = computed(() => history.canUndo());
  const canRedo = computed(() => history.canRedo());

  const stats = computed(() => ({
    sprites: spriteSheets.value.reduce((s, ss) => s + ss.frames.length, 0),
    animations: animations.value.length,
    tilemaps: tilemaps.value.length,
    audio: audioClips.value.length
  }));

  function persistProjects() {
    storage.setProjectList(projects.value);
  }

  function persistCurrent() {
    if (!currentProjectId.value) return;
    storage.setProject(currentProjectId.value, {
      spriteSheets: spriteSheets.value,
      animations: animations.value,
      tilemaps: tilemaps.value,
      audioClips: audioClips.value,
      snapshots: snapshots.value,
      autoSnapshotInterval: autoSnapshotInterval.value,
      autoSnapshotEnabled: autoSnapshotEnabled.value
    });
    lastSavedAt.value = Date.now();
  }

  function loadFromStorage(id: string) {
    const data = storage.getProject<any>(id, {
      spriteSheets: [], animations: [], tilemaps: [], audioClips: [], snapshots: [],
      autoSnapshotInterval: 5 * 60 * 1000, autoSnapshotEnabled: true
    });
    spriteSheets.value = data.spriteSheets || [];
    animations.value = data.animations || [];
    tilemaps.value = data.tilemaps || [];
    audioClips.value = data.audioClips || [];
    snapshots.value = data.snapshots || [];
    autoSnapshotInterval.value = data.autoSnapshotInterval ?? 5 * 60 * 1000;
    autoSnapshotEnabled.value = data.autoSnapshotEnabled ?? true;
    history.clear();
    restartAutoSnapshot();
  }

  function createProject(name: string, description = ''): Project {
    const p: Project = {
      id: genId('proj'), name, description,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    projects.value.push(p);
    persistProjects();
    return p;
  }

  function openProject(id: string) {
    currentProjectId.value = id;
    loadFromStorage(id);
    const p = projects.value.find(x => x.id === id);
    if (p) { p.updatedAt = Date.now(); persistProjects(); }
  }

  function deleteProject(id: string) {
    projects.value = projects.value.filter(p => p.id !== id);
    storage.removeProject(id);
    persistProjects();
    if (currentProjectId.value === id) {
      currentProjectId.value = null;
      stopAutoSnapshot();
    }
  }

  function duplicateProject(id: string, newName: string): Project | null {
    const orig = projects.value.find(p => p.id === id);
    if (!orig) return null;
    const copy = deepClone(orig);
    copy.id = genId('proj'); copy.name = newName;
    copy.createdAt = Date.now(); copy.updatedAt = Date.now();
    projects.value.push(copy);
    const data = storage.getProject<any>(id, null);
    if (data) storage.setProject(copy.id, data);
    persistProjects();
    return copy;
  }

  function remapIds<T extends { id?: string }>(obj: T, prefix: string): T {
    const out = deepClone(obj);
    if (out.id) out.id = genId(prefix);
    return out;
  }

  function copyResourceToProject(
    resourceType: ResourceType,
    resourceId: string,
    targetProjectId: string
  ): string | null {
    if (!currentProjectId.value) return null;
    const srcProjId = currentProjectId.value;
    const srcSnap: SnapshotPayload = {
      spriteSheets: deepClone(spriteSheets.value),
      animations: deepClone(animations.value),
      tilemaps: deepClone(tilemaps.value),
      audioClips: deepClone(audioClips.value)
    };

    let newId: string | null = null;
    const idMap = new Map<string, string>();

    if (resourceType === 'spritesheet') {
      const ss = srcSnap.spriteSheets.find(s => s.id === resourceId);
      if (!ss) return null;
      const newSs = remapIds(ss, 'sheet');
      for (const f of newSs.frames) {
        const oldId = f.id;
        f.id = genId('frame');
        idMap.set(oldId, f.id);
      }
      openProject(targetProjectId);
      spriteSheets.value.push(newSs);
      newId = newSs.id;
    } else if (resourceType === 'animation') {
      const anim = srcSnap.animations.find(a => a.id === resourceId);
      if (!anim) return null;
      const newAnim = remapIds(anim, 'anim');
      for (const t of newAnim.tracks) {
        t.id = genId('track');
        for (const kf of t.keyframes) {
          const oldFid = kf.frameId;
          kf.id = genId('kf');
          if (!spriteSheets.value.some(ss => ss.frames.some(f => f.id === oldFid))) {
            for (const ss of srcSnap.spriteSheets) {
              const f = ss.frames.find(fr => fr.id === oldFid);
              if (f) {
                let targetSs = spriteSheets.value.find(s => s.id === ss.id);
                if (!targetSs) {
                  targetSs = remapIds(ss, 'sheet');
                  for (const fr of targetSs.frames) {
                    const oid = fr.id;
                    fr.id = genId('frame');
                    idMap.set(oid, fr.id);
                  }
                  spriteSheets.value.push(targetSs);
                }
                break;
              }
            }
          }
          if (idMap.has(oldFid)) kf.frameId = idMap.get(oldFid)!;
        }
      }
      openProject(targetProjectId);
      animations.value.push(newAnim);
      newId = newAnim.id;
    } else if (resourceType === 'tilemap') {
      const tm = srcSnap.tilemaps.find(t => t.id === resourceId);
      if (!tm) return null;
      const newTm = remapIds(tm, 'map');
      for (const l of newTm.layers) {
        l.id = genId('layer');
      }
      for (const z of newTm.triggerZones) {
        z.id = genId('zone');
      }
      openProject(targetProjectId);
      tilemaps.value.push(newTm);
      newId = newTm.id;
    } else if (resourceType === 'audioclip') {
      const ac = srcSnap.audioClips.find(a => a.id === resourceId);
      if (!ac) return null;
      const newAc = remapIds(ac, 'audio');
      openProject(targetProjectId);
      audioClips.value.push(newAc);
      newId = newAc.id;
    }

    persistCurrent();
    const wasCurrent = targetProjectId === srcProjId;
    if (!wasCurrent) {
      openProject(srcProjId);
    }
    return newId;
  }

  function saveSnapshot(name: string) {
    if (!currentProjectId.value) return;
    const snap: Snapshot = {
      id: genId('snap'), projectId: currentProjectId.value, name, label: name,
      timestamp: Date.now(),
      resourceCount: spriteSheets.value.length + animations.value.length + tilemaps.value.length + audioClips.value.length,
      payload: {
        spriteSheets: deepClone(spriteSheets.value),
        animations: deepClone(animations.value),
        tilemaps: deepClone(tilemaps.value),
        audioClips: deepClone(audioClips.value)
      }
    };
    snapshots.value.push(snap);
    while (snapshots.value.length > 50) snapshots.value.shift();
    persistCurrent();
    return snap;
  }

  function startAutoSnapshot() {
    stopAutoSnapshot();
    if (!autoSnapshotEnabled.value) return;
    autoSnapshotTimer = setInterval(() => {
      if (!currentProjectId.value) return;
      saveSnapshot(`自动快照 ${new Date().toLocaleString()}`);
    }, autoSnapshotInterval.value);
  }

  function stopAutoSnapshot() {
    if (autoSnapshotTimer) {
      clearInterval(autoSnapshotTimer);
      autoSnapshotTimer = null;
    }
  }

  function restartAutoSnapshot() {
    stopAutoSnapshot();
    startAutoSnapshot();
  }

  function setAutoSnapshot(enabled: boolean, intervalMs?: number) {
    autoSnapshotEnabled.value = enabled;
    if (intervalMs !== undefined) autoSnapshotInterval.value = Math.max(30 * 1000, intervalMs);
    persistCurrent();
    restartAutoSnapshot();
  }

  function compareSnapshots(aId: string, bId: string): DiffNode[] {
    const a = snapshots.value.find(s => s.id === aId);
    const b = snapshots.value.find(s => s.id === bId);
    if (!a || !b) return [];
    return diffSnapshots(
      a.payload as unknown as Record<string, unknown>,
      b.payload as unknown as Record<string, unknown>
    );
  }

  function restoreSnapshot(id: string) {
    const snap = snapshots.value.find(s => s.id === id);
    if (!snap) return;
    history.clear();
    spriteSheets.value = deepClone(snap.payload.spriteSheets);
    animations.value = deepClone(snap.payload.animations);
    tilemaps.value = deepClone(snap.payload.tilemaps);
    audioClips.value = deepClone(snap.payload.audioClips);
    persistCurrent();
  }

  function deleteSnapshot(id: string) {
    snapshots.value = snapshots.value.filter(s => s.id !== id);
    persistCurrent();
  }

  function exportConfig(templateId?: string) {
    if (!currentProject.value) return;
    const payload: SnapshotPayload = {
      spriteSheets: spriteSheets.value,
      animations: animations.value,
      tilemaps: tilemaps.value,
      audioClips: audioClips.value
    };
    const tpl = builtInTemplates.find(t => t.id === templateId) || builtInTemplates[0];
    exportToFile(currentProject.value, payload, tpl);
  }

  function getReferencesOfFrame(frameId: string): { type: string; name: string; id: string }[] {
    const refs: { type: string; name: string; id: string }[] = [];
    for (const a of animations.value) {
      for (const t of a.tracks) {
        if (t.keyframes.some(k => k.frameId === frameId)) {
          refs.push({ type: 'animation', name: a.name, id: a.id });
        }
      }
    }
    for (const tm of tilemaps.value) {
      for (const l of tm.layers) {
        let found = false;
        for (const row of l.cells) for (const c of row) {
          if (c === frameId) { found = true; break; }
        }
        if (found) { refs.push({ type: 'tilemap', name: tm.name, id: tm.id }); break; }
      }
    }
    return refs;
  }

  function getReferencesOfAudio(audioId: string): { type: string; name: string; id: string }[] {
    const refs: { type: string; name: string; id: string }[] = [];
    for (const a of animations.value) {
      for (const t of a.tracks) {
        if (t.keyframes.some(k => k.audioClipId === audioId)) {
          refs.push({ type: 'animation', name: a.name, id: a.id });
        }
      }
    }
    for (const tm of tilemaps.value) {
      if (tm.triggerZones.some(z => z.audioClipId === audioId)) {
        refs.push({ type: 'tilemap', name: tm.name, id: tm.id });
      }
    }
    return refs;
  }

  function pushHistory(action: HistoryAction) {
    history.push(action);
  }

  function beginHistory() {
    history.beginGroup();
  }

  function commitHistory(label?: string) {
    history.endGroup(label);
  }

  function undo() {
    const a = history.popUndo();
    if (!a) return;
    if (a.type === 'group') {
      const actions = (a as HistoryGroupAction).before as HistoryAction<any>[];
      for (let i = actions.length - 1; i >= 0; i--) applyHistory(actions[i], true);
    } else {
      applyHistory(a as HistoryAction, true);
    }
    persistCurrent();
  }

  function redo() {
    const a = history.popRedo();
    if (!a) return;
    if (a.type === 'group') {
      const actions = (a as HistoryGroupAction).after as HistoryAction<any>[];
      for (const act of actions) applyHistory(act, false);
    } else {
      applyHistory(a as HistoryAction, false);
    }
    persistCurrent();
  }

  function applyHistory(action: HistoryAction, isUndo: boolean) {
    const val = isUndo ? action.before : action.after;
    const id = action.targetId;
    switch (action.type) {
      case 'spritesheet': {
        if (val === null || val === undefined) {
          spriteSheets.value = spriteSheets.value.filter(s => s.id !== id);
        } else {
          const idx = spriteSheets.value.findIndex(s => s.id === id);
          if (idx >= 0) spriteSheets.value.splice(idx, 1, val);
          else if (!isUndo) spriteSheets.value.push(val);
        }
        break;
      }
      case 'spritesheet-frames': {
        for (const ss of spriteSheets.value) {
          if (ss.id === id) { ss.frames = val; break; }
        }
        break;
      }
      case 'frame': {
        for (const ss of spriteSheets.value) {
          const idx = ss.frames.findIndex(f => f.id === id);
          if (idx >= 0) { ss.frames.splice(idx, 1, val); break; }
        }
        break;
      }
      case 'animation': {
        if (val === null || val === undefined) {
          animations.value = animations.value.filter(a => a.id !== id);
        } else {
          const idx = animations.value.findIndex(a => a.id === id);
          if (idx >= 0) animations.value.splice(idx, 1, val);
          else if (!isUndo) animations.value.push(val);
        }
        break;
      }
      case 'track-keyframes': {
        for (const an of animations.value) {
          const t = an.tracks.find(t => t.id === id);
          if (t) { t.keyframes = val; break; }
        }
        break;
      }
      case 'keyframe': {
        if (val === null || val === undefined) {
          for (const an of animations.value) {
            for (const t of an.tracks) {
              const idx = t.keyframes.findIndex(k => k.id === id);
              if (idx >= 0) { t.keyframes.splice(idx, 1); return; }
            }
          }
        } else {
          for (const an of animations.value) {
            for (const t of an.tracks) {
              const idx = t.keyframes.findIndex(k => k.id === id);
              if (idx >= 0) { t.keyframes.splice(idx, 1, val); return; }
            }
          }
          if (!isUndo && val?.trackId) {
            for (const an of animations.value) {
              const t = an.tracks.find(t => t.id === val.trackId);
              if (t) { t.keyframes.push(val); return; }
            }
          }
        }
        break;
      }
      case 'tilemap': {
        const idx = tilemaps.value.findIndex(t => t.id === id);
        if (idx >= 0) tilemaps.value.splice(idx, 1, val);
        else if (!isUndo) tilemaps.value.push(val);
        break;
      }
      case 'tilemap-layer-cells': {
        for (const tm of tilemaps.value) {
          const l = tm.layers.find(l => l.id === id);
          if (l) { l.cells = val; break; }
        }
        break;
      }
      case 'audioclip': {
        const idx = audioClips.value.findIndex(a => a.id === id);
        if (idx >= 0) audioClips.value.splice(idx, 1, val);
        else if (!isUndo) audioClips.value.push(val);
        break;
      }
    }
  }

  watch([spriteSheets, animations, tilemaps, audioClips], () => {
    persistCurrent();
  }, { deep: true });

  watch(currentProjectId, (nv) => {
    if (nv) startAutoSnapshot();
    else stopAutoSnapshot();
  });

  return {
    projects, currentProjectId, snapshots,
    spriteSheets, animations, tilemaps, audioClips,
    currentProject, stats, lastSavedAt,
    canUndo, canRedo, historyLabel,
    autoSnapshotInterval, autoSnapshotEnabled,
    createProject, openProject, deleteProject, duplicateProject,
    copyResourceToProject,
    saveSnapshot, compareSnapshots, restoreSnapshot, deleteSnapshot,
    startAutoSnapshot, stopAutoSnapshot, setAutoSnapshot,
    exportConfig, persistCurrent, persistAll: persistCurrent,
    getReferencesOfFrame, getReferencesOfAudio,
    pushHistory, beginHistory, commitHistory, undo, redo
  };
});
