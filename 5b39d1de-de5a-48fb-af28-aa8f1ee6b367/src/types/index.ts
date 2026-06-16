export type ID = string;

export interface Project {
  id: ID;
  name: string;
  description: string;
  thumbnail: string;
  createdAt: number;
  updatedAt: number;
  fps: 12 | 24 | 30;
}

export interface Scene {
  id: ID;
  projectId: ID;
  name: string;
  orderIndex: number;
  createdAt: number;
}

export type CameraMove =
  | 'static'
  | 'push'
  | 'pull'
  | 'pan'
  | 'tilt'
  | 'follow';

export type TransitionType = 'cut' | 'fade' | 'wipe';

export interface Dialogue {
  id: ID;
  character: string;
  text: string;
  timePoint: number;
}

export interface ReferenceImage {
  id: ID;
  url: string;
  name: string;
  opacity: number;
}

export interface Shot {
  id: ID;
  sceneId: ID;
  projectId: ID;
  orderIndex: number;
  title?: string;
  duration: number;
  cameraMovement: CameraMove;
  transition: TransitionType;
  layers: Layer[];
  thumbnail?: string;
  referenceImage?: ReferenceImage | null;
  dialogues: Dialogue[];
  sfxTags: string[];
  createdAt: number;
  updatedAt: number;
}

export type ToolType =
  | 'pen'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'eraser'
  | 'pan';

export type KonvaNodeType = 'line' | 'rect' | 'ellipse' | 'arrow';

export interface BaseKonvaNode {
  id: ID;
  type: KonvaNodeType;
}

export interface LineNode extends BaseKonvaNode {
  type: 'line';
  points: number[];
  stroke: string;
  strokeWidth: number;
  tension: number;
  closed?: boolean;
}

export interface RectNode extends BaseKonvaNode {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
}

export interface EllipseNode extends BaseKonvaNode {
  type: 'ellipse';
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
}

export interface ArrowNode extends BaseKonvaNode {
  type: 'arrow';
  points: number[];
  stroke: string;
  strokeWidth: number;
  pointerLength: number;
  pointerWidth: number;
}

export type KonvaNode = LineNode | RectNode | EllipseNode | ArrowNode;

export interface Layer {
  id: ID;
  name: string;
  orderIndex: number;
  visible: boolean;
  locked: boolean;
  nodes: KonvaNode[];
}

interface SfxPreset {
  value: string;
  label: string;
  icon: string;
}

export const SFX_PRESETS: readonly SfxPreset[] = [
  { value: 'footstep', label: '脚步声', icon: '👣' },
  { value: 'door_open', label: '开门声', icon: '🚪' },
  { value: 'door_close', label: '关门声', icon: '🚪' },
  { value: 'phone_ring', label: '电话铃声', icon: '📞' },
  { value: 'knock', label: '敲门声', icon: '🔨' },
  { value: 'wind', label: '风声', icon: '💨' },
  { value: 'rain', label: '雨声', icon: '🌧️' },
  { value: 'thunder', label: '雷声', icon: '🌩️' },
  { value: 'birds', label: '鸟鸣声', icon: '🐦' },
  { value: 'car', label: '汽车声', icon: '🚗' },
  { value: 'explosion', label: '爆炸声', icon: '💥' },
  { value: 'gunshot', label: '枪声', icon: '🔫' },
  { value: 'fight', label: '打斗声', icon: '👊' },
  { value: 'shatter', label: '碎裂声', icon: '💔' },
  { value: 'alarm', label: '警报声', icon: '🚨' },
  { value: 'bgm_fade_in', label: 'BGM淡入', icon: '🎵' },
  { value: 'bgm_fade_out', label: 'BGM淡出', icon: '🎵' },
  { value: 'ambient', label: '环境音', icon: '🌿' },
  { value: 'heartbeat', label: '心跳声', icon: '💓' },
  { value: 'breath', label: '呼吸声', icon: '😮‍💨' },
] as const;

export const CAMERA_MOVEMENT_OPTIONS: { value: CameraMove; label: string }[] = [
  { value: 'static', label: '固定镜头' },
  { value: 'push', label: '推镜头' },
  { value: 'pull', label: '拉镜头' },
  { value: 'pan', label: '摇镜头' },
  { value: 'tilt', label: '移镜头' },
  { value: 'follow', label: '跟镜头' },
];

export const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'cut', label: '切' },
  { value: 'fade', label: '淡入淡出' },
  { value: 'wipe', label: '划变' },
];

export const PRESET_COLORS: readonly string[] = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
] as const;

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const MAX_LAYERS = 20;
export const MAX_DIALOGUES = 5;
export const MAX_HISTORY = 100;
export const MIN_DURATION = 0.5;
export const MAX_DURATION = 30;
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;
export const MIN_BRUSH = 1;
export const MAX_BRUSH = 50;
