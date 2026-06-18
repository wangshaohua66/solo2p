export type TimePeriod =
  | 'early_morning'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'late_night';

export type SceneCategory =
  | 'market'
  | 'subway'
  | 'street'
  | 'park'
  | 'construction'
  | 'traffic'
  | 'indoor'
  | 'nature'
  | 'festival'
  | 'other';

export type WeatherCondition =
  | 'sunny'
  | 'cloudy'
  | 'rainy'
  | 'windy'
  | 'foggy'
  | 'snowy'
  | 'thunderstorm';

export type ActionType =
  | 'upload'
  | 'update_metadata'
  | 'batch_update'
  | 'delete'
  | 'export_m3u'
  | 'export_zip'
  | 'create_project'
  | 'update_clip'
  | 'delete_project'
  | 'theme_change'
  | 'language_change'
  | 'error';

export type EntityType = 'audio' | 'project' | 'clip' | 'setting' | 'system';

export type Theme = 'dark' | 'light';

export type Language = 'zh-CN' | 'en-US';

export interface AudioRecording {
  id: string;
  title: string;
  description: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  administrativeDistrict: string;
  timePeriod: TimePeriod | null;
  sceneCategory: SceneCategory | null;
  weatherCondition: WeatherCondition | null;
  recordingDevice: string;
  lineName: string;
  recordedAt: string | null;
  duration: number;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
  fileSize: number;
  opfsPath: string;
  coverImagePath: string | null;
  waveformDataPath: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TimelineProject {
  id: string;
  name: string;
  description: string;
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineClip {
  id: string;
  projectId: string;
  audioId: string;
  trackIndex: number;
  startTime: number;
  endTime: number;
  fadeIn: number;
  fadeOut: number;
  volume: number;
  loop: boolean;
  zIndex: number;
}

export interface OperationLog {
  id: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId: string | null;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface WaveformData {
  peaks: number[];
  duration: number;
  samplesPerPeak: number;
}

export interface AudioUploadState {
  file: File;
  progress: number;
  status: 'pending' | 'parsing' | 'storing' | 'completed' | 'error';
  error?: string;
}

export interface FilterOptions {
  search: string;
  timePeriod: TimePeriod[];
  sceneCategory: SceneCategory[];
  weatherCondition: WeatherCondition[];
  administrativeDistrict: string[];
  recordingDevice: string[];
  lineName: string[];
  dateRange: [string, string] | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export type SortField = 'createdAt' | 'recordedAt' | 'duration' | 'title' | 'fileSize';
export type SortOrder = 'asc' | 'desc';

export interface MapMarker {
  id: string;
  audioId: string;
  latitude: number;
  longitude: number;
  title: string;
  timePeriod: TimePeriod | null;
  sceneCategory: SceneCategory | null;
}

export interface DistrictAggregation {
  name: string;
  count: number;
  center: { lat: number; lng: number };
  audioIds: string[];
}

export interface LineRoute {
  name: string;
  markers: MapMarker[];
  color: string;
}

export interface CompareTrack {
  audioId: string;
  audio: AudioRecording;
  volume: number;
  muted: boolean;
  solo: boolean;
}

export interface ExportOptions {
  format: 'm3u' | 'zip';
  includeMetadata: boolean;
  includeCover: boolean;
  quality: 'original' | 'compressed';
}
