import { useState, useRef } from "react";
import {
  Undo2,
  Redo2,
  Upload,
  Download,
  Save,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Scissors,
  Copy,
  ClipboardPaste,
  Trash2,
  Sparkles,
  FolderOpen,
  Home,
  Pencil,
  Check,
} from "lucide-react";
import { useProjectStore, validateAudioFile } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useNavigate } from "react-router-dom";
import type { ExportedProject, Project, AudioTrack } from "@/types/audio";
import { uuid, generateSyntheticWaveform } from "@/utils/audioProcessor";

export function Navbar() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);

  const {
    project,
    setProjectName,
    addTrack,
    updateTrack,
    setLoading,
    setError,
    persist,
    setClipboard,
    clipboard,
    activeTrackId,
  } = useProjectStore();

  const {
    undoStack,
    redoStack,
    undo,
    redo,
    leftPanelOpen,
    rightPanelOpen,
    setLeftPanelOpen,
    setRightPanelOpen,
    selection,
    clearSelection,
    pushHistory,
  } = useEditorStore();

  const { decodeFile, computeWaveform } = useAudioEngine();
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project.name);

  const handleSaveProjectName = () => {
    if (draftName.trim()) {
      setProjectName(draftName.trim());
      pushHistory("update_track", { name: project.name }, { name: draftName.trim() });
    }
    setEditingName(false);
  };

  const handleImportAudio = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const err = validateAudioFile(f);
        if (err) {
          setError(`${f.name}: ${err}`);
          continue;
        }
        const idx = useProjectStore.getState().project.tracks.length;
        const track = addTrack({
          name: f.name.replace(/\.[^.]+$/, ""),
          duration: 300,
          waveformData: generateSyntheticWaveform(800, idx * 7 + 11),
          segments: [{ id: uuid(), start: 0, duration: 300, offset: 0 }],
        });
        if (!track) continue;
        try {
          const buf = await decodeFile(f);
          const wf = computeWaveform(buf, 2000);
          updateTrack(track.id, {
            duration: buf.duration,
            waveformData: wf,
            src: f.name,
            segments: [{ id: uuid(), start: 0, duration: buf.duration, offset: 0 }],
          });
        } catch (e) {
          // synthetic fallback already applied above
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportProject = () => {
    const exp: ExportedProject = {
      version: "1.0.0",
      project: {
        ...project,
        tracks: project.tracks.map(({ audioBufferRef: _r, ...rest }) => rest) as Array<
          Omit<AudioTrack, "audioBufferRef">
        >,
      },
    };
    const blob = new Blob([JSON.stringify(exp, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}.podcut.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    persist();
  };

  const handleImportProject = async (file: File) => {
    try {
      const text = await file.text();
      const exp = JSON.parse(text) as ExportedProject;
      if (!exp.project || !Array.isArray(exp.project.tracks)) {
        setError("无效的项目文件格式");
        return;
      }
      useProjectStore.getState().setProject(exp.project as Project);
      useEditorStore.getState().clearHistory();
    } catch (err) {
      setError("项目导入失败: " + String(err));
    }
  };

  const handleCut = () => {
    if (!selection) return;
    setClipboard({
      ...selection,
      trackId: selection.activeTrackId ?? undefined,
      timestamp: Date.now(),
      regionDuration: Math.max(0.001, selection.end - selection.start),
    });
    pushHistory("cut_selection", { selection }, null);
    clearSelection();
  };

  const handleCopy = () => {
    if (!selection) return;
    setClipboard({
      ...selection,
      trackId: selection.activeTrackId ?? undefined,
      timestamp: Date.now(),
      regionDuration: Math.max(0.001, selection.end - selection.start),
    });
  };

  const handlePaste = () => {
    if (!clipboard) return;
    pushHistory(
      "paste_selection",
      { clipboard },
      { at: useProjectStore.getState().currentTime }
    );
  };

  const handleDelete = () => {
    if (!selection) return;
    pushHistory("delete_selection", { selection }, null);
    clearSelection();
  };

  const handleUndo = () => {
    const action = undo();
    if (action?.type?.startsWith("update_track") && action.previous) {
      // apply inverse
      const p = action.previous as { name?: string };
      if (p.name) setProjectName(p.name);
    }
  };

  return (
    <header className="h-14 shrink-0 flex items-center px-3 gap-2 border-b border-border bg-background-secondary/80 backdrop-blur-xl">
      <button
        className="btn-icon"
        onClick={() => navigate("/")}
        title="返回项目列表"
      >
        <Home className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow-accent-40">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              className="bg-background-tertiary/70 border border-accent/40 focus:border-accent outline-none px-2 py-1 rounded-md text-sm font-semibold min-w-[200px]"
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveProjectName();
                if (e.key === "Escape") setEditingName(false);
              }}
              onBlur={handleSaveProjectName}
            />
            <button
              className="btn-icon !w-7 !h-7 !text-success"
              onClick={handleSaveProjectName}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            className="flex items-center gap-1 group"
            onClick={() => {
              setDraftName(project.name);
              setEditingName(true);
            }}
          >
            <h1 className="text-[15px] font-bold tracking-wide bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              {project.name}
            </h1>
            <Pencil className="w-3 h-3 text-white/20 group-hover:text-accent transition opacity-0 group-hover:opacity-100" />
          </button>
        )}
        <span className="hidden lg:block text-[10px] px-2 py-0.5 rounded-full bg-success-soft text-success border border-success/30 font-medium">
          已保存
        </span>
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <div className="flex items-center gap-0.5">
        <button
          className="btn-icon"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          title={`撤销 (${undoStack.length})`}
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          className="btn-icon"
          onClick={redo}
          disabled={redoStack.length === 0}
          title={`重做 (${redoStack.length})`}
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-border mx-1 hidden md:block" />

      <div className="hidden md:flex items-center gap-0.5">
        <button
          className="btn-icon"
          onClick={handleCut}
          disabled={!selection}
          title="剪切选区"
        >
          <Scissors className="w-4 h-4" />
        </button>
        <button
          className="btn-icon"
          onClick={handleCopy}
          disabled={!selection}
          title="复制选区"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          className="btn-icon"
          onClick={handlePaste}
          disabled={!clipboard}
          title="粘贴选区"
        >
          <ClipboardPaste className="w-4 h-4" />
        </button>
        <button
          className="btn-icon !text-accent/70 hover:!text-accent"
          onClick={handleDelete}
          disabled={!selection}
          title="删除选区"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-1">
        <button
          className="btn-icon"
          onClick={() => fileInputRef.current?.click()}
          title="导入音频"
        >
          <Upload className="w-4 h-4 text-info" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleImportAudio(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          className="btn-icon"
          onClick={() => projectInputRef.current?.click()}
          title="导入项目JSON"
        >
          <FolderOpen className="w-4 h-4 text-info" />
        </button>
        <input
          ref={projectInputRef}
          type="file"
          accept="application/json,.podcut.json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportProject(f);
            e.target.value = "";
          }}
        />
        <button
          className="btn-icon"
          onClick={handleExportProject}
          title="导出项目 + 章节"
        >
          <Download className="w-4 h-4 text-success" />
        </button>
        <button
          className="btn-icon"
          onClick={() => persist()}
          title="立即保存到本地"
        >
          <Save className="w-4 h-4 text-accent" />
        </button>
      </div>

      <div className="w-px h-6 bg-border mx-1 hidden lg:block" />

      <div className="hidden lg:flex items-center gap-0.5">
        <button
          className="btn-icon"
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          title={leftPanelOpen ? "隐藏左侧轨道面板" : "显示左侧轨道面板"}
        >
          {leftPanelOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>
        <button
          className="btn-icon"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          title={rightPanelOpen ? "隐藏右侧标记面板" : "显示右侧标记面板"}
        >
          {rightPanelOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </div>

      {activeTrackId && selection && (
        <span className="hidden xl:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent-soft/60 border border-accent/40 text-[11px] font-mono text-accent">
          选区 {(selection.end - selection.start).toFixed(2)}s
        </span>
      )}
    </header>
  );
}

export default Navbar;
