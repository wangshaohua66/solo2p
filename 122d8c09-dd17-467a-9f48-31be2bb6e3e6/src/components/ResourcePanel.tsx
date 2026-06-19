import React, { memo, useMemo } from 'react';
import type { Resource } from '@/types';
import { useGanttStore } from '@/store/useGanttStore';
import { ResourceAllocator } from '@/core/ResourceAllocator';
import { workloadColor, poolColor, poolLabel, initials } from '@/utils/colorUtils';
import { addDays, formatDate, today, DAY_MS } from '@/utils/dateUtils';

interface ResourcePanelProps {
  onClose?: () => void;
}

export const ResourcePanel = memo(function ResourcePanel({ onClose }: ResourcePanelProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const tasks = useGanttStore(s => s.tasks);
  const resources = useGanttStore(s => s.resources);

  const { loads, conflicts } = useMemo(() => {
    const allocator = new ResourceAllocator(tasks, resources);
    const start = today();
    const end = addDays(today(), 13);
    return allocator.compute(start, end);
  }, [tasks, resources]);

  const days = useMemo(() => {
    const arr: number[] = [];
    const start = today();
    for (let i = 0; i < 14; i++) {
      arr.push(start + i * DAY_MS);
    }
    return arr;
  }, []);

  const groupedByPool = useMemo(() => {
    const groups: Record<string, Resource[]> = {
      product: [], design: [], development: [], testing: [],
    };
    for (const r of resources) groups[r.pool].push(r);
    return groups;
  }, [resources]);

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
          <div className="grid grid-cols-7 gap-px px-1 py-1">
            {days.slice(0, 7).map(d => (
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

        {(['product', 'design', 'development', 'testing'] as const).map(pool => (
          <div key={pool}>
            <div className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b ${
              theme === 'dark' ? 'bg-slate-800/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <span className={`w-2 h-2 rounded-full ${poolColor(pool)}`} />
              {poolLabel(pool)}
              <span className={`ml-auto font-normal ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
                {groupedByPool[pool].length}人
              </span>
            </div>
            {groupedByPool[pool].map(r => {
              const daily = loads.get(r.id) || new Map();
              const hasConflict = conflicts.some(c => c.resourceId === r.id);
              return (
                <div
                  key={r.id}
                  className={`grid grid-cols-[auto,1fr] items-center border-b ${
                    theme === 'dark' ? 'border-slate-800/60 hover:bg-slate-800/30' : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 px-2 py-1.5 min-w-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br ${
                      pool === 'product' ? 'from-violet-500 to-fuchsia-600' :
                      pool === 'design' ? 'from-pink-500 to-rose-600' :
                      pool === 'development' ? 'from-blue-500 to-indigo-600' :
                      'from-amber-500 to-orange-600'
                    }`}>
                      {initials(r.name)}
                    </div>
                    <span className={`text-xs truncate ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {r.name}
                    </span>
                    {hasConflict && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                    )}
                  </div>
                  <div className="grid grid-cols-7 gap-px px-1 py-1">
                    {days.slice(0, 7).map(d => {
                      const key = formatDate(d, 'long');
                      const load = daily.get(key);
                      const ratio = load ? load.workload / r.capacityPerDay : 0;
                      return (
                        <div
                          key={d}
                          className="h-5 rounded-sm flex items-center justify-center text-[9px] font-semibold text-white relative"
                          style={{
                            backgroundColor: load && load.workload > 0
                              ? undefined
                              : (theme === 'dark' ? 'rgba(100,116,139,0.1)' : 'rgba(148,163,184,0.12)'),
                          }}
                        >
                          {load && load.workload > 0 && (
                            <div
                              className={`absolute inset-0.5 rounded-sm ${workloadColor(ratio)} ${load.overload ? 'ring-2 ring-rose-500 animate-pulse' : ''}`}
                            />
                          )}
                          {load && load.workload > 0 && (
                            <span className="relative z-10" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                              {Math.round(load.workload)}
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
        ))}
      </div>
    </div>
  );
});
