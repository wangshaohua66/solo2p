export interface TrackSegment {
  id: string;
  start: number;
  duration: number;
  offset: number;
}

export interface AudioTrack {
  id: string;
  projectId: string;
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  order: number;
  src?: string;
  waveformData?: number[];
  audioBufferRef?: string;
  duration: number;
  segments: TrackSegment[];
}

export interface Marker {
  id: string;
  projectId: string;
  time: number;
  title: string;
  description?: string;
  color?: string;
}

export interface Comment {
  id: string;
  projectId: string;
  time: number;
  author: string;
  content: string;
  status: "pending" | "resolved";
  createdAt: number;
}

export interface TranscriptSegment {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface Selection {
  start: number;
  end: number;
  activeTrackId?: string;
}

export type HistoryType =
  | "add_track"
  | "remove_track"
  | "reorder_tracks"
  | "update_track"
  | "add_marker"
  | "remove_marker"
  | "update_marker"
  | "add_comment"
  | "update_comment"
  | "remove_comment"
  | "edit_selection"
  | "cut_selection"
  | "paste_selection"
  | "delete_selection";

export interface HistoryAction {
  type: HistoryType;
  timestamp: number;
  previous: unknown;
  next: unknown;
}

export interface Project {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  tracks: AudioTrack[];
  markers: Marker[];
  comments: Comment[];
  transcripts: TranscriptSegment[];
  createdAt: number;
  updatedAt: number;
}

export interface ExportedProject {
  version: string;
  project: Omit<Project, "tracks"> & {
    tracks: Array<Omit<AudioTrack, "audioBufferRef">>;
  };
}

export const TRACK_COLORS = [
  "#4facfe",
  "#06d6a0",
  "#ffd166",
  "#e94560",
  "#a855f7",
  "#f97316",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#eab308",
];

export const MAX_TRACKS = 16;
export const MAX_FILE_SIZE = 200 * 1024 * 1024;
export const UNDO_STACK_LIMIT = 50;
export const AUTO_SAVE_INTERVAL = 30_000;
export const ACCEPTED_AUDIO_MIME = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"];
export const ACCEPTED_AUDIO_EXT = [".mp3", ".wav", ".ogg", ".webm", ".m4a"];
