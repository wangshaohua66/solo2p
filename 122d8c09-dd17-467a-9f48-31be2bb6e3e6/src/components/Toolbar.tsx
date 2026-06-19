import React, { memo, useState, useRef } from 'react';
import {
  Sun, Moon, ZoomIn, ZoomOut, Target, ListEnd, LayoutGrid,
  Download, Upload, Save, Trash2, Calendar, ChevronDown, Plus, X, Menu, Users,
} from 'lucide-react';
import type { TimelineGranularity, Theme } from '@/types';
import { useGanttStore } from '@/store/useGanttStore';

const GRAN_OPTIONS: Array<{ value: TimelineGranularity; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季' },
];

interface ToolbarProps {
  onMobileOpenTaskTree?: () => void;
  onTabletOpenResource?: () => void;
}

export const Toolbar = memo(function Toolbar({ onMobileOpenTaskTree, onTabletOpenResource }: ToolbarProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const granularity = useGanttStore(s => s.timeline.granularity);
  const toggleTheme = useGanttStore(s => s.toggleTheme);
  const setGranularity = useGanttStore(s => s.setTimelineGranularity);
  const scrollToToday = useGanttStore(s => s.scrollToToday);
  const setShowTaskTree = useGanttStore(s => s.setShowTaskTree);
  const setShowResourcePanel = useGanttStore(s => s.setShowResourcePanel);
  const showTaskTree = useGanttStore(s => s.ui.showTaskTree);
  const showResourcePanel = useGanttStore(s => s.ui.showResourcePanel);
  const exportData = useGanttStore(s => s.exportData);
  const importData = useGanttStore(s => s.importData);
  const saveBaseline = useGanttStore(s => s.saveBaseline);
  const baselines = useGanttStore(s => s.baselines);
  const activeBaselineId = useGanttStore(s => s.activeBaselineId);
  const setActiveBaseline = useGanttStore(s => s.setActiveBaseline);
  const deleteBaseline = useGanttStore(s => s.deleteBaseline);
  const computeCriticalPath = useGanttStore(s => s.computeCriticalPath);
  const setCriticalPathIds = useGanttStore(s => (ids: string[]) => {
    useGanttStore.setState(state => ({ ui: { ...state.ui, criticalPathIds: ids } }));
  });
  const wheelZoomTimeline = useGanttStore(s => s.wheelZoomTimeline);

  const [showBaselineMenu, setShowBaselineMenu] = useState(false);
  const [baselineName, setBaselineName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const btnBase = `flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-md text-sm transition-colors ${
    theme === 'dark'
      ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
  }`;

  const btnActive = theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-900';

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gantt-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importData(ev.target?.result as string);
      } catch (err) {
        alert('导入失败：无效的 JSON 文件');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleComputeCritical = () => {
    const ids = computeCriticalPath();
    setCriticalPathIds(ids);
  };

  const handleSaveBaseline = () => {
    const name = baselineName.trim() || `基线 ${new Date().toLocaleDateString('zh-CN')}`;
    saveBaseline(name);
    setBaselineName('');
  };

  return (
    <div
      className={`h-14 px-3 flex items-center gap-1 border-b backdrop-blur-md ${
        theme === 'dark'
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-white/80 border-slate-200'
      }`}
    >
      <button
        className={`lg:hidden p-1.5 rounded-md ${
          theme === 'dark' ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
        }`}
        onClick={onMobileOpenTaskTree}
        title="任务树"
      >
        <Menu size={18} />
      </button>

      <div className="flex items-center gap-2 mr-3 ml-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
          <Calendar size={16} className="text-white" />
        </div>
        <div className="hidden sm:block">
          <div className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            GanttPro
          </div>
          <div className={`text-[10px] -mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            项目管理工作台
          </div>
        </div>
      </div>

      <div className={`h-6 w-px mx-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />

      <button
        className={`md:hidden p-1.5 rounded-md ${
          theme === 'dark' ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
        }`}
        onClick={onTabletOpenResource}
        title="资源"
      >
        <Users size={16} />
      </button>

      <button className={`${btnBase} ${showTaskTree ? btnActive : ''} max-lg:hidden`} onClick={() => setShowTaskTree(!showTaskTree)} title="任务树">
        <ListEnd size={15} />
        <span className="hidden lg:inline text-xs">任务树</span>
      </button>

      <button className={`${btnBase} ${showResourcePanel ? btnActive : ''} max-lg:hidden`} onClick={() => setShowResourcePanel(!showResourcePanel)} title="资源面板">
        <LayoutGrid size={15} />
        <span className="hidden lg:inline text-xs">资源</span>
      </button>

      <button className={btnBase} onClick={handleComputeCritical} title="计算关键路径">
        <Target size={15} />
        <span className="hidden lg:inline text-xs">关键路径</span>
      </button>

      <div className={`h-6 w-px mx-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />

      <div className={`flex items-center rounded-md p-0.5 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {GRAN_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setGranularity(opt.value)}
            className={`h-7 px-2.5 rounded text-xs font-medium transition-colors ${
              granularity === opt.value
                ? (theme === 'dark' ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow')
                : (theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900')
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button className={btnBase} onClick={() => {
        const order: TimelineGranularity[] = ['day', 'week', 'month', 'quarter'];
        const idx = order.indexOf(granularity);
        if (idx > 0) setGranularity(order[idx - 1]);
      }} title="放大">
        <ZoomIn size={15} />
      </button>
      <button className={btnBase} onClick={() => {
        const order: TimelineGranularity[] = ['day', 'week', 'month', 'quarter'];
        const idx = order.indexOf(granularity);
        if (idx < order.length - 1) setGranularity(order[idx + 1]);
      }} title="缩小">
        <ZoomOut size={15} />
      </button>

      <button
        className={`flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-md text-sm transition-colors ${
          theme === 'dark'
            ? 'text-rose-300 hover:bg-rose-500/20 hover:text-rose-200'
            : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
        }`}
        onClick={scrollToToday}
        title="定位到今天"
      >
        <Target size={15} />
        <span className="hidden lg:inline text-xs">今天</span>
      </button>

      <div className={`h-6 w-px mx-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />

      <div className="relative">
        <button
          className={btnBase}
          onClick={() => setShowBaselineMenu(!showBaselineMenu)}
        >
          <Save size={15} />
          <span className="hidden lg:inline text-xs">基线</span>
          <ChevronDown size={12} />
        </button>
        {showBaselineMenu && (
          <div
            className={`absolute top-full left-0 mt-1 w-64 rounded-lg shadow-2xl border z-50 overflow-hidden ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-2.5 border-b" style={{ borderColor: theme === 'dark' ? '#334155' : '#E2E8F0' }}>
              <div className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>保存新基线</div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={baselineName}
                  onChange={e => setBaselineName(e.target.value)}
                  placeholder="基线名称"
                  className={`flex-1 h-8 px-2 rounded text-xs outline-none ${
                    theme === 'dark' ? 'bg-slate-900 text-slate-200 border border-slate-700 focus:border-blue-500' : 'bg-slate-50 text-slate-800 border border-slate-200 focus:border-blue-400'
                  }`}
                />
                <button
                  onClick={handleSaveBaseline}
                  className="h-8 px-3 rounded bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium"
                >
                  <Plus size={12} className="inline mr-1" />保存
                </button>
              </div>
            </div>
            <div className="max-h-56 overflow-auto">
              {baselines.length === 0 && (
                <div className={`p-4 text-center text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  暂无基线快照
                </div>
              )}
              {baselines.map(b => (
                <div
                  key={b.id}
                  className={`flex items-center gap-2 px-2.5 py-2 text-xs cursor-pointer border-b ${
                    theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-700/40' : 'border-slate-100 hover:bg-slate-50'
                  } ${activeBaselineId === b.id ? (theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50') : ''}`}
                  onClick={() => setActiveBaseline(activeBaselineId === b.id ? null : b.id)}
                >
                  <Save size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{b.name}</div>
                    <div className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {new Date(b.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteBaseline(b.id); }}
                    className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button className={btnBase} onClick={() => fileInputRef.current?.click()} title="导入 JSON">
        <Upload size={15} />
        <span className="hidden lg:inline text-xs">导入</span>
      </button>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      <button className={btnBase} onClick={handleExport} title="导出 JSON">
        <Download size={15} />
        <span className="hidden lg:inline text-xs">导出</span>
      </button>

      <div className="flex-1" />

      <button
        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
          theme === 'dark'
            ? 'hover:bg-slate-800 text-amber-400'
            : 'hover:bg-slate-200 text-indigo-600'
        }`}
        onClick={toggleTheme}
        title={theme === 'dark' ? '切换亮色' : '切换暗色'}
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </div>
  );
});
