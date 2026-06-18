import { create } from 'zustand';
import type {
  AudioRecording,
  FilterOptions,
  SortField,
  SortOrder,
  AudioUploadState,
} from '@/types';
import {
  createAudioRecording,
  getAudioRecording,
  updateAudioRecording,
  deleteAudioRecording,
  listAudioRecordings,
  batchUpdateAudioRecordings,
  batchDeleteAudioRecordings,
} from '@/db/operations/audioOperations';
import { withOperationLog, logOperation } from '@/db/operations/logOperations';
import { saveAudioFile, saveWaveformData, deleteAudioData } from '@/storage/fileOperations';
import { decodeAudioFile, generateWaveformData, getAudioInfo } from '@/utils/audio/waveform';

interface AudioState {
  recordings: AudioRecording[];
  currentRecording: AudioRecording | null;
  uploadQueue: AudioUploadState[];
  filters: Partial<FilterOptions>;
  sortField: SortField;
  sortOrder: SortOrder;
  selectedIds: string[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  actions: {
    loadRecordings: () => Promise<void>;
    loadRecording: (id: string) => Promise<void>;
    setCurrentRecording: (recording: AudioRecording | null) => void;
    uploadRecording: (file: File) => Promise<AudioRecording | null>;
    updateRecording: (
      id: string,
      updates: Partial<AudioRecording>,
    ) => Promise<AudioRecording | undefined>;
    deleteRecording: (id: string) => Promise<void>;
    batchUpdate: (ids: string[], updates: Partial<AudioRecording>) => Promise<number>;
    batchDelete: (ids: string[]) => Promise<void>;
    setFilters: (filters: Partial<FilterOptions>) => void;
    resetFilters: () => void;
    setSort: (field: SortField, order: SortOrder) => void;
    toggleSelect: (id: string) => void;
    selectAll: () => void;
    clearSelection: () => void;
    setError: (error: string | null) => void;
    clearUploadQueue: () => void;
  };
}

const initialFilters: Partial<FilterOptions> = {
  search: '',
  timePeriod: [],
  sceneCategory: [],
  weatherCondition: [],
  administrativeDistrict: [],
  recordingDevice: [],
  lineName: [],
  dateRange: null,
};

export const useAudioStore = create<AudioState>((set, get) => ({
  recordings: [],
  currentRecording: null,
  uploadQueue: [],
  filters: initialFilters,
  sortField: 'createdAt',
  sortOrder: 'desc',
  selectedIds: [],
  loading: false,
  error: null,
  totalCount: 0,

  actions: {
    loadRecordings: async () => {
      set({ loading: true, error: null });
      try {
        const { filters, sortField, sortOrder } = get();
        const recordings = await listAudioRecordings(filters, sortField, sortOrder);
        set({ recordings, totalCount: recordings.length, loading: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load recordings';
        set({ error: message, loading: false });
        logOperation('error', 'audio', null, { error: message, action: 'loadRecordings' });
      }
    },

    loadRecording: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const recording = await getAudioRecording(id);
        set({ currentRecording: recording || null, loading: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load recording';
        set({ error: message, loading: false });
        logOperation('error', 'audio', id, { error: message, action: 'loadRecording' });
      }
    },

    setCurrentRecording: (recording) => {
      set({ currentRecording: recording });
    },

    uploadRecording: async (file: File) => {
      const uploadState: AudioUploadState = {
        file,
        progress: 0,
        status: 'parsing',
      };
      set((state) => ({ uploadQueue: [...state.uploadQueue, uploadState] }));

      try {
        return await withOperationLog(
          'upload',
          'audio',
          null,
          async () => {
            set((state) => ({
              uploadQueue: state.uploadQueue.map((u) =>
                u.file === file ? { ...u, status: 'parsing', progress: 0 } : u,
              ),
            }));

            const audioBuffer = await decodeAudioFile(file);
            set((state) => ({
              uploadQueue: state.uploadQueue.map((u) =>
                u.file === file ? { ...u, status: 'parsing', progress: 30 } : u,
              ),
            }));

            const waveformData = await generateWaveformData(audioBuffer);
            const audioInfo = getAudioInfo(audioBuffer, file);

            set((state) => ({
              uploadQueue: state.uploadQueue.map((u) =>
                u.file === file ? { ...u, status: 'storing', progress: 50 } : u,
              ),
            }));

            const { id, path, format } = await saveAudioFile(file, (progress) => {
              set((state) => ({
                uploadQueue: state.uploadQueue.map((u) =>
                  u.file === file ? { ...u, progress: 50 + progress * 40 } : u,
                ),
              }));
            });

            const waveformPath = await saveWaveformData(id, waveformData);

            set((state) => ({
              uploadQueue: state.uploadQueue.map((u) =>
                u.file === file ? { ...u, status: 'storing', progress: 95 } : u,
              ),
            }));

            const recording = await createAudioRecording({
              title: file.name.replace(/\.[^/.]+$/, ''),
              description: '',
              locationName: '',
              latitude: null,
              longitude: null,
              administrativeDistrict: '',
              timePeriod: null,
              sceneCategory: null,
              weatherCondition: null,
              recordingDevice: '',
              lineName: '',
              recordedAt: null,
              duration: audioInfo.duration,
              sampleRate: audioInfo.sampleRate,
              bitDepth: audioInfo.bitDepth,
              fileFormat: format,
              fileSize: audioInfo.fileSize,
              opfsPath: path,
              coverImagePath: null,
              waveformDataPath: waveformPath,
              tags: [],
            });

            set((state) => ({
              uploadQueue: state.uploadQueue.map((u) =>
                u.file === file ? { ...u, status: 'completed', progress: 100 } : u,
              ),
            }));

            void get().actions.loadRecordings();

            return recording;
          },
          { fileName: file.name, fileSize: file.size },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        set((state) => ({
          uploadQueue: state.uploadQueue.map((u) =>
            u.file === file ? { ...u, status: 'error', error: message } : u,
          ),
        }));
        return null;
      }
    },

    updateRecording: async (id, updates) => {
      try {
        return await withOperationLog(
          'update_metadata',
          'audio',
          id,
          async () => {
            const updated = await updateAudioRecording(id, updates);
            if (updated) {
              void get().actions.loadRecordings();
              if (get().currentRecording?.id === id) {
                set({ currentRecording: updated });
              }
            }
            return updated;
          },
          { updates: Object.keys(updates) },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update';
        set({ error: message });
        return undefined;
      }
    },

    deleteRecording: async (id) => {
      try {
        await withOperationLog(
          'delete',
          'audio',
          id,
          async () => {
            const recording = await getAudioRecording(id);
            if (recording) {
              await deleteAudioData(id, recording.fileFormat);
              await deleteAudioRecording(id);
              void get().actions.loadRecordings();
              if (get().currentRecording?.id === id) {
                set({ currentRecording: null });
              }
            }
          },
          { id },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete';
        set({ error: message });
      }
    },

    batchUpdate: async (ids, updates) => {
      try {
        return await withOperationLog(
          'batch_update',
          'audio',
          null,
          async () => {
            const count = await batchUpdateAudioRecordings(ids, updates);
            void get().actions.loadRecordings();
            return count;
          },
          { ids, updates: Object.keys(updates) },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to batch update';
        set({ error: message });
        return 0;
      }
    },

    batchDelete: async (ids) => {
      try {
        await withOperationLog(
          'delete',
          'audio',
          null,
          async () => {
            for (const id of ids) {
              const recording = await getAudioRecording(id);
              if (recording) {
                await deleteAudioData(id, recording.fileFormat);
              }
            }
            await batchDeleteAudioRecordings(ids);
            void get().actions.loadRecordings();
            set({ selectedIds: [] });
          },
          { ids, count: ids.length },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to batch delete';
        set({ error: message });
      }
    },

    setFilters: (filters) => {
      set((state) => ({
        filters: { ...state.filters, ...filters },
      }));
      void get().actions.loadRecordings();
    },

    resetFilters: () => {
      set({ filters: initialFilters });
      void get().actions.loadRecordings();
    },

    setSort: (field, order) => {
      set({ sortField: field, sortOrder: order });
      void get().actions.loadRecordings();
    },

    toggleSelect: (id) => {
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((i) => i !== id)
          : [...state.selectedIds, id],
      }));
    },

    selectAll: () => {
      set((state) => ({
        selectedIds: state.recordings.map((r) => r.id),
      }));
    },

    clearSelection: () => {
      set({ selectedIds: [] });
    },

    setError: (error) => {
      set({ error });
    },

    clearUploadQueue: () => {
      set({ uploadQueue: [] });
    },
  },
}));
