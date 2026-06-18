import type { AudioRecording } from '@/types';
import type { ScreenPoint } from './Marker';
import { recordingToMarker } from './Marker';
import type { MapMarker } from '@/types';

export interface DistrictCluster {
  id: string;
  name: string;
  count: number;
  markers: MapMarker[];
  centerLat: number;
  centerLng: number;
  audioIds: string[];
}

export interface ClusterStyle {
  radius: number;
  fillColor: string;
  strokeColor: string;
  textColor: string;
  strokeWidth: number;
  fontSize: number;
}

export const clusterRecordingsByDistrict = (
  recordings: AudioRecording[],
): DistrictCluster[] => {
  const districtMap = new Map<string, MapMarker[]>();

  for (const recording of recordings) {
    const marker = recordingToMarker(recording);
    if (!marker) continue;

    const district = recording.administrativeDistrict || '未知区域';

    if (!districtMap.has(district)) {
      districtMap.set(district, []);
    }

    districtMap.get(district)!.push(marker);
  }

  const clusters: DistrictCluster[] = [];

  for (const [name, markers] of districtMap.entries()) {
    if (markers.length === 0) continue;

    let sumLat = 0;
    let sumLng = 0;

    for (const m of markers) {
      sumLat += m.latitude;
      sumLng += m.longitude;
    }

    clusters.push({
      id: `cluster-${name}`,
      name,
      count: markers.length,
      markers,
      centerLat: sumLat / markers.length,
      centerLng: sumLng / markers.length,
      audioIds: markers.map((m) => m.audioId),
    });
  }

  return clusters.sort((a, b) => b.count - a.count);
};

const getClusterColorScale = (count: number, isDark: boolean): string[] => {
  if (isDark) {
    if (count <= 2) return ['rgba(59, 130, 246, 0.85)', 'rgba(59, 130, 246, 0.4)'];
    if (count <= 5) return ['rgba(139, 92, 246, 0.85)', 'rgba(139, 92, 246, 0.4)'];
    if (count <= 10) return ['rgba(236, 72, 153, 0.85)', 'rgba(236, 72, 153, 0.4)'];
    if (count <= 20) return ['rgba(245, 158, 11, 0.85)', 'rgba(245, 158, 11, 0.4)'];
    return ['rgba(239, 68, 68, 0.85)', 'rgba(239, 68, 68, 0.4)'];
  }

  if (count <= 2) return ['rgba(59, 130, 246, 0.9)', 'rgba(59, 130, 246, 0.35)'];
  if (count <= 5) return ['rgba(139, 92, 246, 0.9)', 'rgba(139, 92, 246, 0.35)'];
  if (count <= 10) return ['rgba(236, 72, 153, 0.9)', 'rgba(236, 72, 153, 0.35)'];
  if (count <= 20) return ['rgba(245, 158, 11, 0.9)', 'rgba(245, 158, 11, 0.35)'];
  return ['rgba(239, 68, 68, 0.9)', 'rgba(239, 68, 68, 0.35)'];
};

export const getClusterStyle = (
  count: number,
  zoom: number,
  isDark: boolean = true,
): ClusterStyle => {
  const zoomScale = Math.min(Math.max(zoom / 2, 0.9), 1.3);
  const baseRadius = count <= 2 ? 20 : count <= 5 ? 24 : count <= 10 ? 28 : count <= 20 ? 32 : 36;
  const radius = baseRadius * zoomScale;

  const [fillColor] = getClusterColorScale(count, isDark);

  return {
    radius,
    fillColor,
    strokeColor: isDark ? '#1a1a1a' : '#ffffff',
    textColor: '#ffffff',
    strokeWidth: 2,
    fontSize: count >= 10 ? 13 : 12,
  };
};

export const drawCluster = (
  ctx: CanvasRenderingContext2D,
  cluster: DistrictCluster,
  screenPos: ScreenPoint,
  zoom: number,
  hovered: boolean = false,
  isDark: boolean = true,
): void => {
  const style = getClusterStyle(cluster.count, zoom, isDark);
  const [, glowColor] = getClusterColorScale(cluster.count, isDark);
  const radius = style.radius + (hovered ? 4 : 0);

  if (hovered) {
    const glowRadius = radius + 12;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.fill();
  }

  const gradient = ctx.createRadialGradient(
    screenPos.x,
    screenPos.y,
    0,
    screenPos.x,
    screenPos.y,
    radius,
  );
  gradient.addColorStop(0, style.fillColor);
  gradient.addColorStop(1, glowColor);

  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = hovered ? style.strokeWidth + 1 : style.strokeWidth;
  ctx.stroke();

  ctx.fillStyle = style.textColor;
  ctx.font = `700 ${style.fontSize}px JetBrains Mono, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(cluster.count), screenPos.x, screenPos.y);
};

export const isPointInCluster = (
  px: number,
  py: number,
  screenPos: ScreenPoint,
  radius: number,
): boolean => {
  const dx = px - screenPos.x;
  const dy = py - screenPos.y;
  const hitRadius = radius + 4;
  return dx * dx + dy * dy <= hitRadius * hitRadius;
};

export const drawClusterPopup = (
  ctx: CanvasRenderingContext2D,
  cluster: DistrictCluster,
  screenPos: ScreenPoint,
  isDark: boolean = true,
): void => {
  const title = cluster.name;
  const subtitle = `${cluster.count} 条录音`;
  const padding = 14;
  const cornerRadius = 8;

  ctx.font = '13px Inter, -apple-system, sans-serif';
  const titleWidth = ctx.measureText(title).width;
  ctx.font = '11px JetBrains Mono, monospace';
  const subtitleWidth = ctx.measureText(subtitle).width;
  const maxTextWidth = Math.max(titleWidth, subtitleWidth);

  const popupWidth = Math.max(maxTextWidth + padding * 2, 160);
  const popupHeight = 60;

  const x = screenPos.x - popupWidth / 2;
  const y = screenPos.y - 70;

  ctx.save();
  ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  ctx.beginPath();
  ctx.roundRect(x, y, popupWidth, popupHeight, cornerRadius);
  ctx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = isDark ? '#2d2d2d' : '#e5e5e5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, popupWidth, popupHeight, cornerRadius);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(screenPos.x - 8, y + popupHeight);
  ctx.lineTo(screenPos.x, y + popupHeight + 8);
  ctx.lineTo(screenPos.x + 8, y + popupHeight);
  ctx.closePath();
  ctx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
  ctx.fill();
  ctx.strokeStyle = isDark ? '#2d2d2d' : '#e5e5e5';
  ctx.stroke();

  const [, glowColor] = getClusterColorScale(cluster.count, isDark);
  ctx.beginPath();
  ctx.arc(x + padding + 4, y + padding + 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.fill();

  ctx.fillStyle = isDark ? '#e5e5e5' : '#171717';
  ctx.font = '600 13px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x + padding + 14, y + padding + 2);

  ctx.fillStyle = isDark ? '#737373' : '#737373';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(subtitle, x + padding, y + popupHeight - padding + 2);
};
