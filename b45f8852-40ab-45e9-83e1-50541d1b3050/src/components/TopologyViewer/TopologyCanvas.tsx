import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { useEquipmentStore } from '@/store/equipmentStore';
import { shallow } from 'zustand/shallow';
import type { Substation, TransmissionLine, VoltageLevel } from '@/types';

interface TopologyCanvasProps {
  onStationClick?: (stationId: string) => void;
  onStationHover?: (stationId: string | null) => void;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface HoveredElement {
  type: 'station' | 'line';
  id: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  station?: Substation;
}

const voltageColors: Record<VoltageLevel, { fill: string; stroke: string; radius: number; shadow: string }> = {
  '500kV': {
    fill: '#991B1B',
    stroke: '#DC2626',
    radius: 22,
    shadow: 'rgba(220, 38, 38, 0.4)',
  },
  '220kV': {
    fill: '#1E40AF',
    stroke: '#2563EB',
    radius: 18,
    shadow: 'rgba(37, 99, 235, 0.4)',
  },
  '110kV': {
    fill: '#166534',
    stroke: '#16A34A',
    radius: 14,
    shadow: 'rgba(22, 163, 74, 0.4)',
  },
};

const lineWidthByVoltage: Record<VoltageLevel, number> = {
  '500kV': 4,
  '220kV': 3,
  '110kV': 2,
};

const TopologyCanvas: React.FC<TopologyCanvasProps> = ({ onStationClick, onStationHover }) => {
  const {
    substations,
    lines,
    selectedEquipmentId,
    highlightPath,
    selectEquipment,
  } = useEquipmentStore(
    (state) => ({
      substations: state.substations,
      lines: state.lines,
      selectedEquipmentId: state.selectedEquipmentId,
      highlightPath: state.highlightPath,
      selectEquipment: state.selectEquipment,
    }),
    shallow
  );

  const handleStationSelect = useCallback(
    (id: string) => {
      selectEquipment(id);
      onStationClick?.(id);
    },
    [selectEquipment, onStationClick]
  );

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [hovered, setHovered] = useState<HoveredElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0 });
  const [pulsePhase, setPulsePhase] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedStationIds = useMemo(() => {
    const ids = new Set<string>();
    highlightPath.forEach((path) => {
      path.forEach((id) => ids.add(id));
    });
    if (selectedEquipmentId) {
      const station = substations.find(
        (s) => s.id === selectedEquipmentId
      );
      if (station) ids.add(selectedEquipmentId);
    }
    return ids;
  }, [highlightPath, selectedEquipmentId, substations]);

  const selectedLineIds = useMemo(() => {
    const ids = new Set<string>();
    highlightPath.forEach((path) => {
      for (let i = 0; i < path.length - 1; i++) {
        const fromId = path[i];
        const toId = path[i + 1];
        const foundLine = lines.find(
          (l) =>
            (l.fromStationId === fromId && l.toStationId === toId) ||
            (l.fromStationId === toId && l.toStationId === fromId)
        );
        if (foundLine) ids.add(foundLine.id);
      }
    });
    return ids;
  }, [highlightPath, lines]);

  const outageStations = useMemo(() => {
    return {
      level1: new Set(['sub-500-001']),
      level2: new Set(['sub-220-001', 'sub-110-001']),
      level3: new Set(['sub-220-004']),
    };
  }, []);

  useEffect(() => {
    let rafId: number;
    const animate = () => {
      setPulsePhase((p) => (p + 0.05) % (Math.PI * 2));
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (sx - rect.left - transform.x) / transform.scale,
        y: (sy - rect.top - transform.y) / transform.scale,
      };
    },
    [transform]
  );

  const findStationAtPoint = useCallback(
    (wx: number, wy: number): Substation | null => {
      for (const station of substations) {
        const { radius } = voltageColors[station.voltageLevel];
        const dx = wx - station.x;
        const dy = wy - station.y;
        if (dx * dx + dy * dy <= radius * radius) {
          return station;
        }
      }
      return null;
    },
    [substations]
  );

  const findLineAtPoint = useCallback(
    (wx: number, wy: number): TransmissionLine | null => {
      const threshold = 8 / transform.scale;
      for (const line of lines) {
        const from = substations.find((s) => s.id === line.fromStationId);
        const to = substations.find((s) => s.id === line.toStationId);
        if (!from || !to) continue;
        const dist = distanceToBezier(wx, wy, from, to);
        if (dist <= threshold) return line;
      }
      return null;
    },
    [lines, substations, transform.scale]
  );

  const distanceToBezier = (
    px: number,
    py: number,
    from: Substation,
    to: Substation
  ): number => {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 40;
    let minDist = Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const x =
        (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * midX + t * t * to.x;
      const y =
        (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * midY + t * t * to.y;
      const dist = Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  };

  const render = useCallback(
    ({ ctx, width, height }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      ctx.clearRect(0, 0, width, height);

      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#F8FAFC');
      bgGrad.addColorStop(1, '#EEF2FF');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      drawGrid(ctx);

      lines.forEach((line) => {
        const from = substations.find((s) => s.id === line.fromStationId);
        const to = substations.find((s) => s.id === line.toStationId);
        if (!from || !to) return;

        const isHighlighted = selectedLineIds.has(line.id);
        const isHovered = hovered?.type === 'line' && hovered.id === line.id;
        drawBezierLine(ctx, line, from, to, isHighlighted, isHovered);
      });

      substations.forEach((station) => {
        drawStation(ctx, station);
      });

      ctx.restore();

      if (selectedEquipmentId) {
        const station = substations.find((s) => s.id === selectedEquipmentId);
        if (station) {
          drawFlowPathAnimation(ctx, station);
        }
      }
    },
    [transform, substations, lines, selectedLineIds, hovered, pulsePhase, selectedEquipmentId]
  );

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = -2000; x < 3000; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -2000);
      ctx.lineTo(x, 3000);
      ctx.stroke();
    }
    for (let y = -2000; y < 3000; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-2000, y);
      ctx.lineTo(3000, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawBezierLine = (
    ctx: CanvasRenderingContext2D,
    line: TransmissionLine,
    from: Substation,
    to: Substation,
    isHighlighted: boolean,
    isHovered: boolean
  ) => {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 40;
    const width = lineWidthByVoltage[line.voltageLevel];

    ctx.save();

    if (isHighlighted) {
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = width + 2;
      ctx.setLineDash([12, 6]);
      ctx.lineDashOffset = -pulsePhase * 10;
    } else if (isHovered) {
      ctx.strokeStyle = voltageColors[line.voltageLevel].stroke;
      ctx.lineWidth = width + 1;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = isHighlighted
        ? '#F59E0B'
        : `${voltageColors[line.voltageLevel].stroke}99`;
      ctx.lineWidth = width;
      ctx.setLineDash([]);
    }

    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(midX, midY, to.x, to.y);
    ctx.stroke();

    ctx.restore();
  };

  const drawStation = (ctx: CanvasRenderingContext2D, station: Substation) => {
    const colors = voltageColors[station.voltageLevel];
    const { radius, fill, stroke, shadow } = colors;
    const isSelected = selectedStationIds.has(station.id);
    const isHovered = hovered?.type === 'station' && hovered.id === station.id;

    ctx.save();

    if (isSelected) {
      const pulseR = radius + 8 + Math.sin(pulsePhase * 2) * 4;
      const grad = ctx.createRadialGradient(
        station.x,
        station.y,
        radius,
        station.x,
        station.y,
        pulseR
      );
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(station.x, station.y, pulseR, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 20;
    } else if (isHovered) {
      ctx.shadowColor = shadow;
      ctx.shadowBlur = 12;
    } else {
      ctx.shadowColor = shadow;
      ctx.shadowBlur = 6;
    }

    const fillGrad = ctx.createRadialGradient(
      station.x - radius * 0.3,
      station.y - radius * 0.3,
      0,
      station.x,
      station.y,
      radius
    );
    fillGrad.addColorStop(0, lightenColor(fill, 30));
    fillGrad.addColorStop(0.7, fill);
    fillGrad.addColorStop(1, darkenColor(fill, 10));

    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.arc(station.x, station.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = isSelected ? '#F59E0B' : stroke;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();

    if (outageStations.level1.has(station.id)) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.45)';
      ctx.beginPath();
      ctx.arc(station.x, station.y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (outageStations.level2.has(station.id)) {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.beginPath();
      ctx.arc(station.x, station.y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (outageStations.level3.has(station.id)) {
      ctx.fillStyle = 'rgba(107, 114, 128, 0.35)';
      ctx.beginPath();
      ctx.arc(station.x, station.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(10, radius * 0.45)}px -apple-system, "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(station.voltageLevel.replace('kV', ''), station.x, station.y);

    ctx.fillStyle = '#1F2937';
    ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const shortName = station.name.replace(/变电站$/, '');
    ctx.fillText(shortName, station.x, station.y + radius + 6);

    ctx.fillStyle = '#6B7280';
    ctx.font = '10px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(`${station.capacity}MVA`, station.x, station.y + radius + 22);

    ctx.restore();
  };

  const drawFlowPathAnimation = (
    ctx: CanvasRenderingContext2D,
    _startStation: Substation
  ) => {
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    highlightPath.forEach((path) => {
      for (let i = 0; i < path.length - 1; i++) {
        const from = substations.find((s) => s.id === path[i]);
        const to = substations.find((s) => s.id === path[i + 1]);
        if (!from || !to) continue;

        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2 - 40;

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -pulsePhase * 15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(midX, midY, to.x, to.y);
        ctx.stroke();

        const arrowCount = 3;
        for (let a = 0; a < arrowCount; a++) {
          const t = ((pulsePhase * 0.3 + a * 0.33) % 1);
          const ax =
            (1 - t) * (1 - t) * from.x +
            2 * (1 - t) * t * midX +
            t * t * to.x;
          const ay =
            (1 - t) * (1 - t) * from.y +
            2 * (1 - t) * t * midY +
            t * t * to.y;

          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(ax, ay, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    ctx.restore();
  };

  const lightenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return `#${((R << 16) | (G << 8) | B).toString(16).padStart(6, '0')}`;
  };

  const darkenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
    const B = Math.max(0, (num & 0x0000ff) - amt);
    return `#${((R << 16) | (G << 8) | B).toString(16).padStart(6, '0')}`;
  };

  const canvasRef = useCanvasRenderer({
    render,
    deps: [transform, substations, lines, highlightPath, hovered, pulsePhase, selectedEquipmentId],
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const world = screenToWorld(e.clientX, e.clientY);
    const station = findStationAtPoint(world.x, world.y);
    if (station) return;

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      tx: transform.x,
      ty: transform.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: dragStartRef.current.tx + (e.clientX - dragStartRef.current.x),
        y: dragStartRef.current.ty + (e.clientY - dragStartRef.current.y),
      }));
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);
    const station = findStationAtPoint(world.x, world.y);
    const line = station ? null : findLineAtPoint(world.x, world.y);

    if (station) {
      setHovered({ type: 'station', id: station.id });
      onStationHover?.(station.id);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltip({
          visible: true,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          station,
        });
      }
    } else if (line) {
      setHovered({ type: 'line', id: line.id });
      onStationHover?.(null);
      setTooltip({ visible: false, x: 0, y: 0 });
    } else {
      setHovered(null);
      onStationHover?.(null);
      setTooltip({ visible: false, x: 0, y: 0 });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    const world = screenToWorld(e.clientX, e.clientY);
    const station = findStationAtPoint(world.x, world.y);
    if (station) {
      handleStationSelect(station.id);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = -e.deltaY * 0.001;
    const newScale = Math.max(0.3, Math.min(3, transform.scale * (1 + delta)));

    const worldX = (mouseX - transform.x) / transform.scale;
    const worldY = (mouseY - transform.y) / transform.scale;

    setTransform({
      x: mouseX - worldX * newScale,
      y: mouseY - worldY * newScale,
      scale: newScale,
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-dispatch-50/30 overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setHovered(null);
        onStationHover?.(null);
        setTooltip({ visible: false, x: 0, y: 0 });
      }}
      onClick={handleClick}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : hovered ? 'pointer' : 'grab' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />

      {tooltip.visible && tooltip.station && (
        <div
          className="absolute z-20 pointer-events-none bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 min-w-[180px]"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y + 16,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div className="font-semibold text-dispatch-900 text-sm mb-2">
            {tooltip.station.name}
          </div>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">电压等级</span>
              <span className="font-medium text-gray-700">
                {tooltip.station.voltageLevel}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">总容量</span>
              <span className="font-medium text-gray-700">
                {tooltip.station.capacity} MVA
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">所属区域</span>
              <span className="font-medium text-gray-700">
                {tooltip.station.region}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">供电状态</span>
              <span className="font-medium text-emerald-600">正常供电</span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex gap-2">
        <button
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.min(3, prev.scale * 1.2),
            }))
          }
          className="w-8 h-8 bg-white rounded-md shadow-sm border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-dispatch-50 hover:text-dispatch-600 transition-colors"
        >
          +
        </button>
        <button
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.max(0.3, prev.scale / 1.2),
            }))
          }
          className="w-8 h-8 bg-white rounded-md shadow-sm border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-dispatch-50 hover:text-dispatch-600 transition-colors"
        >
          -
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="px-3 h-8 bg-white rounded-md shadow-sm border border-gray-200 flex items-center justify-center text-xs text-gray-600 hover:bg-dispatch-50 hover:text-dispatch-600 transition-colors"
        >
          重置视图
        </button>
      </div>

      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 px-4 py-3">
        <div className="text-xs font-semibold text-gray-700 mb-2">图例</div>
        <div className="space-y-1.5">
          {(['500kV', '220kV', '110kV'] as VoltageLevel[]).map((v) => (
            <div key={v} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: voltageColors[v].fill }}
              />
              <span className="text-xs text-gray-600">{v}</span>
            </div>
          ))}
          <div className="h-px bg-gray-100 my-1" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/40" />
            <span className="text-xs text-gray-600">一级停电</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500/40" />
            <span className="text-xs text-gray-600">二级停电</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400/40" />
            <span className="text-xs text-gray-600">三级停电</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-md shadow-sm border border-gray-200 px-3 py-1.5">
        <span className="text-xs text-gray-500">
          缩放：{Math.round(transform.scale * 100)}%
        </span>
      </div>
    </div>
  );
};

export default TopologyCanvas;
