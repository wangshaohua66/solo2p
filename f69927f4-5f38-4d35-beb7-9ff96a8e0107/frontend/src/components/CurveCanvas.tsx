import { useRef, useEffect, useCallback } from 'react';
import type { CurveSegment, CurvePhase } from '@/types';

const PHASE_COLORS: Record<CurvePhase, string> = {
  HEAT_UP: '#E8602C',
  HOLD: '#3B6FA0',
  COOL_DOWN: '#52C41A',
};

const PHASE_LABELS: Record<CurvePhase, string> = {
  HEAT_UP: '升温',
  HOLD: '保温',
  COOL_DOWN: '降温',
};

const PADDING = { left: 60, right: 40, top: 40, bottom: 60 };
const MAX_TEMP = 1200;
const MIN_TEMP = 20;

export function calcSlope(segment: CurveSegment, prevTemp: number): number {
  if (segment.phase === 'HOLD') return 0;
  return Math.abs(segment.targetTemp - prevTemp) / segment.duration;
}

export function getPointTemps(segments: CurveSegment[]): number[] {
  const temps: number[] = [20];
  for (const seg of segments) temps.push(seg.targetTemp);
  return temps;
}

export function getPointTimes(segments: CurveSegment[]): number[] {
  const times: number[] = [0];
  let t = 0;
  for (const seg of segments) { t += seg.duration; times.push(t); }
  return times;
}

interface CurveCanvasProps {
  segments: CurveSegment[];
  selectedSegmentIndex: number | null;
  zoomLevel: number;
  hoverInfo: { x: number; y: number; temp: number; time: number } | null;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
  onDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
}

export default function CurveCanvas({
  segments,
  selectedSegmentIndex,
  zoomLevel,
  hoverInfo,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  onDoubleClick,
  onWheel,
}: CurveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  const pointTemps = getPointTemps(segments);
  const pointTimes = getPointTimes(segments);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const chartW = width - PADDING.left - PADDING.right;
    const chartH = height - PADDING.top - PADDING.bottom;
    const maxTime = Math.max(totalDuration * zoomLevel, 60);

    const timeToX = (t: number) => PADDING.left + (t / maxTime) * chartW;
    const tempToY = (temp: number) =>
      PADDING.top + chartH - ((temp - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)) * chartH;

    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let temp = 0; temp <= MAX_TEMP; temp += 100) {
      if (temp < MIN_TEMP) continue;
      const y = tempToY(temp);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(width - PADDING.right, y);
      ctx.stroke();
      ctx.fillText(`${temp}°C`, PADDING.left - 8, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let t = 0; t <= maxTime; t += 30) {
      const x = timeToX(t);
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, height - PADDING.bottom);
      ctx.stroke();
      ctx.fillText(`${t}min`, x, height - PADDING.bottom + 8);
    }

    if (segments.length === 0) return;

    let prevTemp = 20;
    let currTime = 0;
    segments.forEach((seg, idx) => {
      const x1 = timeToX(currTime);
      const y1 = tempToY(prevTemp);
      const x2 = timeToX(currTime + seg.duration);
      const y2 = tempToY(seg.targetTemp);

      const slope = calcSlope(seg, prevTemp);
      const exceeds = seg.phase !== 'HOLD' && slope > seg.maxSlope;
      const color = exceeds ? '#FF4D4F' : PHASE_COLORS[seg.phase];

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.fillStyle = color;
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(PHASE_LABELS[seg.phase], midX, midY - 6);

      if (idx === selectedSegmentIndex) {
        ctx.strokeStyle = PHASE_COLORS[seg.phase];
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, PADDING.top);
        ctx.lineTo(x1, height - PADDING.bottom);
        ctx.moveTo(x2, PADDING.top);
        ctx.lineTo(x2, height - PADDING.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (exceeds) {
        ctx.fillStyle = '#FF4D4F';
        ctx.beginPath();
        ctx.arc(midX, midY - 20, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', midX, midY - 20);
      }

      currTime += seg.duration;
      prevTemp = seg.targetTemp;
    });

    pointTemps.forEach((temp, i) => {
      const x = timeToX(pointTimes[i]);
      const y = tempToY(temp);
      ctx.fillStyle = i === 0 ? '#999' : PHASE_COLORS[segments[i - 1]?.phase || 'HEAT_UP'];
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    if (hoverInfo) {
      const hx = timeToX(hoverInfo.time);
      const hy = tempToY(hoverInfo.temp);
      ctx.strokeStyle = '#E8602C';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hx, PADDING.top);
      ctx.lineTo(hx, height - PADDING.bottom);
      ctx.moveTo(PADDING.left, hy);
      ctx.lineTo(width - PADDING.right, hy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [segments, pointTemps, pointTimes, totalDuration, zoomLevel, hoverInfo, selectedSegmentIndex]);

  useEffect(() => {
    drawCanvas();
    const handleResize = () => drawCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
      />
    </div>
  );
}

export { PADDING, MAX_TEMP, MIN_TEMP, PHASE_COLORS, PHASE_LABELS };
