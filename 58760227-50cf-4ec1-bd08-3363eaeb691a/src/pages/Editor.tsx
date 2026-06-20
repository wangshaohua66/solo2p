import { useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import TrackPanel from "@/components/TrackPanel";
import Timeline from "@/components/Timeline";
import MarkerPanel from "@/components/MarkerPanel";
import PlaybackBar from "@/components/PlaybackBar";
import { useProjectStore, validateAudioFile } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useBreakpoint } from "@/hooks/useMediaQuery";
import { loadProject } from "@/utils/idbStorage";
import { AUTO_SAVE_INTERVAL } from "@/types/audio";
import { debounce } from "@/utils/idbStorage";
import {
  sliceAudioBuffer,
  mergeAudioBuffers,
  waveformDataToAudioBuffer,
  bufferToWaveformData,
  extractWaveformRegion,
  removeWaveformRegion,
  insertWaveformRegion,
  uuid,
} from "@/utils/audioProcessor";

export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const initializedRef = useRef(false);

  const { isMobile, isTablet, singleTrackMode } = useBreakpoint();

  const project = useProjectStore((s) => s.project);
  const tracks = useProjectStore((s) => s.project.tracks);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const currentTime = useProjectStore((s) => s.currentTime);
  const setProject = useProjectStore((s) => s.setProject);
  const addTrack = useProjectStore((s) => s.addTrack);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const persist = useProjectStore((s) => s.persist);
  const setError = useProjectStore((s) => s.setError);

  const selection = useEditorStore((s) => s.selection);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const leftPanelOpen = useEditorStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const setLeftPanelOpen = useEditorStore((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useEditorStore((s) => s.setRightPanelOpen);
  const setSingleTrackMode = useEditorStore((s) => s.setSingleTrackMode);
  const leftDrawerOpen = useEditorStore((s) => s.leftDrawerOpen);
  const rightDrawerOpen = useEditorStore((s) => s.rightDrawerOpen);
  const setLeftDrawerOpen = useEditorStore((s) => s.setLeftDrawerOpen);
  const setRightDrawerOpen = useEditorStore((s) => s.setRightDrawerOpen);
  const setSelection = useEditorStore((s) => s.setSelection);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const engine = useAudioEngine();

  useEffect(() => {
    setSingleTrackMode(singleTrackMode);
  }, [singleTrackMode, setSingleTrackMode]);

  useEffect(() => {
    if (isMobile) {
      setLeftPanelOpen(false);
      setRightPanelOpen(false);
    } else if (isTablet) {
      setLeftPanelOpen(false);
      setRightPanelOpen(false);
    } else {
      setLeftPanelOpen(true);
      setRightPanelOpen(true);
      setLeftDrawerOpen(false);
      setRightDrawerOpen(false);
    }
  }, [isMobile, isTablet, setLeftPanelOpen, setRightPanelOpen, setLeftDrawerOpen, setRightDrawerOpen]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    (async () => {
      if (projectId && projectId !== "new") {
        try {
          const loaded = await loadProject(projectId);
          if (loaded) {
            setProject(loaded);
            if (loaded.tracks.length === 0) {
              setTimeout(() => {
                addTrack({ name: "主持人主声道", duration: 2700 });
                addTrack({ name: "嘉宾声道", duration: 2700 });
                addTrack({ name: "背景音乐轨", duration: 2700 });
                addTrack({ name: "音效轨", duration: 2700 });
              }, 0);
            }
            return;
          }
        } catch {
          /* ignore */
        }
      }
      addTrack({ name: "主持人主声道", duration: 2700 });
      addTrack({ name: "嘉宾声道", duration: 2700 });
      addTrack({ name: "背景音乐轨", duration: 2700 });
      addTrack({ name: "音效轨", duration: 2700 });
    })();
  }, [projectId, setProject, addTrack]);

  const debouncedPersist = useCallback(
    debounce(() => {
      persist().catch(() => {});
    }, AUTO_SAVE_INTERVAL),
    [persist]
  );

  useEffect(() => {
    if (tracks.length > 0) {
      debouncedPersist();
    }
  }, [
    project.name,
    project.tracks.length,
    project.markers.length,
    project.comments.length,
    project.transcripts.length,
    debouncedPersist,
    tracks.length,
  ]);

  const togglePlay = useCallback(async () => {
    try {
      await engine.resume();
    } catch {
      /* ignore */
    }
    if (isPlaying) {
      engine.pause();
    } else {
      await engine.play();
    }
  }, [engine, isPlaying]);

  const handleSeek = useCallback(
    (t: number) => {
      engine.seek(t);
    },
    [engine]
  );

  const handleImportAudioFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      for (const file of fileArr) {
        const err = validateAudioFile(file);
        if (err) {
          setError(err);
          continue;
        }
        try {
          const buffer = await engine.decodeFile(file);
          const waveformData = engine.computeWaveform(buffer, 1200);
          const duration = buffer.duration;
          const prevState = JSON.stringify(tracks.map((t) => ({ id: t.id, name: t.name })));
          const track = addTrack({
            name: file.name.replace(/\.[^.]+$/, ""),
            duration,
            waveformData,
          });
          if (track) {
            const nextState = JSON.stringify([...tracks, { id: track.id, name: track.name }]);
            pushHistory("add_track", prevState, nextState);
            updateTrack(track.id, {
              segments: [
                {
                  id: track.id + "-seg",
                  start: 0,
                  duration,
                  offset: 0,
                },
              ],
            });
          }
        } catch (e) {
          setError("音频解码失败: " + (e instanceof Error ? e.message : String(e)));
        }
      }
    },
    [engine, tracks, addTrack, updateTrack, pushHistory, setError]
  );

  const handleCut = useCallback(() => {
    if (!selection) return;
    const trackId = selection.activeTrackId;
    const targetTrack = trackId
      ? tracks.find((t) => t.id === trackId)
      : tracks[0];
    if (!targetTrack) return;

    const start = selection.start;
    const end = selection.end;
    const regionDur = Math.max(0.001, end - start);
    const prevState = JSON.stringify({
      trackId: targetTrack.id,
      waveformData: targetTrack.waveformData,
      segments: targetTrack.segments,
      duration: targetTrack.duration,
    });

    const peaks = targetTrack.waveformData ?? [];
    let clipboardPeaks: number[] = [];

    try {
      const ctx = engine.audioContext ?? new AudioContext();
      const srcBuffer = waveformDataToAudioBuffer(
        peaks,
        ctx,
        targetTrack.duration,
        project.sampleRate
      );
      const sliced = sliceAudioBuffer(srcBuffer, start, end, ctx);
      clipboardPeaks = bufferToWaveformData(sliced, Math.max(8, Math.floor((regionDur / targetTrack.duration) * peaks.length)));

      const before = sliceAudioBuffer(srcBuffer, 0, start, ctx);
      const after = sliceAudioBuffer(srcBuffer, end, targetTrack.duration, ctx);
      const merged = mergeAudioBuffers([before, after], ctx, 0);
      const newPeaks = bufferToWaveformData(merged, Math.max(64, peaks.length - clipboardPeaks.length));
      const newDur = merged.duration;

      const newSegments = targetTrack.segments
        .map((seg) => {
          const segEnd = seg.start + seg.duration;
          if (segEnd <= start || seg.start >= end) {
            return seg.start >= end
              ? { ...seg, start: seg.start - regionDur }
              : seg;
          }
          if (seg.start < start && segEnd > end) {
            return [
              { ...seg, duration: start - seg.start },
              {
                id: uuid(),
                start: start,
                duration: segEnd - end,
                offset: seg.offset + (end - seg.start),
              },
            ];
          }
          if (seg.start < start) {
            return { ...seg, duration: start - seg.start };
          }
          return null;
        })
        .flat()
        .filter(Boolean) as typeof targetTrack.segments;

      updateTrack(targetTrack.id, {
        waveformData: newPeaks,
        duration: newDur,
        segments: newSegments.length > 0 ? newSegments : [{ id: uuid(), start: 0, duration: newDur, offset: 0 }],
      });

      useProjectStore.getState().setClipboard({
        start,
        end,
        trackId: targetTrack.id,
        timestamp: Date.now(),
        waveformData: clipboardPeaks,
        regionDuration: regionDur,
      });
      setSelection(null);
      pushHistory("cut_selection", prevState, JSON.stringify({ trackId: targetTrack.id }));
    } catch (e) {
      setError("剪切失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [selection, tracks, project.sampleRate, engine, updateTrack, setSelection, pushHistory, setError]);

  const handleCopy = useCallback(() => {
    if (!selection) return;
    const trackId = selection.activeTrackId;
    const targetTrack = trackId
      ? tracks.find((t) => t.id === trackId)
      : tracks[0];
    if (!targetTrack) return;

    const start = selection.start;
    const end = selection.end;
    const regionDur = Math.max(0.001, end - start);
    const peaks = targetTrack.waveformData ?? [];
    let clipboardPeaks: number[] = [];

    try {
      const ctx = engine.audioContext ?? new AudioContext();
      const srcBuffer = waveformDataToAudioBuffer(
        peaks,
        ctx,
        targetTrack.duration,
        project.sampleRate
      );
      const sliced = sliceAudioBuffer(srcBuffer, start, end, ctx);
      clipboardPeaks = bufferToWaveformData(sliced, Math.max(8, Math.floor((regionDur / targetTrack.duration) * peaks.length)));
    } catch {
      clipboardPeaks = extractWaveformRegion(peaks, start, end, targetTrack.duration);
    }

    useProjectStore.getState().setClipboard({
      start,
      end,
      trackId: targetTrack.id,
      timestamp: Date.now(),
      waveformData: clipboardPeaks,
      regionDuration: regionDur,
    });
  }, [selection, tracks, project.sampleRate, engine]);

  const handlePaste = useCallback(() => {
    const cb = useProjectStore.getState().clipboard;
    if (!cb || !cb.waveformData || cb.waveformData.length === 0) return;
    const trackId = cb.trackId ?? tracks[0]?.id;
    const targetTrack = tracks.find((t) => t.id === trackId) ?? tracks[0];
    if (!targetTrack) return;

    const insertAt = currentTime;
    const prevState = JSON.stringify({
      trackId: targetTrack.id,
      waveformData: targetTrack.waveformData,
      segments: targetTrack.segments,
      duration: targetTrack.duration,
    });

    const peaks = targetTrack.waveformData ?? [];
    const insertPeaks = cb.waveformData;
    const newDur = targetTrack.duration + cb.regionDuration;

    try {
      const newPeaks = insertWaveformRegion(peaks, insertPeaks, insertAt, targetTrack.duration);
      const normalizedPeaks =
        newPeaks.length > peaks.length
          ? newPeaks.slice(0, Math.max(newPeaks.length, peaks.length + insertPeaks.length))
          : newPeaks;

      const newSegments: typeof targetTrack.segments = [];
      for (const seg of targetTrack.segments) {
        const segEnd = seg.start + seg.duration;
        if (seg.start >= insertAt) {
          newSegments.push({ ...seg, start: seg.start + cb.regionDuration });
        } else if (segEnd <= insertAt) {
          newSegments.push(seg);
        } else {
          newSegments.push({ ...seg, duration: insertAt - seg.start });
          newSegments.push({
            id: uuid(),
            start: insertAt + cb.regionDuration,
            duration: segEnd - insertAt,
            offset: seg.offset + (insertAt - seg.start),
          });
        }
      }
      newSegments.push({
        id: uuid(),
        start: insertAt,
        duration: cb.regionDuration,
        offset: 0,
      });
      newSegments.sort((a, b) => a.start - b.start);

      updateTrack(targetTrack.id, {
        waveformData: normalizedPeaks,
        duration: newDur,
        segments: newSegments,
      });
      pushHistory("paste_selection", prevState, JSON.stringify({ trackId: targetTrack.id }));
    } catch (e) {
      setError("粘贴失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [currentTime, tracks, updateTrack, pushHistory, setError]);

  const handleDelete = useCallback(() => {
    if (!selection) return;
    const trackId = selection.activeTrackId;
    const targetTrack = trackId
      ? tracks.find((t) => t.id === trackId)
      : tracks[0];
    if (!targetTrack) return;

    const start = selection.start;
    const end = selection.end;
    const regionDur = Math.max(0.001, end - start);
    const prevState = JSON.stringify({
      trackId: targetTrack.id,
      waveformData: targetTrack.waveformData,
      segments: targetTrack.segments,
      duration: targetTrack.duration,
    });

    const peaks = targetTrack.waveformData ?? [];

    try {
      const ctx = engine.audioContext ?? new AudioContext();
      const srcBuffer = waveformDataToAudioBuffer(
        peaks,
        ctx,
        targetTrack.duration,
        project.sampleRate
      );
      const before = sliceAudioBuffer(srcBuffer, 0, start, ctx);
      const after = sliceAudioBuffer(srcBuffer, end, targetTrack.duration, ctx);
      const merged = mergeAudioBuffers([before, after], ctx, 0);
      const newPeaks = bufferToWaveformData(merged, Math.max(64, peaks.length - Math.floor((regionDur / targetTrack.duration) * peaks.length)));
      const newDur = merged.duration;

      const newSegments = targetTrack.segments
        .map((seg) => {
          const segEnd = seg.start + seg.duration;
          if (segEnd <= start || seg.start >= end) {
            return seg.start >= end
              ? { ...seg, start: seg.start - regionDur }
              : seg;
          }
          if (seg.start < start && segEnd > end) {
            return {
              ...seg,
              duration: seg.duration - regionDur,
              offset: seg.offset + (end - seg.start),
            };
          }
          if (seg.start < start) {
            return { ...seg, duration: start - seg.start };
          }
          return null;
        })
        .filter(Boolean) as typeof targetTrack.segments;

      updateTrack(targetTrack.id, {
        waveformData: newPeaks,
        duration: newDur,
        segments: newSegments.length > 0 ? newSegments : [{ id: uuid(), start: 0, duration: newDur, offset: 0 }],
      });
      setSelection(null);
      pushHistory("delete_selection", prevState, JSON.stringify({ trackId: targetTrack.id }));
    } catch (e) {
      setError("删除失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [selection, tracks, project.sampleRate, engine, updateTrack, setSelection, pushHistory, setError]);

  const handleUndo = useCallback(() => {
    const action = undo();
    if (!action) return;
    if (action.type === "add_track" && typeof action.previous === "string") {
      try {
        const prev = JSON.parse(action.previous as string) as Array<{ id: string }>;
        const currentIds = new Set(tracks.map((t) => t.id));
        for (const t of tracks) {
          if (!prev.find((p) => p.id === t.id) && currentIds.has(t.id)) {
            useProjectStore.getState().removeTrack(t.id);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }, [undo, tracks]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isEditable =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;

      if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleCut();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePaste();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection) {
          e.preventDefault();
          handleDelete();
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        setCurrentTime(Math.max(0, currentTime - step));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        setCurrentTime(Math.min(project.duration, currentTime + step));
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setCurrentTime(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setCurrentTime(project.duration);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    handleUndo,
    handleRedo,
    handleCut,
    handleCopy,
    handlePaste,
    handleDelete,
    selection,
    currentTime,
    project.duration,
    setCurrentTime,
  ]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background-primary text-text-primary font-sans select-none">
      <Navbar />

      <div className="flex-1 flex min-h-0 relative">
        {!isMobile && !isTablet && (
          <>
            <aside
              className={`shrink-0 transition-all duration-300 ease-out border-r border-border-subtle overflow-hidden bg-background-secondary flex flex-col ${
                leftPanelOpen ? "w-[20%] min-w-[260px]" : "w-0"
              }`}
            >
              {leftPanelOpen && (
                <div className="flex-1 min-w-0 h-full">
                  <TrackPanel />
                </div>
              )}
            </aside>

            {!leftPanelOpen && (
              <button
                onClick={() => setLeftPanelOpen(true)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-20 w-6 bg-background-tertiary border-r border-border-subtle rounded-r-lg flex items-center justify-center text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-all"
                title="展开轨道面板"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {(isMobile || isTablet) && (
          <button
            onClick={() => setLeftDrawerOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-20 w-6 bg-background-tertiary border-r border-border-subtle rounded-r-lg flex items-center justify-center text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-all"
            title="展开轨道面板"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <main className="flex-1 min-w-0 flex flex-col bg-background-primary overflow-hidden">
          <Timeline />
        </main>

        {!isMobile && !isTablet && (
          <>
            {!rightPanelOpen && (
              <button
                onClick={() => setRightPanelOpen(true)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-20 w-6 bg-background-tertiary border-l border-border-subtle rounded-l-lg flex items-center justify-center text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-all"
                title="展开标记面板"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <aside
              className={`shrink-0 transition-all duration-300 ease-out border-l border-border-subtle overflow-hidden bg-background-secondary flex flex-col ${
                rightPanelOpen ? "w-[20%] min-w-[280px]" : "w-0"
              }`}
            >
              {rightPanelOpen && (
                <div className="flex-1 min-w-0 h-full">
                  <MarkerPanel />
                </div>
              )}
            </aside>
          </>
        )}

        {(isMobile || isTablet) && (
          <button
            onClick={() => setRightDrawerOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-20 w-6 bg-background-tertiary border-l border-border-subtle rounded-l-lg flex items-center justify-center text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-all"
            title="展开标记面板"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {(isMobile || isTablet) && leftDrawerOpen && (
          <div className="absolute inset-0 z-30 flex">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setLeftDrawerOpen(false)}
            />
            <div className="relative z-10 w-[80%] max-w-[340px] h-full bg-background-secondary border-r border-border-subtle shadow-2xl animate-slide-up">
              <button
                onClick={() => setLeftDrawerOpen(false)}
                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-text-muted hover:text-white transition-all"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
              <TrackPanel />
            </div>
          </div>
        )}

        {(isMobile || isTablet) && rightDrawerOpen && (
          <div className="absolute inset-0 z-30 flex justify-end">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setRightDrawerOpen(false)}
            />
            <div className="relative z-10 w-[80%] max-w-[360px] h-full bg-background-secondary border-l border-border-subtle shadow-2xl animate-slide-up">
              <button
                onClick={() => setRightDrawerOpen(false)}
                className="absolute top-3 left-3 z-20 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-text-muted hover:text-white transition-all"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
              <MarkerPanel />
            </div>
          </div>
        )}
      </div>

      <PlaybackBar />
    </div>
  );
}
