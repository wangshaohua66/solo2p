import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Stage,
  Layer,
  Line,
  Rect,
  Ellipse,
  Arrow,
  Image as KonvaImage,
} from 'react-konva';
import type KonvaType from 'konva';
import { useToolStore } from '@/stores/toolStore';
import { useProjectStore } from '@/stores/projectStore';
import type {
  Layer as LayerType,
  KonvaNode,
  LineNode,
  RectNode,
  EllipseNode,
  ArrowNode,
} from '@/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/types';
import { generateId } from '@/utils/idGenerator';
import {
  addNodeToLayer,
  getNodesByEraserPoint,
  removeNodeFromLayer,
} from '@/utils/konvaSerializer';
import { generateThumbnail } from '@/utils/thumbnailGenerator';

type DrawingState = {
  isDrawing: boolean;
  startX: number;
  startY: number;
  nodeId: string | null;
};

export const StoryCanvas: React.FC = () => {
  const {
    currentTool,
    brushSize,
    brushColor,
    canvasScale,
    canvasOffsetX,
    canvasOffsetY,
    setCanvasScale,
    adjustCanvasOffset,
    currentLayerId,
    setCurrentLayerId,
    setTool,
  } = useToolStore();

  const currentShot = useProjectStore((s) => s.getCurrentShot());
  const updateShotLayersData = useProjectStore((s) => s.updateShotLayersData);
  const commitHistory = useProjectStore((s) => s._commitHistory);

  const shotId = currentShot?.id || '';
  const refUrl = currentShot?.referenceImage?.url;
  const refOpacity = currentShot?.referenceImage?.opacity ?? 0.5;

  const stageRef = useRef<KonvaType.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [layers, setLayers] = useState<LayerType[]>(currentShot?.layers || []);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    nodeId: null,
  });
  const [tempNode, setTempNode] = useState<KonvaNode | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [panState, setPanState] = useState<{
    isPanning: boolean;
    startX: number;
    startY: number;
    offX: number;
    offY: number;
  }>({ isPanning: false, startX: 0, startY: 0, offX: 0, offY: 0 });
  const [refImg, setRefImg] = useState<HTMLImageElement | null>(null);
  const debounceTimer = useRef<number | null>(null);
  const hasChanges = useRef(false);

  const effectiveTool = spacePressed || currentTool === 'pan' ? 'pan' : currentTool;
  const activeLayerId = currentLayerId ?? layers[0]?.id ?? null;
  const activeLayer = layers.find((l) => l.id === activeLayerId);

  useEffect(() => {
    if (currentShot?.layers) {
      setLayers(currentShot.layers);
      if (!currentLayerId && currentShot.layers[0]) {
        setCurrentLayerId(currentShot.layers[0].id);
      }
    }
  }, [shotId]);

  useEffect(() => {
    if (!currentLayerId && layers[0]) {
      setCurrentLayerId(layers[0].id);
    }
  }, [layers, currentLayerId, setCurrentLayerId]);

  useEffect(() => {
    if (!refUrl) {
      setRefImg(null);
      return;
    }
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => alive && setRefImg(img);
    img.src = refUrl;
    return () => {
      alive = false;
    };
  }, [refUrl]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setContainerSize({ w: Math.max(400, r.width), h: Math.max(400, r.height) });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      )
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
      }
      if (e.code === 'Digit1') setTool('pen');
      if (e.code === 'Digit2') setTool('line');
      if (e.code === 'Digit3') setTool('rect');
      if (e.code === 'Digit4') setTool('ellipse');
      if (e.code === 'Digit5') setTool('arrow');
      if (e.code === 'KeyE') setTool('eraser');
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [setTool]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const schedulePersist = (ls: LayerType[]) => {
    if (!shotId) return;
    hasChanges.current = true;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(async () => {
      try {
        if (!currentShot) return;
        const thumb = await generateThumbnail(
          { ...currentShot, layers: ls },
          480,
          270
        );
        updateShotLayersData(shotId, ls, thumb);
      } catch (e) {
        updateShotLayersData(shotId, ls);
      }
    }, 600);
  };

  const toCanvasCoord = (e: KonvaType.KonvaPointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition() || { x: 0, y: 0 };
    return {
      x: (pos.x - canvasOffsetX) / canvasScale,
      y: (pos.y - canvasOffsetY) / canvasScale,
    };
  };

  const handleMouseDown = (e: KonvaType.KonvaPointerEvent) => {
    if (!shotId) return;
    const { x, y } = toCanvasCoord(e);
    const evt = e.evt as MouseEvent;

    if (
      effectiveTool === 'pan' ||
      evt.button === 1 ||
      (evt.button === 0 && spacePressed)
    ) {
      setPanState({
        isPanning: true,
        startX: evt.clientX,
        startY: evt.clientY,
        offX: canvasOffsetX,
        offY: canvasOffsetY,
      });
      return;
    }

    if (!activeLayerId || !activeLayer || activeLayer.locked) return;

    if (currentTool === 'eraser') {
      const hits = getNodesByEraserPoint(layers, activeLayerId, x, y, brushSize);
      if (hits.length > 0) {
        let newLayers = layers;
        for (const h of hits) {
          newLayers = removeNodeFromLayer(newLayers, h.layerId, h.nodeId);
        }
        setLayers(newLayers);
        schedulePersist(newLayers);
        commitHistory();
      }
      return;
    }

    const baseNode = {
      id: generateId(),
    } as const;
    let node: KonvaNode | null = null;

    switch (currentTool) {
      case 'pen':
        node = {
          ...baseNode,
          type: 'line',
          points: [x, y],
          stroke: brushColor,
          strokeWidth: brushSize,
          tension: 0.5,
        } as LineNode;
        break;
      case 'line':
        node = {
          ...baseNode,
          type: 'line',
          points: [x, y, x, y],
          stroke: brushColor,
          strokeWidth: brushSize,
          tension: 0,
        } as LineNode;
        break;
      case 'rect':
        node = {
          ...baseNode,
          type: 'rect',
          x,
          y,
          width: 0,
          height: 0,
          stroke: brushColor,
          strokeWidth: brushSize,
        } as RectNode;
        break;
      case 'ellipse':
        node = {
          ...baseNode,
          type: 'ellipse',
          x,
          y,
          radiusX: 0,
          radiusY: 0,
          stroke: brushColor,
          strokeWidth: brushSize,
        } as EllipseNode;
        break;
      case 'arrow':
        node = {
          ...baseNode,
          type: 'arrow',
          points: [x, y, x, y],
          stroke: brushColor,
          strokeWidth: brushSize,
          pointerLength: 12,
          pointerWidth: 8,
        } as ArrowNode;
        break;
    }
    if (node) {
      setDrawingState({
        isDrawing: true,
        startX: x,
        startY: y,
        nodeId: node.id,
      });
      setTempNode(node);
    }
  };

  const handleMouseMove = (e: KonvaType.KonvaPointerEvent) => {
    const { x, y } = toCanvasCoord(e);
    const evt = e.evt as MouseEvent;

    if (panState.isPanning) {
      adjustCanvasOffset(
        panState.offX + (evt.clientX - panState.startX),
        panState.offY + (evt.clientY - panState.startY)
      );
      return;
    }

    if (currentTool === 'eraser' && (evt.buttons & 1) && activeLayerId) {
      const hits = getNodesByEraserPoint(layers, activeLayerId, x, y, brushSize);
      if (hits.length > 0) {
        let newLayers = layers;
        for (const h of hits) {
          newLayers = removeNodeFromLayer(newLayers, h.layerId, h.nodeId);
        }
        setLayers(newLayers);
        schedulePersist(newLayers);
      }
      return;
    }

    if (!drawingState.isDrawing || !tempNode) return;

    let updated: KonvaNode = tempNode;
    if (tempNode.type === 'pen') {
      updated = {
        ...tempNode,
        points: [...tempNode.points, x, y],
      };
    } else if (tempNode.type === 'line' || tempNode.type === 'arrow') {
      updated = {
        ...tempNode,
        points: [drawingState.startX, drawingState.startY, x, y],
      };
    } else if (tempNode.type === 'rect') {
      updated = {
        ...tempNode,
        x: Math.min(drawingState.startX, x),
        y: Math.min(drawingState.startY, y),
        width: Math.abs(x - drawingState.startX),
        height: Math.abs(y - drawingState.startY),
      };
    } else if (tempNode.type === 'ellipse') {
      updated = {
        ...tempNode,
        x: (drawingState.startX + x) / 2,
        y: (drawingState.startY + y) / 2,
        radiusX: Math.abs(x - drawingState.startX) / 2,
        radiusY: Math.abs(y - drawingState.startY) / 2,
      };
    }
    setTempNode(updated);
  };

  const handleMouseUp = () => {
    if (panState.isPanning) {
      setPanState((p) => ({ ...p, isPanning: false }));
      return;
    }
    if (!drawingState.isDrawing || !tempNode || !activeLayerId) {
      setDrawingState({ isDrawing: false, startX: 0, startY: 0, nodeId: null });
      setTempNode(null);
      return;
    }

    let valid = true;
    if (tempNode.type === 'rect' || tempNode.type === 'ellipse') {
      if (
        (tempNode.type === 'rect' && (tempNode.width < 2 || tempNode.height < 2)) ||
        (tempNode.type === 'ellipse' && (tempNode.radiusX < 2 || tempNode.radiusY < 2))
      ) {
        valid = false;
      }
    } else if (tempNode.type === 'line' || tempNode.type === 'arrow') {
      const [x1, y1, x2, y2] = tempNode.points;
      if (Math.hypot(x2 - x1, y2 - y1) < 4) valid = false;
    } else if (tempNode.type === 'pen') {
      if (tempNode.points.length < 4) valid = false;
    }

    if (valid) {
      const newLayers = addNodeToLayer(layers, activeLayerId, tempNode);
      setLayers(newLayers);
      schedulePersist(newLayers);
      commitHistory();
    }

    setDrawingState({ isDrawing: false, startX: 0, startY: 0, nodeId: null });
    setTempNode(null);
  };

  const handleWheel = (e: KonvaType.KonvaWheelEvent) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = canvasScale;
    const pointer = stage.getPointerPosition() || { x: 0, y: 0 };
    const mousePointTo = {
      x: (pointer.x - canvasOffsetX) / oldScale,
      y: (pointer.y - canvasOffsetY) / oldScale,
    };
    const delta = -e.evt.deltaY * 0.0015;
    const newScale = Math.max(0.25, Math.min(4, oldScale * (1 + delta)));
    const newOffset = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setCanvasScale(newScale, newOffset.x, newOffset.y);
  };

  const renderNode = (node: KonvaNode, keyPrefix = '') => {
    switch (node.type) {
      case 'line':
        return (
          <Line
            key={`${keyPrefix}${node.id}`}
            points={node.points}
            stroke={node.stroke}
            strokeWidth={node.strokeWidth}
            tension={node.tension || 0}
            closed={(node as LineNode).closed}
            perfectDrawEnabled={false}
            hitStrokeWidth={8}
            lineCap="round"
            lineJoin="round"
          />
        );
      case 'rect':
        return (
          <Rect
            key={`${keyPrefix}${node.id}`}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            stroke={node.stroke}
            strokeWidth={node.strokeWidth || 2}
            fill={node.fill}
            perfectDrawEnabled={false}
          />
        );
      case 'ellipse':
        return (
          <Ellipse
            key={`${keyPrefix}${node.id}`}
            x={node.x}
            y={node.y}
            radiusX={node.radiusX}
            radiusY={node.radiusY}
            stroke={node.stroke}
            strokeWidth={node.strokeWidth || 2}
            fill={node.fill}
            perfectDrawEnabled={false}
          />
        );
      case 'arrow':
        return (
          <Arrow
            key={`${keyPrefix}${node.id}`}
            points={node.points}
            stroke={node.stroke}
            strokeWidth={node.strokeWidth}
            pointerLength={node.pointerLength || 10}
            pointerWidth={node.pointerWidth || 8}
            perfectDrawEnabled={false}
            hitStrokeWidth={8}
            lineCap="round"
            lineJoin="round"
          />
        );
      default:
        return null;
    }
  };

  const stageX =
    (containerSize.w - CANVAS_WIDTH * canvasScale) / 2 + canvasOffsetX;
  const stageY =
    (containerSize.h - CANVAS_HEIGHT * canvasScale) / 2 + canvasOffsetY;

  const visibleLayers = layers.filter((l) => l.visible);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative checkerboard overflow-hidden"
      style={{ cursor: effectiveTool === 'pan' ? (panState.isPanning ? 'grabbing' : 'grab') : 'crosshair' }}
    >
      <div
        className="absolute shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] transition-transform duration-100 ease-out bg-white"
        style={{
          left: stageX,
          top: stageY,
          width: CANVAS_WIDTH * canvasScale,
          height: CANVAS_HEIGHT * canvasScale,
          transformOrigin: '0 0',
        }}
      >
        <Stage
          ref={stageRef}
          width={CANVAS_WIDTH * canvasScale}
          height={CANVAS_HEIGHT * canvasScale}
          scaleX={canvasScale}
          scaleY={canvasScale}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.evt.preventDefault()}
          className="bg-white"
        >
          {refImg && (
            <Layer>
              <KonvaImage
                image={refImg}
                x={0}
                y={0}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                opacity={refOpacity}
              />
            </Layer>
          )}
          {visibleLayers.map((layer) => (
            <Layer key={layer.id}>
              {layer.nodes.map((n) => renderNode(n, `l${layer.id}-`))}
            </Layer>
          ))}
          {tempNode && <Layer key="__temp__">{renderNode(tempNode, 't-')}</Layer>}
        </Stage>
      </div>

      {currentShot && (
        <>
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-md px-3 py-1.5 border border-white/10 pointer-events-none">
            <p className="text-[11px] font-mono text-gray-200">
              #{currentShot.orderIndex + 1} · {currentShot.title || '未命名分镜'}
            </p>
            <p className="text-[10px] text-gray-400">
              {currentShot.duration.toFixed(1)}s · {currentShot.cameraMovement} · {currentShot.transition}
            </p>
          </div>
          <div className="absolute bottom-14 right-3 bg-black/60 backdrop-blur-sm rounded-md px-3 py-1.5 border border-white/10 pointer-events-none">
            <p className="text-[10px] font-mono text-gray-400">
              {CANVAS_WIDTH}×{CANVAS_HEIGHT} · {Math.round(canvasScale * 100)}%
            </p>
          </div>
        </>
      )}

      {!currentShot && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/5 flex items-center justify-center text-gray-600">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 3v18" />
              </svg>
            </div>
            <p className="text-sm text-gray-400 mb-1">选择或创建分镜</p>
            <p className="text-xs text-gray-600">在左侧场景树点击「+」新建分镜后即可开始绘制</p>
          </div>
        </div>
      )}
    </div>
  );
};
