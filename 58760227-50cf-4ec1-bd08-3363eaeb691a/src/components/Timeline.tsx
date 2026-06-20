import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { drawRuler } from "@/hooks/useWaveform";
import { WaveformCanvas } from "./WaveformCanvas";
import { generateTimeTicks } from "@/utils/timeFormat";
import type { AudioTrack } from "@/types/audio";

interface TimelineProps {
  pxPerSec?: number;
  onSeek?: (time: number) => void;
  onPlayPreview?: (start: number, end: number) => void;
}

export function Timeline({ pxPerSec: propsPxPerSec, onSeek: propsOnSeek, onPlayPreview: _onPlayPreview }: TimelineProps) {
  const { project, scrollX, setScrollX, currentTime, zoom, setZoom, setCurrentTime } = useProjectStore();
  const { showMinimap, clearSelection } = useEditorStore();
  const { playPreview } = useAudioEngine();

  const pxPerSec = propsPxPerSec ?? (80 * zoom);
  const onSeek = propsOnSeek ?? ((t: number) => setCurrentTime(t));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 1200, h: 540 });
  const [trackHeights, setTrackHeights] = useState(120);

  const sortedTracks = useMemo(
    () => [...project.tracks].sort((a, b) => a.order - b.order),
    [project.tracks]
  );

  const singleTrackMode = useEditorStore((s) => s.singleTrackMode);
  const activeTrackId = useProjectStore((s) => s.activeTrackId);

  const visibleTracks = useMemo(() => {
    if (!singleTrackMode) return sortedTracks;
    const active = sortedTracks.find((t) => t.id === activeTrackId);
    return active ? [active] : sortedTracks.slice(0, 1);
  }, [sortedTracks, singleTrackMode, activeTrackId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({
          w: Math.max(400, Math.floor(e.contentRect.width)),
          h: Math.max(300, Math.floor(e.contentRect.height)),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (visibleTracks.length === 0) return;
    setTrackHeights(Math.max(80, Math.floor((size.h - 60) / visibleTracks.length)));
  }, [visibleTracks.length, size.h]);

  const ticks = useMemo(
    () => generateTimeTicks(project.duration, pxPerSec),
    [project.duration, pxPerSec]
  );

  useEffect(() => {
    const canvas = rulerRef.current;
    if (!canvas || size.w <= 0) return;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    canvas.width = size.w * dpr;
    canvas.height = 36 * dpr;
    canvas.style.width = size.w + "px";
    canvas.style.height = "36px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRuler(ctx, size.w, 36, ticks, pxPerSec, scrollX);
  }, [size.w, ticks, pxPerSec, scrollX]);

  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas || size.w <= 0 || !showMinimap) return;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const h = 60;
    const w = Math.min(360, size.w - 32);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "rgba(15,52,96,0.85)";
    ctx.fillRect(0, 0, w, h);
    if (sortedTracks.length > 0 && project.duration > 0) {
      const bandH = Math.max(4, h / sortedTracks.length - 2);
      sortedTracks.forEach((t, idx) => {
        const peaks = t.waveformData ?? [];
        if (peaks.length === 0) return;
        const y = idx * (bandH + 2) + 2;
        const step = Math.max(1, Math.floor(peaks.length / w));
        ctx.fillStyle = t.color + "aa";
        for (let i = 0; i < w; i++) {
          let m = 0;
          const si = i * step;
          for (let j = 0; j < step && si + j < peaks.length; j++) {
            if (peaks[si + j] > m) m = peaks[si + j];
          }
          const bh = Math.max(1, m * bandH * 0.9);
          ctx.fillRect(i, y + (bandH - bh) / 2, 1, bh);
        }
      });
      const viewStart = (scrollX / (project.duration * pxPerSec)) * w;
      const viewW = (size.w / (project.duration * pxPerSec)) * w;
      ctx.strokeStyle = "#e94560";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(233,69,96,0.2)";
      ctx.fillRect(viewStart, 0, viewW, h);
      ctx.strokeRect(viewStart + 1, 1, viewW - 2, h - 2);
      const playPx = (currentTime / project.duration) * w;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playPx, 0);
      ctx.lineTo(playPx, h);
      ctx.stroke();
    }
  }, [sortedTracks, size.w, project.duration, scrollX, pxPerSec, currentTime, showMinimap]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.005;
        setZoom(Math.max(0.2, Math.min(20, zoom + delta)));
      } else {
        setScrollX(Math.max(0, scrollX + e.deltaY * 0.8));
      }
    },
    [zoom, setZoom, scrollX, setScrollX]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      clearSelection();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = Math.max(0, (x + scrollX) / pxPerSec);
      if (e.shiftKey) {
        playPreview(Math.max(0, t - 2), Math.min(project.duration, t + 2));
      } else {
        onSeek(t);
      }
    },
    [scrollX, pxPerSec, clearSelection, onSeek, playPreview, project.duration]
  );

  const handleMinimapClick = useCallback(
    (e: React.MouseEvent) => {
      const el = minimapRef.current;
      if (!el || project.duration <= 0) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = (x / rect.width) * project.duration;
      onSeek(t);
      const maxScroll = Math.max(0, project.duration * pxPerSec - size.w);
      setScrollX(Math.max(0, Math.min(maxScroll, t * pxPerSec - size.w / 2)));
    },
    [project.duration, size.w, pxPerSec, onSeek, setScrollX]
  );

  const totalWidth = Math.ceil(project.duration * pxPerSec);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-w-0 flex flex-col bg-background overflow-hidden"
      onWheel={onWheel}
    >
      <div className="relative shrink-0 border-b border-border z-10" onClick={handleTimelineClick}>
        <canvas ref={rulerRef} className="block" />
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: totalWidth + "px" }}
          onClick={handleTimelineClick}
        >
          {visibleTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent-soft to-waveform-selection flex items-center justify-center mb-6 border border-border">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-12 h-12 text-accent"
                >
                  <path d="M3 12h3l3-9 4 18 3-9h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white/90 mb-2">开始创建你的播客节目</h3>
              <p className="text-sm text-white/50 max-w-md mb-6">
                在左侧「音轨」面板添加主持人、嘉宾、背景音乐等轨道，
                导入音频素材后即可在此查看对齐的多轨波形并进行编辑。
              </p>
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                {[
                  "🎙️ 多轨并行编辑",
                  "📝 自动语音转录",
                  "✅ 批注审核协作",
                  "🏷️ 章节标记导出",
                ].map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1.5 rounded-full bg-background-secondary border border-border text-white/60"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {visibleTracks.map((t: AudioTrack, i: number) => (
                <div
                  key={t.id}
                  className="relative border-b border-border/40 flex items-center"
                  style={{ height: trackHeights + "px" }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-14 bg-background-secondary/80 border-r border-border flex flex-col items-center justify-center gap-1 shrink-0 z-10 backdrop-blur-sm"
                    style={{ transform: `translateX(${-scrollX}px)` }}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: t.color + "40", color: t.color }}
                    >
                      {i + 1}
                    </div>
                  </div>
                  <div
                    className="flex-1 h-full relative"
                    style={{ marginLeft: "56px" }}
                  >
                    <WaveformCanvas
                      track={t}
                      width={Math.max(0, size.w - 56)}
                      height={trackHeights}
                      pxPerSec={pxPerSec}
                      scrollX={scrollX}
                      onSeek={onSeek}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {project.markers.length > 0 && (
          <div className="pointer-events-none absolute top-9 left-0 right-0 h-4 z-20">
            {project.markers.map((m) => {
              const x = m.time * pxPerSec - scrollX + 56;
              if (x < -20 || x > size.w + 20) return null;
              return (
                <div
                  key={m.id}
                  className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                  style={{ left: x + "px" }}
                  title={`${m.title}  (${Math.floor(m.time / 60)}:${String(Math.floor(m.time % 60)).padStart(2, "0")})`}
                >
                  <div
                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap shadow-lg"
                    style={{ background: m.color ?? "#e94560" }}
                  >
                    {m.title}
                  </div>
                  <div
                    className="w-0.5 h-3"
                    style={{ background: m.color ?? "#e94560" }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {showMinimap && sortedTracks.length > 0 && (
          <div className="absolute right-4 bottom-4 panel p-2 animate-fade-in cursor-pointer shadow-2xl">
            <div className="text-[10px] text-white/40 mb-1 px-1 font-medium">小地图导航</div>
            <canvas ref={minimapRef} onClick={handleMinimapClick} className="rounded-md block" />
          </div>
        )}
      </div>
    </div>
  );
}

export default Timeline;
