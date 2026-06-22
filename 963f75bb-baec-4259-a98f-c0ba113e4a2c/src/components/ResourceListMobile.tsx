import { useState, useMemo } from 'react';
import { Filter, Users } from 'lucide-react';
import { cn, getStatusColor } from '@/utils/helpers';
import type { Resource, ResourceStatus } from '@/types';

interface ResourceListMobileProps {
  categories: Record<string, Resource[]>;
  onSelect: (id: string) => void;
  selectedId: string | null;
}

type FilterStatus = 'all' | ResourceStatus;

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'available', label: '可用' },
  { value: 'occupied', label: '占用' },
  { value: 'maintenance', label: '维护' },
  { value: 'transitioning', label: '转换中' },
];

export default function ResourceListMobile({
  categories,
  onSelect,
  selectedId
}: ResourceListMobileProps) {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const allResources = useMemo(() => {
    return Object.values(categories).flat();
  }, [categories]);

  const filteredResources = useMemo(() => {
    if (statusFilter === 'all') return allResources;
    return allResources.filter(r => r.status === statusFilter);
  }, [allResources, statusFilter]);

  const filteredCategories = useMemo(() => {
    const result: Record<string, Resource[]> = {};
    Object.entries(categories).forEach(([category, resources]) => {
      const filtered = resources.filter(r =>
        statusFilter === 'all' || r.status === statusFilter
      );
      if (filtered.length > 0) {
        result[category] = filtered;
      }
    });
    return result;
  }, [categories, statusFilter]);

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                statusFilter === filter.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/50 border border-transparent'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {filteredResources.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-800/60 flex items-center justify-center">
            <Users className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">暂无符合条件的资源</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(filteredCategories).map(([category, categoryResources]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryResources.map(resource => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    isSelected={selectedId === resource.id}
                    onClick={() => onSelect(resource.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceCard({
  resource,
  isSelected,
  onClick
}: {
  resource: Resource;
  isSelected: boolean;
  onClick: () => void;
}) {
  const utilization = resource.status === 'occupied' ? 75 : resource.status === 'transitioning' ? 40 : 15;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-xl border transition-all duration-200 text-left',
        isSelected
          ? 'bg-cyan-500/15 border-cyan-500/30'
          : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center relative overflow-hidden">
            <Users className="w-6 h-6 text-slate-400" />
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500/30 to-transparent transition-all duration-500"
              style={{ height: `${utilization}%` }}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-white truncate">{resource.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {resource.capacity > 0 ? `容纳 ${resource.capacity} 人` : '设备资源'}
              </p>
            </div>
            <span className={cn(
              'flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium',
              resource.status === 'available' && 'bg-green-500/20 text-green-400',
              resource.status === 'occupied' && 'bg-amber-500/20 text-amber-400',
              resource.status === 'maintenance' && 'bg-slate-500/20 text-slate-400',
              resource.status === 'transitioning' && 'bg-blue-500/20 text-blue-400',
            )}>
              {resource.status === 'available' && '空闲'}
              {resource.status === 'occupied' && '占用'}
              {resource.status === 'maintenance' && '维护'}
              {resource.status === 'transitioning' && '转换中'}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getStatusColor(resource.status) }}
              />
              <span className="text-[10px] text-slate-500">
                转换耗时: {resource.conversionTime}分钟
              </span>
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-slate-500">利用率</span>
              <span className="text-slate-400">{utilization}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  resource.status === 'available' && 'bg-green-500/50',
                  resource.status === 'occupied' && 'bg-amber-500/50',
                  resource.status === 'maintenance' && 'bg-slate-500/50',
                  resource.status === 'transitioning' && 'bg-blue-500/50',
                )}
                style={{ width: `${utilization}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
