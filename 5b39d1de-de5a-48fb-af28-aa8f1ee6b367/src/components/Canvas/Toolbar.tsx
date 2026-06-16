import {
  Pencil,
  Minus,
  Square,
  Circle,
  ArrowRight,
  Eraser,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { ToolType, Layer } from '@/types';
import { PRESET_COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/types';
import { useToolStore } from '@/stores/toolStore';
import { useProjectStore } from '@/stores/projectStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  addNewLayer,
  deleteLayer,
  reorderLayer,
  toggleLayerLocked,
  toggleLayerVisible,
} from '@/utils/konvaSerializer';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import { useState, useEffect, useRef } from 'react';

const tools: { type: ToolType; icon: typeof Pencil; label: string; shortcut: string }[] = [
  { type: 'pen', icon: Pencil, label: '自由画笔', shortcut: '1' },
  { type: 'line', icon: Minus, label: '直线', shortcut: '2' },
  { type: 'rect', icon: Square, label: '矩形', shortcut: '3' },
  { type: 'ellipse', icon: Circle, label: '椭圆', shortcut: '4' },
  { type: 'arrow', icon: ArrowRight, label: '箭头', shortcut: '5' },
  { type: 'eraser', icon: Eraser, label: '橡皮擦', shortcut: 'E' },
];

export const Toolbar: React.FC = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const navigate = useNavigate();
  const {
    currentTool,
    setTool,
    brushSize,
    setBrushSize,
    brushColor,
    setBrushColor,
    canvasScale,
    setCanvasScale,
    resetCanvasView,
    currentLayerId,
    setCurrentLayerId,
  } = useToolStore();

  const currentShot = useProjectStore((s) => s.getCurrentShot());
  const { undo, redo, canUndo, canRedo, updateShotLayersData, _commitHistory } = useProjectStore();
  const [showLayers, setShowLayers] = useState(true);
  const [showAllColors, setShowAllColors] = useState(false);

  const [layers, setLayers] = useState<Layer[]>(currentShot?.layers || []);
  const debounceTimer = useRef<number | null>(null);

  const shotId = currentShot?.id || '';

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

  const activeLayerId = currentLayerId ?? layers[0]?.id ?? null;
  const activeLayer = layers.find((l) => l.id === activeLayerId);

  const persistThumbnail = (ls: Layer[]) => {
    if (!shotId || !currentShot) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(async () => {
      try {
        const thumb = await generateThumbnail({ ...currentShot, layers: ls }, 480, 270);
        updateShotLayersData(shotId, ls, thumb);
      } catch {
        updateShotLayersData(shotId, ls);
      }
    }, 500);
  };

  const updateLayers = (newLayers: Layer[]) => {
    setLayers(newLayers);
    updateShotLayersData(shotId, newLayers);
  };

  const handleAddLayer = () => {
    const newLayers = addNewLayer(layers);
    if (newLayers.length !== layers.length) {
      updateLayers(newLayers);
      setCurrentLayerId(newLayers[newLayers.length - 1].id);
      _commitHistory();
      persistThumbnail(newLayers);
    }
  };

  const handleDeleteLayer = () => {
    if (!activeLayerId || layers.length <= 1) return;
    const newLayers = deleteLayer(layers, activeLayerId);
    updateLayers(newLayers);
    setCurrentLayerId(newLayers[0]?.id ?? null);
    _commitHistory();
    persistThumbnail(newLayers);
  };

  const handleReorder = (dir: 'up' | 'down') => {
    if (!activeLayerId) return;
    const newLayers = reorderLayer(layers, activeLayerId, dir);
    updateLayers(newLayers);
    _commitHistory();
    persistThumbnail(newLayers);
  };

  const handleToggleVisible = () => {
    if (!activeLayerId) return;
    const newLayers = toggleLayerVisible(layers, activeLayerId);
    updateLayers(newLayers);
  };

  const handleToggleLocked = () => {
    if (!activeLayerId) return;
    const newLayers = toggleLayerLocked(layers, activeLayerId);
    updateLayers(newLayers);
  };

  const undoDisabled = !canUndo();
  const redoDisabled = !canRedo();

  const zoomOut = () => setCanvasScale(Math.max(0.25, canvasScale - 0.25), undefined, undefined);
  const zoomIn = () => setCanvasScale(Math.min(4, canvasScale + 0.25), undefined, undefined);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 p-2 rounded-xl bg-sidebar-light/90 backdrop-blur-md shadow-toolbar border border-sidebar-lighter/60">
        {tools.map(({ type, icon: Icon, label, shortcut }) => (
          <button
            key={type}
            onClick={() => setTool(type)}
            title={`${label} (${shortcut})`}
            className={`toolbar-btn ${currentTool === type ? 'active' : ''}`}
          >
            <Icon size={18} />
            <span className="hidden md:inline text-xs">{label}</span>
            <kbd className="hidden lg:inline ml-1 px-1 py-0.5 text-[9px] rounded bg-white/10 text-gray-400 font-mono">
              {shortcut}
            </kbd>
          </button>
        ))}

        <div className="w-px h-7 bg-sidebar-lighter mx-2" />

        <div className="flex items-center gap-2 px-2">
          <div
            className="w-6 h-6 rounded-md border border-white/20 shadow-inner cursor-pointer relative overflow-hidden group"
            style={{ backgroundColor: brushColor }}
          >
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex flex-wrap gap-0.5 max-w-[112px]">
            {(showAllColors ? PRESET_COLORS : PRESET_COLORS.slice(0, 8)).map((c) => (
              <button
                key={c}
                onClick={() => setBrushColor(c)}
                className={`color-swatch ${brushColor === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            {PRESET_COLORS.length > 8 && (
              <button
                onClick={() => setShowAllColors((s) => !s)}
                className="w-4 h-4 text-[9px] text-gray-400 hover:text-gray-200 rounded hover:bg-white/10 flex items-center justify-center"
                title={showAllColors ? '收起' : '更多颜色'}
              >
                {showAllColors ? '×' : '···'}
              </button>
            )}
          </div>
        </div>

        <div className="w-px h-7 bg-sidebar-lighter mx-2" />

        <div className="flex items-center gap-2 px-2 w-40">
          <Eraser size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="range"
            min={1}
            max={50}
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="flex-1 accent-accent h-1"
          />
          <span className="text-[10px] text-gray-300 font-mono w-6 text-right">
            {brushSize}
          </span>
        </div>

        <div className="w-px h-7 bg-sidebar-lighter mx-2" />

        <button
          onClick={undo}
          disabled={undoDisabled}
          title="撤销 (Ctrl+Z)"
          className={`toolbar-btn ${undoDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={redo}
          disabled={redoDisabled}
          title="重做 (Ctrl+Shift+Z)"
          className={`toolbar-btn ${redoDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Redo2 size={18} />
        </button>

        <div className="w-px h-7 bg-sidebar-lighter mx-2" />

        <button onClick={zoomOut} title="缩小" className="toolbar-btn">
          <ZoomOut size={18} />
        </button>
        <div className="text-xs font-mono text-gray-300 min-w-[48px] text-center">
          {Math.round(canvasScale * 100)}%
        </div>
        <button onClick={zoomIn} title="放大" className="toolbar-btn">
          <ZoomIn size={18} />
        </button>
        <button onClick={resetCanvasView} title="重置视图 (Ctrl+0)" className="toolbar-btn">
          <Maximize2 size={18} />
        </button>

        <div className="w-px h-7 bg-sidebar-lighter mx-2" />

        {projectId && (
          <button
            onClick={() => navigate(`/preview?project=${projectId}`)}
            className="toolbar-btn text-accent hover:!bg-accent/20"
            title="时间轴预览"
          >
            <Play size={18} />
            <span className="hidden md:inline text-xs">预览</span>
          </button>
        )}
      </div>

      <div className="p-2 rounded-xl bg-sidebar-light/90 backdrop-blur-md shadow-toolbar border border-sidebar-lighter/60">
        <div
          className="flex items-center justify-between cursor-pointer mb-1.5 px-1 select-none"
          onClick={() => setShowLayers((s) => !s)}
        >
          <span className="text-[11px] font-semibold text-gray-200 uppercase tracking-wider">
            图层管理
          </span>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <span>
              {layers.length}/20
            </span>
            <span className={`transition-transform duration-200 ${showLayers ? 'rotate-90' : ''}`}>
              ›
            </span>
          </div>
        </div>

        {showLayers && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              <button
                onClick={handleAddLayer}
                disabled={layers.length >= 20}
                className={`flex-1 px-2 py-1 text-[11px] rounded-md flex items-center justify-center gap-1 transition-colors ${
                  layers.length >= 20
                    ? 'opacity-40 cursor-not-allowed bg-white/5 text-gray-500'
                    : 'bg-accent/20 hover:bg-accent/30 text-accent'
                }`}
                title="新建图层"
              >
                <Plus size={12} />
                新建
              </button>
              <button
                onClick={handleDeleteLayer}
                disabled={layers.length <= 1 || !activeLayer}
                className="px-2 py-1 text-[11px] rounded-md bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="删除图层"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {layers.length >= 20 && (
              <div className="text-[10px] text-amber-400 text-center">
                已达每分镜 20 图层上限
              </div>
            )}

            <div className="space-y-0.5 max-h-36 overflow-auto pr-1">
              {[...layers]
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .reverse()
                .map((layer) => (
                  <div
                    key={layer.id}
                    onClick={() => setCurrentLayerId(layer.id)}
                    className={`group flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors border ${
                      activeLayerId === layer.id
                        ? 'bg-accent/15 border-accent/40'
                        : 'border-transparent hover:bg-white/5'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisible();
                      }}
                      className={`p-0.5 rounded hover:bg-white/10 ${
                        layer.visible ? 'text-gray-200' : 'text-gray-600'
                      }`}
                    >
                      {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLocked();
                      }}
                      className={`p-0.5 rounded hover:bg-white/10 ${
                        layer.locked ? 'text-amber-400' : 'text-gray-600 hover:text-gray-300'
                      }`}
                    >
                      {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <span
                      className={`flex-1 text-xs truncate ${
                        layer.visible ? 'text-gray-200' : 'text-gray-600 line-through'
                      }`}
                    >
                      {layer.name}
                    </span>
                    <span className="text-[9px] font-mono text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {layer.nodes.length}
                    </span>
                  </div>
                ))}
            </div>

            {activeLayer && (
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-[10px] text-gray-500 truncate flex-1">
                  {activeLayer.nodes.length} 笔画
                </span>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => handleReorder('up')}
                    disabled={activeLayer.orderIndex >= layers.length - 1}
                    className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="上移"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => handleReorder('down')}
                    disabled={activeLayer.orderIndex <= 0}
                    className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="下移"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
