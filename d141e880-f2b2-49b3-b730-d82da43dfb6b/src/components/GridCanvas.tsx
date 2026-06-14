import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Group, Text, Transformer } from 'react-konva';
import { Popover, Button, Space, message } from 'antd';
import { ZoomIn, ZoomOut, Grid3X3, Split, Merge, Move } from 'lucide-react';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { getGridStatusColor } from '@/utils/color';
import { CANVAS_CONFIG } from '@/constants';
import type { Grid } from '@/types';
import Konva from 'konva';

interface GridCanvasProps {
  onGridSelect?: (grid: Grid) => void;
  onQuickRegister?: (grid: Grid) => void;
  site?: any;
  grids?: Grid[];
  selectedGridId?: string | null;
}

const GridCanvas: React.FC<GridCanvasProps> = ({ onGridSelect, onQuickRegister }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 500 });
  const [scale, setScale] = useState(CANVAS_CONFIG.DEFAULT_SCALE);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [longPressGrid, setLongPressGrid] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'pan' | 'split' | 'merge'>('select');
  const [selectedGridsForMerge, setSelectedGridsForMerge] = useState<string[]>([]);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSiteId = useSiteStore((state) => state.currentSiteId);
  const selectedGridId = useSiteStore((state) => state.selectedGridId);
  const getGridsBySite = useSiteStore((state) => state.getGridsBySite);
  const setSelectedGrid = useSiteStore((state) => state.setSelectedGrid);
  const splitGridById = useSiteStore((state) => state.splitGridById);
  const mergeGridsByIds = useSiteStore((state) => state.mergeGridsByIds);
  const getStrataByGrid = useArtifactStore((state) => state.getStrataByGrid);

  const grids = useMemo(() => {
    if (!currentSiteId) return [];
    return getGridsBySite(currentSiteId);
  }, [currentSiteId, getGridsBySite]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (grids.length > 0) {
      const maxCol = Math.max(...grids.map((g) => g.col));
      const maxRow = Math.max(...grids.map((g) => g.row));
      const contentWidth = (maxCol + 1) * CANVAS_CONFIG.GRID_CELL_PX + 40;
      const contentHeight = (maxRow + 1) * CANVAS_CONFIG.GRID_CELL_PX + 40;
      
      if (contentWidth > stageSize.width * scale || contentHeight > stageSize.height * scale) {
        const fitScale = Math.min(
          (stageSize.width - 40) / contentWidth,
          (stageSize.height - 40) / contentHeight,
          1
        );
        setScale(Math.max(fitScale, CANVAS_CONFIG.MIN_SCALE));
      }
    }
  }, [grids.length]);

  useEffect(() => {
    return () => {
      if (stageRef.current) {
        stageRef.current.destroy();
      }
    };
  }, []);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const oldScale = scale;
    const pointer = stageRef.current?.getPointerPosition();
    
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    let newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
    newScale = Math.max(CANVAS_CONFIG.MIN_SCALE, Math.min(CANVAS_CONFIG.MAX_SCALE, newScale));

    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [scale, position]);

  const handleZoom = (delta: number) => {
    let newScale = scale + delta;
    newScale = Math.max(CANVAS_CONFIG.MIN_SCALE, Math.min(CANVAS_CONFIG.MAX_SCALE, newScale));
    setScale(newScale);
  };

  const resetView = () => {
    setScale(CANVAS_CONFIG.DEFAULT_SCALE);
    setPosition({ x: 20, y: 20 });
  };

  const handleGridClick = (grid: Grid) => {
    if (isDragging) return;

    if (mode === 'merge') {
      setSelectedGridsForMerge((prev) => {
        if (prev.includes(grid.id)) {
          return prev.filter((id) => id !== grid.id);
        }
        return [...prev, grid.id];
      });
      return;
    }

    if (mode === 'split') {
      splitGridById(grid.id);
      message.success('探方已拆分为4个小探方');
      setMode('select');
      return;
    }

    setSelectedGrid(grid.id);
    setSelectedGridsForMerge([]);
    onGridSelect?.(grid);
  };

  const handleGridMouseDown = (grid: Grid) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressGrid(grid.id);
    }, CANVAS_CONFIG.LONG_PRESS_DURATION);
  };

  const handleGridMouseUp = (grid: Grid) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressGrid === grid.id) {
      setLongPressGrid(null);
      onQuickRegister?.(grid);
    }
  };

  const handleGridMouseLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLongPressGrid(null);
  };

  const handleDragStart = () => {
    setIsDragging(false);
  };

  const handleDragMove = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setPosition({
      x: e.target.x(),
      y: e.target.y(),
    });
    setTimeout(() => setIsDragging(false), 100);
  };

  const handleMerge = () => {
    if (selectedGridsForMerge.length >= 2) {
      mergeGridsByIds(selectedGridsForMerge);
      message.success(`已合并 ${selectedGridsForMerge.length} 个探方`);
      setSelectedGridsForMerge([]);
      setMode('select');
    } else {
      message.warning('请至少选择2个探方进行合并');
    }
  };

  const getGridDisplayInfo = (grid: Grid) => {
    const strata = getStrataByGrid(grid.id);
    const x = grid.col * CANVAS_CONFIG.GRID_CELL_PX;
    const y = grid.row * CANVAS_CONFIG.GRID_CELL_PX;
    const width = (grid.width / 5) * CANVAS_CONFIG.GRID_CELL_PX;
    const height = (grid.height / 5) * CANVAS_CONFIG.GRID_CELL_PX;
    return { x, y, width, height, strataCount: strata.length };
  };

  const renderGridCell = (grid: Grid) => {
    const { x, y, width, height, strataCount } = getGridDisplayInfo(grid);
    const isSelected = selectedGridId === grid.id || selectedGridsForMerge.includes(grid.id);
    const fillColor = getGridStatusColor(grid.status);
    const strata = getStrataByGrid(grid.id);

    return (
      <Group
        key={grid.id}
        onClick={() => handleGridClick(grid)}
        onTap={() => handleGridClick(grid)}
        onMouseDown={() => handleGridMouseDown(grid)}
        onMouseUp={() => handleGridMouseUp(grid)}
        onMouseLeave={handleGridMouseLeave}
        onTouchStart={() => handleGridMouseDown(grid)}
        onTouchEnd={() => handleGridMouseUp(grid)}
      >
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fillColor}
          stroke={isSelected ? '#D4AF37' : '#A0826D'}
          strokeWidth={isSelected ? 3 : 1}
          shadowColor={isSelected ? '#D4AF37' : 'transparent'}
          shadowBlur={isSelected ? 10 : 0}
          shadowOffset={{ x: 0, y: 0 }}
          cornerRadius={2}
          opacity={0.9}
        />
        
        {strata.length > 0 && (
          <>
            {strata.slice(0, 3).map((s, idx) => (
              <Rect
                key={s.id}
                x={x + 4}
                y={y + 4 + idx * 12}
                width={width - 8}
                height={10}
                fill={`hsl(${30 + idx * 15}, 30%, ${60 - idx * 10}%)`}
                opacity={0.6}
              />
            ))}
          </>
        )}

        <Text
          x={x + width / 2}
          y={y + 4}
          text={`T${grid.row + 1}${String.fromCharCode(65 + grid.col)}`}
          fontSize={11}
          fill="#2D2A26"
          fontStyle="bold"
          align="center"
          offsetX={-width / 2 + 4}
        />

        {grid.artifactCount > 0 && (
          <Group>
            <Rect
              x={x + width - 22}
              y={y + 4}
              width={18}
              height={18}
              fill="#8B4513"
              cornerRadius={9}
            />
            <Text
              x={x + width - 13}
              y={y + 6}
              text={grid.artifactCount.toString()}
              fontSize={11}
              fill="#fff"
              fontStyle="bold"
              align="center"
            />
          </Group>
        )}

        {strataCount > 0 && (
          <Text
            x={x + 4}
            y={y + height - 16}
            text={`${strataCount}层`}
            fontSize={10}
            fill="#5C4033"
          />
        )}
      </Group>
    );
  };

  const toolbar = (
    <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-lg border border-stone-200">
      <Button
        type={mode === 'select' ? 'primary' : 'default'}
        icon={<Grid3X3 size={16} />}
        onClick={() => { setMode('select'); setSelectedGridsForMerge([]); }}
        size="small"
      />
      <Button
        type={mode === 'pan' ? 'primary' : 'default'}
        icon={<Move size={16} />}
        onClick={() => setMode(mode === 'pan' ? 'select' : 'pan')}
        size="small"
      />
      <div className="h-px bg-stone-200 my-1" />
      <Button
        type={mode === 'split' ? 'primary' : 'default'}
        icon={<Split size={16} />}
        onClick={() => { setMode(mode === 'split' ? 'select' : 'split'); setSelectedGridsForMerge([]); }}
        size="small"
        title="拆分探方"
      />
      <Button
        type={mode === 'merge' ? 'primary' : 'default'}
        icon={<Merge size={16} />}
        onClick={() => { setMode(mode === 'merge' ? 'select' : 'merge'); setSelectedGridsForMerge([]); }}
        size="small"
        title="合并探方"
      />
      {mode === 'merge' && selectedGridsForMerge.length >= 2 && (
        <Button type="primary" size="small" onClick={handleMerge}>
          合并{selectedGridsForMerge.length}个
        </Button>
      )}
      <div className="h-px bg-stone-200 my-1" />
      <Button icon={<ZoomIn size={16} />} onClick={() => handleZoom(0.1)} size="small" />
      <Button icon={<ZoomOut size={16} />} onClick={() => handleZoom(-0.1)} size="small" />
      <Button onClick={resetView} size="small">
        重置
      </Button>
    </div>
  );

  if (!currentSiteId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-500">
        请从左侧选择一个发掘工地
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-stone-100 overflow-hidden">
      {toolbar}
      
      <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-stone-200">
        <div className="flex items-center gap-3 text-sm text-stone-600">
          <span>缩放: {(scale * 100).toFixed(0)}%</span>
          <span>探方: {grids.length}个</span>
          {mode !== 'select' && (
            <span className="text-amber-600 font-medium">
              {mode === 'pan' ? '拖拽模式' : mode === 'split' ? '点击拆分' : `选择合并(${selectedGridsForMerge.length})`}
            </span>
          )}
        </div>
      </div>

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onWheel={handleWheel}
        style={{ background: '#F5F2ED' }}
      >
        <Layer>
          <Group
            x={position.x}
            y={position.y}
            scaleX={scale}
            scaleY={scale}
            draggable={mode === 'pan'}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            {grids.map(renderGridCell)}
          </Group>
        </Layer>
      </Stage>

      {longPressGrid && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
          <div className="bg-white rounded-lg p-4 shadow-xl">
            <p className="text-stone-700">松手快速登记遗物...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(GridCanvas);
