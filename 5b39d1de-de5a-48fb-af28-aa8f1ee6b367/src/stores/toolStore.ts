import { create } from 'zustand';
import type { ToolType } from '@/types';
import {
  PRESET_COLORS,
  MIN_SCALE,
  MAX_SCALE,
  MIN_BRUSH,
  MAX_BRUSH,
} from '@/types';

interface ToolState {
  currentTool: ToolType;
  brushSize: number;
  brushColor: string;
  presetColors: readonly string[];
  canvasScale: number;
  canvasOffsetX: number;
  canvasOffsetY: number;
  currentLayerId: string | null;

  setTool: (tool: ToolType) => void;
  setBrushSize: (size: number) => void;
  setBrushColor: (color: string) => void;
  addPresetColor: (color: string) => void;
  setCanvasScale: (scale: number, center?: { x: number; y: number }) => void;
  setCanvasOffset: (x: number, y: number) => void;
  adjustCanvasOffset: (dx: number, dy: number) => void;
  resetCanvasView: () => void;
  setCurrentLayerId: (id: string | null) => void;
}

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

export const useToolStore = create<ToolState>((set, get) => ({
  currentTool: 'pen',
  brushSize: 3,
  brushColor: '#000000',
  presetColors: PRESET_COLORS,
  canvasScale: 1,
  canvasOffsetX: 0,
  canvasOffsetY: 0,
  currentLayerId: null,

  setTool: (tool) => set({ currentTool: tool }),

  setBrushSize: (size) => set({ brushSize: clamp(size, MIN_BRUSH, MAX_BRUSH) }),

  setBrushColor: (color) => set({ brushColor: color }),

  addPresetColor: (color) => {
    const existing = get().presetColors;
    if (existing.includes(color)) return;
    set({ presetColors: [...existing.slice(0, 15), color] });
  },

  setCanvasScale: (scale, center) => {
    const clamped = clamp(scale, MIN_SCALE, MAX_SCALE);
    const prev = get().canvasScale;
    if (center) {
      const ratio = clamped / prev;
      set({
        canvasScale: clamped,
        canvasOffsetX: center.x - (center.x - get().canvasOffsetX) * ratio,
        canvasOffsetY: center.y - (center.y - get().canvasOffsetY) * ratio,
      });
    } else {
      set({ canvasScale: clamped });
    }
  },

  setCanvasOffset: (x, y) => set({ canvasOffsetX: x, canvasOffsetY: y }),

  adjustCanvasOffset: (dx, dy) =>
    set((s) => ({
      canvasOffsetX: s.canvasOffsetX + dx,
      canvasOffsetY: s.canvasOffsetY + dy,
    })),

  resetCanvasView: () => set({ canvasScale: 1, canvasOffsetX: 0, canvasOffsetY: 0 }),

  setCurrentLayerId: (id) => set({ currentLayerId: id }),
}));
