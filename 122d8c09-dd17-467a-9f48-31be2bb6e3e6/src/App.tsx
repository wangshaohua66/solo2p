import React, { useEffect } from 'react';
import { Toolbar } from '@/components/Toolbar';
import { TaskTree } from '@/components/TaskTree';
import { GanttChart } from '@/components/GanttChart';
import { ResourcePanel } from '@/components/ResourcePanel';
import { useGanttStore } from '@/store/useGanttStore';
import { mockTasks, mockTaskOrder, mockDependencies, mockResources } from '@/data/mockData';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { GanttState } from '@/store/useGanttStore';

const STORAGE_KEY = 'ganttpro-state-v1';
const ROW_HEIGHT = 32;

export default function App() {
  const theme = useGanttStore(s => s.ui.theme);
  const showTaskTree = useGanttStore(s => s.ui.showTaskTree);
  const showResourcePanel = useGanttStore(s => s.ui.showResourcePanel);
  const hydrate = useGanttStore(s => s.hydrate);
  const tasks = useGanttStore(s => s.tasks);

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

  const bgClass = theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';

  return (
    <div className={`h-screen w-screen flex flex-col ${bgClass} overflow-hidden`}>
      <Toolbar />
      <div className="flex-1 flex min-h-0">
        {showTaskTree && (
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
        {showResourcePanel && (
          <div
            className="border-l shrink-0 overflow-hidden transition-all duration-200 hidden lg:block"
            style={{ width: 260 }}
          >
            <ResourcePanel onClose={() => useGanttStore.getState().setShowResourcePanel(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
