import { useState, useMemo, useRef } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Move, 
  Layers, 
  Info,
  RotateCcw,
  GripVertical
} from 'lucide-react';
import { useVenueStore } from '@/store/useVenueStore';
import { cn, getStatusColor, hexToRgba } from '@/utils/helpers';
import { formatDateTime } from '@/utils/dateUtils';
import type { Resource, VenueType } from '@/types';

export default function ResourceMap() {
  const { venues, selectedVenueId, resources, setSelectedResourceId, selectedResourceId } = useVenueStore();
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentVenue = venues.find(v => v.id === selectedVenueId);
  const venueResources = useMemo(() => 
    resources.filter(r => r.venueId === selectedVenueId),
    [resources, selectedVenueId]
  );

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

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

  const venueStyle = currentVenue ? getVenueShape(currentVenue.type) : { shape: 'rectangle', color: '#1a2f4a' };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">资源拓扑图</h1>
          <p className="text-slate-400 text-sm mt-1">
            {currentVenue?.name} - 共 {venueResources.length} 项可调度资源
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
            <button
              onClick={handleZoomOut}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
              title="重置视图"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
              showLabels 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/50'
            )}
          >
            <Info className="w-4 h-4" />
            标签
          </button>

          <button className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 rounded-xl text-sm text-slate-400 hover:bg-slate-700/50 transition-colors">
            <Layers className="w-4 h-4" />
            图层
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div 
          ref={containerRef}
          className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
          >
            <Venue3DView 
              venue={currentVenue}
              resources={venueResources}
              venueStyle={venueStyle}
              showLabels={showLabels}
              selectedResourceId={selectedResourceId}
              onSelectResource={setSelectedResourceId}
            />
          </div>

          <div className="absolute bottom-4 left-4 flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Move className="w-4 h-4" />
              <span>拖拽平移</span>
            </div>
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4" />
              <span>滚轮缩放</span>
            </div>
          </div>

          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-xl px-3 py-2 border border-slate-700/50">
            <p className="text-xs text-slate-400">当前场馆</p>
            <p className="text-sm font-semibold text-white">{currentVenue?.name}</p>
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
                { label: '可用', color: getStatusColor('available'), count: venueResources.filter(r => r.status === 'available').length },
                { label: '占用', color: getStatusColor('occupied'), count: venueResources.filter(r => r.status === 'occupied').length },
                { label: '维护', color: getStatusColor('maintenance'), count: venueResources.filter(r => r.status === 'maintenance').length },
                { label: '转换中', color: getStatusColor('transitioning'), count: venueResources.filter(r => r.status === 'transitioning').length },
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

function Venue3DView({ 
  venue, 
  resources, 
  venueStyle, 
  showLabels,
  selectedResourceId,
  onSelectResource,
}: { 
  venue: ReturnType<typeof useVenueStore.getState>['venues'][0] | undefined;
  resources: Resource[];
  venueStyle: { shape: string; color: string };
  showLabels: boolean;
  selectedResourceId: string | null;
  onSelectResource: (id: string) => void;
}) {
  const width = 600;
  const height = 450;

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      className="drop-shadow-2xl"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        <linearGradient id="venueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0f1f35" />
        </linearGradient>

        <linearGradient id="fieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1a472a" />
          <stop offset="100%" stopColor="#0d2818" />
        </linearGradient>

        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="15" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* 场馆主体 - 等距视角 */}
      <g transform="translate(50, 30)">
        {/* 场馆底部阴影 */}
        <ellipse 
          cx={width / 2 - 50} 
          cy={height - 40} 
          rx={220} 
          ry={30} 
          fill="rgba(0,0,0,0.3)" 
        />

        {/* 场馆主体 - 椭圆形体育场 */}
        <g filter="url(#shadow)">
          {/* 侧面/厚度 */}
          <ellipse 
            cx={width / 2 - 50} 
            cy={height / 2 + 60} 
            rx={200} 
            ry={120} 
            fill="#0a1628"
            stroke="#1e3a5f"
            strokeWidth="2"
          />
          
          {/* 顶部/场地 */}
          <ellipse 
            cx={width / 2 - 50} 
            cy={height / 2 - 10} 
            rx={200} 
            ry={120} 
            fill="url(#fieldGradient)"
            stroke="#2d5a87"
            strokeWidth="2"
          />

          {/* 场地标记线 */}
          <ellipse 
            cx={width / 2 - 50} 
            cy={height / 2 - 10} 
            rx={160} 
            ry={90} 
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
            strokeDasharray="5,5"
          />

          {/* 中圈 */}
          <circle 
            cx={width / 2 - 50} 
            cy={height / 2 - 10} 
            r={30} 
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
        </g>

        {/* 资源节点 */}
        {resources.map((resource, idx) => {
          const x = 50 + resource.position.x * 5;
          const y = 30 + resource.position.y * 4;
          const isSelected = selectedResourceId === resource.id;
          const statusColor = getStatusColor(resource.status);

          return (
            <g 
              key={resource.id}
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelectResource(resource.id)}
              className="cursor-pointer"
              style={{ 
                filter: isSelected ? 'url(#glow)' : undefined,
                transition: 'all 0.3s ease',
              }}
            >
              {/* 光晕效果 */}
              {isSelected && (
                <circle 
                  r={18} 
                  fill={statusColor} 
                  opacity={0.3}
                  className="animate-pulse"
                />
              )}
              
              {/* 资源节点 */}
              <circle 
                r={isSelected ? 10 : 8} 
                fill={statusColor}
                fillOpacity={0.9}
                stroke="white"
                strokeWidth={isSelected ? 2 : 1}
                strokeOpacity={0.5}
                style={{ transition: 'all 0.2s ease' }}
              />
              
              {/* 内部高光 */}
              <circle 
                r={isSelected ? 5 : 4} 
                cy="-2"
                fill="white"
                fillOpacity={0.3}
              />

              {/* 标签 */}
              {showLabels && (
                <g transform="translate(14, -6)">
                  <rect 
                    x="0" 
                    y="-10" 
                    width={resource.name.length * 10 + 16} 
                    height="20" 
                    rx="4"
                    fill="rgba(15, 23, 42, 0.9)"
                    stroke={statusColor}
                    strokeOpacity={0.3}
                  />
                  <text 
                    x="8" 
                    y="4" 
                    fill="white" 
                    fontSize="11"
                    fontWeight="500"
                  >
                    {resource.name}
                  </text>
                </g>
              )}

              {/* 连接线到场地 */}
              {resource.type === 'main_field' && (
                <line 
                  x1="0" 
                  y1="8" 
                  x2={width / 2 - 50 - x} 
                  y2={height / 2 - 10 - y + 30}
                  stroke={statusColor}
                  strokeOpacity={0.2}
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
              )}
            </g>
          );
        })}

        {/* 场馆名称 */}
        <text 
          x={width / 2 - 50} 
          y={20} 
          textAnchor="middle" 
          fill="white" 
          fontSize="16"
          fontWeight="bold"
        >
          {venue?.name}
        </text>
        
        <text 
          x={width / 2 - 50} 
          y={38} 
          textAnchor="middle" 
          fill="#64748b" 
          fontSize="11"
        >
          容量 {venue?.capacity.toLocaleString()} 人
        </text>
      </g>

      {/* 装饰性元素 - 网格背景 */}
      <g opacity="0.05">
        {Array.from({ length: 20 }).map((_, i) => (
          <line 
            key={`h-${i}`}
            x1="0" 
            y1={i * 25} 
            x2={width} 
            y2={i * 25}
            stroke="#00d4ff"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 24 }).map((_, i) => (
          <line 
            key={`v-${i}`}
            x1={i * 25} 
            y1="0" 
            x2={i * 25} 
            y2={height}
            stroke="#00d4ff"
            strokeWidth="1"
          />
        ))}
      </g>
    </svg>
  );
}
