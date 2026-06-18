import type { AudioRecording } from '@/types';
import { formatDuration } from '@/storage/fileOperations';

export const generateM3UContent = (
  recordings: AudioRecording[],
  includeMetadata: boolean = true,
): string => {
  const lines: string[] = ['#EXTM3U'];

  if (includeMetadata) {
    lines.push(`#EXTENC:UTF-8`);
    lines.push(`#PLAYLIST:SoundScape Archive Export`);
    lines.push(`#EXPORT-DATE:${new Date().toISOString()}`);
    lines.push('');
  }

  recordings.forEach((recording, index) => {
    if (includeMetadata) {
      lines.push(`# Recording ${index + 1}`);
      lines.push(`# ID: ${recording.id}`);
      if (recording.locationName) {
        lines.push(`# LOCATION: ${recording.locationName}`);
      }
      if (recording.administrativeDistrict) {
        lines.push(`# DISTRICT: ${recording.administrativeDistrict}`);
      }
      if (recording.timePeriod) {
        lines.push(`# TIME_PERIOD: ${recording.timePeriod}`);
      }
      if (recording.sceneCategory) {
        lines.push(`# SCENE: ${recording.sceneCategory}`);
      }
      if (recording.weatherCondition) {
        lines.push(`# WEATHER: ${recording.weatherCondition}`);
      }
      if (recording.recordingDevice) {
        lines.push(`# DEVICE: ${recording.recordingDevice}`);
      }
      if (recording.lineName) {
        lines.push(`# LINE: ${recording.lineName}`);
      }
      if (recording.recordedAt) {
        lines.push(`# RECORDED_AT: ${recording.recordedAt}`);
      }
      if (recording.tags.length > 0) {
        lines.push(`# TAGS: ${recording.tags.join(', ')}`);
      }
      if (recording.latitude !== null && recording.longitude !== null) {
        lines.push(`# COORDS: ${recording.latitude}, ${recording.longitude}`);
      }
      if (recording.description) {
        lines.push(`# DESCRIPTION: ${recording.description.replace(/\n/g, ' ')}`);
      }
    }

    const extinfTitle = recording.title || `Recording ${index + 1}`;
    lines.push(`#EXTINF:${Math.round(recording.duration)},${extinfTitle}`);
    lines.push(recording.title || `recording_${recording.id}.${recording.fileFormat}`);
    lines.push('');
  });

  lines.push('#EXTM3U');

  return lines.join('\n');
};

export const downloadM3U = (
  recordings: AudioRecording[],
  filename: string = 'soundscape-playlist.m3u8',
  includeMetadata: boolean = true,
): void => {
  const content = generateM3UContent(recordings, includeMetadata);
  const blob = new Blob([content], { type: 'application/vnd.apple.mpegurl' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const parseM3U = (content: string): { title: string; duration: number; filename: string; metadata: Record<string, string> }[] => {
  const lines = content.split('\n');
  const entries: { title: string; duration: number; filename: string; metadata: Record<string, string> }[] = [];

  let currentMetadata: Record<string, string> = {};
  let currentExtinf: { duration: number; title: string } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#EXTM3U') || trimmed === '') {
      continue;
    }

    if (trimmed.startsWith('#EXTINF:')) {
      const match = trimmed.match(/#EXTINF:(-?\d+(?:\.\d+)?),(.+)/);
      if (match) {
        currentExtinf = {
          duration: parseFloat(match[1]),
          title: match[2],
        };
      }
      continue;
    }

    if (trimmed.startsWith('# ')) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(2, colonIndex).trim().toUpperCase().replace(/\s+/g, '_');
        const value = trimmed.slice(colonIndex + 1).trim();
        if (key && value) {
          currentMetadata[key] = value;
        }
      }
      continue;
    }

    if (!trimmed.startsWith('#') && currentExtinf) {
      entries.push({
        title: currentExtinf.title,
        duration: currentExtinf.duration,
        filename: trimmed,
        metadata: { ...currentMetadata },
      });
      currentMetadata = {};
      currentExtinf = null;
    }
  }

  return entries;
};
