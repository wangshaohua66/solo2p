import type { Layer } from '@/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/types';

const THUMB_WIDTH = 240;
const THUMB_HEIGHT = 135;

export const generateThumbnailFromLayers = (layers: Layer[]): string => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);

    const scaleX = THUMB_WIDTH / CANVAS_WIDTH;
    const scaleY = THUMB_HEIGHT / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    ctx.save();
    ctx.scale(scale, scale);

    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const node of layer.nodes) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (node.type === 'line' || node.type === 'arrow') {
          ctx.strokeStyle = node.stroke;
          ctx.lineWidth = node.strokeWidth;
          ctx.beginPath();
          const pts = node.points;
          if (pts.length >= 4) {
            ctx.moveTo(pts[0], pts[1]);
            for (let i = 2; i < pts.length; i += 2) {
              ctx.lineTo(pts[i], pts[i + 1]);
            }
            ctx.stroke();
          }
        } else if (node.type === 'rect') {
          if (node.fill) {
            ctx.fillStyle = node.fill;
            ctx.fillRect(node.x, node.y, node.width, node.height);
          }
          if (node.stroke && node.strokeWidth) {
            ctx.strokeStyle = node.stroke;
            ctx.lineWidth = node.strokeWidth;
            ctx.strokeRect(node.x, node.y, node.width, node.height);
          }
        } else if (node.type === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(node.x, node.y, node.radiusX, node.radiusY, 0, 0, Math.PI * 2);
          if (node.fill) {
            ctx.fillStyle = node.fill;
            ctx.fill();
          }
          if (node.stroke && node.strokeWidth) {
            ctx.strokeStyle = node.stroke;
            ctx.lineWidth = node.strokeWidth;
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return '';
  }
};

export const generateProjectThumbnail = (thumbnails: string[]): string => {
  if (thumbnails.length === 0) return '';
  return thumbnails.find((t) => t && t.length > 100) ?? '';
};
