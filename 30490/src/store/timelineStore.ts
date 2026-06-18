import { create } from 'zustand';
import type { TimelineProject, TimelineClip, CompareTrack } from '@/types';
import {
  createTimelineProject,
  getTimelineProject,
  updateTimelineProject,
  deleteTimelineProject,
  listTimelineProjects,
  createTimelineClip,
  getTimelineClips,
  updateTimelineClip,
  deleteTimelineClip,
  batchCreateTimelineClips,
  duplicateTimelineProject,
} from '@/db/operations/timelineOperations';
import { withOperationLog } from '@/db/operations/logOperations';
import { getAudioRecording } from '@/db/operations/audioOperations';

interface TimelineState {
  projects: TimelineProject[];
  currentProject: TimelineProject | null;
  clips: TimelineClip[];
  compareTracks: CompareTrack[];
  currentTime: number;
  isPlaying: boolean;
  zoomLevel: number;
  loopStart: number | null;
  loopEnd: number | null;
  loading: boolean;
  error: string | null;
  actions: {
    loadProjects: () => Promise<void>;
    loadProject: (id: string) => Promise<void>;
    createProject: (name: string, description?: string) => Promise<TimelineProject | null>;
    updateProject: (id: string, updates: Partial<TimelineProject>) => Promise<TimelineProject | undefined>;
    deleteProject: (id: string) => Promise<void>;
    duplicateProject: (id: string, newName: string) => Promise<TimelineProject | undefined>;
    addClip: (projectId: string, audioId: string, startTime: number) => Promise<TimelineClip | null>;
    updateClip: (id: string, updates: Partial<TimelineClip>) => Promise<TimelineClip | undefined>;
    deleteClip: (id: string) => Promise<void>;
    batchAddClips: (
      projectId: string,
      clips: { audioId: string; startTime: number; trackIndex: number }[],
    ) => Promise<TimelineClip[]>;
    splitClip: (clipId: string, time: number) => Promise<void>;
    addCompareTrack: (audioId: string) => Promise<void>;
    removeCompareTrack: (audioId: string) => void;
    updateCompareTrack: (audioId: string, updates: Partial<CompareTrack>) => void;
    clearCompareTracks: () => void;
    setCurrentTime: (time: number) => void;
    setIsPlaying: (playing: boolean) => void;
    setZoomLevel: (level: number) => void;
    setLoop: (start: number | null, end: number | null) => void;
    setError: (error: string | null) => void;
  };
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  projects: [],
  currentProject: null,
  clips: [],
  compareTracks: [],
  currentTime: 0,
  isPlaying: false,
  zoomLevel: 1,
  loopStart: null,
  loopEnd: null,
  loading: false,
  error: null,

  actions: {
    loadProjects: async () => {
      set({ loading: true });
      try {
        const projects = await listTimelineProjects();
        set({ projects, loading: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load projects';
        set({ error: message, loading: false });
      }
    },

    loadProject: async (id: string) => {
      set({ loading: true });
      try {
        const [project, clips] = await Promise.all([getTimelineProject(id), getTimelineClips(id)]);
        set({
          currentProject: project || null,
          clips,
          currentTime: 0,
          loading: false,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load project';
        set({ error: message, loading: false });
      }
    },

    createProject: async (name, description = '') => {
      try {
        return await withOperationLog(
          'create_project',
          'project',
          null,
          async () => {
            const project = await createTimelineProject({
              name,
              description,
              totalDuration: 0,
            });
            void get().actions.loadProjects();
            return project;
          },
          { name },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create project';
        set({ error: message });
        return null;
      }
    },

    updateProject: async (id, updates) => {
      try {
        const updated = await updateTimelineProject(id, updates);
        if (updated) {
          void get().actions.loadProjects();
          if (get().currentProject?.id === id) {
            set({ currentProject: updated });
          }
        }
        return updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update project';
        set({ error: message });
        return undefined;
      }
    },

    deleteProject: async (id) => {
      try {
        await withOperationLog(
          'delete_project',
          'project',
          id,
          async () => {
            await deleteTimelineProject(id);
            void get().actions.loadProjects();
            if (get().currentProject?.id === id) {
              set({ currentProject: null, clips: [] });
            }
          },
          { id },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete project';
        set({ error: message });
      }
    },

    duplicateProject: async (id, newName) => {
      try {
        const duplicated = await duplicateTimelineProject(id, newName);
        if (duplicated) {
          void get().actions.loadProjects();
        }
        return duplicated;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to duplicate project';
        set({ error: message });
        return undefined;
      }
    },

    addClip: async (projectId, audioId, startTime) => {
      try {
        const audio = await getAudioRecording(audioId);
        if (!audio) return null;

        return await withOperationLog(
          'update_clip',
          'clip',
          null,
          async () => {
            const maxTrackIndex = get().clips.reduce(
              (max, c) => (c.trackIndex > max ? c.trackIndex : max),
              0,
            );

            const clip = await createTimelineClip({
              projectId,
              audioId,
              trackIndex: maxTrackIndex,
              startTime,
              endTime: startTime + audio.duration,
              fadeIn: 0,
              fadeOut: 0,
              volume: 1,
              loop: false,
              zIndex: get().clips.length,
            });

            const clips = await getTimelineClips(projectId);
            set({ clips });
            return clip;
          },
          { projectId, audioId, startTime },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add clip';
        set({ error: message });
        return null;
      }
    },

    updateClip: async (id, updates) => {
      try {
        const updated = await updateTimelineClip(id, updates);
        if (updated) {
          set((state) => ({
            clips: state.clips.map((c) => (c.id === id ? updated : c)),
          }));
        }
        return updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update clip';
        set({ error: message });
        return undefined;
      }
    },

    deleteClip: async (id) => {
      try {
        await deleteTimelineClip(id);
        set((state) => ({
          clips: state.clips.filter((c) => c.id !== id),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete clip';
        set({ error: message });
      }
    },

    batchAddClips: async (projectId, clipInputs) => {
      try {
        const inputs = await Promise.all(
          clipInputs.map(async (input, index) => {
            const audio = await getAudioRecording(input.audioId);
            return {
              projectId,
              audioId: input.audioId,
              trackIndex: input.trackIndex,
              startTime: input.startTime,
              endTime: input.startTime + (audio?.duration || 0),
              fadeIn: 0,
              fadeOut: 0,
              volume: 1,
              loop: false,
              zIndex: index,
            };
          }),
        );

        const clips = await batchCreateTimelineClips(inputs);
        const allClips = await getTimelineClips(projectId);
        set({ clips: allClips });
        return clips;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add clips';
        set({ error: message });
        return [];
      }
    },

    splitClip: async (clipId, time) => {
      const clip = get().clips.find((c) => c.id === clipId);
      if (!clip) return;

      try {
        const audio = await getAudioRecording(clip.audioId);
        if (!audio) return;

        const firstClipEnd = time;
        const secondClipStart = time;
        const originalDuration = clip.endTime - clip.startTime;
        const clipAudioStart = (audio.duration / originalDuration) * (firstClipEnd - clip.startTime);

        await deleteTimelineClip(clipId);

        await createTimelineClip({
          ...clip,
          endTime: firstClipEnd,
          id: undefined as unknown as string,
        });

        await createTimelineClip({
          ...clip,
          startTime: secondClipStart,
          zIndex: clip.zIndex + 1,
          id: undefined as unknown as string,
        });

        void clipAudioStart;

        const clips = await getTimelineClips(clip.projectId);
        set({ clips });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to split clip';
        set({ error: message });
      }
    },

    addCompareTrack: async (audioId) => {
      const audio = await getAudioRecording(audioId);
      if (!audio) return;

      if (get().compareTracks.length >= 4) {
        set({ error: 'Maximum 4 tracks allowed' });
        return;
      }

      if (get().compareTracks.some((t) => t.audioId === audioId)) {
        return;
      }

      set((state) => ({
        compareTracks: [
          ...state.compareTracks,
          {
            audioId,
            audio,
            volume: 1,
            muted: false,
            solo: false,
          },
        ],
      }));
    },

    removeCompareTrack: (audioId) => {
      set((state) => ({
        compareTracks: state.compareTracks.filter((t) => t.audioId !== audioId),
      }));
    },

    updateCompareTrack: (audioId, updates) => {
      set((state) => ({
        compareTracks: state.compareTracks.map((t) =>
          t.audioId === audioId ? { ...t, ...updates } : t,
        ),
      }));
    },

    clearCompareTracks: () => {
      set({ compareTracks: [], currentTime: 0, isPlaying: false });
    },

    setCurrentTime: (time) => {
      set({ currentTime: time });
    },

    setIsPlaying: (playing) => {
      set({ isPlaying: playing });
    },

    setZoomLevel: (level) => {
      set({ zoomLevel: Math.max(0.25, Math.min(4, level)) });
    },

    setLoop: (start, end) => {
      set({ loopStart: start, loopEnd: end });
    },

    setError: (error) => {
      set({ error });
    },
  },
}));
