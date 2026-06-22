import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Resource } from '@/types';

interface HeatmapDataPoint {
  resourceId: string;
  resourceName: string;
  datetime: Date;
  utilization: number;
  status: 'available' | 'occupied' | 'maintenance' | 'transitioning';
}

interface HeatmapChartProps {
  resources: Resource[];
  refreshInterval?: number;
}

interface TooltipData {
  x: number;
  y: number;
  resourceName: string;
  datetime: Date;
  utilization: number;
  status: string;
}

const STATUS_NAMES: Record<string, string> = {
  available: '可用',
  occupied: '占用',
  maintenance: '维护',
  transitioning: '保留',
};

const generateHeatmapData = (resources: Resource[]): HeatmapDataPoint[] => {
  const data: HeatmapDataPoint[] = [];
  const now = new Date();
  now.setMinutes(0, 0, 0);

  resources.forEach((resource) => {
    for (let hourOffset = -23; hourOffset <= 0; hourOffset++) {
      const datetime = new Date(now);
      datetime.setHours(datetime.getHours() + hourOffset);

      let utilization: number;
      let status: HeatmapDataPoint['status'];

      if (resource.status === 'maintenance') {
        utilization = 0;
        status = 'maintenance';
      } else if (resource.status === 'occupied') {
        utilization = 70 + Math.floor(Math.random() * 30);
        status = 'occupied';
      } else if (resource.status === 'transitioning') {
        utilization = 30 + Math.floor(Math.random() * 20);
        status = 'transitioning';
      } else {
        utilization = Math.floor(Math.random() * 40);
        status = 'available';
      }

      if (hourOffset > -9 && hourOffset < -2) {
        utilization = Math.min(100, utilization + 30);
      }

      data.push({
        resourceId: resource.id,
        resourceName: resource.name,
        datetime,
        utilization,
        status,
      });
    }
  });

  return data;
};

const getHeatmapColor = (utilization: number): string => {
  if (utilization === 0) return '#1e293b';
  if (utilization < 20) return '#0c4a6e';
  if (utilization < 40) return '#0369a1';
  if (utilization < 60) return '#0891b2';
  if (utilization < 80) return '#059669';
  if (utilization < 90) return '#d97706';
  return '#dc2626';
};

const formatTimeLabel = (date: Date): string => {
  return format(date, 'HH:mm', { locale: zhCN });
};

const formatDateLabel = (date: Date): string => {
  return format(date, 'MM/dd', { locale: zhCN });
};

export default function HeatmapChart({
  resources,
  refreshInterval = 30000,
}: HeatmapChartProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[]>([]);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const cellWidth = 28;
  const cellHeight = 24;
  const rowHeaderWidth = 120;
  const colHeaderHeight = 50;
  const legendHeight = 40;

  const refreshData = useCallback(() => {
    const newData = generateHeatmapData(resources);
    setHeatmapData(newData);
    setLastUpdated(new Date());
  }, [resources]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshData, refreshInterval]);

  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    const now = new Date();
    now.setMinutes(0, 0, 0);
    for (let i = -23; i <= 0; i++) {
      const date = new Date(now);
      date.setHours(date.getHours() + i);
      slots.push(date);
    }
    return slots;
  }, []);

  const svgWidth = rowHeaderWidth + timeSlots.length * cellWidth + 20;
  const svgHeight = colHeaderHeight + resources.length * cellHeight + legendHeight + 20;

  const handleMouseEnter = (
    e: React.MouseEvent<SVGRectElement>,
    data: HeatmapDataPoint
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      resourceName: data.resourceName,
      datetime: data.datetime,
      utilization: data.utilization,
      status: STATUS_NAMES[data.status] || data.status,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const getDataPoint = (resourceId: string, datetime: Date): HeatmapDataPoint | undefined => {
    return heatmapData.find(
      (d) =>
        d.resourceId === resourceId &&
        d.datetime.getTime() === datetime.getTime()
    );
  };

  return (
    <div className="relative w-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-white">资源利用率热力图</h4>
          <span className="text-xs text-slate-500">
            最近24小时
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-500">
            更新于 {format(lastUpdated, 'HH:mm:ss')}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="block"
        >
          <defs>
            <linearGradient id="heatmapGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="20%" stopColor="#0c4a6e" />
              <stop offset="40%" stopColor="#0369a1" />
              <stop offset="60%" stopColor="#0891b2" />
              <stop offset="75%" stopColor="#059669" />
              <stop offset="90%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>

            <filter id="cellGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {timeSlots.map((slot, colIndex) => {
            const isNewDay = colIndex > 0 && slot.getDate() !== timeSlots[colIndex - 1].getDate();
            return (
              <g key={colIndex}>
                {isNewDay && (
                  <line
                    x1={rowHeaderWidth + colIndex * cellWidth}
                    y1={colHeaderHeight - 20}
                    x2={rowHeaderWidth + colIndex * cellWidth}
                    y2={colHeaderHeight + resources.length * cellHeight}
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                )}
                <text
                  x={rowHeaderWidth + colIndex * cellWidth + cellWidth / 2}
                  y={colHeaderHeight - 25}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-500"
                >
                  {isNewDay ? formatDateLabel(slot) : ''}
                </text>
                <text
                  x={rowHeaderWidth + colIndex * cellWidth + cellWidth / 2}
                  y={colHeaderHeight - 8}
                  textAnchor="middle"
                  className={colIndex % 3 === 0 ? 'text-[10px] fill-slate-400' : 'text-[10px] fill-slate-600'}
                >
                  {colIndex % 3 === 0 ? formatTimeLabel(slot) : ''}
                </text>
              </g>
            );
          })}

          {resources.map((resource, rowIndex) => (
            <g key={resource.id}>
              <text
                x={rowHeaderWidth - 10}
                y={colHeaderHeight + rowIndex * cellHeight + cellHeight / 2 + 4}
                textAnchor="end"
                className="text-[11px] fill-slate-400"
              >
                {resource.name.length > 12 ? resource.name.slice(0, 12) + '...' : resource.name}
              </text>

              {timeSlots.map((slot, colIndex) => {
                const dataPoint = getDataPoint(resource.id, slot);
                if (!dataPoint) return null;

                const color = getHeatmapColor(dataPoint.utilization);
                const isHighUtilization = dataPoint.utilization >= 80;

                return (
                  <rect
                    key={colIndex}
                    x={rowHeaderWidth + colIndex * cellWidth + 1}
                    y={colHeaderHeight + rowIndex * cellHeight + 1}
                    width={cellWidth - 2}
                    height={cellHeight - 2}
                    rx={2}
                    fill={color}
                    className={isHighUtilization ? 'cursor-pointer' : 'cursor-pointer'}
                    style={{
                      filter: isHighUtilization ? 'url(#cellGlow)' : undefined,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, dataPoint)}
                    onMouseLeave={handleMouseLeave}
                    opacity={0.9}
                  />
                );
              })}
            </g>
          ))}

          <g transform={`translate(${rowHeaderWidth}, ${colHeaderHeight + resources.length * cellHeight + 10})`}>
            <text x={0} y={15} className="text-[10px] fill-slate-500">
              利用率:
            </text>
            <rect
              x={40}
              y={5}
              width={200}
              height={16}
              rx={2}
              fill="url(#heatmapGradient)"
            />
            {[0, 20, 40, 60, 80, 100].map((value, i) => (
              <text
                key={i}
                x={40 + i * 40}
                y={32}
                textAnchor="middle"
                className="text-[9px] fill-slate-500"
              >
                {value}%
              </text>
            ))}
          </g>
        </svg>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-slate-900/95 backdrop-blur border border-cyan-500/30 rounded-lg px-3 py-2 shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="text-xs font-semibold text-white mb-1">
            {tooltip.resourceName}
          </div>
          <div className="text-[10px] text-slate-400 mb-1">
            {format(tooltip.datetime, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold"
              style={{ color: getHeatmapColor(tooltip.utilization) }}
            >
              {tooltip.utilization}%
            </span>
            <span className="text-[10px] text-slate-500">利用率</span>
            <span className="text-[10px] text-slate-600">·</span>
            <span className="text-[10px] text-slate-400">{tooltip.status}</span>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>横轴：日期时间 · 纵轴：资源名称</span>
        <span>每 {refreshInterval / 1000} 秒自动刷新</span>
      </div>
    </div>
  );
}
