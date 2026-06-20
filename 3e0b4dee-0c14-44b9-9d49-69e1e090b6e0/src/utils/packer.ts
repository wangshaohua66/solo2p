import type { SpriteFrame, Rect, Vec2 } from '@/types';
import { genId } from './id';

export function gridCut(
  img: HTMLImageElement,
  cols: number,
  rows: number,
  padding = 0,
  sheetId: string
): SpriteFrame[] {
  const frames: SpriteFrame[] = [];
  const fw = (img.width - padding * (cols + 1)) / cols;
  const fh = (img.height - padding * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padding + c * (fw + padding);
      const y = padding + r * (fh + padding);
      const w = Math.floor(fw);
      const h = Math.floor(fh);
      frames.push({
        id: genId('fr'),
        sheetId,
        name: `frame_${String(r * cols + c).padStart(3, '0')}`,
        x: Math.floor(x), y: Math.floor(y), width: w, height: h,
        anchor: { x: Math.floor(w / 2), y: h - 2 },
        hitbox: { x: Math.floor(w * 0.1), y: Math.floor(h * 0.1), w: Math.floor(w * 0.8), h: Math.floor(h * 0.8) },
        triggerArea: null
      });
    }
  }
  return frames;
}

export function contourCut(
  img: HTMLImageElement,
  alphaThreshold = 12,
  padding = 2,
  sheetId: string
): SpriteFrame[] {
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const { data, width, height } = imgData;
  const visited = new Uint8Array(width * height);
  const frames: SpriteFrame[] = [];

  function idx(x: number, y: number) { return (y * width + x) * 4; }
  function vidx(x: number, y: number) { return y * width + x; }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[vidx(x, y)]) continue;
      if (data[idx(x, y) + 3] < alphaThreshold) { visited[vidx(x, y)] = 1; continue; }
      const stack: Vec2[] = [{ x, y }];
      let minX = x, maxX = x, minY = y, maxY = y;
      while (stack.length) {
        const p = stack.pop()!;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = p.x + dx, ny = p.y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (visited[vidx(nx, ny)]) continue;
            visited[vidx(nx, ny)] = 1;
            if (data[idx(nx, ny) + 3] >= alphaThreshold) {
              stack.push({ x: nx, y: ny });
              if (nx < minX) minX = nx;
              if (nx > maxX) maxX = nx;
              if (ny < minY) minY = ny;
              if (ny > maxY) maxY = ny;
            }
          }
        }
      }
      const fw = maxX - minX + 1 + padding * 2;
      const fh = maxY - minY + 1 + padding * 2;
      if (fw < 3 || fh < 3) continue;
      const fx = Math.max(0, minX - padding);
      const fy = Math.max(0, minY - padding);
      frames.push({
        id: genId('fr'), sheetId,
        name: `sprite_${String(frames.length).padStart(3, '0')}`,
        x: fx, y: fy, width: fw, height: fh,
        anchor: { x: Math.floor(fw / 2), y: fh - 2 },
        hitbox: { x: 2, y: 2, w: fw - 4, h: fh - 4 },
        triggerArea: null
      });
    }
  }
  return mergeOverlappingRects(frames);
}

function mergeOverlappingRects(frames: SpriteFrame[]): SpriteFrame[] {
  const result: SpriteFrame[] = [];
  const used = new Set<number>();
  for (let i = 0; i < frames.length; i++) {
    if (used.has(i)) continue;
    let a = frames[i];
    for (let j = i + 1; j < frames.length; j++) {
      if (used.has(j)) continue;
      const b = frames[j];
      if (rectOverlap({ x: a.x, y: a.y, w: a.width, h: a.height }, { x: b.x, y: b.y, w: b.width, h: b.height })) {
        a = mergeTwo(a, b);
        used.add(j);
      }
    }
    used.add(i);
    result.push(a);
  }
  return result.sort((a, b) => {
    if (Math.abs(a.y - b.y) > a.height / 2) return a.y - b.y;
    return a.x - b.x;
  });
}

function rectOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

function mergeTwo(a: SpriteFrame, b: SpriteFrame): SpriteFrame {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(a.x + a.width, b.x + b.width) - x;
  const h = Math.max(a.y + a.height, b.y + b.height) - y;
  return {
    ...a, x, y, width: w, height: h,
    anchor: { x: Math.floor(w / 2), y: h - 2 },
    hitbox: { x: 2, y: 2, w: w - 4, h: h - 4 }
  };
}

export function batchRename(frames: SpriteFrame[], prefix: string, start = 1, pad = 3): SpriteFrame[] {
  return frames.map((f, i) => ({
    ...f,
    name: `${prefix}_${String(start + i).padStart(pad, '0')}`
  }));
}
