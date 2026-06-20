import { useEffect, useRef, useCallback } from "react";
import { renderWaveform2D, drawSelection, drawPlayhead } from "@/hooks/useWaveform";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import type { AudioTrack } from "@/types/audio";

interface WaveformCanvasProps {
  track: AudioTrack;
  width: number;
  height: number;
  pxPerSec: number;
  scrollX: number;
  onSeek?: (time: number) => void;
  onSelectionEnd?: () => void;
  clickable?: boolean;
  showPlayhead?: boolean;
  showSelection?: boolean;
  compact?: boolean;
}

export function WaveformCanvas({
  track,
  width,
  height,
  pxPerSec,
  scrollX,
  onSeek,
  onSelectionEnd,
  clickable = true,
  showPlayhead = true,
  showSelection = true,
  compact = false,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentTime = useProjectStore((s) => s.currentTime);
  const zoom = useProjectStore((s) => s.zoom);
  const selection = useEditorStore((s) => s.selection);
  const startSelection = useEditorStore((s) => s.startSelection);
  const updateSelectionEnd = useEditorStore((s) => s.updateSelectionEnd);
  const setIsSelecting = useEditorStore((s) => s.setIsSelecting);
  const setSelectStart = useEditorStore((s) => s.setSelectStart);
  const activeTrackId = useProjectStore((s) => s.activeTrackId);
  const setActiveTrackId = useProjectStore((s) => s.setActiveTrackId);

  const isActive = activeTrackId === track.id;

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const isMuted = track.muted;
    const peaks = track.waveformData ?? [];
    const duration = Math.max(0.1, track.duration);
    const totalPx = duration * pxPerSec;

    if (peaks.length > 0 && totalPx > 0) {
      const startSample = Math.max(
        0,
        Math.floor((scrollX / totalPx) * peaks.length)
      );
      const visibleSamples = Math.min(
        peaks.length - startSample,
        Math.ceil((width / totalPx) * peaks.length) + 2
      );
      const visiblePeaks: number[] = [];
      for (let i = 0; i < visibleSamples; i++) {
        visiblePeaks.push(peaks[startSample + i] ?? 0);
      }
      const scale = Math.max(1, Math.floor(visiblePeaks.length / Math.max(1, width / 2)));
      const downPeaks: number[] = [];
      for (let i = 0; i < visiblePeaks.length; i += scale) {
        let m = 0;
        for (let j = 0; j < scale && i + j < visiblePeaks.length; j++) {
          if (visiblePeaks[i + j] > m) m = visiblePeaks[i + j];
        }
        downPeaks.push(m);
      }
      const gradEnd = track.color;
      const gradStart = isMuted ? "#475569" : track.color;
      renderWaveform2D(ctx, downPeaks, width, height, {
        gradientColors: isMuted
          ? ["#475569", "#334155"]
          : [gradStart, gradEnd + "88"],
        barWidth: compact ? 1 : 2,
        barGap: 1,
        center: true,
        mirror: true,
        rounded: !compact,
      });
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let x = 0; x < width; x += 4) {
        const h = Math.max(1, Math.random() * height * 0.4);
        ctx.fillRect(x, height / 2 - h / 2, 2, h);
      }
    }

    if (isActive && !compact) {
      ctx.strokeStyle = "rgba(233,69,96,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);
    }

    if (showSelection && selection && (selection.activeTrackId === track.id || !selection.activeTrackId)) {
      const x1 = selection.start * pxPerSec - scrollX;
      const x2 = selection.end * pxPerSec - scrollX;
      drawSelection(ctx, x1, x2, height);
    }

    if (showPlayhead) {
      const px = currentTime * pxPerSec - scrollX;
      if (px >= -10 && px <= width + 10) {
        drawPlayhead(ctx, px, height);
      }
    }
  }, [
    track,
    width,
    height,
    pxPerSec,
    scrollX,
    currentTime,
    selection,
    isActive,
    showPlayhead,
    showSelection,
    compact,
    zoom,
  ]);

  useEffect(() => {
    const id = requestAnimationFrame(render);
    return () => cancelAnimationFrame(id);
  }, [render]);

  const timeFromX = useCallback(
    (clientX: number): number => {
      const el = containerRef.current ?? canvasRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      return (x + scrollX) / pxPerSec;
    },
    [pxPerSec, scrollX]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!clickable) return;
      e.stopPropagation();
      setActiveTrackId(track.id);
      if (e.shiftKey || e.button === 2 || e.altKey) {
        startSelection(timeFromX(e.clientX), track.id);
      } else {
        onSeek?.(timeFromX(e.clientX));
      }
    },
    [clickable, track.id, setActiveTrackId, timeFromX, startSelection, onSeek]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const state = useEditorStore.getState();
      if (!state.isSelecting) return;
      updateSelectionEnd(timeFromX(e.clientX));
    },
    [timeFromX, updateSelectionEnd]
  );

  const handleMouseUp = useCallback(() => {
    const state = useEditorStore.getState();
    if (state.isSelecting) {
      setIsSelecting(false);
      setSelectStart(null);
      onSelectionEnd?.();
    }
  }, [setIsSelecting, setSelectStart, onSelectionEnd]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${clickable ? "cursor-pointer" : "cursor-default"} select-none ${
        isActive ? "bg-accent-soft/20" : ""
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

export default WaveformCanvas;
