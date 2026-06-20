import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Project, Snapshot, SpriteSheet, Animation, Tilemap, AudioClip, DiffNode, SnapshotPayload } from '@/types';
import { genId } from '@/utils/id';
import { storage } from '@/utils/storage';
import { deepClone, diffSnapshots } from '@/utils/diff';
import { exportToFile } from '@/utils/exporter';

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>(storage.getProjectList<Project>());
  const currentProjectId = ref<string | null>(null);
  const snapshots = ref<Snapshot[]>([]);
  const lastSavedAt = ref<number>(0);

  const spriteSheets = ref<SpriteSheet[]>([]);
  const animations = ref<Animation[]>([]);
  const tilemaps = ref<Tilemap[]>([]);
  const audioClips = ref<AudioClip[]>([]);

  const currentProject = computed(() =>
    projects.value.find(p => p.id === currentProjectId.value) || null
  );

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
      snapshots: snapshots.value
    });
    lastSavedAt.value = Date.now();
  }

  function loadFromStorage(id: string) {
    const data = storage.getProject<{
      spriteSheets: SpriteSheet[]; animations: Animation[];
      tilemaps: Tilemap[]; audioClips: AudioClip[]; snapshots: Snapshot[];
    }>(id, { spriteSheets: [], animations: [], tilemaps: [], audioClips: [], snapshots: [] });
    spriteSheets.value = data.spriteSheets;
    animations.value = data.animations;
    tilemaps.value = data.tilemaps;
    audioClips.value = data.audioClips;
    snapshots.value = data.snapshots;
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
    if (currentProjectId.value === id) currentProjectId.value = null;
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

  function saveSnapshot(name: string) {
    if (!currentProjectId.value) return;
    const snap: Snapshot = {
      id: genId('snap'), projectId: currentProjectId.value, name,
      timestamp: Date.now(),
      payload: {
        spriteSheets: deepClone(spriteSheets.value),
        animations: deepClone(animations.value),
        tilemaps: deepClone(tilemaps.value),
        audioClips: deepClone(audioClips.value)
      }
    };
    snapshots.value.push(snap);
    persistCurrent();
    return snap;
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

  function exportConfig() {
    if (!currentProject.value) return;
    const payload: SnapshotPayload = {
      spriteSheets: spriteSheets.value,
      animations: animations.value,
      tilemaps: tilemaps.value,
      audioClips: audioClips.value
    };
    exportToFile(currentProject.value, payload);
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

  return {
    projects, currentProjectId, snapshots,
    spriteSheets, animations, tilemaps, audioClips,
    currentProject, stats, lastSavedAt,
    createProject, openProject, deleteProject, duplicateProject,
    saveSnapshot, compareSnapshots, restoreSnapshot, deleteSnapshot,
    exportConfig, persistCurrent,
    getReferencesOfFrame, getReferencesOfAudio
  };
});
