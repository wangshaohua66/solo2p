<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
import { useAnimationStore } from '@/stores/animation';
import { useSpriteStore } from '@/stores/sprite';
import { useProjectStore } from '@/stores/project';
import { useAudioStore } from '@/stores/audio';
import { loadImage } from '@/utils/id';
import { drawCheckerboard } from '@/utils/canvas-helper';

const animStore = useAnimationStore();
const spriteStore = useSpriteStore();
const projectStore = useProjectStore();
const audioStore = useAudioStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);
const imageCache = new Map<string, HTMLImageElement>();
const sheetImageCache = new Map<string, HTMLImageElement>();
const playedEventIds = ref<Set<string>>(new Set());
let rafId = 0;
let startTime = 0;
let resizeObs: ResizeObserver | null = null;

const anim = computed(() => animStore.selectedAnim);
const totalDur = computed(() => animStore.totalDuration);

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

function currentKeyframe(track: { keyframes: { durationMs: number; frameId: string; offsetX: number; offsetY: number; rotation: number; eventType: string; eventValue: string; audioClipId: string | null; id: string }[] }, timeMs: number): { kf: typeof track.keyframes[number]; progress: number; index: number } | null {
  let acc = 0;
  for (let i = 0; i < track.keyframes.length; i++) {
    const kf = track.keyframes[i];
    if (timeMs < acc + kf.durationMs) {
      return { kf, progress: (timeMs - acc) / kf.durationMs, index: i };
    }
    acc += kf.durationMs;
  }
  if (track.keyframes.length) {
    return { kf: track.keyframes[track.keyframes.length - 1], progress: 1, index: track.keyframes.length - 1 };
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

  if (!anim.value) return;

  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const t = anim.value.loop ? animStore.playbackTime % Math.max(1, totalDur.value) : animStore.playbackTime;

  const sorted = [...anim.value.tracks].sort((a, b) => a.zIndex - b.zIndex);
  for (const track of sorted) {
    const info = currentKeyframe(track, t);
    if (!info) continue;
    const { kf, index } = info;
    const frameInfo = getFrameInfo(kf.frameId);
    if (!frameInfo) continue;

    ctx.save();
    ctx.translate(cx + kf.offsetX, cy + kf.offsetY);
    if (kf.rotation) ctx.rotate((kf.rotation * Math.PI) / 180);
    ctx.translate(-frameInfo.w / 2, -frameInfo.h / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frameInfo.img, frameInfo.x, frameInfo.y, frameInfo.w, frameInfo.h, 0, 0, frameInfo.w, frameInfo.h);
    ctx.restore();

    if (kf.eventType !== 'none') {
      const evKey = `${track.id}_${index}_${Math.floor(t / 100)}`;
      if (!playedEventIds.value.has(evKey)) {
        playedEventIds.value.add(evKey);
        if (kf.eventType === 'audio' && kf.audioClipId) {
          audioStore.playClip(kf.audioClipId);
        }
      }
    }
  }
}

function tick(ts: number) {
  if (!startTime) startTime = ts;
  const elapsed = ts - startTime;
  if (animStore.isPlaying) {
    animStore.playbackTime = elapsed;
    if (anim.value?.loop === false && elapsed >= totalDur.value) {
      animStore.isPlaying = false;
    }
  } else {
    startTime = ts - animStore.playbackTime;
  }
  render();
  rafId = requestAnimationFrame(tick);
}

function play() {
  if (!anim.value?.tracks.some(t => t.keyframes.length)) return;
  animStore.playbackTime = 0;
  playedEventIds.value.clear();
  startTime = 0;
  animStore.isPlaying = true;
}
function pause() { animStore.isPlaying = false; }
function stop() { animStore.isPlaying = false; animStore.playbackTime = 0; playedEventIds.value.clear(); }
function seek(ms: number) {
  animStore.playbackTime = Math.max(0, Math.min(totalDur.value, ms));
  playedEventIds.value.clear();
  startTime = performance.now() - animStore.playbackTime;
  render();
}

watch(() => anim.value?.id, () => {
  preloadAll();
  stop();
  render();
});

onMounted(() => {
  resizeObs = new ResizeObserver(resize);
  if (wrapRef.value) resizeObs.observe(wrapRef.value);
  preloadAll();
  rafId = requestAnimationFrame(tick);
});

onUnmounted(() => { resizeObs?.disconnect(); cancelAnimationFrame(rafId); });

defineExpose({ play, pause, stop, seek, render, preloadAll });
</script>

<template>
  <div class="anim-player-wrap">
    <div ref="wrapRef" class="anim-canvas-wrap checkerboard">
      <canvas ref="canvasRef" class="anim-canvas"></canvas>
      <div v-if="!anim" class="empty-hint">
        <div class="icon">🎬</div>
        <div>选择或创建动画开始编排</div>
      </div>
    </div>
    <div class="player-controls">
      <div class="ctrl-left">
        <button @click="stop" title="停止">⏹</button>
        <button @click="animStore.isPlaying ? pause() : play()" class="btn-primary">
          {{ animStore.isPlaying ? '⏸ 暂停' : '▶ 播放' }}
        </button>
      </div>
      <div class="ctrl-mid">
        <input type="range" min="0" :max="totalDur || 1000" :value="animStore.playbackTime"
          @input="seek(Number(($event.target as HTMLInputElement).value))" class="time-slider" />
        <span class="time-label">{{ (animStore.playbackTime/1000).toFixed(2) }}s / {{ (totalDur/1000).toFixed(2) }}s</span>
      </div>
      <div class="ctrl-right">
        <span class="fps-badge">🎞 60fps</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.anim-player-wrap {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
}
.anim-canvas-wrap {
  flex: 1; position: relative; overflow: hidden;
  border-bottom: 1px solid var(--color-border);
  min-height: 0;
}
.anim-canvas {
  position: absolute; inset: 0; image-rendering: pixelated;
}
.empty-hint {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--color-text-muted); gap: 12px; pointer-events: none;
}
.empty-hint .icon { font-size: 48px; opacity: 0.5; }
.player-controls {
  flex: 0 0 auto; display: flex; align-items: center; gap: 14px;
  padding: 10px 14px; background: var(--color-bg-panel);
}
.ctrl-left, .ctrl-right { display: flex; gap: 8px; align-items: center; }
.ctrl-mid { flex: 1; display: flex; align-items: center; gap: 12px; }
.time-slider {
  flex: 1; height: 6px; background: var(--color-bg-input);
  -webkit-appearance: none; border-radius: 3px; outline: none;
}
.time-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
  background: var(--color-primary); cursor: pointer;
  box-shadow: 0 0 8px var(--shadow-glow-orange);
}
.time-label { font-size: 11px; color: var(--color-text-muted); min-width: 100px; text-align: right; }
.fps-badge {
  font-size: 10px; padding: 3px 8px;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: 10px; color: var(--color-text-success);
}
</style>
