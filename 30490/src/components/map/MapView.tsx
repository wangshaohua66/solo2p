import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  MapPin,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';
import { useSettingsStore } from '@/store/settingsStore';
import { translate } from '@/i18n';
import type { AudioRecording, MapMarker } from '@/types';
import {
  recordingToMarker,
  latLngToScreen,
  drawMarker,
  drawMarkerPopup,
  isPointInMarker,
  getMarkerStyle,
} from './Marker';
import type { ScreenPoint } from './Marker';
import {
  clusterRecordingsByDistrict,
  drawCluster,
  drawClusterPopup,
  isPointInCluster,
  getClusterStyle,
} from './Cluster';
import type { DistrictCluster } from './Cluster';
import {
  groupRecordingsByLine,
  drawLine,
  drawLineEndpoint,
} from './LineOverlay';
import type { LineData } from './LineOverlay';
import styles from './MapView.module.css';

type ViewMode = 'district' | 'lines';

interface HoveredItem {
  type: 'marker' | 'cluster';
  id: string;
  screenPos: ScreenPoint;
  data: MapMarker | DistrictCluster;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.25;

const labelFallback: Record<string, string> = {
  'map.title': '地图视图',
  'map.markers': '采样点',
  'map.aggregation': '按行政区聚合',
  'map.lines': '按线路查看',
  'map.totalMarkers': '共 {count} 个采样点',
  'map.noLocation': '以下录音没有位置信息',
  'map.cluster': '{count} 条录音',
  'common.zoomIn': '放大',
  'common.zoomOut': '缩小',
  'nav.library': '录音库',
};

export const MapView = () => {
  const recordings = useAudioStore((s) => s.recordings);
  const loading = useAudioStore((s) => s.loading);
  const { loadRecordings } = useAudioStore((s) => s.actions);
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);

  const t = (key: string, params?: Record<string, string | number>) => {
    const translated = translate(language, key, params);
    if (translated === key) {
      const fallback = labelFallback[key];
      if (fallback && params) {
        return fallback.replace(/\{(\w+)\}/g, (_, k) => String(params[k] || `{${k}}`));
      }
      return fallback || key;
    }
    return translated;
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [centerLat] = useState(39.9);
  const [centerLng] = useState(116.4);
  const [viewMode, setViewMode] = useState<ViewMode>('district');
  const [hoveredItem, setHoveredItem] = useState<HoveredItem | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ lat: number; lng: number } | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const isDark = theme === 'dark';

  const validMarkers = useMemo<MapMarker[]>(() => {
    return recordings
      .map(recordingToMarker)
      .filter((m): m is MapMarker => m !== null);
  }, [recordings]);

  const noLocationRecordings = useMemo<AudioRecording[]>(() => {
    return recordings.filter(
      (r) => r.latitude === null || r.longitude === null,
    );
  }, [recordings]);

  const districtClusters = useMemo<DistrictCluster[]>(() => {
    return clusterRecordingsByDistrict(recordings);
  }, [recordings]);

  const lineRoutes = useMemo<LineData[]>(() => {
    return groupRecordingsByLine(recordings);
  }, [recordings]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const bgColor = isDark ? '#0f172a' : '#f0f9ff';
    const gridColor = isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.12)';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const gridSize = 60 * Math.max(zoom / 1.5, 0.7);
    const startX = ((offsetX % gridSize) + gridSize) % gridSize;
    const startY = ((offsetY % gridSize) + gridSize) % gridSize;

    ctx.beginPath();
    for (let x = startX; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = startY; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    const labelColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.35)';
    ctx.fillStyle = labelColor;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let i = 0; i < 5; i++) {
      const lat = centerLat + (i - 2) * 0.5;
      const lng = centerLng + (i - 2) * 0.5;
      const latScreen = latLngToScreen(lat, centerLng, zoom, offsetX, offsetY, width, height, centerLat, centerLng);
      const lngScreen = latLngToScreen(centerLat, lng, zoom, offsetX, offsetY, width, height, centerLat, centerLng);

      ctx.fillText(`${lat.toFixed(1)}°N`, 8, Math.min(Math.max(latScreen.y, 8), height - 20));
      ctx.fillText(`${lng.toFixed(1)}°E`, Math.min(Math.max(lngScreen.x, 8), width - 50), 8);
    }

    if (viewMode === 'lines') {
      for (const line of lineRoutes) {
        const points: ScreenPoint[] = line.markers.map((m) =>
          latLngToScreen(
            m.latitude,
            m.longitude,
            zoom,
            offsetX,
            offsetY,
            width,
            height,
            centerLat,
            centerLng,
          ),
        );

        drawLine(ctx, points, line.color, zoom, isDark);

        if (line.markers.length >= 2) {
          const first = points[0];
          const last = points[points.length - 1];
          drawLineEndpoint(ctx, first, line.color, true, '起', isDark);
          drawLineEndpoint(ctx, last, line.color, false, '终', isDark);
        }
      }

      for (const marker of validMarkers) {
        const screenPos = latLngToScreen(
          marker.latitude,
          marker.longitude,
          zoom,
          offsetX,
          offsetY,
          width,
          height,
          centerLat,
          centerLng,
        );

        const isHovered = hoveredItem?.type === 'marker' && hoveredItem.id === marker.id;
        const isSelected = selectedMarkerId === marker.audioId;
        drawMarker(ctx, marker, screenPos, { zoom, offsetX, offsetY, hovered: isHovered, selected: isSelected }, isDark);
      }
    } else {
      const expandedCluster = expandedClusterId
        ? districtClusters.find((c) => c.id === expandedClusterId)
        : null;

      const expandedMarkerIds = new Set(
        expandedCluster ? expandedCluster.markers.map((m) => m.id) : [],
      );

      for (const cluster of districtClusters) {
        const screenPos = latLngToScreen(
          cluster.centerLat,
          cluster.centerLng,
          zoom,
          offsetX,
          offsetY,
          width,
          height,
          centerLat,
          centerLng,
        );

        if (cluster.id === expandedClusterId) {
          for (const marker of cluster.markers) {
            const markerScreen = latLngToScreen(
              marker.latitude,
              marker.longitude,
              zoom,
              offsetX,
              offsetY,
              width,
              height,
              centerLat,
              centerLng,
            );
            const isHovered = hoveredItem?.type === 'marker' && hoveredItem.id === marker.id;
            const isSelected = selectedMarkerId === marker.audioId;
            drawMarker(ctx, marker, markerScreen, { zoom, offsetX, offsetY, hovered: isHovered, selected: isSelected }, isDark);
          }
          continue;
        }

        if (cluster.count < 2) {
          for (const marker of cluster.markers) {
            const markerScreen = latLngToScreen(
              marker.latitude,
              marker.longitude,
              zoom,
              offsetX,
              offsetY,
              width,
              height,
              centerLat,
              centerLng,
            );
            const isHovered = hoveredItem?.type === 'marker' && hoveredItem.id === marker.id;
            const isSelected = selectedMarkerId === marker.audioId;
            drawMarker(ctx, marker, markerScreen, { zoom, offsetX, offsetY, hovered: isHovered, selected: isSelected }, isDark);
          }
          continue;
        }

        const isHovered = hoveredItem?.type === 'cluster' && hoveredItem.id === cluster.id;
        drawCluster(ctx, cluster, screenPos, zoom, isHovered, isDark);
      }

      if (expandedMarkerIds.size === 0) {
        for (const cluster of districtClusters) {
          if (cluster.count >= 2) continue;
        }
      }
    }

    if (hoveredItem) {
      const screenPos = latLngToScreen(
        hoveredItem.type === 'marker'
          ? (hoveredItem.data as MapMarker).latitude
          : (hoveredItem.data as DistrictCluster).centerLat,
        hoveredItem.type === 'marker'
          ? (hoveredItem.data as MapMarker).longitude
          : (hoveredItem.data as DistrictCluster).centerLng,
        zoom,
        offsetX,
        offsetY,
        width,
        height,
        centerLat,
        centerLng,
      );

      if (hoveredItem.type === 'marker') {
        drawMarkerPopup(ctx, hoveredItem.data as MapMarker, screenPos, isDark);
      } else {
        drawClusterPopup(ctx, hoveredItem.data as DistrictCluster, screenPos, isDark);
      }
    }
  }, [
    isDark,
    zoom,
    offsetX,
    offsetY,
    centerLat,
    centerLng,
    viewMode,
    validMarkers,
    districtClusters,
    lineRoutes,
    hoveredItem,
    selectedMarkerId,
    expandedClusterId,
  ]);

  useEffect(() => {
    const animate = () => {
      render();
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings]);

  const getHitItem = useCallback(
    (clientX: number, clientY: number): HoveredItem | null => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return null;

      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      if (viewMode === 'district') {
        const expandedCluster = expandedClusterId
          ? districtClusters.find((c) => c.id === expandedClusterId)
          : null;

        if (expandedCluster) {
          for (const marker of expandedCluster.markers) {
            const screenPos = latLngToScreen(
              marker.latitude,
              marker.longitude,
              zoom,
              offsetX,
              offsetY,
              width,
              height,
              centerLat,
              centerLng,
            );
            const style = getMarkerStyle(marker.sceneCategory, isDark);
            if (isPointInMarker(x, y, screenPos, style.radius + 4)) {
              return { type: 'marker', id: marker.id, screenPos, data: marker };
            }
          }
        }

        for (const cluster of districtClusters) {
          if (cluster.id === expandedClusterId) continue;

          const screenPos = latLngToScreen(
            cluster.centerLat,
            cluster.centerLng,
            zoom,
            offsetX,
            offsetY,
            width,
            height,
            centerLat,
            centerLng,
          );
          const style = getClusterStyle(cluster.count, zoom, isDark);

          if (cluster.count < 2) {
            for (const marker of cluster.markers) {
              const markerScreen = latLngToScreen(
                marker.latitude,
                marker.longitude,
                zoom,
                offsetX,
                offsetY,
                width,
                height,
                centerLat,
                centerLng,
              );
              const markerStyle = getMarkerStyle(marker.sceneCategory, isDark);
              if (isPointInMarker(x, y, markerScreen, markerStyle.radius + 4)) {
                return { type: 'marker', id: marker.id, screenPos: markerScreen, data: marker };
              }
            }
          } else {
            if (isPointInCluster(x, y, screenPos, style.radius)) {
              return { type: 'cluster', id: cluster.id, screenPos, data: cluster };
            }
          }
        }
      } else {
        for (const marker of validMarkers) {
          const screenPos = latLngToScreen(
            marker.latitude,
            marker.longitude,
            zoom,
            offsetX,
            offsetY,
            width,
            height,
            centerLat,
            centerLng,
          );
          const style = getMarkerStyle(marker.sceneCategory, isDark);
          if (isPointInMarker(x, y, screenPos, style.radius + 4)) {
            return { type: 'marker', id: marker.id, screenPos, data: marker };
          }
        }
      }

      return null;
    },
    [
      viewMode,
      districtClusters,
      validMarkers,
      zoom,
      offsetX,
      offsetY,
      centerLat,
      centerLng,
      isDark,
      expandedClusterId,
    ],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX,
        offsetY,
      };
      (e.currentTarget as HTMLDivElement).classList.add(styles.grabbing);
    },
    [offsetX, offsetY],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;

      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setOffsetX(dragStartRef.current.offsetX + dx);
        setOffsetY(dragStartRef.current.offsetY + dy);
        setHoveredItem(null);
        setMousePos(null);
        return;
      }

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const scale = Math.pow(2, zoom) * 80;
      const dx = x - width / 2 - offsetX;
      const dy = y - height / 2 - offsetY;
      setMousePos({
        lat: centerLat - dy / scale,
        lng: centerLng + dx / scale,
      });

      const hit = getHitItem(e.clientX, e.clientY);
      setHoveredItem(hit);
    },
    [zoom, offsetX, offsetY, centerLat, centerLng, getHitItem],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      (e.currentTarget as HTMLDivElement).classList.remove(styles.grabbing);

      const dx = Math.abs(e.clientX - dragStartRef.current.x);
      const dy = Math.abs(e.clientY - dragStartRef.current.y);

      if (dx < 3 && dy < 3) {
        const hit = getHitItem(e.clientX, e.clientY);

        if (hit) {
          if (hit.type === 'marker') {
            const marker = hit.data as MapMarker;
            setSelectedMarkerId(marker.audioId);
            setExpandedClusterId(null);
          } else if (hit.type === 'cluster') {
            const cluster = hit.data as DistrictCluster;
            setExpandedClusterId(
              expandedClusterId === cluster.id ? null : cluster.id,
            );
            setSelectedMarkerId(null);
          }
        } else {
          setSelectedMarkerId(null);
          setExpandedClusterId(null);
        }
      }
    },
    [getHitItem, expandedClusterId],
  );

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    setHoveredItem(null);
    setMousePos(null);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
    },
    [],
  );

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleModeDistrict = useCallback(() => {
    setViewMode('district');
    setHoveredItem(null);
    setSelectedMarkerId(null);
    setExpandedClusterId(null);
  }, []);

  const handleModeLines = useCallback(() => {
    setViewMode('lines');
    setHoveredItem(null);
    setSelectedMarkerId(null);
    setExpandedClusterId(null);
  }, []);

  return (
    <div className={styles.mapContainer} ref={containerRef}>
      <div
        className={`${styles.canvasWrapper} ${isDraggingRef.current ? styles.grabbing : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>

      <div className={styles.controls}>
        <div className={styles.zoomControls}>
          <button
            type="button"
            className={styles.zoomButton}
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label={t('common.zoomIn')}
          >
            <ZoomIn className={styles.zoomIcon} />
          </button>
          <button
            type="button"
            className={styles.zoomButton}
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label={t('common.zoomOut')}
          >
            <ZoomOut className={styles.zoomIcon} />
          </button>
        </div>

        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeButton} ${viewMode === 'district' ? styles.active : ''}`}
            onClick={handleModeDistrict}
          >
            <MapPin className={styles.modeIcon} />
            {t('map.aggregation')}
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${viewMode === 'lines' ? styles.active : ''}`}
            onClick={handleModeLines}
          >
            <GitBranch className={styles.modeIcon} />
            {t('map.lines')}
          </button>
        </div>
      </div>

      <div className={styles.infoPanel}>
        <div className={styles.statsCard}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t('map.markers')}</span>
            <span className={styles.statValue}>{validMarkers.length}</span>
          </div>
          {viewMode === 'district' && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>行政区</span>
              <span className={styles.statValue}>{districtClusters.length}</span>
            </div>
          )}
          {viewMode === 'lines' && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>线路</span>
              <span className={styles.statValue}>{lineRoutes.length}</span>
            </div>
          )}
          {noLocationRecordings.length > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>无坐标</span>
              <span className={styles.statValue} style={{ color: 'var(--color-warning)' }}>
                {noLocationRecordings.length}
              </span>
            </div>
          )}
        </div>

        {mousePos && (
          <div className={styles.coordsCard}>
            <div className={styles.coordItem}>
              <span className={styles.coordLabel}>Lat:</span>
              <span className={styles.coordValue}>{mousePos.lat.toFixed(4)}</span>
            </div>
            <div className={styles.coordItem}>
              <span className={styles.coordLabel}>Lng:</span>
              <span className={styles.coordValue}>{mousePos.lng.toFixed(4)}</span>
            </div>
          </div>
        )}

        {noLocationRecordings.length > 0 && (
          <div className={styles.noLocationCard}>
            <div className={styles.noLocationTitle}>
              <AlertTriangle className={styles.alertIcon} />
              {t('map.noLocation')}
            </div>
            <div className={styles.noLocationList}>
              {noLocationRecordings.slice(0, 3).map((r) => r.title).join('、')}
              {noLocationRecordings.length > 3 && ` 等 ${noLocationRecordings.length} 条`}
            </div>
          </div>
        )}
      </div>

      <div className={styles.zoomLevel}>
        {zoom.toFixed(2)}x
      </div>

      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} />
        </div>
      )}
    </div>
  );
};

export default MapView;
