<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import { useSpriteStore } from '@/stores/sprite';
import { useAnimationStore } from '@/stores/animation';
import { useTilemapStore } from '@/stores/tilemap';
import { useAudioStore } from '@/stores/audio';

const projectStore = useProjectStore();
const spriteStore = useSpriteStore();
const animStore = useAnimationStore();
const mapStore = useTilemapStore();
const audioStore = useAudioStore();
const route = useRoute();
const router = useRouter();

const expanded = ref<Set<string>>(new Set(['sprites', 'animations', 'tilemaps', 'audio']));
const search = ref('');

function toggleGroup(k: string) {
  if (expanded.value.has(k)) expanded.value.delete(k);
  else expanded.value.add(k);
}

const filteredSheets = computed(() => {
  if (!search.value) return projectStore.spriteSheets;
  return projectStore.spriteSheets.filter(s =>
    s.name.toLowerCase().includes(search.value.toLowerCase())
  );
});
const filteredAnims = computed(() => {
  if (!search.value) return projectStore.animations;
  return projectStore.animations.filter(a =>
    a.name.toLowerCase().includes(search.value.toLowerCase())
  );
});
const filteredMaps = computed(() => {
  if (!search.value) return projectStore.tilemaps;
  return projectStore.tilemaps.filter(t =>
    t.name.toLowerCase().includes(search.value.toLowerCase())
  );
});
const filteredAudio = computed(() => {
  if (!search.value) return projectStore.audioClips;
  return projectStore.audioClips.filter(a =>
    a.name.toLowerCase().includes(search.value.toLowerCase())
  );
});

const pid = computed(() => route.params.projectId as string);

function goto(pathSuffix: string) {
  router.push(`/projects/${pid.value}/${pathSuffix}`);
}

function openSpriteSheet(id: string) {
  spriteStore.selectSheet(id);
  goto('sprites');
}

function openAnim(id: string) {
  animStore.selectAnim(id);
  goto('animations');
}

function openMap(id: string) {
  mapStore.selectMap(id);
  goto('tilemaps');
}

function openAudio(id: string) {
  audioStore.selectedClipId = id;
  goto('audio');
}

function onSpriteDrop(e: DragEvent) {
  e.preventDefault();
  const files = e.dataTransfer?.files;
  if (!files) return;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.type.startsWith('image/')) spriteStore.addSpriteSheet(f);
  }
}

function onAudioDrop(e: DragEvent) {
  e.preventDefault();
  const files = e.dataTransfer?.files;
  if (!files) return;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.type.startsWith('audio/')) audioStore.addAudio(f);
  }
}

function isAudioUsed(id: string) {
  return projectStore.getReferencesOfAudio(id).length > 0;
}
function isFrameUsed(id: string) {
  return projectStore.getReferencesOfFrame(id).length > 0;
}

watch([() => projectStore.spriteSheets.length, () => projectStore.animations.length,
  () => projectStore.tilemaps.length, () => projectStore.audioClips.length], () => {
  expanded.value.add('sprites');
  expanded.value.add('animations');
  expanded.value.add('tilemaps');
  expanded.value.add('audio');
});
</script>

<template>
  <div class="resource-tree">
    <div class="tree-header">
      <div class="panel-header">📂 资源索引</div>
      <div class="search-wrap">
        <input v-model="search" class="tree-search" placeholder="🔍 搜索资源..." />
      </div>
      <div class="stats-row">
        <div class="stat"><span class="stat-val">{{ projectStore.stats.sprites }}</span>帧</div>
        <div class="stat"><span class="stat-val">{{ projectStore.stats.animations }}</span>动画</div>
        <div class="stat"><span class="stat-val">{{ projectStore.stats.tilemaps }}</span>地图</div>
        <div class="stat"><span class="stat-val">{{ projectStore.stats.audio }}</span>音效</div>
      </div>
    </div>
    <div class="tree-body">
      <div class="group">
        <div class="group-header" @click="toggleGroup('sprites')">
          <span class="expand-arrow">{{ expanded.has('sprites') ? '▼' : '▶' }}</span>
          <span class="group-icon">🖼️</span>
          <span class="group-name">精灵表</span>
          <span class="badge">{{ projectStore.spriteSheets.length }}</span>
        </div>
        <div v-show="expanded.has('sprites')" class="group-body drop-zone"
          @dragover.prevent @drop="onSpriteDrop">
          <div v-if="filteredSheets.length === 0" class="empty-drop">
            拖拽PNG图片到此处
          </div>
          <div v-for="ss in filteredSheets" :key="ss.id"
            class="item sprite-item"
            :class="{ active: spriteStore.selectedSheetId === ss.id }"
            @click="openSpriteSheet(ss.id)">
            <span class="item-icon">📋</span>
            <span class="item-name" :title="ss.name">{{ ss.name }}</span>
            <span class="frame-count">{{ ss.frames.length }}帧</span>
          </div>
        </div>
      </div>

      <div class="group">
        <div class="group-header" @click="toggleGroup('animations')">
          <span class="expand-arrow">{{ expanded.has('animations') ? '▼' : '▶' }}</span>
          <span class="group-icon">🎬</span>
          <span class="group-name">动画序列</span>
          <span class="badge">{{ projectStore.animations.length }}</span>
        </div>
        <div v-show="expanded.has('animations')" class="group-body">
          <div v-if="filteredAnims.length === 0" class="empty-hint">暂无动画</div>
          <div v-for="a in filteredAnims" :key="a.id"
            class="item anim-item"
            :class="{ active: animStore.selectedAnimId === a.id }"
            @click="openAnim(a.id)">
            <span class="item-icon">⏯</span>
            <span class="item-name" :title="a.name">{{ a.name }}</span>
            <span v-if="a.loop" class="loop-flag">🔁</span>
          </div>
        </div>
      </div>

      <div class="group">
        <div class="group-header" @click="toggleGroup('tilemaps')">
          <span class="expand-arrow">{{ expanded.has('tilemaps') ? '▼' : '▶' }}</span>
          <span class="group-icon">🗺️</span>
          <span class="group-name">瓦片地图</span>
          <span class="badge">{{ projectStore.tilemaps.length }}</span>
        </div>
        <div v-show="expanded.has('tilemaps')" class="group-body">
          <div v-if="filteredMaps.length === 0" class="empty-hint">暂无地图</div>
          <div v-for="tm in filteredMaps" :key="tm.id"
            class="item map-item"
            :class="{ active: mapStore.selectedMapId === tm.id }"
            @click="openMap(tm.id)">
            <span class="item-icon">🧩</span>
            <span class="item-name" :title="tm.name">{{ tm.name }}</span>
            <span class="dim">{{ tm.cols }}×{{ tm.rows }}</span>
          </div>
        </div>
      </div>

      <div class="group">
        <div class="group-header" @click="toggleGroup('audio')">
          <span class="expand-arrow">{{ expanded.has('audio') ? '▼' : '▶' }}</span>
          <span class="group-icon">🔊</span>
          <span class="group-name">音效资源</span>
          <span class="badge">{{ projectStore.audioClips.length }}</span>
        </div>
        <div v-show="expanded.has('audio')" class="group-body drop-zone"
          @dragover.prevent @drop="onAudioDrop">
          <div v-if="filteredAudio.length === 0" class="empty-drop">
            拖拽音频文件到此处
          </div>
          <div v-for="a in filteredAudio" :key="a.id"
            class="item audio-item"
            :class="{ active: audioStore.selectedClipId === a.id }"
            @click="openAudio(a.id)">
            <span class="item-icon">🎵</span>
            <span class="item-name" :title="a.name">{{ a.name }}</span>
            <span v-if="isAudioUsed(a.id)" class="used-dot" title="已被引用"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-tree {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  min-height: 0;
}
.tree-header {
  padding: 0; border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.search-wrap { padding: 8px 10px; }
.tree-search {
  width: 100%; font-size: 12px;
}
.stats-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 4px; padding: 6px 10px 10px;
  border-bottom: 1px solid var(--color-border);
}
.stat {
  display: flex; flex-direction: column; align-items: center;
  font-size: 10px; color: var(--color-text-muted);
  padding: 4px 2px;
  background: var(--color-bg-input);
  border-radius: var(--radius-sm);
}
.stat-val {
  font-size: 14px; font-weight: 700;
  color: var(--color-text-primary);
}

.tree-body {
  flex: 1; overflow-y: auto; padding: 6px 0;
}
.group { margin-bottom: 4px; }
.group-header {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 10px; cursor: pointer;
  font-size: 12px; font-weight: 600;
  color: var(--color-text-main);
  transition: background var(--transition-fast);
  user-select: none;
}
.group-header:hover { background: var(--color-bg-panel-hover); }
.expand-arrow {
  font-size: 9px; color: var(--color-text-muted);
  width: 12px;
}
.group-icon { font-size: 13px; }
.group-name { flex: 1; }

.group-body {
  padding: 4px 0 8px 20px;
}
.drop-zone {
  border: 1px dashed transparent;
  margin: 0 8px 4px 28px;
  padding: 8px 4px;
  transition: all var(--transition-fast);
  border-radius: var(--radius-sm);
}
.drop-zone:hover {
  border-color: var(--color-text-secondary);
  background: rgba(0, 212, 255, 0.04);
}
.empty-hint, .empty-drop {
  font-size: 11px; color: var(--color-text-muted);
  padding: 8px 6px; font-style: italic;
  text-align: center;
}
.item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; margin: 1px 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  position: relative;
  transition: all var(--transition-fast);
}
.item:hover { background: var(--color-bg-panel-hover); }
.item.active {
  background: rgba(255, 107, 53, 0.12);
  border-left: 2px solid var(--color-text-primary);
  padding-left: 8px;
}
.item-icon { font-size: 13px; flex-shrink: 0; }
.item-name {
  flex: 1; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.frame-count, .dim {
  font-size: 10px; color: var(--color-text-muted);
  flex-shrink: 0;
}
.loop-flag { font-size: 10px; }
.used-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--color-text-success);
  box-shadow: 0 0 6px var(--color-text-success);
  flex-shrink: 0;
}
</style>
