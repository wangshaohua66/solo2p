import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Upload,
  Trash2,
  FolderPlus,
  Film,
  Clock,
  FileJson,
  AlertTriangle,
  Upload as UploadIcon,
} from 'lucide-react';
import { useProjectStore, type ExportProjectJSON } from '@/stores/projectStore';
import Modal from '@/components/Common/Modal';
import Skeleton from '@/components/Common/Skeleton';

const ProjectList = () => {
  const navigate = useNavigate();
  const { projects, loadProjects, createProject, deleteProject, importProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState<ExportProjectJSON | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadProjects().finally(() => setLoading(false));
  }, [loadProjects]);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  const shotCount = (p: { id: string; fps?: number }): string => {
    const sec = Math.floor((Date.now() - p.createdAt) / 1000);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    return `${m}分钟前`;
  };

  const formatDate = (t: number) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    const id = await createProject(newName.trim(), newDesc.trim());
    setIsCreating(false);
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
    navigate(`/editor?project=${id}`);
  };

  const handleFileChange = (file: File) => {
    setImportError('');
    setImportPreview(null);
    if (!file.name.toLowerCase().endsWith('.json')) {
      setImportError('请选择 .json 格式的项目文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as ExportProjectJSON;
        if (!data.project || !data.version) throw new Error('无效的文件格式');
        setImportPreview(data);
      } catch {
        setImportError('文件解析失败，请确认是合法的项目导出文件');
      }
    };
    reader.onerror = () => setImportError('文件读取失败');
    reader.readAsText(file);
    setImportFile(file);
  };

  const handleImport = async () => {
    if (!importPreview) return;
    const id = await importProject({
      project: importPreview.project,
      scenes: importPreview.scenes,
      shots: importPreview.shots,
    });
    setShowImport(false);
    setImportFile(null);
    setImportPreview(null);
    navigate(`/editor?project=${id}`);
  };

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-b from-sidebar to-[#181825]">
      <header className="h-16 border-b border-sidebar-light/60 flex items-center justify-between px-8 bg-sidebar/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center shadow-lg shadow-accent/20">
            <Film className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-mono font-bold text-xl text-white leading-tight">Storyboard Studio</h1>
            <p className="text-[11px] text-sidebar-fg">分镜创作平台 · 纯前端本地存储</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sidebar-fg" />
            <input
              type="text"
              placeholder="搜索项目名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72 pl-10 pr-4 py-2 text-sm !rounded-lg"
            />
          </div>
          <button onClick={() => setShowImport(true)} className="btn-secondary inline-flex items-center gap-2">
            <Upload size={16} />
            导入
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            新建项目
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="library-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-sidebar-light/30 border border-sidebar-light overflow-hidden">
                <Skeleton height={160} rounded="rounded-none" />
                <div className="p-4 space-y-3">
                  <Skeleton height={18} width="70%" />
                  <Skeleton height={12} width="40%" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
              <div className="w-20 h-20 rounded-2xl bg-sidebar-light/50 flex items-center justify-center">
                <FolderPlus size={40} className="text-sidebar-fg" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  {search ? '没有匹配的项目' : '还没有项目'}
                </h2>
                <p className="text-sidebar-fg text-sm mb-6">
                  {search ? '尝试更换搜索关键词' : '点击右上角按钮创建你的第一个分镜项目'}
                </p>
              </div>
              {!search && (
                <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
                  <Plus size={18} />
                  创建项目
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="library-grid">
            {filtered.map((p) => {
              const count = shotCount(p);
              return (
                <div
                  key={p.id}
                  className="group rounded-xl bg-sidebar-light/30 border border-sidebar-light overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-card-hover hover:border-accent/50 hover:-translate-y-1"
                  onClick={() => navigate(`/editor?project=${p.id}`)}
                >
                  <div className="h-40 bg-sidebar-lighter relative overflow-hidden checkerboard flex items-center justify-center">
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt={p.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-sidebar-fg">
                        <Film size={40} strokeWidth={1.5} />
                        <span className="text-xs">暂无分镜</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(p.id);
                        }}
                        className="w-8 h-8 rounded-lg bg-danger/90 text-white flex items-center justify-center hover:bg-danger shadow-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white text-sm truncate mb-2">{p.name}</h3>
                    {p.description && (
                      <p className="text-xs text-sidebar-fg mb-3 line-clamp-2">{p.description}</p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-sidebar-muted">
                      <span className="inline-flex items-center gap-1">
                        <Film size={12} />
                        {count} 分镜
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(p.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Modal open={showCreate} onClose={() => !isCreating && setShowCreate(false)} title="新建项目" width={520}
        footer={
          <>
            <button onClick={() => setShowCreate(false)} disabled={isCreating} className="btn-secondary">取消</button>
            <button onClick={handleCreate} disabled={!newName.trim() || isCreating} className="btn-primary">
              {isCreating ? '创建中...' : '创建并进入'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-sidebar-fg mb-2">项目名称 *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：原创番剧 第1季"
              className="w-full"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sidebar-fg mb-2">项目描述</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="简要描述项目的故事背景、风格、目标集数等..."
              className="w-full h-24 resize-none"
            />
          </div>
          <div className="p-3 rounded-lg bg-sidebar-light/50 border border-sidebar-light text-xs text-sidebar-muted">
            创建后会自动生成一个包含默认分镜的场景，您可以随时修改。
          </div>
        </div>
      </Modal>

      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="导入项目"
        width={520}
        footer={
          <>
            <button onClick={() => setShowImport(false)} className="btn-secondary">取消</button>
            <button
              onClick={handleImport}
              disabled={!importPreview}
              className="btn-primary inline-flex items-center gap-2"
            >
              <UploadIcon size={16} />
              确认导入
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileChange(file);
            }}
            onClick={() => document.getElementById('import-input')?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
              isDragging ? 'border-accent bg-accent/10' : 'border-sidebar-lighter hover:border-accent/50 hover:bg-sidebar-light/30'
            }`}
          >
            <div className="w-14 h-14 rounded-xl bg-sidebar-light flex items-center justify-center">
              <FileJson size={28} className="text-accent" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white mb-1">拖拽 JSON 文件到此处</p>
              <p className="text-xs text-sidebar-fg">或点击选择文件</p>
            </div>
            <input
              id="import-input"
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileChange(f);
              }}
            />
          </div>

          {importError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          {importPreview && (
            <div className="p-4 rounded-lg bg-sidebar-light/50 border border-sidebar-light space-y-2">
              <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                文件解析成功
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-sidebar-fg">项目名称：</div>
                <div className="text-white">{importPreview.project.name}</div>
                <div className="text-sidebar-fg">场景数：</div>
                <div className="text-white">{importPreview.scenes.length}</div>
                <div className="text-sidebar-fg">分镜数：</div>
                <div className="text-white">{importPreview.shots.length}</div>
                <div className="text-sidebar-fg">导出于：</div>
                <div className="text-white">{new Date(importPreview.exportedAt).toLocaleString('zh-CN')}</div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="删除项目"
        width={440}
        footer={
          <>
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary">取消</button>
            <button
              onClick={async () => {
                if (confirmDelete) {
                  await deleteProject(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
              className="bg-danger hover:bg-danger/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              确认删除
            </button>
          </>
        }
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-danger/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={24} className="text-danger" />
          </div>
          <div>
            <p className="text-white font-medium mb-1">此操作无法撤销</p>
            <p className="text-sm text-sidebar-fg">
              删除项目将移除所有场景、分镜、对白和参考图。所有本地数据将被清空。
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectList;
