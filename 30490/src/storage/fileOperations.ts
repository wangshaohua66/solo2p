import { writeFile, readFile, readFileAsDataURL, deleteFile, fileExists } from './opfs';
import { v4 as uuidv4 } from 'uuid';
import type { WaveformData } from '@/types';

export const getAudioPath = (id: string, format: string): string => {
  return `audio/${id}.${format.toLowerCase()}`;
};

export const getCoverPath = (id: string): string => {
  return `cover/${id}.jpg`;
};

export const getWaveformPath = (id: string): string => {
  return `waveform/${id}.json`;
};

export const saveAudioFile = async (
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ id: string; path: string; format: string }> => {
  const id = uuidv4();
  const format = file.name.split('.').pop() || 'wav';
  const path = getAudioPath(id, format);

  await writeFile(path, file, onProgress);

  return { id, path, format };
};

export const saveCoverImage = async (id: string, file: File): Promise<string> => {
  const path = getCoverPath(id);
  await writeFile(path, file);
  return path;
};

export const saveWaveformData = async (id: string, data: WaveformData): Promise<string> => {
  const path = getWaveformPath(id);
  const json = JSON.stringify(data);
  await writeFile(path, json);
  return path;
};

export const getAudioFile = async (path: string): Promise<File> => {
  return readFile(path);
};

export const getAudioAsArrayBuffer = async (path: string): Promise<ArrayBuffer> => {
  const file = await readFile(path);
  return file.arrayBuffer();
};

export const getCoverImageURL = async (path: string): Promise<string | null> => {
  try {
    const exists = await fileExists(path);
    if (!exists) return null;
    return readFileAsDataURL(path);
  } catch {
    return null;
  }
};

export const getWaveformData = async (path: string): Promise<WaveformData | null> => {
  try {
    const exists = await fileExists(path);
    if (!exists) return null;

    const file = await readFile(path);
    const text = await file.text();
    return JSON.parse(text) as WaveformData;
  } catch (error) {
    console.error('Failed to load waveform data:', error);
    return null;
  }
};

export const deleteAudioData = async (id: string, format: string): Promise<void> => {
  const audioPath = getAudioPath(id, format);
  const coverPath = getCoverPath(id);
  const waveformPath = getWaveformPath(id);

  await Promise.allSettled([deleteFile(audioPath), deleteFile(coverPath), deleteFile(waveformPath)]);
};

export const createObjectURLFromPath = async (path: string): Promise<string> => {
  const file = await readFile(path);
  return URL.createObjectURL(file);
};

export const revokeObjectURL = (url: string): void => {
  URL.revokeObjectURL(url);
};

export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

export const isValidAudioFile = (file: File): boolean => {
  const validExtensions = ['wav', 'mp3', 'flac', 'ogg', 'aac', 'm4a'];
  const ext = getFileExtension(file.name);
  return validExtensions.includes(ext) || file.type.startsWith('audio/');
};

export const isValidImageFile = (file: File): boolean => {
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const ext = getFileExtension(file.name);
  return validExtensions.includes(ext) || file.type.startsWith('image/');
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatDurationLong = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};
