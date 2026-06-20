import { useState, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { Project, WorkflowTemplate, ActiveTab } from '@/types';
import {
  FolderPlus,
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Trash2,
  Copy,
  Download,
  Upload,
  FileJson,
  Settings,
  GitBranch,
  Clock,
  MoreVertical,
  Beaker,
  Workflow,
  Plus,
  Save,
} from 'lucide-react';
import { Empty, Dropdown, Tooltip, Modal, Input, Button } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface ProjectSidebarProps {
  onOpenWorkflow: () => void;
}

export function ProjectSidebar({ onOpenWorkflow }: ProjectSidebarProps) {
  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    createProject,
    duplicateProject,
    deleteProject,
    renameProject,
    exportProject,
    importProject,
    addToast,
    templates,
  } = useProjectStore();

  const setActiveTab = useAnalysisStore((s) => s.setActiveTab);
  const resetAnalysis = useAnalysisStore((s) => s.resetAnalysis);

  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    useProjectStore.getState().init();
  }, []);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (p: Project) => {
    setCurrentProjectId(p.id);
    if (p.data) {
      useAnalysisStore.setState({
        ...p.data,
        activeTab: 'sequence' as ActiveTab,
      });
    } else {
      resetAnalysis();
    }
    setActiveTab('sequence');
  };

  const handleCreate = () => {
    if (!newProjectName.trim()) {
      addToast('warning', '请输入项目名称');
      return;
    }
    const project = createProject(newProjectName.trim());
    setShowNewModal(false);
    setNewProjectName('');
    handleSelect(project);
    addToast('success', `项目「${project.name}」已创建`);
  };

  const handleRename = (id: string) => {
    if (!renameValue.trim()) return;
    renameProject(id, renameValue.trim());
    setRenamingId(null);
    setRenameValue('');
    addToast('success', '项目已重命名');
  };

  const handleDelete = (p: Project) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除项目「${p.name}」？此操作无法撤销。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      styles: {
        content: { background: '#161b22', border: '1px solid #30363d' },
        header: { color: '#c9d1d9' },
        body: { color: '#8b949e' },
      },
      onOk: () => {
        deleteProject(p.id);
        if (currentProjectId === p.id) {
          const first = projects.find((x) => x.id !== p.id);
          if (first) handleSelect(first);
        }
        addToast('success', '项目已删除');
      },
    });
  };

  const handleDuplicate = (p: Project) => {
    const newP = duplicateProject(p.id);
    addToast('success', `已复制为「${newP.name}」`);
  };

  const handleExport = (p: Project) => {
    exportProject(p.id);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importProject(file);
      addToast('success', '项目已导入');
    } catch (err) {
      addToast('error', '导入失败：文件格式错误');
    }
    e.target.value = '';
  };

  return (
    <div className="h-full flex flex-col bg-bio-bg border-r border-bio-border">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-bio-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-bio-green via-bio-blue to-bio-purple flex items-center justify-center shadow-lg shadow-bio-blue/20">
          <Beaker className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-bio-text">GeneWorkstation</div>
          <div className="text-[10px] text-bio-text-secondary">基因检测分析平台</div>
        </div>
      </div>

      <div className="p-3 border-b border-bio-border">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-bio-text-secondary" />
            <input
              className="w-full pl-8 pr-3 py-1.5 bg-bio-panel border border-bio-border rounded text-xs text-bio-text placeholder:text-bio-text-secondary focus:outline-none focus:border-bio-blue"
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <input
            type="file"
            accept=".json"
            id="import-project"
            className="hidden"
            onChange={handleImport}
          />
          <Tooltip title="导入项目">
            <button
              onClick={() => document.getElementById('import-project')?.click()}
              className="p-1.5 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors"
            >
              <Upload className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip title="新建项目">
            <button
              onClick={() => setShowNewModal(true)}
              className="p-1.5 rounded bg-bio-blue/20 hover:bg-bio-blue/30 text-bio-blue transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="p-2 border-b border-bio-border">
        <button
          onClick={onOpenWorkflow}
          className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text transition-colors group"
        >
          <Workflow className="w-4 h-4 text-bio-purple group-hover:text-bio-purple" />
          <span className="text-sm">分析流程模板</span>
          <span className="ml-auto text-xs bg-bio-purple/20 text-bio-purple px-1.5 py-0.5 rounded">
            {templates.length}
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-bio-text-secondary">
          <Folder className="w-3.5 h-3.5" />
          我的项目
        </div>
        <span className="text-[10px] text-bio-text-secondary">
          {projects.length} 个
        </span>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-2">
        {filteredProjects.length === 0 ? (
          <div className="py-8">
            <Empty
              description={searchQuery ? '无匹配项目' : '暂无项目'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredProjects.map((p) => {
              const isActive = currentProjectId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className={`
                    group flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer transition-all
                    ${isActive
                      ? 'bg-bio-blue/15 text-bio-blue border border-bio-blue/30'
                      : 'text-bio-text hover:bg-bio-panel border border-transparent'
                    }
                  `}
                >
                  {isActive ? (
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 flex-shrink-0 text-bio-text-secondary group-hover:text-bio-text" />
                  )}
                  <div className="flex-1 min-w-0">
                    {renamingId === p.id ? (
                      <input
                        autoFocus
                        className="w-full bg-bio-bg border border-bio-blue rounded px-1.5 py-0.5 text-xs text-bio-text focus:outline-none"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(p.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onBlur={() => handleRename(p.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <div className="text-xs font-medium truncate">{p.name}</div>
                        <div className="flex items-center gap-1 text-[10px] text-bio-text-secondary mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {dayjs(p.updatedAt).fromNow()}
                        </div>
                      </>
                    )}
                  </div>
                  {renamingId !== p.id && (
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          {
                            key: 'rename',
                            label: '重命名',
                            icon: <Settings className="w-3.5 h-3.5" />,
                            onClick: ({ domEvent }) => {
                              domEvent.stopPropagation();
                              setRenamingId(p.id);
                              setRenameValue(p.name);
                            },
                          },
                          {
                            key: 'duplicate',
                            label: '复制项目',
                            icon: <Copy className="w-3.5 h-3.5" />,
                            onClick: ({ domEvent }) => {
                              domEvent.stopPropagation();
                              handleDuplicate(p);
                            },
                          },
                          {
                            key: 'export',
                            label: '导出JSON',
                            icon: <Download className="w-3.5 h-3.5" />,
                            onClick: ({ domEvent }) => {
                              domEvent.stopPropagation();
                              handleExport(p);
                            },
                          },
                          { type: 'divider' },
                          {
                            key: 'delete',
                            label: '删除',
                            danger: true,
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            onClick: ({ domEvent }) => {
                              domEvent.stopPropagation();
                              handleDelete(p);
                            },
                          },
                        ],
                      }}
                    >
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-bio-bg text-bio-text-secondary hover:text-bio-text transition-all"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </Dropdown>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-bio-border">
        <button
          onClick={() => setShowNewModal(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-bio-blue/10 hover:bg-bio-blue/20 text-bio-blue text-xs font-medium transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          新建分析项目
        </button>
      </div>

      <Modal
        title="新建项目"
        open={showNewModal}
        onOk={handleCreate}
        onCancel={() => setShowNewModal(false)}
        okText="创建"
        cancelText="取消"
        styles={{
          content: { background: '#161b22', border: '1px solid #30363d' },
          header: { color: '#c9d1d9' },
        }}
      >
        <div className="mt-4">
          <label className="block text-xs text-bio-text-secondary mb-1.5">项目名称</label>
          <input
            autoFocus
            className="w-full px-3 py-2 bg-bio-bg border border-bio-border rounded text-sm text-bio-text focus:outline-none focus:border-bio-blue"
            placeholder="例如：BRCA1 突变分析"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>
      </Modal>
    </div>
  );
}
