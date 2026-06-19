import React, { memo, useMemo } from 'react';
import type { Resource } from '@/types';
import { useGanttStore } from '@/store/useGanttStore';
import { ResourceAllocator } from '@/core/ResourceAllocator';
import { workloadColor, poolColor, poolLabel, initials } from '@/utils/colorUtils';
import { addDays, formatDate, formatDateKey, today, DAY_MS } from '@/utils/dateUtils';

interface ResourcePanelProps {
  compact?: boolean;
  onClose?: () => void;
}

export const ResourcePanel = memo(function ResourcePanel({ compact, onClose }: ResourcePanelProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const tasks = useGanttStore(s => s.tasks);
  const resources = useGanttStore(s => s.resources);
  const setDetailTaskId = useGanttStore(s => s.setDetailTaskId);
  const setSelectedTask = useGanttStore(s => s.setSelectedTask);

  const { loads, conflicts } = useMemo(() => {
    const allocator = new ResourceAllocator(tasks, resources);
    const start = today();
    const end = addDays(today(), 13);
    return allocator.compute(start, end);
  }, [tasks, resources]);

  const displayDays = compact ? 5 : 7;

  const days = useMemo(() => {
    const arr: number[] = [];
    const start = today();
    for (let i = 0; i < displayDays; i++) {
      arr.push(start + i * DAY_MS);
    }
    return arr;
  }, [displayDays]);

  const groupedByPool = useMemo(() => {
    const groups: Record<string, Resource[]> = {
      product: [], design: [], development: [], testing: [],
    };
    for (const r of resources) groups[r.pool].push(r);
    return groups;
  }, [resources]);

  function handleCellClick(taskIds: string[]) {
    if (taskIds.length === 0) return;
    const tid = taskIds[0];
    setSelectedTask(tid);
    setDetailTaskId(tid);
  }

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
      <div className={`sticky top-0 z-10 h-12 flex items-center justify-between px-3 border-b ${
        theme === 'dark' ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
      } backdrop-blur`}>
        <span className={`text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          资源负载
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className={`text-xs px-2 py-1 rounded ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            隐藏
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className={`sticky top-0 z-10 grid grid-cols-[auto,1fr] border-b text-[10px] ${
          theme === 'dark' ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
        } backdrop-blur`}>
          <div className="py-1.5 px-2" />
          <div className={`grid gap-px px-1 py-1`} style={{ gridTemplateColumns: `repeat(${displayDays}, minmax(0, 1fr))` }}>
            {days.map(d => (
              <div key={d} className="text-center">
                <div className={`${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {formatDate(d, 'day')}
                </div>
                <div className={`${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`}>
                  {['日', '一', '二', '三', '四', '五', '六'][new Date(d).getDay()]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {(['product', 'design', 'development', 'testing'] as const).map(pool => {
          const poolResources = groupedByPool[pool];
          if (compact && poolResources.length === 0) return null;
          return (
            <div key={pool}>
              <div className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b ${
                theme === 'dark' ? 'bg-slate-800/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <span className={`w-2 h-2 rounded-full ${poolColor(pool)}`} />
                {poolLabel(pool)}
                {!compact && (
                  <span className={`ml-auto font-normal ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
                    {poolResources.length}人
                  </span>
                )}
              </div>
              {poolResources.map(r => {
                const daily = loads.get(r.id) || new Map();
                const hasConflict = conflicts.some(c => c.resourceId === r.id);
                return (
                  <div
                    key={r.id}
                    className={`grid grid-cols-[auto,1fr] items-center border-b ${
                      theme === 'dark' ? 'border-slate-800/60 hover:bg-slate-800/30' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 py-1.5 min-w-0 ${compact ? 'px-1.5' : 'px-2'}`}>
                      <div className={`${compact ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[9px]'} rounded-full flex items-center justify-center font-bold text-white shrink-0 bg-gradient-to-br ${
                        pool === 'product' ? 'from-violet-500 to-fuchsia-600' :
                        pool === 'design' ? 'from-pink-500 to-rose-600' :
                        pool === 'development' ? 'from-blue-500 to-indigo-600' :
                        'from-amber-500 to-orange-600'
                      }`}>
                        {initials(r.name)}
                      </div>
                      {!compact && (
                        <span className={`text-xs truncate flex-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          {r.name}
                        </span>
                      )}
                      {hasConflict && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" title="资源超载" />
                      )}
                    </div>
                    <div className={`grid gap-px py-1 ${compact ? 'px-0.5' : 'px-1'}`} style={{ gridTemplateColumns: `repeat(${displayDays}, minmax(0, 1fr))` }}>
                      {days.map(d => {
                        const key = formatDateKey(d);
                        const load = daily.get(key);
                        const ratio = load ? load.workload / r.capacityPerDay : 0;
                        const hasLoad = load && load.workload > 0;
                        return (
                          <div
                            key={d}
                            className={`${compact ? 'h-4 text-[8px]' : 'h-5 text-[9px]'} rounded-sm flex items-center justify-center font-semibold text-white relative cursor-pointer transition-transform hover:scale-[1.08] active:scale-95 ${
                              hasLoad ? 'ring-1 ring-white/20' : ''
                            }`}
                            style={{
                              backgroundColor: hasLoad
                                ? undefined
                                : (theme === 'dark' ? 'rgba(100,116,139,0.1)' : 'rgba(148,163,184,0.12)'),
                            }}
                            onClick={() => handleCellClick(load?.taskIds || [])}
                            title={hasLoad
                              ? `${r.name} · ${formatDate(d, 'short')} · ${Math.round(load!.workload)}h · 点击查看任务`
                              : `${r.name} · ${formatDate(d, 'short')} · 无任务`}
                          >
                            {hasLoad && (
                              <div
                                className={`absolute inset-0.5 rounded-sm ${workloadColor(ratio)} ${load!.overload ? 'ring-2 ring-rose-500 animate-pulse' : ''}`}
                              />
                            )}
                            {hasLoad && (
                              <span className="relative z-10 tabular-nums" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                                {compact ? (load!.workload >= r.capacityPerDay ? '!' : Math.round(load!.workload)) : Math.round(load!.workload)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className={`px-3 py-2 text-[10px] border-t ${
          theme === 'dark' ? 'bg-slate-800/30 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
        }`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span>图例：</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-emerald-500/70" /> 正常
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-amber-500/70" /> 偏高
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-rose-500/70 ring-2 ring-rose-500" /> 超载
            </span>
            {!compact && <span className="ml-auto opacity-70">点击格查看任务</span>}
          </div>
        </div>
      </div>
    </div>
  );
});
