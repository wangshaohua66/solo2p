<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
import { useSpriteStore } from '@/stores/sprite';
import { loadImage } from '@/utils/id';
import { drawCheckerboard, drawRect, drawCrosshair, fillRect } from '@/utils/canvas-helper';
import type { SpriteFrame } from '@/types';

const spriteStore = useSpriteStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);
const cachedImg = ref<HTMLImageElement | null>(null);
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const frameImageCache = new Map<string, HTMLCanvasElement>();

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
    }
  }

  ctx.restore();
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
  }
}

function onMouseUp() { isDragging.value = false; }

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
watch([() => sheet.value?.frames.length, () => spriteStore.selectedFrameId, () => spriteStore.editMode],
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
    <div v-else class="zoom-indicator">缩放 {{ (spriteStore.zoom * 100).toFixed(0) }}% · {{ sheet.width }}×{{ sheet.height }}</div>
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
