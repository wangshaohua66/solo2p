import { useMemo, useState } from "react";
import {
  Volume2,
  VolumeX,
  Headphones,
  Trash2,
  GripVertical,
  Plus,
  Upload,
  Eye,
  EyeOff,
  Mic,
  Music,
  Radio,
  AlertCircle,
} from "lucide-react";
import { useProjectStore, validateAudioFile } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { WaveformCanvas } from "./WaveformCanvas";
import { formatTimeShort } from "@/utils/timeFormat";
import type { AudioTrack } from "@/types/audio";
import { MAX_TRACKS } from "@/types/audio";

interface TrackRowProps {
  track: AudioTrack;
  onRemove: (id: string) => void;
  onVolume: (id: string, v: number) => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onName: (id: string, name: string) => void;
  decodeFile: (f: File) => Promise<AudioBuffer>;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  updateTrack: (id: string, patch: Partial<AudioTrack>) => void;
  computeWaveform: (buf: AudioBuffer, samples: number) => number[];
  pxPerSec: number;
}

function TrackRow({
  track,
  onRemove,
  onVolume,
  onToggleMute,
  onToggleSolo,
  onName,
  decodeFile,
  setLoading,
  setError,
  updateTrack,
  computeWaveform,
  pxPerSec,
}: TrackRowProps) {
  const soloTrackIds = useProjectStore((s) => s.soloTrackIds);
  const isSoloed = soloTrackIds.has(track.id);
  const anySolo = soloTrackIds.size > 0;
  const dim = anySolo && !isSoloed;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const err = validateAudioFile(f);
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    try {
      const buf = await decodeFile(f);
      const wf = computeWaveform(buf, 2000);
      updateTrack(track.id, {
        name: f.name.replace(/\.[^.]+$/, ""),
        duration: buf.duration,
        waveformData: wf,
        src: f.name,
        segments: [{ id: crypto.randomUUID(), start: 0, duration: buf.duration, offset: 0 }],
      });
      setError(null);
    } catch (err) {
      setError("音频解码失败: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const categoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("主") || n.includes("主持") || n.includes("host")) return <Mic className="w-3 h-3" />;
    if (n.includes("嘉宾") || n.includes("voice") || n.includes("人声")) return <Radio className="w-3 h-3" />;
    if (n.includes("bgm") || n.includes("音乐") || n.includes("music")) return <Music className="w-3 h-3" />;
    return <Headphones className="w-3 h-3" />;
  };

  return (
    <div
      className={`group relative flex flex-col gap-2 p-3 rounded-xl border transition-all duration-200 animate-fade-in ${
        dim
          ? "bg-background-tertiary/30 border-border/40 opacity-50"
          : "bg-background-tertiary/70 border-border hover:border-border-hover hover:bg-background-tertiary"
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: track.color }}
    >
      <div className="flex items-center gap-2">
        <div className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/60 transition">
          <GripVertical className="w-4 h-4" />
        </div>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: track.color + "33", color: track.color }}
        >
          {categoryIcon(track.name)}
        </div>
        <input
          className="flex-1 bg-transparent outline-none text-sm font-medium text-white/90 border-b border-transparent focus:border-accent/50 transition"
          value={track.name}
          onChange={(e) => onName(track.id, e.target.value)}
        />
        <label className="btn-icon !w-7 !h-7" title="导入音频">
          <Upload className="w-3.5 h-3.5" />
          <input type="file" accept="audio/*" className="hidden" onChange={handleFile} />
        </label>
        <button
          className={`btn-icon !w-7 !h-7 ${isSoloed ? "!bg-warning-soft !text-warning" : ""}`}
          onClick={() => onToggleSolo(track.id)}
          title="独奏"
        >
          {isSoloed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          className={`btn-icon !w-7 !h-7 ${track.muted ? "!bg-accent-soft !text-accent" : ""}`}
          onClick={() => onToggleMute(track.id)}
          title={track.muted ? "取消静音" : "静音"}
        >
          {track.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        <button
          className="btn-icon !w-7 !h-7 opacity-0 group-hover:opacity-100 !text-accent/70 hover:!text-accent hover:!bg-accent-soft"
          onClick={() => onRemove(track.id)}
          title="删除轨道"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-16 rounded-lg overflow-hidden bg-black/30 border border-white/5">
        <WaveformCanvas
          track={track}
          width={320}
          height={64}
          pxPerSec={pxPerSec}
          scrollX={0}
          clickable={false}
          showPlayhead={false}
          showSelection={false}
          compact
        />
      </div>

      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-mono text-white/40 w-12 shrink-0">
          {Math.round(track.volume * 100)}%
        </span>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.01}
          value={track.volume}
          onChange={(e) => onVolume(track.id, Number(e.target.value))}
          className="slider"
        />
        <span className="text-xs font-mono text-white/40 ml-auto">
          {formatTimeShort(track.duration)}
        </span>
      </div>
    </div>
  );
}

interface TrackPanelProps {
  pxPerSec?: number;
}

export function TrackPanel({ pxPerSec = 80 }: TrackPanelProps) {
  const {
    project,
    addTrack,
    removeTrack,
    updateTrack,
    toggleMute,
    toggleSolo,
    setLoading,
    setError,
    activeTrackId,
    setActiveTrackId,
    reorderTracks,
  } = useProjectStore();

  const leftOpen = useEditorStore((s) => s.leftPanelOpen);
  const { decodeFile, computeWaveform } = useAudioEngine();

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sortedTracks = useMemo(
    () => [...project.tracks].sort((a, b) => a.order - b.order),
    [project.tracks]
  );

  void leftOpen;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleDragLeave = (id: string) => {
    if (dragOverId === id) setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragId ?? e.dataTransfer.getData("text/plain");
    setDragOverId(null);
    setDragId(null);
    if (!sourceId || sourceId === targetId) return;

    const orderedIds = sortedTracks.map((t) => t.id);
    const fromIdx = orderedIds.indexOf(sourceId);
    const toIdx = orderedIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    orderedIds.splice(fromIdx, 1);
    orderedIds.splice(toIdx, 0, sourceId);
    reorderTracks(orderedIds);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  return (
    <aside className="flex flex-col w-full h-full min-w-0 shrink-0 border-r border-border bg-background-secondary/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Headphones className="w-4 h-4 text-waveform-bar" />
          <span className="panel-title">音轨 ({project.tracks.length}/{MAX_TRACKS})</span>
        </div>
        <button
          className="btn-ghost !px-2 !py-1.5 gap-1 text-xs"
          onClick={() => addTrack()}
          disabled={project.tracks.length >= MAX_TRACKS}
        >
          <Plus className="w-3.5 h-3.5" />
          添加
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sortedTracks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-white/40 p-6">
            <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-4">
              <Headphones className="w-8 h-8 text-accent" />
            </div>
            <p className="text-sm font-medium text-white/70 mb-1">暂无音轨</p>
            <p className="text-xs mb-4">点击右上角「添加」创建第一条音轨</p>
            <button className="btn-primary text-sm" onClick={() => addTrack()}>
              <Plus className="w-4 h-4" />
              创建音轨
            </button>
          </div>
        )}

        {sortedTracks.map((t) => {
          const isDragging = dragId === t.id;
          const isDragOver = dragOverId === t.id && dragId !== t.id;
          return (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => handleDragStart(e, t.id)}
              onDragOver={(e) => handleDragOver(e, t.id)}
              onDragLeave={() => handleDragLeave(t.id)}
              onDrop={(e) => handleDrop(e, t.id)}
              onDragEnd={handleDragEnd}
              onClick={() => t.id !== activeTrackId && setActiveTrackId(t.id)}
              className={`transition-all duration-150 ${
                isDragging
                  ? "opacity-40 scale-[0.98]"
                  : isDragOver
                  ? "ring-2 ring-accent ring-offset-2 ring-offset-background-secondary scale-[1.01]"
                  : ""
              }`}
            >
              <TrackRow
                track={t}
                onRemove={removeTrack}
                onVolume={(id, v) => updateTrack(id, { volume: v })}
                onToggleMute={toggleMute}
                onToggleSolo={toggleSolo}
                onName={(id, name) => updateTrack(id, { name })}
                decodeFile={decodeFile}
                setLoading={setLoading}
                setError={setError}
                updateTrack={updateTrack}
                computeWaveform={computeWaveform}
                pxPerSec={pxPerSec}
              />
            </div>
          );
        })}
      </div>

      {useProjectStore.getState().error && (
        <div className="px-3 py-2 border-t border-border bg-accent-soft/40 flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-white/80">
            {useProjectStore.getState().error}
          </div>
          <button
            className="text-white/40 hover:text-white text-xs"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}
    </aside>
  );
}

export default TrackPanel;
