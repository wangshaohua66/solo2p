<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useProjectStore, type ResourceType } from '@/stores/project';
import { useSpriteStore } from '@/stores/sprite';
import { useAnimationStore } from '@/stores/animation';
import { useTilemapStore } from '@/stores/tilemap';
import { useAudioStore } from '@/stores/audio';

const projectStore = useProjectStore();
const spriteStore = useSpriteStore();
const animStore = useAnimationStore();
const mapStore = useTilemapStore();
const audioStore = useAudioStore();

const props = defineProps<{
  mode?: 'all' | 'sprites' | 'frames';
  selectable?: ResourceType[];
  showGroups?: boolean;
  expanded?: boolean;
}>();

const emit = defineEmits<{
  selectSprite: [id: string];
  selectFrame: [sheetId: string, frameId: string];
  selectAnimation: [id: string];
  selectTilemap: [id: string];
  selectAudio: [id: string];
}>();

const filterSprites = computed(() => props.mode === 'all' || props.mode === 'sprites' || props.mode === 'frames');
const spriteGroups = ref<Map<string, string>>(new Map());
const audioGroups = ref<Map<string, string>>(new Map());
const tilemapGroups = ref<Map<string, string>>(new Map());
const animGroups = ref<Map<string, string>>(new Map());

const open = ref<Record<string, boolean>>({
  sprites: true,
  animations: true,
  tilemaps: true,
  audio: true
});

function toggle(key: string) {
  open.value[key] = !open.value[key];
}

function getGroup(map: Map<string, string>, id: string): string {
  return map.get(id) || '未分组';
}

function groupItems<T extends { id: string; name: string }>(items: T[], groups: Map<string, string>): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const it of items) {
    const g = getGroup(groups, it.id);
    if (!result[g]) result[g] = [];
    result[g].push(it);
  }
  return result;
}

const groupedAnimations = computed(() => groupItems(projectStore.animations, animGroups.value));
const groupedTilemaps = computed(() => groupItems(projectStore.tilemaps, tilemapGroups.value));
const groupedAudio = computed(() => groupItems(projectStore.audioClips, audioGroups.value));

const search = ref('');
function matches(s: string) {
  if (!search.value) return true;
  return s.toLowerCase().includes(search.value.toLowerCase());
}

const draggedData = ref<{ type: ResourceType; id: string; fromGroup?: string } | null>(null);

function onDragStart(e: DragEvent, type: ResourceType, id: string, fromGroup?: string) {
  draggedData.value = { type, id, fromGroup };
  if (e.dataTransfer) {
    e.dataTransfer.setData('application/x-pixelforge-resource',
      JSON.stringify({ type, id, fromGroup }));
    e.dataTransfer.effectAllowed = 'move';
  }
}
function onDragEnd() {
  draggedData.value = null;
}
function onDragOver(e: DragEvent) {
  if (draggedData.value) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }
}
function onDropToGroup(e: DragEvent, type: ResourceType, group: string) {
  e.preventDefault();
  if (!draggedData.value || draggedData.value.type !== type) return;
  if (draggedData.value.fromGroup === group) return;
  let map = animGroups.value;
  if (type === 'audioclip') map = audioGroups.value;
  else if (type === 'tilemap') map = tilemapGroups.value;
  else if (type === 'animation') map = animGroups.value;
  else if (type === 'spritesheet') map = spriteGroups.value;
  map.set(draggedData.value.id, group);
  if (type === 'spritesheet') spriteGroups.value = new Map(map);
  else if (type === 'audioclip') audioGroups.value = new Map(map);
  else if (type === 'tilemap') tilemapGroups.value = new Map(map);
  else animGroups.value = new Map(map);
}
function onDropToProject(e: DragEvent, targetProjectId: string) {
  e.preventDefault();
  if (!draggedData.value) return;
  const cur = projectStore.currentProject?.id;
  if (cur === targetProjectId) return;
  const ok = projectStore.copyResourceToProject(
    draggedData.value.type, draggedData.value.id, targetProjectId);
  if (ok) console.log(`已复制${draggedData.value.type}到${targetProjectId}: ${ok}`);
}

function canSelect(type: ResourceType): boolean {
  if (!props.selectable) return true;
  return props.selectable.includes(type);
}

function openAllGroups(grouped: Record<string, any[]>) {
  return Object.keys(grouped).reduce((acc, k) => { acc[k] = true; return acc; }, {} as Record<string, boolean>);
}
const animOpen = ref<Record<string, boolean>>({});
const tileOpen = ref<Record<string, boolean>>({});
const audioOpen = ref<Record<string, boolean>>({});
const spriteOpen = ref<Record<string, boolean>>({});

watch(groupedAnimations, g => Object.keys(g).forEach(k => { if (!(k in animOpen.value)) animOpen.value[k] = true; }), { immediate: true });
watch(groupedTilemaps, g => Object.keys(g).forEach(k => { if (!(k in tileOpen.value)) tileOpen.value[k] = true; }), { immediate: true });
watch(groupedAudio, g => Object.keys(g).forEach(k => { if (!(k in audioOpen.value)) audioOpen.value[k] = true; }), { immediate: true });

const copyMenuOpen = ref<{ x: number; y: number; type: ResourceType; id: string } | null>(null);

function openCopyMenu(e: MouseEvent, type: ResourceType, id: string) {
  if (projectStore.projects.length < 2) return;
  e.preventDefault();
  e.stopPropagation();
  copyMenuOpen.value = { x: e.clientX, y: e.clientY, type, id };
  setTimeout(() => {
    const handler = () => { copyMenuOpen.value = null; document.removeEventListener('click', handler); };
    document.addEventListener('click', handler);
  }, 0);
}
</script>

<template>
  <div class="resource-tree">
    <div v-if="mode === 'all'" class="search-wrap">
      <input v-model="search" type="text" placeholder="搜索资源..." class="search-input" />
    </div>

    <div v-if="filterSprites && open.sprites" class="tree-section">
      <div class="section-head" @click="toggle('sprites')">
        <span class="caret">{{ open.sprites ? '▾' : '▸' }}</span>
        <span class="icon">🖼️</span>
        <span class="label">精灵</span>
        <span class="count">{{ projectStore.spriteSheets.length }}</span>
      </div>
      <div class="section-body">
        <div v-for="ss in projectStore.spriteSheets.filter(s => matches(s.name))" :key="ss.id"
          class="tree-item"
          :class="{ active: spriteStore.selectedSheetId === ss.id }"
          draggable="true"
          @dragstart="onDragStart($event, 'spritesheet', ss.id)"
          @dragend="onDragEnd"
          @click="canSelect('spritesheet') && emit('selectSprite', ss.id)"
          @contextmenu="openCopyMenu($event, 'spritesheet', ss.id)">
          <span class="item-icon">📄</span>
          <span class="item-label">{{ ss.name }}</span>
          <span class="item-count">{{ ss.frames.length }}帧</span>
        </div>
      </div>
    </div>

    <div v-if="mode === 'all' || mode === 'frames'" class="frames-sub">
      <div v-if="spriteStore.selectedSheet && (mode === 'frames' || (mode === 'all' && open.sprites))" class="frames-wrap">
        <div
          v-for="f in spriteStore.selectedSheet.frames.filter(fr => matches(fr.name))"
          :key="f.id"
          class="frame-item"
          :class="{ active: spriteStore.selectedFrame?.id === f.id }"
          @click="emit('selectFrame', spriteStore.selectedSheet!.id, f.id)">
          <div class="frame-thumb"><span>▢</span></div>
          <div class="frame-name">{{ f.name }}</div>
          <div class="frame-size">{{ f.width }}×{{ f.height }}</div>
        </div>
      </div>
    </div>

    <div v-if="mode === 'all'" class="tree-section">
      <div class="section-head" @click="toggle('animations')">
        <span class="caret">{{ open.animations ? '▾' : '▸' }}</span>
        <span class="icon">🎬</span>
        <span class="label">动画</span>
        <span class="count">{{ projectStore.animations.length }}</span>
      </div>
      <div v-if="open.animations" class="section-body group-drop" @dragover="onDragOver" @drop="onDropToGroup($event, 'animation', '未分组')">
        <div v-for="(items, group) in groupedAnimations" :key="group" class="group-block">
          <div class="group-head drop-target" @dragover="onDragOver" @drop="onDropToGroup($event, 'animation', group)">
            <span class="caret">{{ animOpen[group] ? '▾' : '▸' }}</span>
            <span class="gicon">📁</span>
            <span class="glabel">{{ group }}</span>
            <span class="gcount">{{ items.length }}</span>
          </div>
          <div v-if="animOpen[group]" class="group-body">
            <div
              v-for="a in items.filter(x => matches(x.name))"
              :key="a.id"
              class="tree-item"
              :class="{ active: animStore.selectedAnim?.id === a.id }"
              draggable="true"
              @dragstart="onDragStart($event, 'animation', a.id, group)"
              @dragend="onDragEnd"
              @click="canSelect('animation') && emit('selectAnimation', a.id)"
              @contextmenu="openCopyMenu($event, 'animation', a.id)">
              <span class="item-icon">🎞️</span>
              <span class="item-label">{{ a.name }}</span>
              <span class="item-count">{{ a.tracks.reduce((s,t)=>s+t.keyframes.length,0) }}帧</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="mode === 'all'" class="tree-section">
      <div class="section-head" @click="toggle('tilemaps')">
        <span class="caret">{{ open.tilemaps ? '▾' : '▸' }}</span>
        <span class="icon">🗺️</span>
        <span class="label">地图</span>
        <span class="count">{{ projectStore.tilemaps.length }}</span>
      </div>
      <div v-if="open.tilemaps" class="section-body group-drop" @dragover="onDragOver" @drop="onDropToGroup($event, 'tilemap', '未分组')">
        <div v-for="(items, group) in groupedTilemaps" :key="group" class="group-block">
          <div class="group-head drop-target" @dragover="onDragOver" @drop="onDropToGroup($event, 'tilemap', group)">
            <span class="caret">{{ tileOpen[group] ? '▾' : '▸' }}</span>
            <span class="gicon">📁</span>
            <span class="glabel">{{ group }}</span>
            <span class="gcount">{{ items.length }}</span>
          </div>
          <div v-if="tileOpen[group]" class="group-body">
            <div
              v-for="tm in items.filter(x => matches(x.name))"
              :key="tm.id"
              class="tree-item"
              :class="{ active: mapStore.selectedMapId === tm.id }"
              draggable="true"
              @dragstart="onDragStart($event, 'tilemap', tm.id, group)"
              @dragend="onDragEnd"
              @click="canSelect('tilemap') && emit('selectTilemap', tm.id)"
              @contextmenu="openCopyMenu($event, 'tilemap', tm.id)">
              <span class="item-icon">🧭</span>
              <span class="item-label">{{ tm.name }}</span>
              <span class="item-count">{{ tm.cols }}×{{ tm.rows }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="mode === 'all'" class="tree-section">
      <div class="section-head" @click="toggle('audio')">
        <span class="caret">{{ open.audio ? '▾' : '▸' }}</span>
        <span class="icon">🔊</span>
        <span class="label">音效</span>
        <span class="count">{{ projectStore.audioClips.length }}</span>
      </div>
      <div v-if="open.audio" class="section-body group-drop" @dragover="onDragOver" @drop="onDropToGroup($event, 'audioclip', '未分组')">
        <div v-for="(items, group) in groupedAudio" :key="group" class="group-block">
          <div class="group-head drop-target" @dragover="onDragOver" @drop="onDropToGroup($event, 'audioclip', group)">
            <span class="caret">{{ audioOpen[group] ? '▾' : '▸' }}</span>
            <span class="gicon">📁</span>
            <span class="glabel">{{ group }}</span>
            <span class="gcount">{{ items.length }}</span>
          </div>
          <div v-if="audioOpen[group]" class="group-body">
            <div
              v-for="ac in items.filter(x => matches(x.name))"
              :key="ac.id"
              class="tree-item"
              :class="{ active: audioStore.selectedClipId === ac.id }"
              draggable="true"
              @dragstart="onDragStart($event, 'audioclip', ac.id, group)"
              @dragend="onDragEnd"
              @click="canSelect('audioclip') && emit('selectAudio', ac.id)"
              @contextmenu="openCopyMenu($event, 'audioclip', ac.id)">
              <span class="item-icon">♪</span>
              <span class="item-label">{{ ac.name }}</span>
              <span class="item-count">{{ (ac.duration||0).toFixed(1) }}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="projectStore.projects.length > 1 && mode === 'all'" class="cross-proj">
      <div class="section-head"><span class="icon">📦</span><span class="label">其他项目（可拖入复制）</span></div>
      <div class="section-body">
        <div v-for="p in projectStore.projects.filter(p => p.id !== projectStore.currentProject?.id)"
          :key="p.id" class="tree-item project-drop"
          @dragover="onDragOver" @drop="onDropToProject($event, p.id)">
          <span class="item-icon">🗂️</span>
          <span class="item-label">{{ p.name }}</span>
          <span class="item-count">{{ p.spriteSheetIds?.length || 0 }}资</span>
        </div>
      </div>
    </div>

    <div v-if="copyMenuOpen" class="context-menu"
      :style="{ left: copyMenuOpen.x + 'px', top: copyMenuOpen.y + 'px' }">
      <div class="ctx-title">复制到项目</div>
      <div v-for="p in projectStore.projects.filter(p => p.id !== projectStore.currentProject?.id)"
        :key="p.id" class="ctx-item"
        @click.stop="projectStore.copyResourceToProject(copyMenuOpen!.type, copyMenuOpen!.id, p.id); copyMenuOpen = null">
        📦 {{ p.name }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-tree {
  display: flex; flex-direction: column; gap: 4px; overflow-y: auto;
  padding: 8px; user-select: none;
}
.search-wrap { padding: 4px 0 8px; }
.search-input {
  width: 100%; padding: 6px 10px; font-size: 12px;
  background: var(--color-bg-input); color: var(--color-text-secondary);
  border: 1px solid var(--color-border); border-radius: 3px;
}
.search-input:focus { border-color: var(--color-text-primary); outline: none; }
.tree-section { display: flex; flex-direction: column; gap: 2px; }
.section-head {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px;
  cursor: pointer; color: var(--color-text-secondary);
  font-size: 12px; font-weight: 600; border-radius: 3px;
}
.section-head:hover { background: rgba(255,107,53,0.08); color: var(--color-text-primary); }
.caret { width: 10px; font-size: 9px; color: var(--color-text-muted); }
.section-head .icon { font-size: 14px; }
.section-head .label { flex: 1; }
.section-head .count { color: var(--color-text-muted); font-size: 10px; }
.section-body { display: flex; flex-direction: column; gap: 1px; padding-left: 4px; }
.group-drop { border-top: 1px dashed rgba(255,107,53,0.15); padding-top: 4px; }
.group-block { margin-bottom: 4px; }
.group-head {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px 4px 16px;
  font-size: 11px; color: var(--color-text-muted);
  border-radius: 3px; cursor: pointer;
}
.group-head:hover { background: rgba(0,212,255,0.06); color: var(--color-accent); }
.drop-target { transition: background 0.15s; }
.drop-target.drag-over { background: rgba(255,107,53,0.2); }
.group-head .gicon { font-size: 12px; }
.group-head .glabel { flex: 1; }
.group-head .gcount { font-size: 9px; opacity: 0.7; }
.group-body { display: flex; flex-direction: column; gap: 1px; }
.tree-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px 5px 20px;
  font-size: 12px; color: var(--color-text-secondary);
  border-radius: 3px; cursor: pointer;
  transition: background 0.1s;
}
.tree-item:hover { background: rgba(255,255,255,0.04); color: var(--color-text-primary); }
.tree-item.active {
  background: linear-gradient(90deg, rgba(255,107,53,0.18) 0%, rgba(255,107,53,0) 100%);
  color: var(--color-text-primary);
  border-left: 2px solid var(--color-text-primary);
}
.tree-item[draggable="true"] { cursor: grab; }
.tree-item[draggable="true"]:active { cursor: grabbing; }
.item-icon { font-size: 13px; width: 16px; text-align: center; }
.item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-count { font-size: 10px; color: var(--color-text-muted); font-family: 'JetBrains Mono', monospace; }
.project-drop { border: 1px dashed rgba(0,212,255,0.3); margin-top: 2px; }
.project-drop:hover { border-color: var(--color-accent); background: rgba(0,212,255,0.06); }
.frames-sub { margin-top: 4px; }
.frames-wrap {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 6px; padding: 4px;
  max-height: 240px; overflow-y: auto;
}
.frame-item {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px; border-radius: 3px; cursor: pointer;
  border: 1px solid transparent;
}
.frame-item:hover { background: rgba(255,255,255,0.04); border-color: var(--color-border); }
.frame-item.active {
  background: rgba(255,107,53,0.12);
  border-color: var(--color-text-primary);
}
.frame-thumb {
  width: 48px; height: 48px;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: 2px; margin-bottom: 4px;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-muted); font-size: 18px;
  image-rendering: pixelated;
}
.frame-name {
  font-size: 10px; color: var(--color-text-secondary);
  max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.frame-size {
  font-size: 9px; color: var(--color-text-muted);
  font-family: 'JetBrains Mono', monospace;
}
.cross-proj { margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--color-border); }
.context-menu {
  position: fixed; z-index: 9999;
  min-width: 160px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  overflow: hidden;
}
.ctx-title {
  padding: 8px 12px; font-size: 11px; color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.ctx-item {
  padding: 8px 12px; font-size: 12px; color: var(--color-text-secondary);
  cursor: pointer;
}
.ctx-item:hover { background: rgba(255,107,53,0.12); color: var(--color-text-primary); }
</style>
