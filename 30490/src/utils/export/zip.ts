import JSZip from 'jszip';
import type { AudioRecording } from '@/types';
import { getAudioFile, getCoverImageURL } from '@/storage/fileOperations';
import { generateM3UContent } from './m3u';

export interface ZipExportOptions {
  includeMetadata: boolean;
  includeCover: boolean;
  includeAudio: boolean;
  onProgress?: (progress: number) => void;
}

export const exportToZip = async (
  recordings: AudioRecording[],
  options: ZipExportOptions,
): Promise<Blob> => {
  const { includeMetadata, includeCover, includeAudio, onProgress } = options;

  const zip = new JSZip();
  const audioFolder = zip.folder('audio');
  const coverFolder = zip.folder('covers');
  const metaFolder = zip.folder('metadata');

  const totalSteps = recordings.length * (includeAudio ? 2 : 1) + (includeMetadata ? 2 : 0) + (includeCover ? 1 : 0);
  let currentStep = 0;

  const updateProgress = () => {
    currentStep++;
    const progress = Math.min(1, currentStep / totalSteps);
    onProgress?.(progress);
  };

  for (const recording of recordings) {
    if (includeAudio) {
      try {
        const audioFile = await getAudioFile(recording.opfsPath);
        const filename = `${recording.title || recording.id}.${recording.fileFormat}`;
        const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
        audioFolder?.file(safeFilename, audioFile);
      } catch (error) {
        console.error(`Failed to add audio ${recording.id}:`, error);
      }
      updateProgress();
    }

    if (includeCover && recording.coverImagePath) {
      try {
        const coverDataURL = await getCoverImageURL(recording.coverImagePath);
        if (coverDataURL) {
          const base64Data = coverDataURL.split(',')[1];
          if (base64Data) {
            coverFolder?.file(`${recording.id}.jpg`, base64Data, { base64: true });
          }
        }
      } catch (error) {
        console.error(`Failed to add cover ${recording.id}:`, error);
      }
      updateProgress();
    }

    if (includeMetadata) {
      const metadata = {
        id: recording.id,
        title: recording.title,
        description: recording.description,
        locationName: recording.locationName,
        latitude: recording.latitude,
        longitude: recording.longitude,
        administrativeDistrict: recording.administrativeDistrict,
        timePeriod: recording.timePeriod,
        sceneCategory: recording.sceneCategory,
        weatherCondition: recording.weatherCondition,
        recordingDevice: recording.recordingDevice,
        lineName: recording.lineName,
        recordedAt: recording.recordedAt,
        duration: recording.duration,
        sampleRate: recording.sampleRate,
        bitDepth: recording.bitDepth,
        fileFormat: recording.fileFormat,
        fileSize: recording.fileSize,
        tags: recording.tags,
        createdAt: recording.createdAt,
        updatedAt: recording.updatedAt,
      };
      metaFolder?.file(`${recording.id}.json`, JSON.stringify(metadata, null, 2));
    }
    updateProgress();
  }

  if (includeMetadata) {
    const indexData = {
      exportedAt: new Date().toISOString(),
      count: recordings.length,
      recordings: recordings.map((r) => ({
        id: r.id,
        title: r.title,
        duration: r.duration,
        fileFormat: r.fileFormat,
      })),
    };
    zip.file('index.json', JSON.stringify(indexData, null, 2));
    updateProgress();

    const m3uContent = generateM3UContent(recordings, true);
    zip.file('playlist.m3u8', m3uContent);
    updateProgress();
  }

  const manifest = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    application: 'SoundScape Archive',
    appVersion: __APP_VERSION__,
    options: {
      includeMetadata,
      includeCover,
      includeAudio,
    },
    statistics: {
      totalRecordings: recordings.length,
      totalDuration: recordings.reduce((sum, r) => sum + r.duration, 0),
      totalFileSize: recordings.reduce((sum, r) => sum + r.fileSize, 0),
    },
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 5 },
  }, (metadata) => {
    onProgress?.(metadata.percent / 100);
  });
};

export const downloadZip = async (
  recordings: AudioRecording[],
  filename: string = 'soundscape-archive.zip',
  options: ZipExportOptions,
): Promise<void> => {
  const blob = await exportToZip(recordings, options);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
