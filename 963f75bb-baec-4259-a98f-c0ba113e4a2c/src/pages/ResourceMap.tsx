import { useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Info, Layers, GripVertical } from 'lucide-react';
import { useVenueStore } from '@/store/useVenueStore';
import { cn, getStatusColor } from '@/utils/helpers';
import ResourceMap3D from '@/components/ResourceMap3D';
import type { Resource, VenueType } from '@/types';

export default function ResourceMap() {
  const { 
    venues, 
    selectedVenueId, 
    resources, 
    setSelectedResourceId, 
    selectedResourceId,
    updateResourcePosition
  } = useVenueStore();

  const currentVenue = venues.find(v => v.id === selectedVenueId);
  const venueResources = useMemo(() => 
    resources.filter(r => r.venueId === selectedVenueId),
    [resources, selectedVenueId]
  );

  const resourceCategories = useMemo(() => {
    const cats: Record<string, Resource[]> = {};
    venueResources.forEach(r => {
      if (!cats[r.category]) cats[r.category] = [];
      cats[r.category].push(r);
    });
    return cats;
  }, [venueResources]);

  const getVenueShape = (type: VenueType) => {
    switch (type) {
      case 'stadium':
        return { shape: 'oval', color: '#1e3a5f' };
      case 'arena':
        return { shape: 'rectangle', color: '#1a2f4a' };
      case 'aquatic_center':
        return { shape: 'pool', color: '#0f2847' };
      default:
        return { shape: 'rectangle', color: '#1a2f4a' };
    }
  };

  const handleUpdateResourcePosition = (resourceId: string, position: { x: number; y: number; z: number }) => {
    updateResourcePosition(resourceId, position);
  };

  const venueStyle = currentVenue ? getVenueShape(currentVenue.type) : { shape: 'rectangle', color: '#1a2f4a' };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">3D 资源拓扑图</h1>
          <p className="text-slate-400 text-sm mt-1">
            {currentVenue?.name} - 共 {resources.length} 项可调度资源（3个场馆）
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
            <button
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 w-12 text-center">
              3D 视图
            </span>
            <button
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
              title="重置视图"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
              'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            )}
          >
            <Info className="w-4 h-4" />
            3D 模式
          </button>

          <button className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 rounded-xl text-sm text-slate-400 hover:bg-slate-700/50 transition-colors">
            <Layers className="w-4 h-4" />
            图层
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden relative">
          <ResourceMap3D
            venues={venues}
            resources={resources}
            selectedResourceId={selectedResourceId}
            onSelectResource={setSelectedResourceId}
            onUpdateResourcePosition={handleUpdateResourcePosition}
          />

          <div className="absolute bottom-4 left-48 flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4" />
              <span>滚轮缩放</span>
            </div>
          </div>

          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-xl px-3 py-2 border border-slate-700/50">
            <p className="text-xs text-slate-400">当前场馆</p>
            <p className="text-sm font-semibold text-white">{currentVenue?.name}</p>
          </div>

          <div className="absolute top-4 right-4 flex flex-col gap-2">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs transition-all',
                  venue.id === selectedVenueId
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-700/50 hover:bg-slate-800/80 cursor-pointer'
                )}
              >
                <p className="font-medium">{venue.name}</p>
                <p className="text-[10px] opacity-75">{venue.type === 'stadium' ? '主体育场' : venue.type === 'arena' ? '综合体育馆' : '游泳跳水馆'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-56 flex-shrink-0 space-y-4">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">资源分类</h3>
            <div className="space-y-2">
              {Object.entries(resourceCategories).map(([category, items]) => {
                const available = items.filter(i => i.status === 'available').length;
                return (
                  <div key={category} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{category}</span>
                    <span className="text-slate-300">
                      <span className="text-green-400">{available}</span>
                      <span className="text-slate-600"> / </span>
                      {items.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">状态图例</h3>
            <div className="space-y-2">
              {[
                { label: '可用', color: getStatusColor('available'), count: resources.filter(r => r.status === 'available').length },
                { label: '占用', color: getStatusColor('occupied'), count: resources.filter(r => r.status === 'occupied').length },
                { label: '维护', color: getStatusColor('maintenance'), count: resources.filter(r => r.status === 'maintenance').length },
                { label: '保留', color: getStatusColor('transitioning'), count: resources.filter(r => r.status === 'transitioning').length },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ 
                        backgroundColor: item.color,
                        boxShadow: `0 0 8px ${item.color}80`,
                      }}
                    />
                    <span className="text-slate-400">{item.label}</span>
                  </div>
                  <span className="text-slate-300">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">场馆分层</h3>
            <div className="space-y-2">
              {[
                { name: '主体育场', y: '0m', resources: resources.filter(r => r.venueId === 'venue-1').length },
                { name: '综合体育馆', y: '15m', resources: resources.filter(r => r.venueId === 'venue-2').length },
                { name: '游泳跳水馆', y: '30m', resources: resources.filter(r => r.venueId === 'venue-3').length },
              ].map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: ['#1e3a5f', '#1a2f4a', '#0f2847'][index] }}
                    />
                    <span className="text-slate-400">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{item.y}</span>
                    <span className="text-slate-300">{item.resources}个</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2">快速操作</h3>
            <div className="space-y-2">
              <button className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors">
                批量分配资源
              </button>
              <button className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors">
                导出资源报表
              </button>
              <button className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors">
                设备状态检查
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
