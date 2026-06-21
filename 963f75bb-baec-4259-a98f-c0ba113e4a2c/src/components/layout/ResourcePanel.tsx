import { X, Thermometer, Users, Clock, Activity, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useVenueStore } from '@/store/useVenueStore';
import { useScheduleStore } from '@/store/useScheduleStore';
import { cn, getStatusColor } from '@/utils/helpers';
import { formatDateTime } from '@/utils/dateUtils';
import type { Resource } from '@/types';
import { useMemo } from 'react';

export function ResourcePanel() {
  const { 
    isResourcePanelOpen, 
    toggleResourcePanel, 
    selectedVenueId, 
    resources, 
    selectedResourceId,
    setSelectedResourceId 
  } = useVenueStore();
  const { events } = useScheduleStore();

  const venueResources = useMemo(() => 
    resources.filter(r => r.venueId === selectedVenueId),
    [resources, selectedVenueId]
  );

  const resourceCategories = useMemo(() => {
    const categories: Record<string, Resource[]> = {};
    venueResources.forEach(r => {
      if (!categories[r.category]) categories[r.category] = [];
      categories[r.category].push(r);
    });
    return categories;
  }, [venueResources]);

  const selectedResource = venueResources.find(r => r.id === selectedResourceId);

  const utilizationRate = useMemo(() => {
    if (venueResources.length === 0) return 0;
    const occupied = venueResources.filter(r => r.status === 'occupied').length;
    return Math.round((occupied / venueResources.length) * 100);
  }, [venueResources]);

  if (!isResourcePanelOpen) {
    return (
      <button
        onClick={toggleResourcePanel}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-slate-800/90 backdrop-blur border border-slate-700/50 rounded-l-xl p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/90 transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  }

  return (
    <aside className="w-80 h-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h2 className="text-white font-semibold">资源状态</h2>
        </div>
        <button
          onClick={toggleResourcePanel}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-700/50">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-400">
              {venueResources.filter(r => r.status === 'available').length}
            </div>
            <div className="text-xs text-slate-400 mt-1">可用</div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">
              {venueResources.filter(r => r.status === 'occupied').length}
            </div>
            <div className="text-xs text-slate-400 mt-1">占用</div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-slate-400">
              {venueResources.filter(r => r.status === 'maintenance').length}
            </div>
            <div className="text-xs text-slate-400 mt-1">维护</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">资源利用率</span>
            <span className="text-cyan-400 font-semibold">{utilizationRate}%</span>
          </div>
          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${utilizationRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedResource ? (
          <ResourceDetail resource={selectedResource} onClose={() => setSelectedResourceId(null)} events={events} />
        ) : (
          <ResourceList categories={resourceCategories} onSelect={setSelectedResourceId} selectedId={selectedResourceId} />
        )}
      </div>

      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 text-sm">
          <Activity className="w-4 h-4 text-green-400 animate-pulse" />
          <span className="text-slate-400">实时同步中</span>
          <span className="ml-auto text-slate-500 text-xs">
            {formatDateTime(new Date())}
          </span>
        </div>
      </div>
    </aside>
  );
}

function ResourceList({ 
  categories, 
  onSelect, 
  selectedId 
}: { 
  categories: Record<string, Resource[]>;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div className="p-3 space-y-4">
      {Object.entries(categories).map(([category, categoryResources]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
            {category}
          </h3>
          <div className="space-y-1">
            {categoryResources.map(resource => (
              <button
                key={resource.id}
                onClick={() => onSelect(resource.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left',
                  selectedId === resource.id
                    ? 'bg-cyan-500/20 border border-cyan-500/30'
                    : 'bg-slate-800/40 border border-transparent hover:bg-slate-800/70'
                )}
              >
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getStatusColor(resource.status) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{resource.name}</p>
                  <p className="text-xs text-slate-500">
                    {resource.capacity > 0 ? `容纳 ${resource.capacity} 人` : '设备资源'}
                  </p>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
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
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResourceDetail({ 
  resource, 
  onClose,
  events 
}: { 
  resource: Resource;
  onClose: () => void;
  events: ReturnType<typeof useScheduleStore.getState>['events'];
}) {
  const resourceEvents = events.filter(e => 
    e.requiredResources.includes(resource.id) && 
    e.status !== 'cancelled' &&
    e.status !== 'completed'
  ).slice(0, 5);

  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{resource.name}</h3>
          <p className="text-sm text-slate-400">{resource.category}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800/60 rounded-xl p-3">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs">容量</span>
          </div>
          <p className="text-lg font-bold text-white">
            {resource.capacity > 0 ? resource.capacity.toLocaleString() : '-'}
          </p>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-3">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">转换耗时</span>
          </div>
          <p className="text-lg font-bold text-white">
            {resource.conversionTime} 分钟
          </p>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">当前状态</h4>
        <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/60 rounded-xl">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getStatusColor(resource.status) }}
          />
          <span className="text-slate-200">
            {resource.status === 'available' && '空闲可用'}
            {resource.status === 'occupied' && '正在使用'}
            {resource.status === 'maintenance' && '维护中'}
            {resource.status === 'transitioning' && '模式转换中'}
          </span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">即将到来的使用</h4>
        {resourceEvents.length > 0 ? (
          <div className="space-y-2">
            {resourceEvents.map(event => (
              <div 
                key={event.id}
                className="px-3 py-2 bg-slate-800/60 rounded-xl border border-slate-700/30"
              >
                <p className="text-sm text-slate-200 truncate">{event.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDateTime(event.startDate)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">
            暂无预约使用
          </p>
        )}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">环境参数</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/40 rounded-lg">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-slate-400">温度</span>
            </div>
            <span className="text-sm text-slate-200">24°C</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/40 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-slate-400">湿度</span>
            </div>
            <span className="text-sm text-slate-200">55%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
