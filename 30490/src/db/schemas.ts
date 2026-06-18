import type { AudioRecording, TimelineProject, TimelineClip, OperationLog } from '@/types';

export const audioRecordingSchema = {
  id: '&id',
  title: '',
  description: '',
  locationName: '',
  latitude: null as number | null,
  longitude: null as number | null,
  administrativeDistrict: '',
  timePeriod: null as string | null,
  sceneCategory: null as string | null,
  weatherCondition: null as string | null,
  recordingDevice: '',
  lineName: '',
  recordedAt: null as string | null,
  duration: 0,
  sampleRate: 0,
  bitDepth: 0,
  fileFormat: '',
  fileSize: 0,
  opfsPath: '',
  coverImagePath: null as string | null,
  waveformDataPath: '',
  tags: [] as string[],
  createdAt: '',
  updatedAt: '',
};

export const timelineProjectSchema = {
  id: '&id',
  name: '',
  description: '',
  totalDuration: 0,
  createdAt: '',
  updatedAt: '',
};

export const timelineClipSchema = {
  id: '&id',
  projectId: '',
  audioId: '',
  trackIndex: 0,
  startTime: 0,
  endTime: 0,
  fadeIn: 0,
  fadeOut: 0,
  volume: 1,
  loop: false,
  zIndex: 0,
};

export const operationLogSchema = {
  id: '&id',
  actionType: '',
  entityType: '',
  entityId: null as string | null,
  details: {} as Record<string, unknown>,
  timestamp: '',
};

export type AudioRecordingInput = Omit<AudioRecording, 'id' | 'createdAt' | 'updatedAt'>;
export type TimelineProjectInput = Omit<TimelineProject, 'id' | 'createdAt' | 'updatedAt'>;
export type TimelineClipInput = Omit<TimelineClip, 'id'>;
