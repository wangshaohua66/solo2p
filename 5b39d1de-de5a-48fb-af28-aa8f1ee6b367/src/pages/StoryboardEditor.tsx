import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SceneTree } from '@/components/Scene/SceneTree';
import { StoryCanvas } from '@/components/Canvas/StoryCanvas';
import { Toolbar } from '@/components/Canvas/Toolbar';
import { PropertyPanel } from '@/components/Property/PropertyPanel';
import { Drawer } from '@/components/Common/Drawer';
import { JsonExporter } from '@/components/Export/JsonExporter';
import { useProjectStore } from '@/stores/projectStore';
import { useResponsive } from '@/hooks/useResponsive';
import { Modal } from '@/components/Common/Modal';

export const StoryboardEditor: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isXl, isXs, isMdUp } = useResponsive();

  const currentProject = useProjectStore((s) => s.currentProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const shots = useProjectStore((s) => s.shots);
  const scenes = useProjectStore((s) => s.scenes);
  const canUndo = useProjectStore((s) => s.canUndo());
  const canRedo = useProjectStore((s) => s.canRedo());

  const [sceneDrawerOpen, setSceneDrawerOpen] = useState(false);
  const [propertyDrawerOpen, setPropertyDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const projectId = searchParams.get('project');

  useEffect(() => {
    const init = async () => {
      if (!projectId) {
        navigate('/projects');
        return;
      }
      await loadProject(projectId);
      setLoading(false);
    };
    init();
  }, [projectId, loadProject, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const isCtrl = e.metaKey || e.ctrlKey;
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((isCtrl && e.shiftKey && e.key === 'z') || (isCtrl && e.key === 'y')) {
        e.preventDefault();
        redo();
      } else if (isCtrl && e.key === 'e') {
        e.preventDefault();
        setExportOpen(true);
      } else if (isCtrl && e.key === 'p') {
        e.preventDefault();
        if (projectId) navigate(`/preview?project=${projectId}`);
      } else if (e.key === 'Escape' && projectId) {
        navigate('/projects');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, navigate, projectId]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#1e1e2e]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-3 border-[#7c3aed] border-t-transparent animate-spin"></div>
          <p className="text-gray-400 text-sm">加载项目中...</p>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1e1e2e] gap-4">
        <p className="text-gray-300">项目不存在</p>
        <button
          onClick={() => navigate('/projects')}
          className="px-4 py-2 bg-[#7c3aed] text-white rounded-lg text-sm hover:bg-[#6d28d9] transition-colors"
        >
          返回项目列表
        </button>
      </div>
    );
  }

  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);

  const renderScenePanel = () => (
    <div
      className="h-full overflow-hidden bg-[#1e1e2e] border-r border-white/10"
      style={{ width: 240 }}
    >
      <SceneTree />
    </div>
  );

  const renderPropertyPanel = () => (
    <div
      className="h-full overflow-hidden bg-[#1e1e2e] border-l border-white/10"
      style={{ width: 280 }}
    >
      <PropertyPanel />
    </div>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-[#161622] text-white overflow-hidden">
      <header className="h-12 flex items-center justify-between px-4 border-b border-white/10 bg-[#1e1e2e] flex-shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          {!isXl && (
            <button
              onClick={() => setSceneDrawerOpen(true)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 transition-colors lg:hidden"
              title="场景树"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
          )}
          <button
            onClick={() => navigate('/projects')}
            className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 transition-colors"
            title="返回项目列表 (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#a855f7] flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-lg shadow-[#7c3aed]/20">
            S
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-100 truncate">
              {currentProject.name}
            </h1>
            <p className="text-[10px] text-gray-500 flex items-center gap-3">
              <span>{scenes.length} 幕</span>
              <span>{shots.length} 分镜</span>
              <span>~{totalDuration.toFixed(1)}s</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1 mr-2 text-[10px] text-gray-500">
            {canUndo ? (
              <span className="flex items-center gap-1 text-emerald-400/80">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="6" />
                </svg>
                历史就绪
              </span>
            ) : (
              <span className="opacity-50">无历史记录</span>
            )}
          </div>
          <button
            onClick={() => projectId && navigate(`/preview?project=${projectId}`)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-gray-200 hover:bg-white/10 transition-colors"
            title="时间轴预览 (Ctrl+P)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            预览
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-gray-200 hover:bg-white/10 transition-colors"
            title="导出项目 (Ctrl+E)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            导出
          </button>
          {!isMdUp && (
            <button
              onClick={() => setPropertyDrawerOpen(true)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 transition-colors"
              title="属性面板"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.36.15.68.39.92.68A1.65 1.65 0 0019.4 15z" />
              </svg>
            </button>
          )}
          <div className="h-5 w-px bg-white/10 mx-1" />
          <div className="text-[10px] text-gray-500 font-mono hidden md:block">
            {new Date().toLocaleDateString('zh-CN')}
          </div>
        </div>
      </header>

      <main className="flex-1 flex min-h-0 relative">
        {isXl && renderScenePanel()}

        <div className="flex-1 min-w-0 flex flex-col bg-[#161622] relative">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-3xl px-4 pointer-events-none">
            <div className="pointer-events-auto mx-auto">
              <Toolbar />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <StoryCanvas />
          </div>
          <div className="h-12 flex items-center justify-between px-4 border-t border-white/10 bg-[#1e1e2e] text-[11px] text-gray-500 flex-shrink-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 text-[9px] rounded bg-white/5 border border-white/10 font-mono">Ctrl</kbd>
                +
                <kbd className="px-1.5 py-0.5 text-[9px] rounded bg-white/5 border border-white/10 font-mono">Z</kbd>
                <span className="ml-1">撤销</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 text-[9px] rounded bg-white/5 border border-white/10 font-mono">Shift</kbd>
                +
                <kbd className="px-1.5 py-0.5 text-[9px] rounded bg-white/5 border border-white/10 font-mono">Z</kbd>
                <span className="ml-1">重做</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 text-[9px] rounded bg-white/5 border border-white/10 font-mono">Space</kbd>
                <span className="ml-1">平移</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>1-5 工具切换</span>
              <span>E 橡皮擦</span>
              <span>滚轮缩放</span>
            </div>
          </div>
        </div>

        {isXl && renderPropertyPanel()}
      </main>

      <Drawer
        open={sceneDrawerOpen}
        onClose={() => setSceneDrawerOpen(false)}
        title="场景树"
        position={isXs ? 'bottom' : 'left'}
        width={280}
        height={isXs ? '60vh' : undefined}
      >
        <SceneTree />
      </Drawer>

      <Drawer
        open={propertyDrawerOpen}
        onClose={() => setPropertyDrawerOpen(false)}
        title="属性面板"
        position={isXs ? 'bottom' : 'right'}
        width={320}
        height={isXs ? '70vh' : undefined}
      >
        <PropertyPanel />
      </Drawer>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="导出 / 导入"
        width={520}
      >
        <JsonExporter onClose={() => setExportOpen(false)} />
      </Modal>
    </div>
  );
};
