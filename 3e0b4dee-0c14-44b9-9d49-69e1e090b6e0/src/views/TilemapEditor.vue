<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTilemapStore } from '@/stores/tilemap';
import { useProjectStore } from '@/stores/project';
import { useAnimationStore } from '@/stores/animation';
import TilemapEditor from '@/components/canvas/TilemapEditor.vue';

const mapStore = useTilemapStore();
const projectStore = useProjectStore();
const animStore = useAnimationStore();
const mapRef = ref<InstanceType<typeof TilemapEditor> | null>(null);
const showNewModal = ref(false);
const newMapName = ref('');
const newCols = ref(64);
const newRows = ref(64);
const newTileW = ref(32);
const newTileH = ref(32);
const zoneType = ref<'collision' | 'trigger'>('collision');

const tiles = computed(() => mapStore.availableTileFrames);
const selectedTileInfo = computed(() =>
  tiles.value.find(t => t.id === mapStore.selectedTileFrameId) || null
);

const maps = computed(() => projectStore.tilemaps);

function createMap() {
  if (!newMapName.value.trim()) return;
  mapStore.createMap(newMapName.value.trim(), newCols.value, newRows.value, newTileW.value, newTileH.value);
  showNewModal.value = false;
  newMapName.value = '';
  newCols.value = 64; newRows.value = 64;
  newTileW.value = 32; newTileH.value = 32;
}

function selectTile(id: string) {
  mapStore.selectedTileFrameId = id;
  const ss = projectStore.spriteSheets.find(s => s.id === (tiles.value.find(t => t.id === id)?.sheetId));
  if (ss) {
    // noop
  }
}

function addZoneHere() {
  if (!mapStore.selectedMap) { alert('请先选择地图'); return; }
  const tm = mapStore.selectedMap;
  const zw = Math.max(tm.tileWidth * 3, 64);
  const zh = Math.max(tm.tileHeight * 3, 64);
  const z = mapStore.addZone(tm.id, zoneType.value, tm.cols * tm.tileWidth / 2 - zw / 2, tm.rows * tm.tileHeight / 2 - zh / 2, zw, zh);
  if (z) { mapStore.selectedZoneId = z.id; alert(`已添加${zoneType.value === 'collision' ? '碰撞' : '触发'}区域，在右侧属性面板编辑`); }
}
</script>

<template>
  <div class="map-page">
    <div class="page-toolbar">
      <div class="tool-group">
        <button class="btn-primary" @click="showNewModal = true">＋ 新建地图</button>
        <select class="map-select"
          :value="mapStore.selectedMapId || ''"
          @change="mapStore.selectMap(($event.target as HTMLSelectElement).value || null)">
          <option value="">选择地图...</option>
          <option v-for="m in maps" :key="m.id" :value="m.id">
            🗺 {{ m.name }} ({{ m.cols }}×{{ m.rows }})
          </option>
        </select>
      </div>
      <div class="spacer"></div>
      <div class="tool-group">
        <div class="zone-tools">
          <select v-model="zoneType" class="zone-select">
            <option value="collision">碰撞区域</option>
            <option value="trigger">触发区域</option>
          </select>
          <button @click="addZoneHere" :disabled="!mapStore.selectedMap">
            ➕ 添加{{ zoneType === 'collision' ? '碰撞' : '触发' }}区
          </button>
        </div>
      </div>
    </div>

    <div class="main-body">
      <div class="left-palette">
        <div class="panel tiles-panel" style="height: 100%; display: flex; flex-direction: column;">
          <div class="panel-header">🧩 瓦片素材 ({{ tiles.length }})</div>
          <div v-if="selectedTileInfo" class="selected-info">
            <div class="sel-name">{{ selectedTileInfo.name }}</div>
            <div class="sel-meta">{{ selectedTileInfo.w }}×{{ selectedTileInfo.h }} · {{ selectedTileInfo.sheetName }}</div>
          </div>
          <div class="tiles-body">
            <div v-if="tiles.length === 0" class="empty-lib">
              <div class="big">🧩</div>
              <p>先到精灵编辑页切割精灵图</p>
            </div>
            <div v-else class="tiles-grid">
              <div v-for="t in tiles" :key="t.id"
                class="tile-item checkerboard"
                :class="{ active: mapStore.selectedTileFrameId === t.id }"
                :title="`${t.name} (${t.w}×${t.h})`"
                @click="selectTile(t.id)">
                <span class="tile-icon">🧱</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="center-col">
        <TilemapEditor ref="mapRef" />
      </div>
    </div>

    <div v-if="showNewModal" class="modal-mask" @click.self="showNewModal = false">
      <div class="modal panel">
        <div class="modal-header">
          <h3>🗺 新建瓦片地图</h3>
          <button class="close" @click="showNewModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row big">
            <label>地图名称 *</label>
            <input v-model="newMapName" placeholder="如 level_01 / boss_room" maxlength="40" @keyup.enter="createMap" />
          </div>
          <div class="grid-2">
            <div class="form-row big">
              <label>列数 (最大256)</label>
              <input type="number" min="1" max="256" v-model.number="newCols" />
            </div>
            <div class="form-row big">
              <label>行数 (最大256)</label>
              <input type="number" min="1" max="256" v-model.number="newRows" />
            </div>
            <div class="form-row big">
              <label>瓦片宽度 px</label>
              <input type="number" min="4" max="256" v-model.number="newTileW" />
            </div>
            <div class="form-row big">
              <label>瓦片高度 px</label>
              <input type="number" min="4" max="256" v-model.number="newTileH" />
            </div>
          </div>
          <p class="hint-sm">默认创建8个图层，可在右侧属性面板切换显示</p>
        </div>
        <div class="modal-footer">
          <button @click="showNewModal = false">取消</button>
          <button class="btn-primary" @click="createMap" :disabled="!newMapName.trim()">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-page {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  min-height: 0; background: var(--color-bg-canvas);
}
.page-toolbar {
  flex: 0 0 auto; display: flex; align-items: center;
  gap: 12px; padding: 8px 14px;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
}
.tool-group { display: flex; gap: 8px; align-items: center; }
.spacer { flex: 1; }
.map-select { min-width: 240px; padding: 6px 10px; font-size: 12px; }
.zone-tools { display: flex; gap: 6px; }
.zone-select { padding: 6px 10px; font-size: 12px; }

.main-body {
  flex: 1; min-height: 0;
  display: flex; padding: 10px;
  gap: 10px;
}
.left-palette {
  flex: 0 0 220px;
  display: flex; flex-direction: column;
  min-height: 0;
}
.tiles-panel .panel-header { font-size: 12px; }
.selected-info {
  padding: 8px 12px;
  background: rgba(255, 107, 53, 0.08);
  border-bottom: 1px solid var(--color-border);
  border-left: 3px solid var(--color-text-primary);
}
.sel-name { font-size: 12px; font-weight: 700; color: var(--color-text-primary); }
.sel-meta { font-size: 10px; color: var(--color-text-muted); margin-top: 3px; }

.tiles-body {
  flex: 1; overflow-y: auto;
  padding: 10px;
  min-height: 0;
}
.empty-lib {
  height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px; color: var(--color-text-muted);
}
.empty-lib .big { font-size: 48px; opacity: 0.5; }
.tiles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 6px;
}
.tile-item {
  aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  overflow: hidden;
}
.tile-item:hover {
  border-color: var(--color-text-secondary);
  transform: scale(1.05);
}
.tile-item.active {
  border-color: var(--color-text-primary);
  box-shadow: 0 0 8px var(--shadow-glow-orange);
}
.tile-icon { font-size: 18px; }

.center-col {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  min-height: 0;
}

.modal-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.modal {
  width: 480px; max-width: 92vw;
  display: flex; flex-direction: column;
  max-height: 86vh; overflow: hidden;
}
.modal-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border);
  display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 {
  font-size: 15px; font-weight: 700; color: var(--color-primary);
}
.close { background: none; border: none; font-size: 16px; padding: 4px 8px; }
.modal-body { padding: 18px; overflow-y: auto; }
.modal-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--color-border);
  display: flex; justify-content: flex-end; gap: 10px;
}
.form-row.big { margin-bottom: 14px; }
.form-row.big > label {
  display: block; margin-bottom: 6px;
  font-size: 12px; font-weight: 600; color: var(--color-text-muted);
}
.form-row.big > input {
  width: 100%; font-size: 13px; padding: 7px 12px;
}
.grid-2 {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.hint-sm { font-size: 11px; color: var(--color-text-muted); font-style: italic; }
</style>
