import type {
  Project, SpriteSheet, Animation, Tilemap, AudioClip, SnapshotPayload
} from '@/types';
import { downloadJSON } from './id';

export interface ExportedConfig {
  version: string;
  exportedAt: number;
  project: Pick<Project, 'id' | 'name' | 'description'>;
  spriteSheets: {
    id: string;
    name: string;
    image: string;
    frames: {
      id: string;
      name: string;
      rect: { x: number; y: number; w: number; h: number };
      anchor: { x: number; y: number };
      hitbox: { x: number; y: number; w: number; h: number };
      triggerArea: { x: number; y: number; w: number; h: number } | null;
    }[];
  }[];
  animations: {
    id: string;
    name: string;
    frameRate: number;
    loop: boolean;
    tracks: {
      name: string;
      zIndex: number;
      keyframes: {
        frameId: string;
        duration: number;
        offset: [number, number];
        rotation: number;
      }[];
    }[];
    events: { frame: number; type: string; value: string; clipId?: string }[];
  }[];
  tilemaps: {
    id: string;
    name: string;
    size: { cols: number; rows: number; tileW: number; tileH: number };
    layers: {
      name: string;
      zIndex: number;
      visible: boolean;
      data: string;
    }[];
    triggers: {
      id: string;
      type: string;
      rect: { x: number; y: number; w: number; h: number };
      clipId: string | null;
    }[];
  }[];
  audioClips: {
    id: string;
    name: string;
    src: string;
    volume: number;
    fadeIn: number;
    fadeOut: number;
    loop: boolean;
    range: { start: number; end: number };
  }[];
  manifest: {
    spriteCount: number;
    animationCount: number;
    tilemapCount: number;
    audioCount: number;
  };
}

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

export function buildExportConfig(
  project: Project,
  payload: SnapshotPayload
): ExportedConfig {
  let spriteCount = 0;
  const spriteSheets = payload.spriteSheets.map(ss => ({
    id: ss.id, name: ss.name, image: ss.imageDataUrl,
    frames: ss.frames.map(f => {
      spriteCount++;
      return {
        id: f.id, name: f.name,
        rect: { x: f.x, y: f.y, w: f.width, h: f.height },
        anchor: { ...f.anchor },
        hitbox: { ...f.hitbox },
        triggerArea: f.triggerArea ? { ...f.triggerArea } : null
      };
    })
  }));

  const animations = payload.animations.map(a => {
    const events: { frame: number; type: string; value: string; clipId?: string }[] = [];
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
            offset: [k.offsetX, k.offsetY] as [number, number],
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
      data: encodeRLE(l.cells)
    })),
    triggers: tm.triggerZones.map(z => ({
      id: z.id, type: z.type,
      rect: { x: z.x, y: z.y, w: z.w, h: z.h },
      clipId: z.audioClipId
    }))
  }));

  const audioClips = payload.audioClips.map(ac => ({
    id: ac.id, name: ac.name, src: ac.audioDataUrl,
    volume: ac.volume, fadeIn: ac.fadeIn, fadeOut: ac.fadeOut, loop: ac.loop,
    range: { start: ac.startTime, end: ac.endTime }
  }));

  return {
    version: '1.0.0',
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
}

export function exportToFile(project: Project, payload: SnapshotPayload): void {
  const config = buildExportConfig(project, payload);
  const filename = `${project.name.replace(/\s+/g, '_')}_config_${Date.now()}.json`;
  downloadJSON(config, filename);
}
