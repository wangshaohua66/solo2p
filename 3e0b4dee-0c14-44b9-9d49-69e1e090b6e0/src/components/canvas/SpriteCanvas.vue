<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
import { useSpriteStore } from '@/stores/sprite';
import { useProjectStore } from '@/stores/project';
import { loadImage } from '@/utils/id';
import { drawCheckerboard, drawRect, drawCrosshair, fillRect } from '@/utils/canvas-helper';
import type { SpriteFrame } from '@/types';

type HandleType = 'left' | 'right' | 'top' | 'bottom' | 'tl' | 'tr' | 'bl' | 'br' | 'move' | null;

const spriteStore = useSpriteStore();
const projectStore = useProjectStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);
const cachedImg = ref<HTMLImageElement | null>(null);
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const frameImageCache = new Map<string, HTMLCanvasElement>();

const activeHandle = ref<HandleType>(null);
const handleStart = ref<{ x: number; y: number; frame: SpriteFrame | null }>({ x: 0, y: 0, frame: null });
const HANDLE_SIZE = 8;

const sheet = computed(() => spriteStore.selectedSheet);
const selFrame = computed(() => spriteStore.selectedFrame);

let resizeObs: ResizeObserver | null = null;
let rafId = 0;

function screenToCanvas(sx: number, sy: number): { x: number; y: number } {
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  const cx = (sx - rect.left - spriteStore.panOffset.x) / spriteStore.zoom;
  const cy = (sy - rect.top - spriteStore.panOffset.y) / spriteStore.zoom;
  return { x: cx, y: cy };
}

function hitTestFrame(cx: number, cy: number): SpriteFrame | null {
  if (!sheet.value) return null;
  for (let i = sheet.value.frames.length - 1; i >= 0; i--) {
    const f = sheet.value.frames[i];
    if (cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height) {
      return f;
    }
  }
  return null;
}

function hitTestHandle(cx: number, cy: number): HandleType {
  if (!selFrame.value || spriteStore.editMode !== 'cut') return null;
  const f = selFrame.value;
  const hs = HANDLE_SIZE / spriteStore.zoom;
  const handles: { type: HandleType; x: number; y: number }[] = [
    { type: 'tl', x: f.x, y: f.y },
    { type: 'tr', x: f.x + f.width, y: f.y },
    { type: 'bl', x: f.x, y: f.y + f.height },
    { type: 'br', x: f.x + f.width, y: f.y + f.height },
    { type: 'left', x: f.x, y: f.y + f.height / 2 },
    { type: 'right', x: f.x + f.width, y: f.y + f.height / 2 },
    { type: 'top', x: f.x + f.width / 2, y: f.y },
    { type: 'bottom', x: f.x + f.width / 2, y: f.y + f.height },
  ];
  for (const h of handles) {
    if (Math.abs(cx - h.x) <= hs && Math.abs(cy - h.y) <= hs) return h.type;
  }
  if (cx > f.x + hs * 2 && cx < f.x + f.width - hs * 2 && cy > f.y + hs * 2 && cy < f.y + f.height - hs * 2) {
    return 'move';
  }
  return null;
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

function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawCheckerboard(ctx, rect.width, rect.height, 16);

  if (!sheet.value || !cachedImg.value) return;

  ctx.save();
  ctx.translate(spriteStore.panOffset.x, spriteStore.panOffset.y);
  ctx.scale(spriteStore.zoom, spriteStore.zoom);

  ctx.drawImage(cachedImg.value, 0, 0);

  for (const f of sheet.value.frames) {
    const isSel = selFrame.value?.id === f.id;
    if (isSel) {
      drawRect(ctx, f.x - 1, f.y - 1, f.width + 2, f.height + 2, '#ff6b35', 2, []);
    } else {
      drawRect(ctx, f.x, f.y, f.width, f.height, '#00d4ff', 1, [4, 3]);
    }
    if (isSel) {
      if (spriteStore.editMode === 'anchor') {
        drawCrosshair(ctx, f.x + f.anchor.x, f.y + f.anchor.y, 8, '#ff6b35');
      }
      if (spriteStore.editMode === 'hitbox') {
        fillRect(ctx, f.x + f.hitbox.x, f.y + f.hitbox.y, f.hitbox.w, f.hitbox.h, 'rgba(255,77,79,0.2)');
        drawRect(ctx, f.x + f.hitbox.x, f.y + f.hitbox.y, f.hitbox.w, f.hitbox.h, '#ff4d4f', 1, []);
      }
      if (spriteStore.editMode === 'trigger' && f.triggerArea) {
        fillRect(ctx, f.x + f.triggerArea.x, f.y + f.triggerArea.y, f.triggerArea.w, f.triggerArea.h, 'rgba(0,212,255,0.2)');
        drawRect(ctx, f.x + f.triggerArea.x, f.y + f.triggerArea.y, f.triggerArea.w, f.triggerArea.h, '#00d4ff', 1, []);
      }
      if (spriteStore.editMode === 'cut') {
        drawHandles(ctx, f);
      }
    }
  }

  ctx.restore();
}

function drawHandles(ctx: CanvasRenderingContext2D, f: SpriteFrame) {
  const hs = HANDLE_SIZE / spriteStore.zoom;
  const positions: { x: number; y: number }[] = [
    { x: f.x, y: f.y },
    { x: f.x + f.width, y: f.y },
    { x: f.x, y: f.y + f.height },
    { x: f.x + f.width, y: f.y + f.height },
    { x: f.x, y: f.y + f.height / 2 },
    { x: f.x + f.width, y: f.y + f.height / 2 },
    { x: f.x + f.width / 2, y: f.y },
    { x: f.x + f.width / 2, y: f.y + f.height },
  ];
  for (const p of positions) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x - hs / 2, p.y - hs / 2, hs, hs);
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 1 / spriteStore.zoom;
    ctx.strokeRect(p.x - hs / 2, p.y - hs / 2, hs, hs);
  }
}

async function reload() {
  if (!sheet.value) { cachedImg.value = null; render(); return; }
  try {
    cachedImg.value = await loadImage(sheet.value.imageDataUrl);
  } catch { cachedImg.value = null; }
  render();
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const newZoom = Math.max(0.1, Math.min(16, spriteStore.zoom * factor));
  const ratio = newZoom / spriteStore.zoom;
  spriteStore.panOffset = {
    x: mx - (mx - spriteStore.panOffset.x) * ratio,
    y: my - (my - spriteStore.panOffset.y) * ratio
  };
  spriteStore.zoom = newZoom;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(render);
}

function onMouseDown(e: MouseEvent) {
  if (e.button === 1 || e.button === 2 || e.shiftKey) {
    isDragging.value = true;
    dragStart.value = { x: e.clientX - spriteStore.panOffset.x, y: e.clientY - spriteStore.panOffset.y };
    e.preventDefault();
    return;
  }
  const { x, y } = screenToCanvas(e.clientX, e.clientY);

  if (spriteStore.editMode === 'cut' && selFrame.value) {
    const handle = hitTestHandle(x, y);
    if (handle) {
      activeHandle.value = handle;
      handleStart.value = { x, y, frame: { ...selFrame.value } };
      projectStore.beginHistory();
      e.preventDefault();
      return;
    }
  }

  const f = hitTestFrame(x, y);
  spriteStore.selectFrame(f ? f.id : null);
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(render);
}

function onMouseMove(e: MouseEvent) {
  if (isDragging.value) {
    spriteStore.panOffset = {
      x: e.clientX - dragStart.value.x,
      y: e.clientY - dragStart.value.y
    };
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(render);
    return;
  }
  if (activeHandle.value && selFrame.value && handleStart.value.frame) {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const dx = x - handleStart.value.x;
    const dy = y - handleStart.value.y;
    const orig = handleStart.value.frame;
    let nx = orig.x, ny = orig.y, nw = orig.width, nh = orig.height;

    switch (activeHandle.value) {
      case 'tl': nx = orig.x + dx; ny = orig.y + dy; nw = orig.width - dx; nh = orig.height - dy; break;
      case 'tr': ny = orig.y + dy; nw = orig.width + dx; nh = orig.height - dy; break;
      case 'bl': nx = orig.x + dx; nw = orig.width - dx; nh = orig.height + dy; break;
      case 'br': nw = orig.width + dx; nh = orig.height + dy; break;
      case 'left': nx = orig.x + dx; nw = orig.width - dx; break;
      case 'right': nw = orig.width + dx; break;
      case 'top': ny = orig.y + dy; nh = orig.height - dy; break;
      case 'bottom': nh = orig.height + dy; break;
      case 'move': nx = orig.x + dx; ny = orig.y + dy; break;
    }
    nw = Math.max(4, Math.round(nw));
    nh = Math.max(4, Math.round(nh));
    nx = Math.max(0, Math.round(nx));
    ny = Math.max(0, Math.round(ny));
    if (sheet.value) {
      nx = Math.min(nx, sheet.value.width - 4);
      ny = Math.min(ny, sheet.value.height - 4);
      nw = Math.min(nw, sheet.value.width - nx);
      nh = Math.min(nh, sheet.value.height - ny);
    }
    spriteStore.updateFrame(selFrame.value.id, { x: nx, y: ny, width: nw, height: nh });
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(render);
  }
}

function onMouseUp() {
  isDragging.value = false;
  if (activeHandle.value) {
    projectStore.commitHistory(`调整帧 ${selFrame.value?.name || ''}`);
    activeHandle.value = null;
    handleStart.value = { x: 0, y: 0, frame: null };
  }
}

function fitToScreen() {
  if (!sheet.value || !wrapRef.value) return;
  const wr = wrapRef.value.getBoundingClientRect();
  const scaleX = (wr.width - 32) / sheet.value.width;
  const scaleY = (wr.height - 32) / sheet.value.height;
  spriteStore.zoom = Math.min(scaleX, scaleY);
  spriteStore.panOffset = {
    x: (wr.width - sheet.value.width * spriteStore.zoom) / 2,
    y: (wr.height - sheet.value.height * spriteStore.zoom) / 2
  };
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(render);
}

function getFrameThumb(frameId: string, size = 80): HTMLCanvasElement | null {
  if (!cachedImg.value || !sheet.value) return null;
  const key = `${frameId}_${size}`;
  if (frameImageCache.has(key)) return frameImageCache.get(key)!;
  const f = sheet.value.frames.find(x => x.id === frameId);
  if (!f) return null;
  const scale = Math.min(size / f.width, size / f.height);
  const c = document.createElement('canvas');
  c.width = Math.max(1, f.width * scale);
  c.height = Math.max(1, f.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cachedImg.value, f.x, f.y, f.width, f.height, 0, 0, c.width, c.height);
  frameImageCache.set(key, c);
  return c;
}

function zoomIn() { spriteStore.zoom *= 1.25; cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render); }
function zoomOut() { spriteStore.zoom /= 1.25; cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render); }

watch(() => sheet.value?.id, () => { frameImageCache.clear(); reload(); });
watch([() => sheet.value?.frames.length, () => spriteStore.selectedFrameId, () => spriteStore.editMode,
  () => selFrame.value?.x, () => selFrame.value?.y, () => selFrame.value?.width, () => selFrame.value?.height],
  () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render); }, { deep: true }
);

onMounted(() => {
  resizeObs = new ResizeObserver(resize);
  if (wrapRef.value) resizeObs.observe(wrapRef.value);
  reload();
});

onUnmounted(() => { resizeObs?.disconnect(); cancelAnimationFrame(rafId); });

defineExpose({ render, fitToScreen, zoomIn, zoomOut, getFrameThumb });
</script>

<template>
  <div ref="wrapRef" class="sprite-canvas-wrap checkerboard"
    @wheel="onWheel" @mousedown="onMouseDown" @mousemove="onMouseMove"
    @mouseup="onMouseUp" @mouseleave="onMouseUp" @contextmenu.prevent>
    <canvas ref="canvasRef" class="sprite-canvas"></canvas>
    <div v-if="!sheet" class="empty-hint">
      <div class="icon">🖼️</div>
      <div>上传或选择精灵表开始编辑</div>
    </div>
    <div v-else class="zoom-indicator">
      缩放 {{ (spriteStore.zoom * 100).toFixed(0) }}% · {{ sheet.width }}×{{ sheet.height }}
      <template v-if="spriteStore.editMode === 'cut'"> · 拖拽橙色方块调整切割边界</template>
    </div>
  </div>
</template>

<style scoped>
.sprite-canvas-wrap {
  position: relative; width: 100%; height: 100%;
  overflow: hidden; cursor: crosshair;
}
.sprite-canvas {
  position: absolute; inset: 0; display: block;
  image-rendering: pixelated;
}
.empty-hint {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-text-muted); gap: 12px; font-size: 14px;
  pointer-events: none;
}
.empty-hint .icon { font-size: 48px; opacity: 0.5; }
.zoom-indicator {
  position: absolute; top: 10px; right: 12px;
  font-size: 11px; padding: 4px 8px;
  background: rgba(35, 39, 47, 0.85);
  border: 1px solid var(--color-border);
  border-radius: 3px; color: var(--color-text-secondary);
  pointer-events: none;
}
</style>
