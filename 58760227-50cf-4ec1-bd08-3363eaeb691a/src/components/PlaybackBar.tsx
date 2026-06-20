import { useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GripHorizontal,
  StopCircle,
} from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { formatTime } from "@/utils/timeFormat";

export function PlaybackBar() {
  const {
    isPlaying,
    currentTime,
    setCurrentTime,
    project,
    zoom,
    setZoom,
    setScrollX,
  } = useProjectStore();

  const { showMinimap, setShowMinimap } = useEditorStore();
  const { play, pause, stop, seek, resume } = useAudioEngine();
  const progressRef = useRef<HTMLDivElement | null>(null);

  const togglePlay = useCallback(async () => {
    await resume();
    if (isPlaying) pause();
    else await play();
  }, [isPlaying, play, pause, resume]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent) => {
      const el = progressRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const t = ratio * project.duration;
      seek(t);
    },
    [project.duration, seek]
  );

  const progress = project.duration > 0 ? (currentTime / project.duration) * 100 : 0;

  return (
    <footer className="h-16 shrink-0 border-t border-border bg-background-secondary/90 backdrop-blur-xl flex items-center px-4 gap-4">
      <div className="flex items-center gap-2 shrink-0">
        <button
          className="btn-icon !w-9 !h-9"
          onClick={() => {
            const t = Math.max(0, currentTime - 10);
            seek(t);
          }}
          title="后退10秒"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={togglePlay}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isPlaying
              ? "bg-white text-background hover:scale-105 shadow-white/20"
              : "bg-accent hover:bg-accent-hover text-white hover:scale-105 shadow-glow-accent"
          }`}
          title={isPlaying ? "暂停 (Space)" : "播放 (Space)"}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>
        <button
          className="btn-icon !w-9 !h-9"
          onClick={() => {
            const t = Math.min(project.duration, currentTime + 10);
            seek(t);
          }}
          title="前进10秒"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        <button
          className="btn-icon !w-8 !h-8 !text-accent/80 ml-1"
          onClick={stop}
          title="停止并回到开头"
        >
          <StopCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 min-w-[180px] shrink-0 font-mono">
        <div className="text-[13px] text-white font-semibold w-[92px] text-right tabular-nums">
          {formatTime(currentTime)}
        </div>
        <GripHorizontal className="w-3 h-3 text-white/20" />
        <div className="text-[13px] text-white/50 w-[92px] tabular-nums">
          {formatTime(project.duration)}
        </div>
      </div>

      <div
        ref={progressRef}
        className="flex-1 group h-8 flex items-center cursor-pointer relative"
        onClick={handleProgressClick}
      >
        <div className="w-full h-2 rounded-full bg-white/5 group-hover:bg-white/10 transition overflow-hidden relative">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent-hover shadow-[0_0_12px_rgba(233,69,96,0.5)] transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
          {project.markers.map((m) => {
            const p = (m.time / project.duration) * 100;
            if (p < 0 || p > 100) return null;
            return (
              <div
                key={m.id}
                className="absolute top-0 bottom-0 w-0.5 hover:w-1 transition-all"
                style={{
                  left: `${p}%`,
                  background: m.color ?? "#ffd166",
                  boxShadow: `0 0 6px ${m.color ?? "#ffd166"}`,
                }}
                title={`${m.title} - ${formatTime(m.time)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  seek(m.time);
                }}
              />
            );
          })}
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-black/50 transition-[left] duration-75 group-hover:scale-125"
          style={{
            left: `calc(${progress}% - 8px)`,
            background: isPlaying ? "#e94560" : "white",
          }}
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden lg:flex items-center gap-2 px-2 py-1 rounded-lg bg-background-tertiary/40 border border-border/60">
          <button
            className="btn-icon !w-7 !h-7"
            onClick={() => setZoom(Math.max(0.2, zoom - 0.5))}
            title="缩小时间轴"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="w-20 relative">
            <input
              type="range"
              min={0.2}
              max={15}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="slider"
            />
          </div>
          <button
            className="btn-icon !w-7 !h-7"
            onClick={() => setZoom(Math.min(15, zoom + 0.5))}
            title="放大时间轴"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-white/50 w-8 text-right tabular-nums">
            {zoom.toFixed(1)}×
          </span>
        </div>
      </div>

      <div className="w-px h-6 bg-border shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        <button
          className="btn-icon !w-8 !h-8"
          onClick={() => setShowMinimap(!showMinimap)}
          title={showMinimap ? "隐藏小地图" : "显示小地图"}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0 pl-1">
        <VolumeIndicator />
      </div>
    </footer>
  );
}

function VolumeIndicator() {
  const { isPlaying } = useProjectStore();
  const bars = 5;
  const seed = useRef(Math.random());
  return (
    <div className="flex items-end gap-0.5 h-6 w-8 opacity-60 group-hover:opacity-100 transition">
      {Array.from({ length: bars }).map((_, i) => {
        const baseH = 20 + ((i * 17 + Math.floor(seed.current * 50)) % 80);
        const h = isPlaying
          ? `${baseH + ((Date.now() / 80 + i * 37) % 100) * 0.4}%`
          : `${baseH * 0.4}%`;
        return (
          <div
            key={i}
            className="w-1 rounded-full transition-all"
            style={{
              height: h,
              background: isPlaying
                ? "linear-gradient(to top, #4facfe, #06d6a0)"
                : "rgba(255,255,255,0.2)",
              minHeight: 3,
              alignSelf: "flex-end",
            }}
          />
        );
      })}
      {!isPlaying && <VolumeX className="w-0 h-0" />}
      {isPlaying && <Volume2 className="w-0 h-0" />}
    </div>
  );
}

export default PlaybackBar;
