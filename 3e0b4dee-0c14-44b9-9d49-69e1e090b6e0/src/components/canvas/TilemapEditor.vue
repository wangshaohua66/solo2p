<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
import { useTilemapStore } from '@/stores/tilemap';
import { useProjectStore } from '@/stores/project';
import { useAudioStore } from '@/stores/audio';
import { loadImage } from '@/utils/id';
import { drawGrid, drawRect, fillRect, drawCheckerboard } from '@/utils/canvas-helper';

const mapStore = useTilemapStore();
const projectStore = useProjectStore();
const audioStore = useAudioStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);
const sheetImageCache = new Map<string, HTMLImageElement>();
const hoverCell = ref<{ col: number; row: number } | null>(null);
const isPainting = ref(false);
const selectStart = ref<{ col: number; row: number } | null>(null);
const selectEnd = ref<{ col: number; row: number } | null>(null);
const selectionConfirmed = ref(false);
const isMovingSelection = ref(false);
const moveStart = ref<{ col: number; row: number } | null>(null);
const moveOffset = ref<{ col: number; row: number }>({ col: 0, row: 0 });
let resizeObs: ResizeObserver | null = null;
let rafId = 0;

const map = computed(() => mapStore.selectedMap);
const layer = computed(() => mapStore.selectedLayer);

function getFrameInfo(frameId: string): { img: HTMLImageElement; x: number; y: number; w: number; h: number } | null {
  for (const ss of projectStore.spriteSheets) {
    const f = ss.frames.find(fr => fr.id === frameId);
    if (f) {
      const img = sheetImageCache.get(ss.id);
      if (!img) return null;
      return { img, x: f.x, y: f.y, w: f.width, h: f.height };
    }
  }
  return null;
}

async function preloadAll() {
  sheetImageCache.clear();
  for (const ss of projectStore.spriteSheets) {
    try { sheetImageCache.set(ss.id, await loadImage(ss.imageDataUrl)); } catch { /* noop */ }
  }
}

function screenToCell(sx: number, sy: number): { col: number; row: number; px: number; py: number } | null {
  if (!map.value) return null;
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  const tw = map.value.tileWidth * mapStore.zoom;
  const th = map.value.tileHeight * mapStore.zoom;
  const mx = (sx - rect.left - mapStore.panOffset.x);
  const my = (sy - rect.top - mapStore.panOffset.y);
  return {
    col: Math.floor(mx / tw),
    row: Math.floor(my / th),
    px: mx, py: my
  };
}

function resize() {
  const canvas = canvasRef.value;
  const wrap = wrapRef.value;
  if (!canvas || !wrap) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = wrap.clientWidth * dpr;
  canvas.height = wrap.clientHeight * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function getSelectionRect() {
  if (!selectStart.value || !selectEnd.value) return null;
  return {
    c1: Math.min(selectStart.value.col, selectEnd.value.col),
    c2: Math.max(selectStart.value.col, selectEnd.value.col),
    r1: Math.min(selectStart.value.row, selectEnd.value.row),
    r2: Math.max(selectStart.value.row, selectEnd.value.row)
  };
}

function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawCheckerboard(ctx, rect.width, rect.height, 16);

  if (!map.value) return;
  const { cols, rows, tileWidth, tileHeight } = map.value;
  const tw = tileWidth * mapStore.zoom;
  const th = tileHeight * mapStore.zoom;

  ctx.save();
  ctx.translate(mapStore.panOffset.x, mapStore.panOffset.y);

  const sortedLayers = [...map.value.layers].sort((a, b) => a.zIndex - b.zIndex);
  for (const l of sortedLayers) {
    if (!l.visible) continue;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const fid = l.cells[r]?.[c];
        if (!fid) continue;
        const info = getFrameInfo(fid);
        if (!info) continue;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(info.img, info.x, info.y, info.w, info.h,
          c * tw, r * th, tw, th);
      }
    }
  }

  drawGrid(ctx, cols * tw, rows * th, tw, th, 'rgba(255,255,255,0.08)');

  if (hoverCell.value && layer.value && !selectionConfirmed.value) {
    const { col, row } = hoverCell.value;
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      drawRect(ctx, col * tw, row * th, tw, th, '#00d4ff', 2, []);
      if (mapStore.tool === 'brush' && mapStore.selectedTileFrameId) {
        const info = getFrameInfo(mapStore.selectedTileFrameId);
        if (info) {
          ctx.globalAlpha = 0.6;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(info.img, info.x, info.y, info.w, info.h,
            col * tw, row * th, tw, th);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  if (selectStart.value && selectEnd.value) {
    const sr = getSelectionRect()!;
    let offX = 0, offY = 0;
    if (isMovingSelection.value && moveOffset) {
      offX = moveOffset.value.col * tw;
      offY = moveOffset.value.row * th;
    }
    const x1 = sr.c1 * tw + offX;
    const y1 = sr.r1 * th + offY;
    const w = (sr.c2 - sr.c1 + 1) * tw;
    const h = (sr.r2 - sr.r1 + 1) * th;
    fillRect(ctx, x1, y1, w, h, isMovingSelection.value ? 'rgba(255,107,53,0.15)' : 'rgba(0, 212, 255, 0.1)');
    drawRect(ctx, x1, y1, w, h, isMovingSelection.value ? '#ff6b35' : '#00d4ff', 2, [6, 4]);
    if (selectionConfirmed.value && !isMovingSelection.value) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText(`${sr.c2 - sr.c1 + 1}×${sr.r2 - sr.r1 + 1}`, x1 + 4, y1 + 12);
    }
  }

  if (mapStore.showCollision) {
    for (const z of map.value.triggerZones) {
      const color = z.type === 'collision' ? 'rgba(255,77,79,0.25)' : 'rgba(0,212,255,0.2)';
      const stroke = z.type === 'collision' ? '#ff4d4f' : '#00d4ff';
      fillRect(ctx, z.x, z.y, z.w, z.h, color);
      drawRect(ctx, z.x, z.y, z.w, z.h, stroke, 1, []);
      ctx.fillStyle = stroke;
      ctx.font = '10px JetBrains Mono';
      ctx.fillText(z.type === 'collision' ? 'COL' : 'TRG', z.x + 4, z.y + 12);
    }
  }

  ctx.restore();
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  if (!map.value) return;
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const newZoom = Math.max(0.25, Math.min(8, mapStore.zoom * factor));
  const ratio = newZoom / mapStore.zoom;
  mapStore.panOffset = {
    x: mx - (mx - mapStore.panOffset.x) * ratio,
    y: my - (my - mapStore.panOffset.y) * ratio
  };
  mapStore.zoom = newZoom;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(render);
}

function isInsideSelection(col: number, row: number): boolean {
  const sr = getSelectionRect();
  if (!sr) return false;
  return col >= sr.c1 && col <= sr.c2 && row >= sr.r1 && row <= sr.r2;
}

function onMouseDown(e: MouseEvent) {
  if (!map.value || !layer.value) return;
  if (e.button === 1 || e.button === 2 || e.shiftKey) {
    const ox = e.clientX - mapStore.panOffset.x;
    const oy = e.clientY - mapStore.panOffset.y;
    const move = (ev: MouseEvent) => {
      mapStore.panOffset = { x: ev.clientX - ox, y: ev.clientY - oy };
      cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    e.preventDefault();
    return;
  }
  const cell = screenToCell(e.clientX, e.clientY);
  if (!cell) return;

  if (mapStore.tool === 'select') {
    if (selectionConfirmed.value && selectStart.value && selectEnd.value && isInsideSelection(cell.col, cell.row)) {
      isMovingSelection.value = true;
      moveStart.value = { col: cell.col, row: cell.row };
      moveOffset.value = { col: 0, row: 0 };
      e.preventDefault();
      return;
    }
    selectStart.value = { col: cell.col, row: cell.row };
    selectEnd.value = { col: cell.col, row: cell.row };
    selectionConfirmed.value = false;
  } else {
    applyTool(cell.col, cell.row);
    isPainting.value = true;
  }
}

function onMouseMove(e: MouseEvent) {
  const cell = screenToCell(e.clientX, e.clientY);
  if (cell) hoverCell.value = { col: cell.col, row: cell.row };
  if (isPainting.value && cell) applyTool(cell.col, cell.row);
  if (selectStart.value && cell && !isMovingSelection.value && !selectionConfirmed.value) {
    selectEnd.value = { col: cell.col, row: cell.row };
    cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render);
  }
  if (isMovingSelection.value && cell && moveStart.value) {
    moveOffset.value = {
      col: cell.col - moveStart.value.col,
      row: cell.row - moveStart.value.row
    };
    cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render);
  }
}

function onMouseUp() {
  isPainting.value = false;
  if (isMovingSelection.value && selectStart.value && selectEnd.value && layer.value) {
    const sr = getSelectionRect()!;
    const dc = moveOffset.value.col, dr = moveOffset.value.row;
    if (dc !== 0 || dr !== 0) {
      mapStore.moveSelection(layer.value.id, sr.c1, sr.r1, sr.c2, sr.r2, sr.c1 + dc, sr.r1 + dr);
      selectStart.value = { col: sr.c1 + dc, row: sr.r1 + dr };
      selectEnd.value = { col: sr.c2 + dc, row: sr.r2 + dr };
    }
    mapStore.copySelection(layer.value.id,
      Math.min(selectStart.value.col, selectEnd.value.col),
      Math.min(selectStart.value.row, selectEnd.value.row),
      Math.max(selectStart.value.col, selectEnd.value.col),
      Math.max(selectStart.value.row, selectEnd.value.row));
    isMovingSelection.value = false;
    moveStart.value = null;
    moveOffset.value = { col: 0, row: 0 };
    selectionConfirmed.value = true;
  } else if (selectStart.value && selectEnd.value && mapStore.tool === 'select' && !selectionConfirmed.value) {
    selectionConfirmed.value = true;
    if (layer.value) {
      mapStore.copySelection(layer.value.id,
        Math.min(selectStart.value.col, selectEnd.value.col),
        Math.min(selectStart.value.row, selectEnd.value.row),
        Math.max(selectStart.value.col, selectEnd.value.col),
        Math.max(selectStart.value.row, selectEnd.value.row));
    }
  }
}

function clearSelection() {
  selectStart.value = null;
  selectEnd.value = null;
  selectionConfirmed.value = false;
  isMovingSelection.value = false;
  cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render);
}

function pasteSelection() {
  const cell = hoverCell.value;
  if (!cell || !layer.value) return;
  mapStore.pasteFromClipboard(layer.value.id, cell.col, cell.row);
  cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render);
}

function applyTool(col: number, row: number) {
  if (!layer.value) return;
  if (mapStore.tool === 'brush') {
    mapStore.paintCell(layer.value.id, col, row, mapStore.selectedTileFrameId);
  } else if (mapStore.tool === 'eraser') {
    mapStore.paintCell(layer.value.id, col, row, null);
  } else if (mapStore.tool === 'fill') {
    mapStore.floodFill(layer.value.id, col, row, mapStore.selectedTileFrameId);
  }
  cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render);
}

function fitToScreen() {
  if (!map.value || !wrapRef.value) return;
  const wr = wrapRef.value.getBoundingClientRect();
  const mw = map.value.cols * map.value.tileWidth;
  const mh = map.value.rows * map.value.tileHeight;
  const scaleX = (wr.width - 32) / mw;
  const scaleY = (wr.height - 32) / mh;
  mapStore.zoom = Math.min(scaleX, scaleY);
  mapStore.panOffset = {
    x: (wr.width - mw * mapStore.zoom) / 2,
    y: (wr.height - mh * mapStore.zoom) / 2
  };
  cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render);
}

function setTool(t: 'brush' | 'fill' | 'eraser' | 'select') {
  mapStore.tool = t;
  clearSelection();
}

watch([() => map.value?.id, () => projectStore.spriteSheets.length], () => {
  preloadAll(); render();
});
watch([() => layer.value?.id, () => map.value?.triggerZones.length],
  () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render); }, { deep: true });

onMounted(() => {
  resizeObs = new ResizeObserver(resize);
  if (wrapRef.value) resizeObs.observe(wrapRef.value);
  preloadAll();
});

onUnmounted(() => { resizeObs?.disconnect(); cancelAnimationFrame(rafId); audioStore.stopPlay(); });

defineExpose({ render, fitToScreen, preloadAll });
</script>

<template>
  <div class="tilemap-wrap">
    <div class="map-toolbar">
      <div class="tool-group">
        <button :class="{ active: mapStore.tool === 'brush' }" @click="setTool('brush')" title="画笔">🖌 画笔</button>
        <button :class="{ active: mapStore.tool === 'fill' }" @click="setTool('fill')" title="填充">🪣 填充</button>
        <button :class="{ active: mapStore.tool === 'eraser' }" @click="setTool('eraser')" title="橡皮">🧽 橡皮</button>
        <button :class="{ active: mapStore.tool === 'select' }" @click="setTool('select')" title="选区">🔲 选区</button>
        <button v-if="mapStore.tool === 'select'" :disabled="!selectionConfirmed" @click="clearSelection" title="清除选区">✕ 清除</button>
        <button v-if="mapStore.tool === 'select'" :disabled="!mapStore.hasClipboard() || !hoverCell" @click="pasteSelection" title="粘贴选区到当前位置">📋 粘贴</button>
      </div>
      <div class="spacer"></div>
      <div class="tool-group">
        <button @click="fitToScreen" title="适配屏幕">⛶ 适配</button>
        <button @click="mapStore.zoom *= 1.25" title="放大">➕</button>
        <button @click="mapStore.zoom /= 1.25" title="缩小">➖</button>
        <button :class="{ active: mapStore.showCollision }" @click="mapStore.showCollision = !mapStore.showCollision" title="显示碰撞/触发">
          {{ mapStore.showCollision ? '◉ 碰撞显示' : '○ 碰撞隐藏' }}
        </button>
      </div>
    </div>
    <div ref="wrapRef" class="map-canvas-wrap checkerboard"
      @wheel="onWheel" @mousedown="onMouseDown" @mousemove="onMouseMove"
      @mouseup="onMouseUp" @mouseleave="onMouseUp" @contextmenu.prevent>
      <canvas ref="canvasRef" class="map-canvas"></canvas>
      <div v-if="!map" class="empty-hint">
        <div class="icon">🗺️</div>
        <div>创建或选择瓦片地图开始编辑</div>
      </div>
      <div v-else class="map-info">
        {{ map.cols }}×{{ map.rows }} 格 · 瓦片 {{ map.tileWidth }}×{{ map.tileHeight }}px · 缩放 {{ (mapStore.zoom*100).toFixed(0) }}%
        <template v-if="selectionConfirmed"> · 已选{{ (getSelectionRect()?.c2! - getSelectionRect()?.c1! + 1) }}×{{ (getSelectionRect()?.r2! - getSelectionRect()?.r1! + 1) }}格，可拖拽移动</template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tilemap-wrap {
  display: flex; flex-direction: column; width: 100%; height: 100%;
  min-height: 0;
}
.map-toolbar {
  flex: 0 0 auto; display: flex; align-items: center;
  padding: 8px 12px; gap: 12px;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
}
.tool-group { display: flex; gap: 4px; }
.tool-group button.active {
  background: linear-gradient(180deg, #ff8050 0%, var(--color-text-primary) 100%);
  border-color: var(--color-text-primary);
  color: #fff;
  box-shadow: 0 0 10px var(--shadow-glow-orange);
}
.spacer { flex: 1; }
.map-canvas-wrap {
  flex: 1; position: relative; overflow: hidden; cursor: crosshair;
  min-height: 0;
}
.map-canvas {
  position: absolute; inset: 0; image-rendering: pixelated;
}
.empty-hint {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-text-muted); gap: 12px; pointer-events: none;
}
.empty-hint .icon { font-size: 48px; opacity: 0.5; }
.map-info {
  position: absolute; top: 10px; right: 12px;
  font-size: 11px; padding: 4px 8px;
  background: rgba(35, 39, 47, 0.85);
  border: 1px solid var(--color-border);
  border-radius: 3px; color: var(--color-text-secondary);
  pointer-events: none;
}
</style>
