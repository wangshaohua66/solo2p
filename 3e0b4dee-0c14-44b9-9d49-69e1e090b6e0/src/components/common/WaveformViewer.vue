<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useAudioStore } from '@/stores/audio';

const audioStore = useAudioStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);

const clip = computed(() => audioStore.selectedClip);

const selection = ref<{ start: number; end: number } | null>(null);
const dragging = ref<'start' | 'end' | 'body' | null>(null);
const playhead = ref(0);

let rafId = 0;
let resizeObs: ResizeObserver | null = null;

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
  const c = clip.value;
  if (!canvas || !c) return;
  const ctx = canvas.getContext('2d')!;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = rect.height;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1e4a');
  g.addColorStop(1, '#1a142e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const data = c.waveformData;
  if (!data || data.length === 0) return;

  const s0 = c.startTime / c.duration;
  const s1 = c.endTime / c.duration;
  const startI = Math.floor(s0 * data.length);
  const endI = Math.ceil(s1 * data.length);
  const slice = data.slice(startI, endI);
  if (slice.length === 0) return;

  const step = W / slice.length;
  ctx.beginPath();
  const midY = H / 2;
  ctx.moveTo(0, midY);
  for (let i = 0; i < slice.length; i++) {
    const h = slice[i] * H * 0.85;
    ctx.lineTo(i * step, midY - h / 2);
  }
  for (let i = slice.length - 1; i >= 0; i--) {
    const h = slice[i] * H * 0.85;
    ctx.lineTo(i * step, midY + h / 2);
  }
  ctx.closePath();
  const wg = ctx.createLinearGradient(0, 0, W, 0);
  wg.addColorStop(0, 'rgba(0, 212, 255, 0.9)');
  wg.addColorStop(0.5, 'rgba(0, 212, 255, 0.7)');
  wg.addColorStop(1, 'rgba(0, 150, 255, 0.9)');
  ctx.fillStyle = wg;
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  if (selection.value) {
    const selStart = (selection.value.start / c.duration) * W;
    const selEnd = (selection.value.end / c.duration) * W;
    ctx.fillStyle = 'rgba(255, 107, 53, 0.2)';
    ctx.fillRect(selStart, 0, selEnd - selStart, H);
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(selStart, 0); ctx.lineTo(selStart, H);
    ctx.moveTo(selEnd, 0); ctx.lineTo(selEnd, H);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  const phX = (playhead.value / c.duration) * W;
  ctx.beginPath();
  ctx.moveTo(phX, 0); ctx.lineTo(phX, H);
  ctx.stroke();
}

function xToTime(x: number): number {
  const wrap = wrapRef.value;
  const c = clip.value;
  if (!wrap || !c) return 0;
  const rect = wrap.getBoundingClientRect();
  return Math.max(0, Math.min(c.duration, ((x - rect.left) / rect.width) * c.duration));
}

function onMouseDown(e: MouseEvent) {
  if (!clip.value) return;
  const t = xToTime(e.clientX);
  if (selection.value) {
    const tol = clip.value.duration * 0.02;
    if (Math.abs(t - selection.value.start) < tol) dragging.value = 'start';
    else if (Math.abs(t - selection.value.end) < tol) dragging.value = 'end';
    else if (t > selection.value.start && t < selection.value.end) dragging.value = 'body';
    else { selection.value = { start: t, end: t }; dragging.value = 'end'; }
  } else {
    selection.value = { start: t, end: t };
    dragging.value = 'end';
  }
  playhead.value = t;
  render();
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value || !clip.value || !selection.value) return;
  const t = xToTime(e.clientX);
  if (dragging.value === 'start') {
    selection.value.start = Math.min(t, selection.value.end);
  } else if (dragging.value === 'end') {
    selection.value.end = Math.max(t, selection.value.start);
  } else if (dragging.value === 'body') {
    const prev = (selection.value.start + selection.value.end) / 2;
    const delta = t - prev;
    const dur = selection.value.end - selection.value.start;
    let ns = selection.value.start + delta;
    let ne = selection.value.end + delta;
    if (ns < 0) { ns = 0; ne = dur; }
    if (ne > clip.value.duration) { ne = clip.value.duration; ns = ne - dur; }
    selection.value.start = ns; selection.value.end = ne;
  }
  render();
}

function onMouseUp() {
  if (dragging.value && selection.value && clip.value) {
    if (selection.value.end - selection.value.start < 0.05) {
      selection.value = null;
    }
  }
  dragging.value = null;
  render();
}

function applySelection() {
  if (!clip.value || !selection.value) return;
  audioStore.updateClip(clip.value.id, {
    startTime: selection.value.start,
    endTime: selection.value.end
  });
}

function resetRange() {
  if (!clip.value) return;
  audioStore.updateClip(clip.value.id, { startTime: 0, endTime: clip.value.duration });
  selection.value = null;
}

function playAt() {
  if (!clip.value) return;
  audioStore.updateClip(clip.value.id, { startTime: playhead.value });
  audioStore.playClip(clip.value.id);
  animatePlayhead();
}

let animStart = 0;
let animStartVal = 0;
function animatePlayhead() {
  cancelAnimationFrame(rafId);
  animStart = performance.now();
  animStartVal = playhead.value;
  function step(ts: number) {
    if (!clip.value) return;
    const elapsed = (ts - animStart) / 1000;
    const endT = clip.value.endTime;
    playhead.value = Math.min(endT, animStartVal + elapsed);
    render();
    if (playhead.value < endT) rafId = requestAnimationFrame(step);
  }
  rafId = requestAnimationFrame(step);
}

watch(() => clip.value?.id, () => {
  selection.value = null; playhead.value = 0;
  resize();
});
watch(() => audioStore.isDecoding, resize);

onMounted(() => {
  resizeObs = new ResizeObserver(resize);
  if (wrapRef.value) resizeObs.observe(wrapRef.value);
});
</script>

<template>
  <div class="wave-wrap">
    <div class="wave-header">
      <span style="font-weight: 600; color: var(--color-text-secondary);">🌊 波形编辑</span>
      <div class="controls">
        <button @click="playAt">▶ 从指针播放</button>
        <button @click="audioStore.stopPlay()">⏹</button>
        <button v-if="selection" class="btn-primary" @click="applySelection">应用选区</button>
        <button @click="resetRange">重置范围</button>
      </div>
    </div>
    <div ref="wrapRef" class="wave-canvas-wrap"
      @mousedown="onMouseDown" @mousemove="onMouseMove"
      @mouseup="onMouseUp" @mouseleave="onMouseUp">
      <canvas ref="canvasRef" class="wave-canvas"></canvas>
      <div v-if="audioStore.isDecoding" class="loading-overlay">
        <div class="loading-bar"><div class="loading-fill" :style="{ width: (audioStore.decodingProgress*100) + '%' }"></div></div>
        <span>解码中 {{ (audioStore.decodingProgress*100).toFixed(0) }}%</span>
      </div>
      <div v-if="!clip" class="empty-overlay">
        <div class="icon">🎵</div>
        <div>选择或上传音效查看波形</div>
      </div>
    </div>
    <div v-if="clip" class="wave-footer">
      <div class="meta-item">总时长 <b>{{ clip.duration.toFixed(2) }}s</b></div>
      <div class="meta-item">起始 <b>{{ clip.startTime.toFixed(2) }}s</b></div>
      <div class="meta-item">结束 <b>{{ clip.endTime.toFixed(2) }}s</b></div>
      <div class="meta-item">播放 <b>{{ (clip.endTime - clip.startTime).toFixed(2) }}s</b></div>
      <div class="meta-item">指针 <b>{{ playhead.toFixed(2) }}s</b></div>
    </div>
  </div>
</template>

<style scoped>
.wave-wrap {
  display: flex; flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg-panel);
}
.wave-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  gap: 12px;
}
.controls { display: flex; gap: 6px; }
.controls button { padding: 4px 10px; font-size: 11px; }
.wave-canvas-wrap {
  position: relative;
  height: 180px; cursor: crosshair;
}
.wave-canvas { position: absolute; inset: 0; }
.loading-overlay {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; font-size: 12px; color: var(--color-text-secondary);
}
.loading-bar {
  width: 60%; height: 6px; background: var(--color-bg-input);
  border-radius: 3px; overflow: hidden;
}
.loading-fill {
  height: 100%; background: linear-gradient(90deg, #ff6b35, #00d4ff);
  transition: width 0.15s ease;
}
.empty-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; color: var(--color-text-muted);
  font-size: 12px; pointer-events: none;
}
.empty-overlay .icon { font-size: 36px; opacity: 0.5; }
.wave-footer {
  display: flex; flex-wrap: wrap;
  gap: 16px; padding: 8px 14px;
  font-size: 11px; color: var(--color-text-muted);
  background: var(--color-bg-panel-hover);
  border-top: 1px solid var(--color-border);
}
.meta-item b {
  color: var(--color-text-secondary);
  font-weight: 600; margin-left: 4px;
}
</style>
