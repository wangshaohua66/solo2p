import { create } from "zustand";
import type {
  AudioTrack,
  Marker,
  Comment,
  Project,
  TranscriptSegment,
} from "@/types/audio";
import {
  TRACK_COLORS,
  MAX_TRACKS,
  MAX_FILE_SIZE,
  ACCEPTED_AUDIO_MIME,
  ACCEPTED_AUDIO_EXT,
} from "@/types/audio";
import { uuid, generateSyntheticWaveform } from "@/utils/audioProcessor";
import { saveProject } from "@/utils/idbStorage";

interface ClipboardSelection {
  start: number;
  end: number;
  trackId?: string;
  timestamp: number;
  waveformData?: number[];
  regionDuration: number;
}

interface ProjectStore {
  project: Project;
  isPlaying: boolean;
  currentTime: number;
  zoom: number;
  scrollX: number;
  activeTrackId: string | null;
  soloTrackIds: Set<string>;
  clipboard: ClipboardSelection | null;
  loading: boolean;
  error: string | null;

  setProject: (p: Project) => void;
  setProjectName: (name: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (t: number) => void;
  setZoom: (z: number) => void;
  setScrollX: (x: number) => void;
  setActiveTrackId: (id: string | null) => void;
  setClipboard: (c: ClipboardSelection | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;

  addTrack: (partial?: Partial<AudioTrack>) => AudioTrack | null;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<AudioTrack>) => void;
  reorderTracks: (orderedIds: string[]) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  clearSolo: () => void;

  addMarker: (time: number, title: string, description?: string) => Marker;
  removeMarker: (id: string) => void;
  updateMarker: (id: string, patch: Partial<Marker>) => void;

  addComment: (
    time: number,
    author: string,
    content: string
  ) => Comment;
  removeComment: (id: string) => void;
  updateComment: (id: string, patch: Partial<Comment>) => void;

  addTranscript: (segments: TranscriptSegment[]) => void;
  persist: () => Promise<void>;
}

function createEmptyProject(): Project {
  const id = uuid();
  const now = Date.now();
  return {
    id,
    name: "未命名播客项目",
    duration: 2700,
    sampleRate: 44100,
    tracks: [],
    markers: [],
    comments: [],
    transcripts: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: createEmptyProject(),
  isPlaying: false,
  currentTime: 0,
  zoom: 1,
  scrollX: 0,
  activeTrackId: null,
  soloTrackIds: new Set(),
  clipboard: null,
  loading: false,
  error: null,

  setProject: (p) => set({ project: p, currentTime: 0, activeTrackId: null }),
  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, name, updatedAt: Date.now() } })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (t) =>
    set((s) => ({
      currentTime: Math.max(0, Math.min(s.project.duration, t)),
    })),
  setZoom: (z) => set({ zoom: Math.max(0.2, Math.min(20, z)) }),
  setScrollX: (x) => set({ scrollX: Math.max(0, x) }),
  setActiveTrackId: (id) => set({ activeTrackId: id }),
  setClipboard: (c) => set({ clipboard: c }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),

  addTrack: (partial) => {
    const state = get();
    if (state.project.tracks.length >= MAX_TRACKS) {
      set({ error: `最多支持 ${MAX_TRACKS} 条音轨` });
      return null;
    }
    const idx = state.project.tracks.length;
    const color = partial?.color ?? TRACK_COLORS[idx % TRACK_COLORS.length];
    const name = partial?.name ?? `音轨 ${idx + 1}`;
    const id = partial?.id ?? uuid();
    const duration = partial?.duration ?? state.project.duration;
    const track: AudioTrack = {
      id,
      projectId: state.project.id,
      name,
      color,
      volume: partial?.volume ?? 0.8,
      muted: partial?.muted ?? false,
      solo: partial?.solo ?? false,
      order: idx,
      duration,
      src: partial?.src,
      waveformData:
        partial?.waveformData ?? generateSyntheticWaveform(800, idx * 17 + 3),
      segments:
        partial?.segments ??
        (partial?.src
          ? [{ id: uuid(), start: 0, duration, offset: 0 }]
          : []),
      audioBufferRef: partial?.audioBufferRef,
    };
    const tracks = [...state.project.tracks, track];
    const maxDur = Math.max(state.project.duration, duration);
    set({
      project: {
        ...state.project,
        tracks,
        duration: maxDur,
        updatedAt: Date.now(),
      },
      activeTrackId: id,
    });
    return track;
  },

  removeTrack: (id) =>
    set((s) => {
      const tracks = s.project.tracks.filter((t) => t.id !== id);
      const maxDur =
        tracks.length === 0 ? 2700 : Math.max(...tracks.map((t) => t.duration));
      const newActive =
        s.activeTrackId === id
          ? tracks.length > 0
            ? tracks[tracks.length - 1].id
            : null
          : s.activeTrackId;
      return {
        project: {
          ...s.project,
          tracks: tracks.map((t, i) => ({ ...t, order: i })),
          duration: maxDur,
          updatedAt: Date.now(),
        },
        activeTrackId: newActive,
      };
    }),

  updateTrack: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === id ? { ...t, ...patch } : t
        ),
        updatedAt: Date.now(),
      },
    })),

  reorderTracks: (orderedIds) =>
    set((s) => {
      const map = new Map(s.project.tracks.map((t) => [t.id, t]));
      const tracks = orderedIds
        .filter((id) => map.has(id))
        .map((id, i) => ({ ...(map.get(id) as AudioTrack), order: i }));
      return {
        project: { ...s.project, tracks, updatedAt: Date.now() },
      };
    }),

  toggleMute: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === id ? { ...t, muted: !t.muted } : t
        ),
        updatedAt: Date.now(),
      },
    })),

  toggleSolo: (id) =>
    set((s) => {
      const next = new Set(s.soloTrackIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { soloTrackIds: next };
    }),

  clearSolo: () => set({ soloTrackIds: new Set() }),

  addMarker: (time, title, description) => {
    const state = get();
    const marker: Marker = {
      id: uuid(),
      projectId: state.project.id,
      time,
      title,
      description,
      color: "#e94560",
    };
    const markers = [...state.project.markers, marker].sort(
      (a, b) => a.time - b.time
    );
    set({
      project: { ...state.project, markers, updatedAt: Date.now() },
    });
    return marker;
  },

  removeMarker: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        markers: s.project.markers.filter((m) => m.id !== id),
        updatedAt: Date.now(),
      },
    })),

  updateMarker: (id, patch) =>
    set((s) => {
      const markers = s.project.markers
        .map((m) => (m.id === id ? { ...m, ...patch } : m))
        .sort((a, b) => a.time - b.time);
      return {
        project: { ...s.project, markers, updatedAt: Date.now() },
      };
    }),

  addComment: (time, author, content) => {
    const state = get();
    const comment: Comment = {
      id: uuid(),
      projectId: state.project.id,
      time,
      author,
      content,
      status: "pending",
      createdAt: Date.now(),
    };
    set({
      project: {
        ...state.project,
        comments: [...state.project.comments, comment],
        updatedAt: Date.now(),
      },
    });
    return comment;
  },

  removeComment: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        comments: s.project.comments.filter((c) => c.id !== id),
        updatedAt: Date.now(),
      },
    })),

  updateComment: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        comments: s.project.comments.map((c) =>
          c.id === id ? { ...c, ...patch } : c
        ),
        updatedAt: Date.now(),
      },
    })),

  addTranscript: (segments) =>
    set((s) => ({
      project: {
        ...s.project,
        transcripts: [...s.project.transcripts, ...segments],
        updatedAt: Date.now(),
      },
    })),

  persist: async () => {
    const state = get();
    try {
      await saveProject(state.project);
    } catch (err) {
      set({ error: "自动保存失败: " + String(err) });
    }
  },
}));

export function validateAudioFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，最大支持 ${
      MAX_FILE_SIZE / 1024 / 1024
    }MB`;
  }
  if (
    !ACCEPTED_AUDIO_MIME.includes(file.type) &&
    !ACCEPTED_AUDIO_EXT.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )
  ) {
    return "不支持的文件格式，仅支持 MP3/WAV/OGG/WEBM/M4A";
  }
  return null;
}
