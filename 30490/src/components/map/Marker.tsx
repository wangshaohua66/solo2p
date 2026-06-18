import type { AudioRecording, MapMarker } from '@/types';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface MarkerStyle {
  radius: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  pulseColor: string;
}

export interface DrawMarkerOptions {
  zoom: number;
  offsetX: number;
  offsetY: number;
  hovered?: boolean;
  selected?: boolean;
}

const MARKER_RADIUS_BASE = 8;
const MARKER_RADIUS_MAX = 14;
const PULSE_RADIUS_MAX = 24;

export const recordingToMarker = (recording: AudioRecording): MapMarker | null => {
  if (recording.latitude === null || recording.longitude === null) {
    return null;
  }

  return {
    id: `marker-${recording.id}`,
    audioId: recording.id,
    latitude: recording.latitude,
    longitude: recording.longitude,
    title: recording.title,
    timePeriod: recording.timePeriod,
    sceneCategory: recording.sceneCategory,
  };
};

export const getMarkerStyle = (
  sceneCategory: MapMarker['sceneCategory'],
  isDark: boolean = true,
): MarkerStyle => {
  const categoryColors: Record<string, { dark: string; light: string }> = {
    market: { dark: '#f59e0b', light: '#d97706' },
    subway: { dark: '#8b5cf6', light: '#7c3aed' },
    street: { dark: '#6366f1', light: '#4f46e5' },
    park: { dark: '#10b981', light: '#059669' },
    construction: { dark: '#ef4444', light: '#dc2626' },
    traffic: { dark: '#f97316', light: '#ea580c' },
    indoor: { dark: '#06b6d4', light: '#0891b2' },
    nature: { dark: '#22c55e', light: '#16a34a' },
    festival: { dark: '#ec4899', light: '#db2777' },
    other: { dark: '#64748b', light: '#475569' },
  };

  const colors = categoryColors[sceneCategory || 'other'] || categoryColors.other;
  const primary = isDark ? colors.dark : colors.light;

  return {
    radius: MARKER_RADIUS_BASE,
    fillColor: primary,
    strokeColor: isDark ? '#1a1a1a' : '#ffffff',
    strokeWidth: 2,
    pulseColor: `${primary}80`,
  };
};

export const latLngToScreen = (
  lat: number,
  lng: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  canvasWidth: number,
  canvasHeight: number,
  centerLat: number = 39.9,
  centerLng: number = 116.4,
): ScreenPoint => {
  const scale = Math.pow(2, zoom) * 80;

  const dx = (lng - centerLng) * scale;
  const dy = (centerLat - lat) * scale;

  return {
    x: canvasWidth / 2 + dx + offsetX,
    y: canvasHeight / 2 + dy + offsetY,
  };
};

export const screenToLatLng = (
  x: number,
  y: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  canvasWidth: number,
  canvasHeight: number,
  centerLat: number = 39.9,
  centerLng: number = 116.4,
): { lat: number; lng: number } => {
  const scale = Math.pow(2, zoom) * 80;

  const dx = x - canvasWidth / 2 - offsetX;
  const dy = y - canvasHeight / 2 - offsetY;

  return {
    lat: centerLat - dy / scale,
    lng: centerLng + dx / scale,
  };
};

export const drawMarker = (
  ctx: CanvasRenderingContext2D,
  marker: MapMarker,
  screenPos: ScreenPoint,
  options: DrawMarkerOptions,
  isDark: boolean = true,
): void => {
  const style = getMarkerStyle(marker.sceneCategory, isDark);
  const zoomScale = Math.min(Math.max(options.zoom / 2, 1), 2);
  const radius = Math.min(MARKER_RADIUS_BASE * zoomScale, MARKER_RADIUS_MAX);
  const isHovered = options.hovered || options.selected;

  if (isHovered) {
    const pulseRadius = radius + 10;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = style.pulseColor;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = style.fillColor;
  ctx.fill();

  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = isHovered ? style.strokeWidth + 1 : style.strokeWidth;
  ctx.stroke();

  if (options.selected) {
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? '#60a5fa' : '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};

export const isPointInMarker = (
  px: number,
  py: number,
  screenPos: ScreenPoint,
  radius: number = MARKER_RADIUS_BASE,
): boolean => {
  const dx = px - screenPos.x;
  const dy = py - screenPos.y;
  const hitRadius = radius + 6;
  return dx * dx + dy * dy <= hitRadius * hitRadius;
};

export const drawMarkerPopup = (
  ctx: CanvasRenderingContext2D,
  marker: MapMarker,
  screenPos: ScreenPoint,
  isDark: boolean = true,
): void => {
  const title = marker.title || '未命名录音';
  const padding = 12;
  const cornerRadius = 8;

  ctx.font = '13px Inter, -apple-system, sans-serif';
  const textMetrics = ctx.measureText(title);
  const popupWidth = Math.max(textMetrics.width + padding * 2, 120);
  const popupHeight = 44;

  const x = screenPos.x - popupWidth / 2;
  const y = screenPos.y - 50;

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

  ctx.fillStyle = isDark ? '#e5e5e5' : '#171717';
  ctx.font = '600 13px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, screenPos.x, y + popupHeight / 2 - 6);

  const style = getMarkerStyle(marker.sceneCategory, isDark);
  ctx.beginPath();
  ctx.arc(screenPos.x - popupWidth / 2 + padding + 4, y + popupHeight / 2 + 8, 3, 0, Math.PI * 2);
  ctx.fillStyle = style.fillColor;
  ctx.fill();

  ctx.fillStyle = isDark ? '#737373' : '#737373';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  const metaText = `${marker.latitude.toFixed(3)}°N, ${marker.longitude.toFixed(3)}°E`;
  ctx.fillText(metaText, screenPos.x - popupWidth / 2 + padding + 12, y + popupHeight / 2 + 8);
};
