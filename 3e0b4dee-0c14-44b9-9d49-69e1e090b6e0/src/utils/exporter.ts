import type {
  Project, SpriteSheet, Animation, Tilemap, AudioClip, SnapshotPayload
} from '@/types';
import { downloadJSON } from './id';

export interface FieldMapping {
  path: string;
  source: string;
  transform?: 'rename' | 'compress' | 'flatten' | 'strip';
  alias?: string;
  enabled: boolean;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  rootFields: FieldMapping[];
  spriteFieldOverrides?: FieldMapping[];
  animationFieldOverrides?: FieldMapping[];
  tilemapFieldOverrides?: FieldMapping[];
  audioFieldOverrides?: FieldMapping[];
  compressTileData?: boolean;
  includeImageData?: boolean;
  includeAudioData?: boolean;
}

export const builtInTemplates: ExportTemplate[] = [
  {
    id: 'standard',
    name: '标准引擎配置',
    description: 'PixelForge默认完整JSON配置，适合直接集成游戏引擎',
    version: '1.0.0',
    compressTileData: true,
    includeImageData: true,
    includeAudioData: true,
    rootFields: [
      { path: 'version', source: 'system.version', enabled: true },
      { path: 'exportedAt', source: 'system.time', enabled: true },
      { path: 'project', source: 'project', enabled: true },
      { path: 'spriteSheets', source: 'sprites', enabled: true },
      { path: 'animations', source: 'animations', enabled: true },
      { path: 'tilemaps', source: 'tilemaps', enabled: true },
      { path: 'audioClips', source: 'audio', enabled: true },
      { path: 'manifest', source: 'system.manifest', enabled: true }
    ]
  },
  {
    id: 'minimal',
    name: '精简运行时',
    description: '仅保留运行时必需字段，体积最小，适合生产包',
    version: '1.0.0',
    compressTileData: true,
    includeImageData: false,
    includeAudioData: false,
    rootFields: [
      { path: 'version', source: 'system.version', enabled: true },
      { path: 'spriteSheets', source: 'sprites', enabled: true },
      { path: 'animations', source: 'animations', enabled: true },
      { path: 'tilemaps', source: 'tilemaps', enabled: true },
      { path: 'audioClips', source: 'audio', enabled: true }
    ],
    spriteFieldOverrides: [
      { path: 'frames[].triggerArea', source: '', enabled: false, transform: 'strip' },
      { path: 'frames[].hitbox', source: '', enabled: true }
    ],
    animationFieldOverrides: [
      { path: 'tracks[].keyframes[].eventValue', source: '', enabled: false, transform: 'strip' }
    ]
  },
  {
    id: 'godot',
    name: 'Godot引擎兼容',
    description: '字段命名适配Godot风格(snake_case + resource_path)',
    version: '1.0.0',
    compressTileData: false,
    includeImageData: false,
    includeAudioData: false,
    rootFields: [
      { path: 'resource_type', source: 'system.type', enabled: true, transform: 'rename', alias: 'PixelForgeConfig' },
      { path: 'sprite_sheets', source: 'sprites', enabled: true, transform: 'rename' },
      { path: 'animations', source: 'animations', enabled: true },
      { path: 'tile_maps', source: 'tilemaps', enabled: true, transform: 'rename' },
      { path: 'audio_clips', source: 'audio', enabled: true, transform: 'rename' }
    ]
  },
  {
    id: 'unity',
    name: 'Unity引擎兼容',
    description: '字段命名适配Unity风格(PascalCase + ScriptableObject)',
    version: '1.0.0',
    compressTileData: false,
    includeImageData: false,
    includeAudioData: false,
    rootFields: [
      { path: 'AssetType', source: 'system.type', enabled: true, transform: 'rename', alias: 'PixelForgeAsset' },
      { path: 'SpriteSheets', source: 'sprites', enabled: true },
      { path: 'Animations', source: 'animations', enabled: true },
      { path: 'Tilemaps', source: 'tilemaps', enabled: true },
      { path: 'AudioClips', source: 'audio', enabled: true }
    ]
  }
];

function encodeRLE(cells: (string | null)[][]): string {
  const flat: string[] = [];
  for (const row of cells) for (const c of row) flat.push(c ?? '');
  const parts: string[] = [];
  let i = 0;
  while (i < flat.length) {
    let j = i + 1;
    while (j < flat.length && flat[j] === flat[i]) j++;
    const count = j - i;
    parts.push(count > 1 ? `${count}*${flat[i]}` : flat[i]);
    i = j;
  }
  return btoa(unescape(encodeURIComponent(parts.join(','))));
}

function snakeCase(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}
function pascalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renameKeys(obj: any, mode: 'snake' | 'pascal' | 'none'): any {
  if (mode === 'none') return obj;
  if (Array.isArray(obj)) return obj.map(o => renameKeys(o, mode));
  if (obj === null || typeof obj !== 'object') return obj;
  const out: any = {};
  for (const k of Object.keys(obj)) {
    const nk = mode === 'snake' ? snakeCase(k) : pascalCase(k);
    out[nk] = renameKeys(obj[k], mode);
  }
  return out;
}

function getTemplateCase(template: ExportTemplate): 'snake' | 'pascal' | 'none' {
  if (template.id === 'godot') return 'snake';
  if (template.id === 'unity') return 'pascal';
  return 'none';
}

export interface ExportedConfig {
  version: string;
  exportedAt: number;
  project: Pick<Project, 'id' | 'name' | 'description'>;
  spriteSheets: any[];
  animations: any[];
  tilemaps: any[];
  audioClips: any[];
  manifest?: {
    spriteCount: number;
    animationCount: number;
    tilemapCount: number;
    audioCount: number;
  };
  [key: string]: any;
}

export function buildExportConfig(
  project: Project,
  payload: SnapshotPayload,
  template: ExportTemplate = builtInTemplates[0]
): ExportedConfig {
  let spriteCount = 0;
  const caseMode = getTemplateCase(template);

  const spriteSheets = payload.spriteSheets.map(ss => {
    const frames = ss.frames.map(f => {
      spriteCount++;
      const out: any = {
        id: f.id, name: f.name,
        rect: { x: f.x, y: f.y, w: f.width, h: f.height },
        anchor: { ...f.anchor },
        hitbox: { ...f.hitbox }
      };
      if (template.spriteFieldOverrides?.some(o => o.path === 'frames[].triggerArea' && o.enabled !== false)) {
        if (f.triggerArea) out.triggerArea = { ...f.triggerArea };
      } else if (!template.spriteFieldOverrides) {
        if (f.triggerArea) out.triggerArea = { ...f.triggerArea };
      }
      return out;
    });
    return {
      id: ss.id, name: ss.name,
      image: template.includeImageData ? ss.imageDataUrl : `assets/sprites/${ss.id}.png`,
      width: ss.width, height: ss.height,
      frames
    };
  });

  const animations = payload.animations.map(a => {
    const events: any[] = [];
    const tracks = a.tracks.map(t => {
      let frameIdx = 0;
      return {
        name: t.name, zIndex: t.zIndex,
        keyframes: t.keyframes.map(k => {
          if (k.eventType !== 'none') {
            events.push({
              frame: frameIdx, type: k.eventType,
              value: k.eventValue, clipId: k.audioClipId ?? undefined
            });
          }
          frameIdx++;
          return {
            frameId: k.frameId, duration: k.durationMs,
            offset: [k.offsetX, k.offsetY],
            rotation: k.rotation
          };
        })
      };
    });
    return {
      id: a.id, name: a.name, frameRate: a.frameRate, loop: a.loop,
      tracks, events
    };
  });

  const tilemaps = payload.tilemaps.map(tm => ({
    id: tm.id, name: tm.name,
    size: { cols: tm.cols, rows: tm.rows, tileW: tm.tileWidth, tileH: tm.tileHeight },
    layers: tm.layers.map(l => ({
      name: l.name, zIndex: l.zIndex, visible: l.visible,
      data: template.compressTileData ? encodeRLE(l.cells) : l.cells
    })),
    triggers: tm.triggerZones.map(z => ({
      id: z.id, type: z.type,
      rect: { x: z.x, y: z.y, w: z.w, h: z.h },
      clipId: z.audioClipId
    }))
  }));

  const audioClips = payload.audioClips.map(ac => ({
    id: ac.id, name: ac.name,
    src: template.includeAudioData ? ac.audioDataUrl : `assets/audio/${ac.id}.${ac.type?.split('/')[1] || 'wav'}`,
    volume: ac.volume, fadeIn: ac.fadeIn, fadeOut: ac.fadeOut, loop: ac.loop,
    range: { start: ac.startTime, end: ac.endTime }
  }));

  const base: ExportedConfig = {
    version: template.version,
    exportedAt: Date.now(),
    project: { id: project.id, name: project.name, description: project.description },
    spriteSheets, animations, tilemaps, audioClips,
    manifest: {
      spriteCount,
      animationCount: animations.length,
      tilemapCount: tilemaps.length,
      audioCount: audioClips.length
    }
  };

  let result: any = {};
  for (const field of template.rootFields.filter(f => f.enabled)) {
    if (field.source === 'system.version') result[field.path] = template.version;
    else if (field.source === 'system.time') result[field.path] = Date.now();
    else if (field.source === 'system.manifest') result[field.path] = base.manifest;
    else if (field.source === 'system.type') result[field.path] = field.alias || 'PixelForgeConfig';
    else if (field.source === 'project') result[field.path] = base.project;
    else if (field.source === 'sprites') result[field.path] = base.spriteSheets;
    else if (field.source === 'animations') result[field.path] = base.animations;
    else if (field.source === 'tilemaps') result[field.path] = base.tilemaps;
    else if (field.source === 'audio') result[field.path] = base.audioClips;
  }

  if (caseMode !== 'none') {
    result = renameKeys(result, caseMode);
  }

  return result as ExportedConfig;
}

export function exportToFile(
  project: Project,
  payload: SnapshotPayload,
  template: ExportTemplate = builtInTemplates[0]
): void {
  const config = buildExportConfig(project, payload, template);
  const filename = `${project.name.replace(/\s+/g, '_')}_${template.id}_${Date.now()}.json`;
  downloadJSON(config, filename);
}
