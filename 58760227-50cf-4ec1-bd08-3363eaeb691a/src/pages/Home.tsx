import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FolderOpen,
  Trash2,
  Clock,
  Music,
  Tag,
  Upload,
  Download,
  Radio,
  Sparkles,
  Mic2,
  Headphones,
  FileAudio,
} from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import {
  listProjects,
  deleteProject,
  loadProject,
  saveProject,
} from "@/utils/idbStorage";
import { formatTime } from "@/utils/timeFormat";
import { uuid, generateSyntheticWaveform } from "@/utils/audioProcessor";
import type { Project, AudioTrack } from "@/types/audio";
import { TRACK_COLORS } from "@/types/audio";

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setProject = useProjectStore((s) => s.setProject);
  const clearHistory = useEditorStore((s) => s.clearHistory);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list.reverse());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createNewProject = useCallback(async () => {
    const id = uuid();
    const now = Date.now();
    const sampleRate = 44100;
    const duration = 2700;
    const trackNames = ["主持人主声道", "嘉宾声道", "背景音乐轨", "音效轨"];
    const tracks: AudioTrack[] = trackNames.map((name, idx) => ({
      id: uuid(),
      projectId: id,
      name,
      color: TRACK_COLORS[idx % TRACK_COLORS.length],
      volume: 0.8,
      muted: false,
      solo: false,
      order: idx,
      duration,
      waveformData: generateSyntheticWaveform(800, idx * 17 + 3),
      segments: [{ id: uuid(), start: 0, duration, offset: 0 }],
    }));

    const project: Project = {
      id,
      name: `新项目 ${new Date().toLocaleDateString("zh-CN")}`,
      duration,
      sampleRate,
      tracks,
      markers: [],
      comments: [],
      transcripts: [],
      createdAt: now,
      updatedAt: now,
    };
    try {
      await saveProject(project);
      setProject(project);
      clearHistory();
      navigate(`/editor/${id}`);
    } catch (e) {
      setError("创建项目失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [navigate, setProject, clearHistory]);

  const openProject = useCallback(
    async (id: string) => {
      try {
        const p = await loadProject(id);
        if (p) {
          setProject(p);
          clearHistory();
          navigate(`/editor/${id}`);
        }
      } catch (e) {
        setError("打开项目失败: " + (e instanceof Error ? e.message : String(e)));
      }
    },
    [navigate, setProject, clearHistory]
  );

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("确认删除此项目？此操作不可撤销。")) return;
      try {
        await deleteProject(id);
        void refresh();
      } catch (e) {
        setError("删除失败: " + (e instanceof Error ? e.message : String(e)));
      }
    },
    [refresh]
  );

  const handleImportProject = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as Project;
        if (!data.id || !data.tracks) {
          throw new Error("无效的项目文件");
        }
        data.id = uuid();
        data.createdAt = Date.now();
        data.updatedAt = Date.now();
        data.tracks = data.tracks.map((t) => ({ ...t, id: uuid(), projectId: data.id }));
        data.markers = data.markers.map((m) => ({ ...m, id: uuid(), projectId: data.id }));
        data.comments = data.comments.map((c) => ({ ...c, id: uuid(), projectId: data.id }));
        await saveProject(data);
        setProject(data);
        clearHistory();
        navigate(`/editor/${data.id}`);
      } catch (err) {
        setError("导入失败: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        e.target.value = "";
      }
    },
    [navigate, setProject, clearHistory]
  );

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const diff = Date.now() - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return d.toLocaleDateString("zh-CN");
  };

  const roleCards = [
    { icon: Mic2, title: "主持人", desc: "录制主声道、嘉宾对话" },
    { icon: Headphones, title: "录音师", desc: "多轨录制、素材整理" },
    { icon: FileAudio, title: "剪辑师", desc: "波形剪辑、章节标记" },
    { icon: Tag, title: "审核员", desc: "批注审阅、版本确认" },
  ];

  return (
    <div className="min-h-screen w-full bg-background-primary text-text-primary font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent-primary/5 rounded-full blur-[120px] -translate-y-1/3" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent-secondary/5 rounded-full blur-[100px] translate-y-1/3" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-glow-accent">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                PodCut Studio
              </h1>
              <p className="text-sm text-text-muted">播客剪辑协作工作台</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="btn-ghost cursor-pointer flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span>导入项目</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportProject}
              />
            </label>
            <button
              onClick={createNewProject}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>新建项目</span>
            </button>
          </div>
        </header>

        <section className="mb-12">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-background-secondary to-background-tertiary border border-border-subtle p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-accent-primary" />
                  <span className="text-sm font-medium text-accent-primary">
                    专为区域广播电台设计
                  </span>
                </div>
                <h2 className="text-3xl font-bold mb-3 leading-tight">
                  一站式播客制作协作平台
                </h2>
                <p className="text-text-muted leading-relaxed mb-5">
                  多轨音频可视化编辑 · Web Speech 自动转录 · 在线审核批注 ·
                  章节标记一键导出。告别 Audition + 微信沟通的混乱流程，让剪辑师和审核员在同一画布高效协作。
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={createNewProject}
                    className="btn-primary flex items-center gap-2 h-11 px-5"
                  >
                    <Plus className="w-5 h-5" />
                    开始制作新节目
                  </button>
                  <div className="hidden md:flex items-center gap-6 text-sm text-text-muted ml-2">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-accent-secondary" />
                      <span>最多 16 轨</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-accent-secondary" />
                      <span>30s 自动保存</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-accent-secondary" />
                      <span>JSON 导出</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
                {roleCards.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="p-4 rounded-xl bg-background-primary/60 border border-border-subtle backdrop-blur-sm hover:border-accent-primary/40 hover:bg-accent-primary/5 transition-all group"
                  >
                    <Icon className="w-5 h-5 text-accent-primary mb-2 group-hover:scale-110 transition-transform" />
                    <div className="text-sm font-semibold mb-0.5">{title}</div>
                    <div className="text-xs text-text-muted leading-snug">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30 text-warning text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-warning/80 hover:text-warning text-xs"
            >
              关闭
            </button>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xl font-bold">最近项目</h3>
              <p className="text-sm text-text-muted mt-1">
                项目数据存储于本地 IndexedDB，支持离线使用
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <FolderOpen className="w-4 h-4" />
              <span>{projects.length} 个项目</span>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-2xl bg-background-secondary border border-border-subtle animate-pulse"
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border-subtle bg-background-secondary/40 p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-background-tertiary flex items-center justify-center mx-auto mb-5">
                <FolderOpen className="w-8 h-8 text-text-muted" />
              </div>
              <h4 className="text-lg font-semibold mb-2">还没有项目</h4>
              <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
                点击「新建项目」开始你的第一个播客节目，或导入已有的 .podcut.json 项目文件
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={createNewProject}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  新建项目
                </button>
                <label className="btn-ghost cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  导入 JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleImportProject}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  className="group text-left rounded-2xl bg-background-secondary border border-border-subtle hover:border-accent-primary/50 hover:shadow-glow-accent-20 transition-all overflow-hidden"
                >
                  <div className="h-28 bg-gradient-to-br from-background-tertiary to-background-secondary relative overflow-hidden border-b border-border-subtle">
                    <div className="absolute inset-0 flex items-end gap-[2px] px-4 pb-3 opacity-50">
                      {Array.from({ length: 48 }).map((_, i) => {
                        const h = 20 + Math.abs(Math.sin(i * 0.4 + p.createdAt) * 40);
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-t bg-accent-primary/70"
                            style={{ height: `${h}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      {p.tracks.slice(0, 4).map((t) => (
                        <div
                          key={t.id}
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                      ))}
                      {p.tracks.length > 4 && (
                        <span className="text-[10px] text-text-muted ml-1">
                          +{p.tracks.length - 4}
                        </span>
                      )}
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="tag text-[10px]">
                        {p.tracks.length} 轨
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h4 className="font-semibold truncate flex-1 group-hover:text-accent-primary transition-colors">
                        {p.name}
                      </h4>
                      <div
                        onClick={(e) => handleDelete(p.id, e)}
                        className="shrink-0 w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-text-muted hover:bg-danger/10 hover:text-danger transition-all"
                        title="删除项目"
                      >
                        <Trash2 className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(p.updatedAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Music className="w-3.5 h-3.5" />
                        <span>{formatTime(p.duration)}</span>
                      </div>
                      {p.markers.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-accent-secondary" />
                          <span className="text-accent-secondary">{p.markers.length} 标记</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-20 pt-8 border-t border-border-subtle text-center text-xs text-text-muted">
          PodCut Studio · 纯前端播客剪辑工具 · 数据本地存储，隐私安全
        </footer>
      </div>
    </div>
  );
}
