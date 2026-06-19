import React, { useEffect, useState } from 'react';
import { X, Menu } from 'lucide-react';
import { Toolbar } from '@/components/Toolbar';
import { TaskTree } from '@/components/TaskTree';
import { GanttChart } from '@/components/GanttChart';
import { ResourcePanel } from '@/components/ResourcePanel';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { useGanttStore } from '@/store/useGanttStore';
import { mockTasks, mockTaskOrder, mockDependencies, mockResources } from '@/data/mockData';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { GanttState } from '@/store/useGanttStore';

const STORAGE_KEY = 'ganttpro-state-v1';
const ROW_HEIGHT = 32;

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return match;
}

export default function App() {
  const theme = useGanttStore(s => s.ui.theme);
  const showTaskTree = useGanttStore(s => s.ui.showTaskTree);
  const showResourcePanel = useGanttStore(s => s.ui.showResourcePanel);
  const detailTaskId = useGanttStore(s => s.ui.detailTaskId);
  const setShowResourcePanel = useGanttStore(s => s.setShowResourcePanel);
  const setShowTaskTree = useGanttStore(s => s.setShowTaskTree);
  const setDetailTaskId = useGanttStore(s => s.setDetailTaskId);
  const hydrate = useGanttStore(s => s.hydrate);
  const tasks = useGanttStore(s => s.tasks);

  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1279px)');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isDesktop = useMediaQuery('(min-width: 1280px)');

  const [mobileTaskTreeOpen, setMobileTaskTreeOpen] = useState(false);
  const [resourceDrawerOpen, setResourceDrawerOpen] = useState(false);

  const [savedState, setSavedState] = useLocalStorage<Partial<GanttState> | null>(STORAGE_KEY, null);

  useEffect(() => {
    if (savedState && Object.keys(savedState).length > 0) {
      hydrate(savedState);
    } else {
      hydrate({
        tasks: mockTasks,
        taskOrder: mockTaskOrder,
        dependencies: mockDependencies,
        resources: mockResources,
        baselines: [],
        activeBaselineId: null,
      });
    }
  }, []);

  useEffect(() => {
    if (Object.keys(tasks).length === 0) return;
    const fullState = useGanttStore.getState();
    const toSave: Partial<GanttState> = {
      tasks: fullState.tasks,
      taskOrder: fullState.taskOrder,
      dependencies: fullState.dependencies,
      resources: fullState.resources,
      baselines: fullState.baselines,
      activeBaselineId: fullState.activeBaselineId,
      ui: {
        ...fullState.ui,
        criticalPathIds: [],
        selectedTaskId: null,
        highlightedDependencyIds: [],
        draggingDepFrom: null,
        detailTaskId: null,
      },
      timeline: fullState.timeline,
    };
    setSavedState(toSave);
  }, [tasks, setSavedState]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (isTablet || isMobile) {
      setShowResourcePanel(false);
    } else if (isDesktop) {
      setShowResourcePanel(true);
    }
  }, [isTablet, isMobile, isDesktop, setShowResourcePanel]);

  useEffect(() => {
    if (isMobile) {
      setShowTaskTree(false);
    } else {
      setShowTaskTree(true);
    }
  }, [isMobile, setShowTaskTree]);

  const bgClass = theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';

  const effectiveResourcePanel = isDesktop && showResourcePanel;
  const tabletResourceDrawerOpen = isTablet && resourceDrawerOpen;

  return (
    <div className={`h-screen w-screen flex flex-col ${bgClass} overflow-hidden relative`}>
      <Toolbar
        onMobileOpenTaskTree={() => isMobile && setMobileTaskTreeOpen(true)}
        onTabletOpenResource={() => isTablet && setResourceDrawerOpen(true)}
      />

      <div className="flex-1 flex min-h-0 relative">
        {showTaskTree && !isMobile && (
          <div
            className="border-r shrink-0 overflow-hidden transition-all duration-200"
            style={{ width: 300 }}
          >
            <TaskTree rowHeight={ROW_HEIGHT} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <GanttChart rowHeight={ROW_HEIGHT} />
        </div>

        {effectiveResourcePanel && (
          <div
            className="border-l shrink-0 overflow-hidden transition-all duration-200"
            style={{ width: 200 }}
          >
            <ResourcePanel onClose={() => setShowResourcePanel(false)} />
          </div>
        )}
      </div>

      {tabletResourceDrawerOpen && (
        <>
          <div
            className="absolute inset-0 bg-black/40 z-40"
            onClick={() => setResourceDrawerOpen(false)}
          />
          <div
            className={`absolute top-14 right-0 bottom-0 w-[280px] z-50 border-l shadow-2xl animate-[slideInRight_200ms_ease-out] ${
              theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="h-full flex flex-col">
              <div className={`h-12 flex items-center justify-between px-3 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  资源负载
                </span>
                <button
                  onClick={() => setResourceDrawerOpen(false)}
                  className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ResourcePanel compact />
              </div>
            </div>
          </div>
        </>
      )}

      {mobileTaskTreeOpen && (
        <>
          <div
            className="absolute inset-0 bg-black/40 z-40"
            onClick={() => setMobileTaskTreeOpen(false)}
          />
          <div
            className={`absolute left-0 right-0 bottom-0 z-50 rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col animate-[slideUp_250ms_ease-out] ${
              theme === 'dark' ? 'bg-slate-900' : 'bg-white'
            }`}
            style={{ maxHeight: '75vh' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: theme === 'dark' ? '#1e293b' : '#e2e8f0' }}>
              <span className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>任务结构</span>
              <button
                onClick={() => setMobileTaskTreeOpen(false)}
                className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <TaskTree rowHeight={ROW_HEIGHT} onTaskClick={() => setMobileTaskTreeOpen(false)} />
            </div>
          </div>
        </>
      )}

      {isMobile && (
        <div className="absolute bottom-4 left-4 right-4 flex justify-between pointer-events-none z-30">
          <button
            onClick={() => setMobileTaskTreeOpen(true)}
            className={`pointer-events-auto px-4 py-2.5 rounded-full shadow-lg flex items-center gap-1.5 ${
              theme === 'dark' ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white text-slate-800 border border-slate-200'
            }`}
          >
            <Menu size={16} />
            <span className="text-xs font-medium">任务</span>
          </button>
          <button
            onClick={() => setResourceDrawerOpen(true)}
            className={`pointer-events-auto px-4 py-2.5 rounded-full shadow-lg flex items-center gap-1.5 ${
              theme === 'dark' ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white text-slate-800 border border-slate-200'
            }`}
          >
            <span className="text-xs font-medium">资源</span>
          </button>
        </div>
      )}

      {tabletResourceDrawerOpen === false && isTablet && (
        <button
          onClick={() => setResourceDrawerOpen(true)}
          className={`absolute right-2 top-16 z-20 px-3 py-1.5 rounded-lg shadow-md text-xs font-medium ${
            theme === 'dark' ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white text-slate-800 border border-slate-200'
          }`}
        >
          资源
        </button>
      )}

      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
        />
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
