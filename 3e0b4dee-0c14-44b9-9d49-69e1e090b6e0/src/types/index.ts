export interface Vec2 { x: number; y: number; }
export interface Rect { x: number; y: number; w: number; h: number; }

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export type CutMode = 'grid' | 'contour';

export interface GridConfig { cols: number; rows: number; padding: number; }

export interface SpriteSheet {
  id: string;
  projectId: string;
  name: string;
  imageDataUrl: string;
  width: number;
  height: number;
  cutMode: CutMode;
  gridConfig: GridConfig;
  contourThreshold: number;
  frames: SpriteFrame[];
}

export interface SpriteFrame {
  id: string;
  sheetId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: Vec2;
  hitbox: Rect;
  triggerArea: Rect | null;
}

export interface Animation {
  id: string;
  projectId: string;
  name: string;
  loop: boolean;
  frameRate: number;
  tracks: AnimationTrack[];
}

export interface AnimationTrack {
  id: string;
  animId: string;
  name: string;
  zIndex: number;
  keyframes: AnimationKeyframe[];
}

export interface AnimationKeyframe {
  id: string;
  trackId: string;
  frameId: string;
  durationMs: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  eventType: 'none' | 'audio' | 'callback' | 'custom';
  eventValue: string;
  audioClipId: string | null;
}

export interface Tilemap {
  id: string;
  projectId: string;
  name: string;
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  layers: TileLayer[];
  triggerZones: TriggerZone[];
}

export interface TileLayer {
  id: string;
  tilemapId: string;
  name: string;
  zIndex: number;
  visible: boolean;
  cells: (string | null)[][];
}

export type ZoneType = 'collision' | 'trigger';

export interface TriggerZone {
  id: string;
  tilemapId: string;
  type: ZoneType;
  x: number;
  y: number;
  w: number;
  h: number;
  audioClipId: string | null;
}

export interface AudioClip {
  id: string;
  projectId: string;
  name: string;
  type: string;
  audioDataUrl: string;
  duration: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
  startTime: number;
  endTime: number;
  waveformData?: number[];
}

export interface Snapshot {
  id: string;
  projectId: string;
  name: string;
  timestamp: number;
  payload: SnapshotPayload;
}

export interface SnapshotPayload {
  spriteSheets: SpriteSheet[];
  animations: Animation[];
  tilemaps: Tilemap[];
  audioClips: AudioClip[];
}

export interface ResourceTreeNode {
  id: string;
  type: 'folder' | 'sprite' | 'animation' | 'tilemap' | 'audio';
  name: string;
  children?: ResourceTreeNode[];
  resourceId?: string;
}

export interface DiffNode {
  type: 'add' | 'remove' | 'update';
  path: string[];
  old?: unknown;
  new?: unknown;
}

export type ToolType = 'brush' | 'fill' | 'eraser' | 'select';
