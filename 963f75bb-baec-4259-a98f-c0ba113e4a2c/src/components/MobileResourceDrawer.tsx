import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { X, Layers, Users, Clock, Activity, ChevronDown } from 'lucide-react';
import { useVenueStore } from '@/store/useVenueStore';
import { useScheduleStore } from '@/store/useScheduleStore';
import { cn, getStatusColor } from '@/utils/helpers';
import { formatDateTime } from '@/utils/dateUtils';
import type { Resource } from '@/types';
import HeatmapChart from '@/components/HeatmapChart';
import ResourceListMobile from '@/components/ResourceListMobile';

interface MobileResourceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileResourceDrawer({ isOpen, onClose }: MobileResourceDrawerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [drawerHeight, setDrawerHeight] = useState<'partial' | 'full'>('partial');
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const { selectedVenueId, resources, selectedResourceId, setSelectedResourceId } = useVenueStore();
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

  const stats = useMemo(() => ({
    total: venueResources.length,
    available: venueResources.filter(r => r.status === 'available').length,
    occupied: venueResources.filter(r => r.status === 'occupied').length,
    maintenance: venueResources.filter(r => r.status === 'maintenance').length,
    utilizationRate: venueResources.length > 0
      ? Math.round((venueResources.filter(r => r.status === 'occupied').length / venueResources.length) * 100)
      : 0,
  }), [venueResources]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    touchCurrentY.current = e.touches[0].clientY;

    const deltaY = touchCurrentY.current - touchStartY.current;

    if (deltaY < -50 && drawerHeight === 'partial') {
      setDrawerHeight('full');
      setIsFullscreen(true);
    } else if (deltaY > 50 && drawerHeight === 'full') {
      setDrawerHeight('partial');
      setIsFullscreen(false);
    } else if (deltaY > 100 && drawerHeight === 'partial') {
      onClose();
    }
  }, [drawerHeight, onClose]);

  const handleTouchEnd = useCallback(() => {
    touchStartY.current = null;
    touchCurrentY.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDrawerHeight('partial');
      setIsFullscreen(false);
      setSelectedResourceId(null);
    }
  }, [isOpen, setSelectedResourceId]);

  if (!isOpen) return null;

  const selectedResource = venueResources.find(r => r.id === selectedResourceId);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
        onClick={onClose}
      />

      <div
        ref={drawerRef}
        className={cn(
          'fixed left-0 right-0 bottom-0 z-50 bg-slate-900/95 backdrop-blur-xl rounded-t-3xl border-t border-slate-700/50 flex flex-col transition-all duration-300 ease-out',
          drawerHeight === 'full' ? 'h-[90vh]' : 'h-[60vh]'
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="px-4 pb-3 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="text-white font-semibold">资源状态</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDrawerHeight(drawerHeight === 'full' ? 'partial' : 'full');
                setIsFullscreen(!isFullscreen);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <ChevronDown className={cn('w-5 h-5 transition-transform', isFullscreen && 'rotate-180')} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedResource ? (
            <ResourceDetail resource={selectedResource} onClose={() => setSelectedResourceId(null)} events={events} />
          ) : (
            <>
              <div className="p-4 border-b border-slate-700/50">
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-cyan-400">{stats.total}</div>
                    <div className="text-[10px] text-slate-400 mt-1">总计</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-green-400">{stats.available}</div>
                    <div className="text-[10px] text-slate-400 mt-1">可用</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-amber-400">{stats.occupied}</div>
                    <div className="text-[10px] text-slate-400 mt-1">占用</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-slate-400">{stats.maintenance}</div>
                    <div className="text-[10px] text-slate-400 mt-1">维护</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400">资源利用率</span>
                    <span className="text-cyan-400 font-semibold">{stats.utilizationRate}%</span>
                  </div>
                  <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${stats.utilizationRate}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-700/50">
                <button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-semibold text-white">资源利用率热力图</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${showHeatmap ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showHeatmap && (
                  <div className="px-4 pb-4">
                    <HeatmapChart resources={venueResources} refreshInterval={30000} />
                  </div>
                )}
              </div>

              <ResourceListMobile
                categories={resourceCategories}
                onSelect={setSelectedResourceId}
                selectedId={selectedResourceId}
              />
            </>
          )}
        </div>

        <div className="p-3 border-t border-slate-700/50">
          <div className="flex items-center gap-3 text-xs">
            <Activity className="w-3.5 h-3.5 text-green-400 animate-pulse" />
            <span className="text-slate-400">实时同步中</span>
            <span className="ml-auto text-slate-500">
              {formatDateTime(new Date())}
            </span>
          </div>
        </div>
      </div>
    </>
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
    </div>
  );
}
