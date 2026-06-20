import { useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import TrackPanel from "@/components/TrackPanel";
import Timeline from "@/components/Timeline";
import MarkerPanel from "@/components/MarkerPanel";
import PlaybackBar from "@/components/PlaybackBar";
import { useProjectStore, validateAudioFile } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { loadProject } from "@/utils/idbStorage";
import { AUTO_SAVE_INTERVAL, UNDO_STACK_LIMIT } from "@/types/audio";
import { debounce } from "@/utils/idbStorage";

export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const initializedRef = useRef(false);

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
  const computeWaveform = useProjectStore((s) => s);

  const selection = useEditorStore((s) => s.selection);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const leftPanelOpen = useEditorStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const setLeftPanelOpen = useEditorStore((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useEditorStore((s) => s.setRightPanelOpen);
  const setSelection = useEditorStore((s) => s.setSelection);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const engine = useAudioEngine();

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
    const state = JSON.stringify({ selection, tracks: tracks.map((t) => t.segments) });
    useProjectStore.getState().setClipboard({
      start: selection.start,
      end: selection.end,
      trackId: selection.activeTrackId ?? undefined,
      timestamp: Date.now(),
    });
    setSelection(null);
    pushHistory("cut_selection", state, JSON.stringify({ selection: null }));
  }, [selection, tracks, setSelection, pushHistory]);

  const handleCopy = useCallback(() => {
    if (!selection) return;
    useProjectStore.getState().setClipboard({
      start: selection.start,
      end: selection.end,
      trackId: selection.activeTrackId ?? undefined,
      timestamp: Date.now(),
    });
  }, [selection]);

  const handlePaste = useCallback(() => {
    const cb = useProjectStore.getState().clipboard;
    if (!cb) return;
    const state = JSON.stringify({ currentTime, tracks: tracks.map((t) => t.segments) });
    setCurrentTime(cb.start);
    pushHistory("paste_selection", state, JSON.stringify({ currentTime: cb.start }));
  }, [currentTime, tracks, setCurrentTime, pushHistory]);

  const handleDelete = useCallback(() => {
    if (!selection) return;
    const state = JSON.stringify({ selection, tracks: tracks.map((t) => t.segments) });
    setSelection(null);
    pushHistory("delete_selection", state, JSON.stringify({ selection: null }));
  }, [selection, tracks, setSelection, pushHistory]);

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

        <main className="flex-1 min-w-0 flex flex-col bg-background-primary overflow-hidden">
          <Timeline />
        </main>

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
      </div>

      <PlaybackBar />
    </div>
  );
}
