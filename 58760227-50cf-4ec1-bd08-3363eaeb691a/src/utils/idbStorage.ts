import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { Project } from "@/types/audio";
import { AUTO_SAVE_INTERVAL } from "@/types/audio";

interface PodcutDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { "by-updatedAt": number };
  };
  audioBuffers: {
    key: string;
    value: { id: string; buffer: ArrayBuffer; sampleRate: number; channels: number };
  };
  snapshots: {
    key: string;
    value: { id: string; projectId: string; createdAt: number; data: unknown };
    indexes: { "by-project": string };
  };
}

const DB_NAME = "podcut-studio";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PodcutDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PodcutDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PodcutDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const projects = db.createObjectStore("projects", { keyPath: "id" });
        projects.createIndex("by-updatedAt", "updatedAt");
        db.createObjectStore("audioBuffers", { keyPath: "id" });
        const snapshots = db.createObjectStore("snapshots", { keyPath: "id" });
        snapshots.createIndex("by-project", "projectId");
      },
    });
  }
  return dbPromise;
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put("projects", { ...project, updatedAt: Date.now() });
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get("projects", id);
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAllFromIndex("projects", "by-updatedAt");
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["projects", "snapshots"], "readwrite");
  await tx.objectStore("projects").delete(id);
  const snapshotsStore = tx.objectStore("snapshots");
  const idx = snapshotsStore.index("by-project");
  let cursor = await idx.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function saveSnapshot(
  projectId: string,
  data: unknown
): Promise<void> {
  const db = await getDB();
  const key = `${projectId}-${Date.now()}`;
  await db.put("snapshots", {
    id: key,
    projectId,
    createdAt: Date.now(),
    data,
  });
}

export async function saveAudioBuffer(
  id: string,
  buffer: AudioBuffer
): Promise<void> {
  const db = await getDB();
  const channels: number[][] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    channels.push(Array.from(data));
  }
  const transferable = {
    id,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    length: buffer.length,
    channelData: channels,
  };
  await db.put("audioBuffers", transferable as unknown as {
    id: string;
    buffer: ArrayBuffer;
    sampleRate: number;
    channels: number;
  });
}

export async function loadAudioBuffer(
  id: string,
  audioCtx: AudioContext
): Promise<AudioBuffer | undefined> {
  const db = await getDB();
  const raw = (await db.get("audioBuffers", id)) as unknown as
    | { id: string; sampleRate: number; channels: number; length: number; channelData: number[][] }
    | undefined;
  if (!raw) return undefined;
  const out = audioCtx.createBuffer(
    raw.channels,
    raw.length,
    raw.sampleRate
  );
  for (let ch = 0; ch < raw.channels; ch++) {
    const dst = out.getChannelData(ch);
    const src = raw.channelData[ch] ?? [];
    for (let i = 0; i < raw.length; i++) {
      dst[i] = src[i] ?? 0;
    }
  }
  return out;
}

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait = AUTO_SAVE_INTERVAL
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
