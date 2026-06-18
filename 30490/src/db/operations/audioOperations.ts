import { db } from '../dexie';
import type { AudioRecording, FilterOptions, SortField, SortOrder } from '@/types';
import type { AudioRecordingInput } from '../schemas';
import { v4 as uuidv4 } from 'uuid';

export const createAudioRecording = async (
  input: AudioRecordingInput,
): Promise<AudioRecording> => {
  const now = new Date().toISOString();
  const recording: AudioRecording = {
    ...input,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  await db.audioRecordings.add(recording);
  return recording;
};

export const getAudioRecording = async (id: string): Promise<AudioRecording | undefined> => {
  return db.audioRecordings.get(id);
};

export const updateAudioRecording = async (
  id: string,
  updates: Partial<AudioRecording>,
): Promise<AudioRecording | undefined> => {
  const recording = await db.audioRecordings.get(id);
  if (!recording) return undefined;

  const updated: AudioRecording = {
    ...recording,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  await db.audioRecordings.update(id, updated);
  return updated;
};

export const batchUpdateAudioRecordings = async (
  ids: string[],
  updates: Partial<AudioRecording>,
): Promise<number> => {
  const now = new Date().toISOString();
  const finalUpdates = { ...updates, updatedAt: now };

  const result = await db.transaction('rw', db.audioRecordings, async () => {
    let count = 0;
    for (const id of ids) {
      const updated = await db.audioRecordings.update(id, finalUpdates);
      if (updated) count++;
    }
    return count;
  });

  return result;
};

export const deleteAudioRecording = async (id: string): Promise<void> => {
  await db.audioRecordings.delete(id);
};

export const batchDeleteAudioRecordings = async (ids: string[]): Promise<void> => {
  await db.audioRecordings.bulkDelete(ids);
};

export const listAudioRecordings = async (
  filters?: Partial<FilterOptions>,
  sortField: SortField = 'createdAt',
  sortOrder: SortOrder = 'desc',
  limit?: number,
  offset?: number,
): Promise<AudioRecording[]> => {
  let query = db.audioRecordings.toCollection();

  if (filters) {
    if (filters.timePeriod && filters.timePeriod.length > 0) {
      query = query.filter((r) => filters.timePeriod!.includes(r.timePeriod!));
    }
    if (filters.sceneCategory && filters.sceneCategory.length > 0) {
      query = query.filter((r) => filters.sceneCategory!.includes(r.sceneCategory!));
    }
    if (filters.weatherCondition && filters.weatherCondition.length > 0) {
      query = query.filter((r) => filters.weatherCondition!.includes(r.weatherCondition!));
    }
    if (filters.administrativeDistrict && filters.administrativeDistrict.length > 0) {
      query = query.filter((r) =>
        filters.administrativeDistrict!.includes(r.administrativeDistrict),
      );
    }
    if (filters.recordingDevice && filters.recordingDevice.length > 0) {
      query = query.filter((r) => filters.recordingDevice!.includes(r.recordingDevice));
    }
    if (filters.lineName && filters.lineName.length > 0) {
      query = query.filter((r) => filters.lineName!.includes(r.lineName));
    }
    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      query = query.filter(
        (r) =>
          r.title.toLowerCase().includes(searchLower) ||
          r.description.toLowerCase().includes(searchLower) ||
          r.tags.some((t) => t.toLowerCase().includes(searchLower)) ||
          r.locationName.toLowerCase().includes(searchLower),
      );
    }
  }

  if (sortField === 'createdAt') {
    query = sortOrder === 'desc' ? query.sortBy('createdAt').reverse() : query.sortBy('createdAt');
  } else if (sortField === 'duration') {
    query = sortOrder === 'desc' ? query.sortBy('duration').reverse() : query.sortBy('duration');
  } else if (sortField === 'title') {
    query = sortOrder === 'desc' ? query.sortBy('title').reverse() : query.sortBy('title');
  } else if (sortField === 'fileSize') {
    query = sortOrder === 'desc' ? query.sortBy('fileSize').reverse() : query.sortBy('fileSize');
  }

  let results = await query.toArray();

  if (sortField === 'recordedAt') {
    results = results.sort((a, b) => {
      const dateA = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
      const dateB = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }

  if (offset) results = results.slice(offset);
  if (limit) results = results.slice(0, limit);

  return results;
};

export const getDistricts = async (): Promise<string[]> => {
  const recordings = await db.audioRecordings.toArray();
  const districts = new Set(recordings.map((r) => r.administrativeDistrict).filter(Boolean));
  return Array.from(districts).sort();
};

export const getDevices = async (): Promise<string[]> => {
  const recordings = await db.audioRecordings.toArray();
  const devices = new Set(recordings.map((r) => r.recordingDevice).filter(Boolean));
  return Array.from(devices).sort();
};

export const getLines = async (): Promise<string[]> => {
  const recordings = await db.audioRecordings.toArray();
  const lines = new Set(recordings.map((r) => r.lineName).filter(Boolean));
  return Array.from(lines).sort();
};

export const getRecordingsByLine = async (lineName: string): Promise<AudioRecording[]> => {
  return db.audioRecordings.where('lineName').equals(lineName).sortBy('recordedAt');
};

export const getRecordingsByDistrict = async (district: string): Promise<AudioRecording[]> => {
  return db.audioRecordings
    .where('administrativeDistrict')
    .equals(district)
    .sortBy('createdAt');
};

export const countAudioRecordings = async (): Promise<number> => {
  return db.audioRecordings.count();
};

export const getTotalFileSize = async (): Promise<number> => {
  const recordings = await db.audioRecordings.toArray();
  return recordings.reduce((sum, r) => sum + r.fileSize, 0);
};
