<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, reactive, shallowRef } from 'vue';
import { useAnimationStore } from '@/stores/animation';
import { useProjectStore } from '@/stores/project';
import { useSpriteStore } from '@/stores/sprite';
import { loadImage } from '@/utils/id';

const animStore = useAnimationStore();
const projectStore = useProjectStore();
const spriteStore = useSpriteStore();

const sheetImgCache = new Map<string, HTMLImageElement>();
const thumbDataUrls = reactive<Map<string, string>>(new Map());
const dragInfo = ref<{ trackId: string; from: number; to: number } | null>(null);
const preloadBusy = shallowRef(false);

const anim = computed(() => animStore.selectedAnim);
const sortedTracks = computed(() =>
  anim.value ? [...anim.value.tracks].sort((a, b) => a.zIndex - b.zIndex) : []
);

const allKeyframeIds = computed(() => {
  const ids = new Set<string>();
  if (anim.value) {
    for (const t of anim.value.tracks) {
      for (const k of t.keyframes) ids.add(k.frameId);
    }
  }
  return ids;
});

function sheetImg(sheetId: string): HTMLImageElement | undefined {
  return sheetImgCache.get(sheetId);
}

async function preloadSheets() {
  sheetImgCache.clear();
  for (const ss of projectStore.spriteSheets) {
    try { sheetImgCache.set(ss.id, await loadImage(ss.imageDataUrl)); } catch { /* noop */ }
  }
}

function buildThumbDataUrl(frameId: string, size = 44): string {
  if (thumbDataUrls.has(frameId)) return thumbDataUrls.get(frameId)!;
  for (const ss of projectStore.spriteSheets) {
    const f = ss.frames.find(x => x.id === frameId);
    if (!f) continue;
    const img = sheetImg(ss.id);
    if (!img) return '';
    const scale = Math.min(size / f.width, size / f.height);
    const w = Math.max(1, Math.round(f.width * scale));
    const h = Math.max(1, Math.round(f.height * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, f.x, f.y, f.width, f.height, 0, 0, w, h);
    try {
      const url = c.toDataURL('image/png');
      thumbDataUrls.set(frameId, url);
      return url;
    } catch {
      return '';
    }
  }
  return '';
}

async function regenerateThumbs() {
  if (preloadBusy.value) return;
  preloadBusy.value = true;
  await preloadSheets();
  thumbDataUrls.clear();
  for (const fid of allKeyframeIds.value) {
    buildThumbDataUrl(fid);
  }
  preloadBusy.value = false;
}

const thumbSeq = ref(0);
const thumbReady = computed(() => thumbSeq.value > 0 && !preloadBusy.value);

function getThumb(frameId: string): string {
  return thumbDataUrls.get(frameId) || buildThumbDataUrl(frameId) || '';
}

watch([
  () => projectStore.spriteSheets.length,
  () => anim.value?.id,
  () => allKeyframeIds.value.size
], () => {
  regenerateThumbs();
  thumbSeq.value++;
}, { immediate: true });

function addTrack() {
  if (!anim.value) return;
  const name = prompt('轨道名称？', `轨道${anim.value.tracks.length + 1}`);
  if (!name) return;
  animStore.addTrack(anim.value.id, name);
}

function addKeyframeToTrack(trackId: string) {
  if (!spriteStore.selectedFrame) {
    alert('请先在精灵编辑页或左侧资源中选中一个帧作为素材');
    return;
  }
  animStore.addKeyframe(trackId, spriteStore.selectedFrame.id, Math.round(1000 / (anim.value?.frameRate || 24)));
  buildThumbDataUrl(spriteStore.selectedFrame.id);
}

function selectKeyframe(trackId: string, kfId: string) {
  animStore.selectedTrackId = trackId;
  animStore.selectKeyframe(kfId);
}

function onTrackDrop(e: DragEvent, trackId: string, toIndex: number) {
  e.preventDefault();
  const fid = e.dataTransfer?.getData('frame-id');
  if (fid) {
    animStore.insertKeyframe(trackId, toIndex, fid, Math.round(1000 / (anim.value?.frameRate || 24)));
    buildThumbDataUrl(fid);
    return;
  }
  const info = e.dataTransfer?.getData('kf');
  if (info) {
    try {
      const { trackId: fT, from } = JSON.parse(info);
      if (fT === trackId) animStore.moveKeyframe(trackId, from, toIndex);
    } catch { /* noop */ }
  }
}

function onDragStart(e: DragEvent, trackId: string, index: number) {
  e.dataTransfer?.setData('kf', JSON.stringify({ trackId, from: index }));
  dragInfo.value = { trackId, from: index, to: index };
}

function onDragEnd() { dragInfo.value = null; }

function getTrackAccumulated(
  kfs: { durationMs: number }[], index: number
): { start: number; width: number } {
  let start = 0;
  for (let i = 0; i < index; i++) start += kfs[i].durationMs;
  return { start, width: kfs[index].durationMs };
}

function onTimelineClick(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  animStore.playbackTime = ratio * animStore.totalDuration;
}

const pxPerMs = 0.15;

onUnmounted(() => { sheetImgCache.clear(); thumbDataUrls.clear(); });
</script>

<template>
  <div class="timeline-wrap panel">
    <div class="timeline-header">
      <div class="header-left">
        <span style="font-weight: 600; color: var(--color-text-secondary);">⏱ 时间轴</span>
      </div>
      <div class="header-right">
        <button @click="addTrack">＋ 轨道</button>
      </div>
    </div>
    <div class="tracks-scroll">
      <div v-if="!anim" class="empty-tl">请先创建或选择动画</div>
      <template v-else>
        <div class="time-ruler" @click="onTimelineClick">
          <div class="ruler-bg">
            <div v-for="i in Math.ceil(animStore.totalDuration / 1000)" :key="i"
              class="ruler-tick" :style="{ left: (i-1)*1000*pxPerMs + 'px' }">
              {{ i-1 }}s
            </div>
          </div>
          <div class="playhead"
            :style="{ left: (animStore.playbackTime * pxPerMs) + 'px' }"></div>
        </div>
        <div class="tracks-container">
          <div v-for="t in sortedTracks" :key="t.id" class="track-row">
            <div class="track-label">
              <span class="track-name" :class="{active: animStore.selectedTrackId === t.id}"
                @click="animStore.selectTrack(t.id)">{{ t.name }}</span>
              <button class="add-kf" title="添加关键帧(使用选中精灵)"
                @click="addKeyframeToTrack(t.id)">＋</button>
            </div>
            <div class="track-content"
              @dragover.prevent
              @drop="(e: DragEvent) => onTrackDrop(e, t.id, t.keyframes.length)">
              <div v-if="t.keyframes.length === 0"
                class="kf-empty-zone"
                @drop="(e: DragEvent) => onTrackDrop(e, t.id, 0)"
                @dragover.prevent>
                <span>拖拽帧至此添加</span>
              </div>
              <template v-for="(k, i) in t.keyframes" :key="k.id">
                <div
                  class="kf-item"
                  :class="{ selected: animStore.selectedKeyframeId === k.id, hasEvent: k.eventType !== 'none' }"
                  :style="{
                    width: (k.durationMs * pxPerMs - 2) + 'px',
                    left: (getTrackAccumulated(t.keyframes, i).start * pxPerMs) + 'px'
                  }"
                  draggable="true"
                  @dragstart="(e: DragEvent) => onDragStart(e, t.id, i)"
                  @dragend="onDragEnd"
                  @click.stop="selectKeyframe(t.id, k.id)"
                  @drop="(e: DragEvent) => { e.stopPropagation(); onTrackDrop(e, t.id, i); }"
                  @dragover.prevent>
                  <div class="thumb-wrap">
                    <img v-if="getThumb(k.frameId)"
                      class="thumb-img"
                      :src="getThumb(k.frameId)"
                      :alt="k.frameId"
                      draggable="false" />
                    <div v-else class="thumb-placeholder">▢</div>
                  </div>
                  <div class="kf-meta">{{ (k.durationMs/1000).toFixed(2) }}s</div>
                  <div v-if="k.eventType !== 'none'" class="event-mark"
                    :title="`事件: ${k.eventType}${k.audioClipId ? ' +音效' : ''}`">
                    {{ k.eventType === 'audio' ? '🔊' : k.eventType === 'callback' ? '⚙' : '★' }}
                  </div>
                </div>
                <div v-if="i < t.keyframes.length - 1" class="kf-gap"
                  @drop="(e: DragEvent) => onTrackDrop(e, t.id, i + 1)"
                  @dragover.prevent></div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.timeline-wrap {
  display: flex; flex-direction: column;
  height: 100%; min-height: 0;
  overflow: hidden;
}
.timeline-header {
  padding: 8px 12px;
  display: flex; align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.tracks-scroll {
  flex: 1; overflow-x: auto; overflow-y: auto;
  min-height: 0;
}
.time-ruler {
  height: 28px; position: relative;
  background: linear-gradient(180deg, rgba(0,212,255,0.04) 0%, transparent 100%);
  border-bottom: 1px solid var(--color-border);
  min-width: 100%;
  cursor: pointer;
}
.ruler-bg { position: absolute; inset: 0; overflow: hidden; }
.ruler-tick {
  position: absolute; top: 0; bottom: 0;
  border-left: 1px solid rgba(255,255,255,0.1);
  padding: 4px 0 0 6px;
  font-size: 10px; color: var(--color-text-muted);
  width: 150px;
}
.playhead {
  position: absolute; top: 0; bottom: -100%;
  width: 2px; background: #ff4d4f;
  box-shadow: 0 0 8px rgba(255,77,79,0.6);
  z-index: 10; pointer-events: none;
}
.playhead::before {
  content: ''; position: absolute; top: -3px; left: -4px;
  width: 10px; height: 10px;
  background: #ff4d4f; border-radius: 50%;
  transform: rotate(45deg);
}
.tracks-container {
  min-width: 100%;
}
.track-row {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  min-height: 80px;
}
.track-label {
  flex: 0 0 140px;
  padding: 8px 10px;
  background: var(--color-bg-panel-hover);
  border-right: 1px solid var(--color-border);
  display: flex; flex-direction: column;
  gap: 6px; align-items: stretch;
  position: sticky; left: 0; z-index: 2;
}
.track-name {
  font-size: 12px; cursor: pointer;
  padding: 4px 6px; border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.track-name:hover { background: var(--color-bg-input); }
.track-name.active {
  background: rgba(0, 212, 255, 0.12);
  color: var(--color-text-secondary);
}
.add-kf {
  padding: 3px; font-size: 11px; line-height: 1;
}
.track-content {
  flex: 1; position: relative;
  padding: 4px; min-height: 80px;
}
.kf-empty-zone {
  position: absolute; inset: 4px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-muted);
  font-size: 11px; font-style: italic;
  transition: all var(--transition-fast);
}
.kf-empty-zone:hover {
  border-color: var(--color-text-secondary);
  color: var(--color-text-secondary);
}
.kf-item {
  position: absolute; top: 4px; bottom: 4px;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex; flex-direction: column;
  align-items: center; justify-content: space-between;
  padding: 3px; cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}
.kf-item:hover {
  border-color: var(--color-text-secondary);
  transform: translateY(-1px);
}
.kf-item.selected {
  border-color: var(--color-text-primary);
  box-shadow: 0 0 10px var(--shadow-glow-orange);
  background: rgba(255, 107, 53, 0.08);
}
.kf-item.hasEvent::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0;
  height: 2px; background: var(--color-text-warning);
}
.thumb-wrap {
  width: 100%; flex: 1; max-height: 42px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  background: rgba(0,0,0,0.2);
  border-radius: 2px;
}
.thumb-img {
  width: auto; height: 100%; max-width: 100%;
  image-rendering: pixelated;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
.thumb-placeholder {
  color: var(--color-text-muted);
  font-size: 16px;
  opacity: 0.5;
}
.kf-meta {
  font-size: 9px; color: var(--color-text-muted);
  margin-top: 2px;
}
.event-mark {
  position: absolute; top: 4px; right: 4px;
  font-size: 10px;
  text-shadow: 0 0 4px rgba(0,0,0,0.8);
}
.kf-gap {
  position: absolute; top: 4px; bottom: 4px;
  width: 1px;
}
.empty-tl {
  padding: 40px; text-align: center;
  color: var(--color-text-muted);
  font-size: 12px;
}
</style>
