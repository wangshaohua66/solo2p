import type { AudioRecording } from '@/types';
import type { MapMarker, LineRoute } from '@/types';
import type { ScreenPoint } from './Marker';
import { recordingToMarker } from './Marker';

export interface LineData {
  name: string;
  color: string;
  markers: MapMarker[];
}

export const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getColorFromLineName = (name: string): string => {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#78716c', '#64748b', '#0891b2',
  ];

  if (!name) return '#64748b';
  const hash = hashCode(name);
  return colors[hash % colors.length];
};

export const groupRecordingsByLine = (recordings: AudioRecording[]): LineData[] => {
  const lineMap = new Map<string, MapMarker[]>();

  for (const recording of recordings) {
    const lineName = recording.lineName;
    if (!lineName) continue;

    const marker = recordingToMarker(recording);
    if (!marker) continue;

    if (!lineMap.has(lineName)) {
      lineMap.set(lineName, []);
    }

    lineMap.get(lineName)!.push(marker);
  }

  const lines: LineData[] = [];

  for (const [name, markers] of lineMap.entries()) {
    if (markers.length < 2) continue;

    const sortedMarkers = [...markers].sort((a, b) => {
      const recA = recordings.find((r) => r.id === a.audioId);
      const recB = recordings.find((r) => r.id === b.audioId);

      const timeA = recA?.recordedAt || recA?.createdAt || '';
      const timeB = recB?.recordedAt || recB?.createdAt || '';

      return timeA.localeCompare(timeB);
    });

    lines.push({
      name,
      color: getColorFromLineName(name),
      markers: sortedMarkers,
    });
  }

  return lines;
};

export const drawLine = (
  ctx: CanvasRenderingContext2D,
  screenPoints: ScreenPoint[],
  color: string,
  zoom: number,
  isDark: boolean = true,
  highlighted: boolean = false,
): void => {
  if (screenPoints.length < 2) return;

  const zoomScale = Math.min(Math.max(zoom / 2, 0.7), 1.5);
  const lineWidth = (highlighted ? 3.5 : 2.5) * zoomScale;

  ctx.save();
  ctx.strokeStyle = `${color}30`;
  ctx.lineWidth = lineWidth + 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = highlighted ? color : `${color}cc`;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (highlighted) {
    ctx.setLineDash([]);
  } else {
    ctx.setLineDash([8, 4]);
  }

  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < screenPoints.length - 1; i++) {
    const p1 = screenPoints[i];
    const p2 = screenPoints[i + 1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const arrowSize = (highlighted ? 8 : 6) * zoomScale;

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    ctx.fillStyle = highlighted ? color : `${color}ee`;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowSize, -arrowSize * 0.5);
    ctx.lineTo(-arrowSize, arrowSize * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
};

export const drawLineEndpoint = (
  ctx: CanvasRenderingContext2D,
  screenPos: ScreenPoint,
  color: string,
  isStart: boolean,
  label: string,
  isDark: boolean = true,
): void => {
  const radius = isStart ? 6 : 8;

  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = `${color}30`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (!isStart) {
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.font = '600 10px JetBrains Mono, monospace';
  const labelWidth = ctx.measureText(label).width;
  const bgWidth = labelWidth + 12;
  const bgHeight = 18;
  const bgX = screenPos.x - bgWidth / 2;
  const bgY = isStart ? screenPos.y - radius - bgHeight - 8 : screenPos.y + radius + 8;

  ctx.save();
  ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 4);
  ctx.fillStyle = isDark ? '#242424' : '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = isDark ? '#404040' : '#e5e5e5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 4);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, screenPos.x, bgY + bgHeight / 2);
};

export const drawLineLegend = (
  ctx: CanvasRenderingContext2D,
  lines: LineData[],
  isDark: boolean = true,
): void => {
  if (lines.length === 0) return;

  const padding = 12;
  const itemHeight = 24;
  const headerHeight = 28;
  const legendWidth = 180;
  const legendHeight = headerHeight + lines.length * itemHeight + padding / 2;
  const x = padding;
  const y = padding;

  ctx.save();
  ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  ctx.beginPath();
  ctx.roundRect(x, y, legendWidth, legendHeight, 8);
  ctx.fillStyle = isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = isDark ? '#2d2d2d' : '#e5e5e5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, legendWidth, legendHeight, 8);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#a3a3a3' : '#525252';
  ctx.font = '600 11px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('线路', x + padding, y + headerHeight / 2);

  lines.forEach((line, index) => {
    const itemY = y + headerHeight + index * itemHeight + 4;

    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(x + padding, itemY + 6);
    ctx.lineTo(x + padding + 24, itemY + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = isDark ? '#e5e5e5' : '#171717';
    ctx.font = '12px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const name = line.name.length > 16 ? `${line.name.slice(0, 15)}…` : line.name;
    ctx.fillText(name, x + padding + 34, itemY + 6);
  });
};

export const lineRouteToLineData = (route: LineRoute): LineData => ({
  name: route.name,
  color: route.color,
  markers: route.markers,
});
