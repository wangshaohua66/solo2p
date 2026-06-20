import { useState, useMemo } from "react";
import {
  Flag,
  MessageSquareText,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Download,
  Clock,
  User,
  FileText,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Mic,
  MicOff,
  BookText,
} from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTranscription, mockTranscript } from "@/hooks/useTranscription";
import { formatTime, formatTimeShort } from "@/utils/timeFormat";
import type { Marker, Comment } from "@/types/audio";

type Tab = "markers" | "comments" | "transcript";

export function MarkerPanel() {
  const rightOpen = useEditorStore((s) => s.rightPanelOpen);
  const activeTab = useEditorStore((s) => s.activeRightTab);
  const setActiveTab = useEditorStore((s) => s.setActiveRightTab);

  if (!rightOpen) return null;

  return (
    <aside className="flex flex-col w-[20%] min-w-[280px] max-w-[420px] shrink-0 border-l border-border bg-background-secondary/50">
      <div className="flex border-b border-border shrink-0">
        <TabButton
          active={activeTab === "markers"}
          onClick={() => setActiveTab("markers")}
          icon={<Flag className="w-3.5 h-3.5" />}
          label="章节"
          count={useProjectStore.getState().project.markers.length}
        />
        <TabButton
          active={activeTab === "comments"}
          onClick={() => setActiveTab("comments")}
          icon={<MessageSquareText className="w-3.5 h-3.5" />}
          label="批注"
          count={useProjectStore.getState().project.comments.filter((c) => c.status === "pending").length}
        />
        <TabButton
          active={activeTab === "transcript"}
          onClick={() => setActiveTab("transcript")}
          icon={<BookText className="w-3.5 h-3.5" />}
          label="转录"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "markers" && <MarkersTab />}
        {activeTab === "comments" && <CommentsTab />}
        {activeTab === "transcript" && <TranscriptTab />}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium transition-all relative ${
        active
          ? "text-accent bg-accent-soft/20"
          : "text-white/50 hover:text-white/80 hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
      {typeof count === "number" && count > 0 && (
        <span
          className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            active ? "bg-accent text-white" : "bg-white/10 text-white/60"
          }`}
        >
          {count}
        </span>
      )}
      {active && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-t-full" />
      )}
    </button>
  );
}

function MarkersTab() {
  const { project, currentTime, addMarker, removeMarker, updateMarker, setCurrentTime } =
    useProjectStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTime, setDraftTime] = useState("");

  const markers = useMemo(
    () => [...project.markers].sort((a, b) => a.time - b.time),
    [project.markers]
  );

  const exportMarkers = () => {
    const data = markers.map((m, i) => ({
      index: i + 1,
      time: formatTime(m.time),
      time_sec: m.time,
      title: m.title,
      description: m.description ?? "",
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_chapters.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const startEdit = (m: Marker) => {
    setEditingId(m.id);
    setDraftTitle(m.title);
    setDraftTime(formatTime(m.time, true));
  };

  const saveEdit = (m: Marker) => {
    updateMarker(m.id, {
      title: draftTitle.trim() || m.title,
      time: parseMarkerTime(draftTime) ?? m.time,
    });
    setEditingId(null);
  };

  const handleAddHere = () => {
    const title = `章节 ${markers.length + 1}`;
    const marker = addMarker(currentTime, title);
    setEditingId(marker.id);
    setDraftTitle(title);
    setDraftTime(formatTime(currentTime, true));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
        <button
          className="btn-ghost !px-2 !py-1.5 gap-1 text-xs flex-1"
          onClick={handleAddHere}
        >
          <Plus className="w-3.5 h-3.5" />
          当前位置
          <span className="font-mono text-accent ml-1">
            {formatTimeShort(currentTime)}
          </span>
        </button>
        <button
          className="btn-icon"
          onClick={exportMarkers}
          disabled={markers.length === 0}
          title="导出章节JSON"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {markers.length === 0 ? (
          <EmptyHint
            icon={<Flag className="w-8 h-8" />}
            title="暂无章节标记"
            desc="在播放至对应位置时点击「当前位置」添加章节，可导出JSON用于播客平台发布"
          />
        ) : (
          markers.map((m, i) => (
            <div
              key={m.id}
              className={`group p-3 rounded-xl border bg-background-tertiary/60 hover:bg-background-tertiary border-border hover:border-border-hover transition-all animate-slide-up ${
                editingId === m.id ? "!border-accent !bg-accent-soft/10" : ""
              }`}
              style={{ borderLeftWidth: 3, borderLeftColor: m.color ?? "#e94560" }}
            >
              {editingId === m.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-accent-soft text-accent flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <input
                      className="input flex-1 !py-1 !text-sm"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <input
                      className="input flex-1 !py-1 !text-xs font-mono"
                      value={draftTime}
                      onChange={(e) => setDraftTime(e.target.value)}
                    />
                    <button className="btn-icon !w-7 !h-7 !text-success" onClick={() => saveEdit(m)}>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button className="btn-icon !w-7 !h-7 !text-accent" onClick={() => setEditingId(null)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: m.color ?? "#e94560" }}
                      >
                        {i + 1}
                      </span>
                      <button
                        className="flex-1 text-sm font-semibold text-white/90 hover:text-accent text-left truncate transition"
                        onClick={() => setCurrentTime(m.time)}
                      >
                        {m.title}
                      </button>
                    </div>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        className="btn-icon !w-7 !h-7"
                        onClick={() => startEdit(m)}
                        title="编辑"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn-icon !w-7 !h-7 !text-accent hover:!bg-accent-soft"
                        onClick={() => removeMarker(m.id)}
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pl-8">
                    <button
                      className="flex items-center gap-1 text-xs font-mono text-waveform-bar hover:text-white transition"
                      onClick={() => setCurrentTime(m.time)}
                    >
                      <PlayCircle className="w-3 h-3" />
                      {formatTime(m.time)}
                    </button>
                    {m.description && (
                      <p className="text-[11px] text-white/40 truncate max-w-[60%]">
                        {m.description}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function parseMarkerTime(s: string): number | null {
  if (!s) return null;
  const parts = s.trim().split(":");
  let total = 0;
  if (parts.length >= 3) {
    total = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parseFloat(parts[2].replace(",", ".")));
  } else if (parts.length === 2) {
    total = Number(parts[0]) * 60 + Number(parseFloat(parts[1].replace(",", ".")));
  } else if (parts.length === 1) {
    total = Number(parseFloat(parts[0].replace(",", ".")));
  }
  return isFinite(total) ? total : null;
}

function CommentsTab() {
  const { project, currentTime, addComment, removeComment, updateComment, setCurrentTime } =
    useProjectStore();
  const [author, setAuthor] = useState("审核员");
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");

  const comments = useMemo(() => {
    const list = [...project.comments].sort((a, b) => a.time - b.time);
    return filter === "all" ? list : list.filter((c) => c.status === filter);
  }, [project.comments, filter]);

  const counts = useMemo(() => ({
    all: project.comments.length,
    pending: project.comments.filter((c) => c.status === "pending").length,
    resolved: project.comments.filter((c) => c.status === "resolved").length,
  }), [project.comments]);

  const handleSubmit = () => {
    const content = draft.trim();
    if (!content) return;
    addComment(currentTime, author.trim() || "匿名审核员", content);
    setDraft("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <User className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              className="input !py-1 !text-xs flex-1 pl-8"
              placeholder="审核员姓名"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
        </div>
        <div className="text-xs font-mono text-white/40 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          添加位置: {formatTime(currentTime)}
        </div>
        <div className="flex gap-2">
          <textarea
            className="input flex-1 !py-2 !text-xs resize-none"
            rows={2}
            placeholder="输入批注内容，例如：此处主持人音量偏小，请调高10%"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSubmit();
            }}
          />
          <button
            className="btn-primary !px-3 self-end"
            onClick={handleSubmit}
            disabled={!draft.trim()}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-3 pt-3 flex gap-1 shrink-0">
        {(["all", "pending", "resolved"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === k
                ? k === "pending"
                  ? "bg-accent-soft text-accent"
                  : k === "resolved"
                  ? "bg-success-soft text-success"
                  : "bg-white/10 text-white"
                : "bg-white/5 text-white/50 hover:text-white/80"
            }`}
          >
            {k === "all" ? "全部" : k === "pending" ? "待修改" : "已处理"}
            <span className="ml-1 opacity-70">({counts[k]})</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {comments.length === 0 ? (
          <EmptyHint
            icon={<MessageSquareText className="w-8 h-8" />}
            title={project.comments.length === 0 ? "暂无批注" : filter === "pending" ? "无待处理批注" : "无已处理批注"}
            desc="在播放到需要修改的位置时输入批注内容，剪辑师可点击时间码跳转修改"
          />
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onJump={() => setCurrentTime(c.time)}
              onToggle={() =>
                updateComment(c.id, {
                  status: c.status === "pending" ? "resolved" : "pending",
                })
              }
              onDelete={() => removeComment(c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  onJump,
  onToggle,
  onDelete,
}: {
  comment: Comment;
  onJump: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group p-3 rounded-xl border bg-background-tertiary/60 border-border animate-slide-up ${
        comment.status === "resolved" ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-white/60" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white/80 truncate">
              {comment.author}
            </div>
            <button
              onClick={onJump}
              className="text-[11px] font-mono text-waveform-bar hover:text-accent transition flex items-center gap-1"
            >
              <Clock className="w-2.5 h-2.5" />
              {formatTime(comment.time)}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`tag ${
              comment.status === "pending" ? "tag-pending" : "tag-resolved"
            }`}
          >
            {comment.status === "pending" ? (
              <>
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                待修改
              </>
            ) : (
              <>
                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                已处理
              </>
            )}
          </span>
        </div>
      </div>
      <p
        className={`text-xs text-white/80 leading-relaxed pl-9 ${
          comment.status === "resolved" ? "line-through decoration-white/30" : ""
        }`}
      >
        {comment.content}
      </p>
      <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
        <button
          className={`btn-icon !w-6 !h-6 ${
            comment.status === "pending" ? "!text-success" : "!text-warning"
          }`}
          onClick={onToggle}
          title={comment.status === "pending" ? "标记已处理" : "重新标记待修改"}
        >
          {comment.status === "pending" ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <AlertTriangle className="w-3 h-3" />
          )}
        </button>
        <button
          className="btn-icon !w-6 !h-6 !text-accent hover:!bg-accent-soft"
          onClick={onDelete}
          title="删除批注"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function TranscriptTab() {
  const tr = useTranscription();
  const activeTrackId = useProjectStore((s) => s.activeTrackId);
  const project = useProjectStore((s) => s.project);

  const segments = tr.segments.filter(
    (s) => !activeTrackId || s.trackId === activeTrackId || s.trackId === "global"
  );

  const handleGenerateMock = () => {
    if (activeTrackId) {
      const mock = mockTranscript(activeTrackId, project.duration, 14);
      useProjectStore.getState().addTranscript(mock);
    } else if (project.tracks.length > 0) {
      const mock = mockTranscript(project.tracks[0].id, project.duration, 14);
      useProjectStore.getState().addTranscript(mock);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => tr.toggle(activeTrackId ?? undefined)}
            disabled={!tr.supported}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tr.isRecording
                ? "bg-accent text-white shadow-glow-accent animate-pulse-slow"
                : tr.supported
                ? "btn-primary"
                : "bg-white/5 text-white/40 cursor-not-allowed"
            }`}
          >
            {tr.isRecording ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <MicOff className="w-4 h-4" />
                停止识别
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                {tr.supported ? "开始实时转录" : "浏览器不支持"}
              </>
            )}
          </button>
          <button
            className="btn-ghost !px-2 !py-2 text-xs"
            onClick={handleGenerateMock}
            title="生成示例转录文本"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
        {tr.currentText && (
          <div className="p-2 rounded-lg bg-accent-soft/30 border border-accent/30 text-xs text-white/80 animate-fade-in">
            <span className="text-accent font-bold mr-1">正在识别：</span>
            {tr.currentText}
          </div>
        )}
        {tr.error && (
          <div className="p-2 rounded-lg bg-accent-soft/40 text-xs text-accent/90">
            {tr.error}
          </div>
        )}
        {!tr.supported && (
          <div className="text-[11px] text-warning/90 bg-warning/10 border border-warning/30 rounded-lg p-2">
            💡 当前浏览器不支持 Web Speech API，可点击右侧「📄」按钮生成示例转录查看效果
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {segments.length === 0 ? (
          <EmptyHint
            icon={<BookText className="w-8 h-8" />}
            title="暂无转录文本"
            desc="点击上方按钮开始实时语音识别（需Chrome/Edge），或生成示例文本预览效果"
          />
        ) : (
          segments.map((s) => (
            <button
              key={s.id}
              onClick={() => tr.jumpToSegment(s.id)}
              className="group block w-full text-left p-2.5 rounded-lg hover:bg-background-tertiary transition animate-fade-in"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded bg-info-soft text-info/90 font-medium">
                  {formatTimeShort(s.startTime)}
                </span>
                <p className="text-xs text-white/80 leading-relaxed group-hover:text-white transition">
                  {s.text}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyHint({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-text-muted">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-white/30 border border-border">
        {icon}
      </div>
      <p className="text-sm font-semibold text-white/70 mb-1">{title}</p>
      <p className="text-[11px] leading-relaxed max-w-[200px]">{desc}</p>
    </div>
  );
}

export default MarkerPanel;
