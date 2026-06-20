<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSpriteStore } from '@/stores/sprite';
import { useAnimationStore } from '@/stores/animation';
import { useTilemapStore } from '@/stores/tilemap';
import { useAudioStore } from '@/stores/audio';
import { useProjectStore } from '@/stores/project';
import { useRoute } from 'vue-router';

const route = useRoute();
const spriteStore = useSpriteStore();
const animStore = useAnimationStore();
const mapStore = useTilemapStore();
const audioStore = useAudioStore();
const projectStore = useProjectStore();

const sheet = computed(() => spriteStore.selectedSheet);
const frame = computed(() => spriteStore.selectedFrame);
const anim = computed(() => animStore.selectedAnim);
const kf = computed(() => animStore.selectedKeyframe);
const map = computed(() => mapStore.selectedMap);
const layer = computed(() => mapStore.selectedLayer);
const zone = computed(() => {
  if (!map.value || !mapStore.selectedZoneId) return null;
  return map.value.triggerZones.find(z => z.id === mapStore.selectedZoneId) || null;
});
const clip = computed(() => audioStore.selectedClip);

const animRename = ref('');
const mapRename = ref('');
const sheetRename = ref('');
const clipRename = ref('');
const frameRename = ref('');
const batchPrefix = ref('frame');

watch(() => anim.value?.name, v => animRename.value = v ?? '');
watch(() => map.value?.name, v => mapRename.value = v ?? '');
watch(() => sheet.value?.name, v => sheetRename.value = v ?? '');
watch(() => clip.value?.name, v => clipRename.value = v ?? '');
watch(() => frame.value?.name, v => frameRename.value = v ?? '');

function renameSheet() {
  if (!sheet.value || !sheetRename.value.trim()) return;
  sheet.value.name = sheetRename.value.trim();
  projectStore.persistCurrent();
}
function renameFrame() {
  if (!frame.value || !frameRename.value.trim()) return;
  spriteStore.updateFrame(frame.value.id, { name: frameRename.value.trim() });
}
function doBatchRename() {
  if (!sheet.value || !batchPrefix.value.trim()) return;
  spriteStore.renameFrames(sheet.value.id, batchPrefix.value.trim());
}
function renameAnim() {
  if (!anim.value || !animRename.value.trim()) return;
  animStore.updateAnim(anim.value.id, { name: animRename.value.trim() });
}
function renameMap() {
  if (!map.value || !mapRename.value.trim()) return;
  mapStore.updateMap(map.value.id, { name: mapRename.value.trim() });
}
function renameClip() {
  if (!clip.value || !clipRename.value.trim()) return;
  audioStore.updateClip(clip.value.id, { name: clipRename.value.trim() });
}

function updateFramePatch<K extends keyof typeof frame.value>(key: K, val: typeof frame.value[K]) {
  if (!frame.value) return;
  spriteStore.updateFrame(frame.value.id, { [key]: val } as any);
}
function updateFrameAnchor(key: 'x' | 'y', val: number) {
  if (!frame.value) return;
  spriteStore.updateFrame(frame.value.id, { anchor: { ...frame.value.anchor, [key]: val } });
}
function updateFrameHitbox(key: 'x' | 'y' | 'w' | 'h', val: number) {
  if (!frame.value) return;
  spriteStore.updateFrame(frame.value.id, { hitbox: { ...frame.value.hitbox, [key]: val } });
}
function updateFrameTrigger(key: 'x' | 'y' | 'w' | 'h', val: number) {
  if (!frame.value) return;
  if (!frame.value.triggerArea) {
    spriteStore.updateFrame(frame.value.id, {
      triggerArea: { x: 0, y: 0, w: frame.value.width, h: frame.value.height }
    });
    return;
  }
  spriteStore.updateFrame(frame.value.id, {
    triggerArea: { ...frame.value.triggerArea, [key]: val }
  });
}
function clearTrigger() {
  if (!frame.value) return;
  spriteStore.updateFrame(frame.value.id, { triggerArea: null });
}

const audioOptions = computed(() => [
  { id: '', label: '无' },
  ...projectStore.audioClips.map(a => ({ id: a.id, label: a.name }))
]);

function referencesForFrame() {
  if (!frame.value) return [];
  return projectStore.getReferencesOfFrame(frame.value.id);
}
function referencesForAudio() {
  if (!clip.value) return [];
  return projectStore.getReferencesOfAudio(clip.value.id);
}
</script>

<template>
  <div class="prop-panel">
    <div class="panel-header">⚙ 属性检查器</div>
    <div class="panel-body">
      <template v-if="route.name === 'sprite-editor'">
        <div v-if="sheet" class="section-group">
          <div class="section-group-title">精灵表信息</div>
          <div class="form-row">
            <label>名称</label>
            <input v-model="sheetRename" @blur="renameSheet" />
          </div>
          <div class="form-row">
            <label>尺寸</label>
            <input :value="`${sheet.width} × ${sheet.height}`" disabled />
          </div>
          <div class="form-row">
            <label>切割模式</label>
            <select :value="sheet.cutMode"
              @change="spriteStore.setCutMode(sheet.id, ($event.target as HTMLSelectElement).value as any)">
              <option value="grid">等分网格</option>
              <option value="contour">轮廓检测</option>
            </select>
          </div>
          <template v-if="sheet.cutMode === 'grid'">
            <div class="form-row">
              <label>列数</label>
              <input type="number" :value="sheet.gridConfig.cols" min="1" max="64"
                @change="spriteStore.updateGridConfig(sheet.id, Number(($event.target as HTMLInputElement).value), sheet.gridConfig.rows, sheet.gridConfig.padding)" />
            </div>
            <div class="form-row">
              <label>行数</label>
              <input type="number" :value="sheet.gridConfig.rows" min="1" max="64"
                @change="spriteStore.updateGridConfig(sheet.id, sheet.gridConfig.cols, Number(($event.target as HTMLInputElement).value), sheet.gridConfig.padding)" />
            </div>
            <div class="form-row">
              <label>边距</label>
              <input type="number" :value="sheet.gridConfig.padding" min="0" max="64"
                @change="spriteStore.updateGridConfig(sheet.id, sheet.gridConfig.cols, sheet.gridConfig.rows, Number(($event.target as HTMLInputElement).value))" />
            </div>
          </template>
          <template v-else>
            <div class="form-row">
              <label>阈值</label>
              <input type="range" min="1" max="255" :value="sheet.contourThreshold"
                @input="spriteStore.updateContourThreshold(sheet.id, Number(($event.target as HTMLInputElement).value))" />
              <span class="inline-val">{{ sheet.contourThreshold }}</span>
            </div>
          </template>
          <div class="form-row">
            <label>批量改名</label>
            <input v-model="batchPrefix" placeholder="前缀..." />
            <button @click="doBatchRename" class="btn-secondary">应用</button>
          </div>
          <button class="btn-danger full" @click="spriteStore.deleteSheet(sheet.id)">🗑 删除精灵表</button>
        </div>

        <div v-if="frame" class="section-group">
          <div class="section-group-title">帧属性 #{{ frame.name }}</div>
          <div class="form-row">
            <label>帧名</label>
            <input v-model="frameRename" @blur="renameFrame" />
          </div>
          <div class="form-row"><label>X</label><input type="number" :value="frame.x" disabled /></div>
          <div class="form-row"><label>Y</label><input type="number" :value="frame.y" disabled /></div>
          <div class="form-row"><label>宽</label><input type="number" :value="frame.width" disabled /></div>
          <div class="form-row"><label>高</label><input type="number" :value="frame.height" disabled /></div>

          <div class="section-group-title" style="margin-top: 12px;">编辑模式</div>
          <div class="mode-tabs">
            <button :class="{active: spriteStore.editMode === 'cut'}" @click="spriteStore.editMode = 'cut'">选择</button>
            <button :class="{active: spriteStore.editMode === 'anchor'}" @click="spriteStore.editMode = 'anchor'">锚点</button>
            <button :class="{active: spriteStore.editMode === 'hitbox'}" @click="spriteStore.editMode = 'hitbox'">碰撞</button>
            <button :class="{active: spriteStore.editMode === 'trigger'}" @click="spriteStore.editMode = 'trigger'">触发</button>
          </div>

          <template v-if="spriteStore.editMode === 'anchor'">
            <div class="form-row"><label>锚X</label>
              <input type="number" :value="frame.anchor.x" @change="updateFrameAnchor('x', Number(($event.target as HTMLInputElement).value))" />
            </div>
            <div class="form-row"><label>锚Y</label>
              <input type="number" :value="frame.anchor.y" @change="updateFrameAnchor('y', Number(($event.target as HTMLInputElement).value))" />
            </div>
          </template>
          <template v-if="spriteStore.editMode === 'hitbox'">
            <div class="form-row"><label>X</label><input type="number" :value="frame.hitbox.x" @change="updateFrameHitbox('x', Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="form-row"><label>Y</label><input type="number" :value="frame.hitbox.y" @change="updateFrameHitbox('y', Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="form-row"><label>W</label><input type="number" :value="frame.hitbox.w" @change="updateFrameHitbox('w', Number(($event.target as HTMLInputElement).value))" /></div>
            <div class="form-row"><label>H</label><input type="number" :value="frame.hitbox.h" @change="updateFrameHitbox('h', Number(($event.target as HTMLInputElement).value))" /></div>
          </template>
          <template v-if="spriteStore.editMode === 'trigger'">
            <div v-if="!frame.triggerArea" class="form-row">
              <label></label>
              <button @click="updateFrameTrigger('x', 0)" class="btn-secondary">＋ 创建触发区</button>
            </div>
            <template v-else>
              <div class="form-row"><label>X</label><input type="number" :value="frame.triggerArea.x" @change="updateFrameTrigger('x', Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="form-row"><label>Y</label><input type="number" :value="frame.triggerArea.y" @change="updateFrameTrigger('y', Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="form-row"><label>W</label><input type="number" :value="frame.triggerArea.w" @change="updateFrameTrigger('w', Number(($event.target as HTMLInputElement).value))" /></div>
              <div class="form-row"><label>H</label><input type="number" :value="frame.triggerArea.h" @change="updateFrameTrigger('h', Number(($event.target as HTMLInputElement).value))" /></div>
              <button class="btn-danger full" @click="clearTrigger">清除触发区</button>
            </template>
          </template>

          <div class="section-group-title" style="margin-top: 12px;">🔗 引用关系</div>
          <div v-if="referencesForFrame().length === 0" class="hint">该帧暂无被引用</div>
          <div v-else class="ref-list">
            <div v-for="r in referencesForFrame()" :key="r.id" class="ref-item">
              <span class="ref-type">{{ r.type === 'animation' ? '🎬动画' : '🗺️地图' }}</span>
              <span class="ref-name">{{ r.name }}</span>
            </div>
          </div>
        </div>

        <div v-if="!sheet" class="hint-center">选择左侧精灵表开始编辑</div>
      </template>

      <template v-else-if="route.name === 'animation-editor'">
        <div v-if="anim" class="section-group">
          <div class="section-group-title">动画属性</div>
          <div class="form-row"><label>名称</label><input v-model="animRename" @blur="renameAnim" /></div>
          <div class="form-row"><label>帧率</label>
            <input type="number" min="1" max="120" :value="anim.frameRate"
              @change="animStore.updateAnim(anim.id, { frameRate: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row"><label>循环</label>
            <input type="checkbox" :checked="anim.loop"
              @change="animStore.updateAnim(anim.id, { loop: ($event.target as HTMLInputElement).checked })" style="width: auto;" />
          </div>
          <button class="btn-danger full" @click="animStore.deleteAnim(anim.id)">🗑 删除动画</button>
        </div>
        <div v-if="kf" class="section-group">
          <div class="section-group-title">关键帧属性</div>
          <div class="form-row"><label>时长ms</label>
            <input type="number" min="16" step="16" :value="kf.durationMs"
              @change="animStore.updateKeyframe(kf.id, { durationMs: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row"><label>偏移X</label>
            <input type="number" :value="kf.offsetX"
              @change="animStore.updateKeyframe(kf.id, { offsetX: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row"><label>偏移Y</label>
            <input type="number" :value="kf.offsetY"
              @change="animStore.updateKeyframe(kf.id, { offsetY: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row"><label>旋转°</label>
            <input type="number" step="1" :value="kf.rotation"
              @change="animStore.updateKeyframe(kf.id, { rotation: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row"><label>事件</label>
            <select :value="kf.eventType"
              @change="animStore.updateKeyframe(kf.id, { eventType: ($event.target as HTMLSelectElement).value as any })">
              <option value="none">无</option>
              <option value="audio">触发音效</option>
              <option value="callback">引擎回调</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div v-if="kf.eventType === 'audio'" class="form-row">
            <label>音效</label>
            <select :value="kf.audioClipId || ''"
              @change="animStore.updateKeyframe(kf.id, { audioClipId: ($event.target as HTMLSelectElement).value || null })">
              <option v-for="o in audioOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </div>
          <div v-if="kf.eventType !== 'none'" class="form-row">
            <label>数值</label>
            <input :value="kf.eventValue" placeholder="事件值..."
              @change="animStore.updateKeyframe(kf.id, { eventValue: ($event.target as HTMLInputElement).value })" />
          </div>
          <button class="btn-danger full"
            @click="animStore.removeKeyframe(kf.trackId, kf.id)">✕ 删除该关键帧</button>
        </div>
        <div v-if="!anim" class="hint-center">选择或创建动画开始编排</div>
      </template>

      <template v-else-if="route.name === 'tilemap-editor'">
        <div v-if="map" class="section-group">
          <div class="section-group-title">地图属性</div>
          <div class="form-row"><label>名称</label><input v-model="mapRename" @blur="renameMap" /></div>
          <div class="form-row"><label>列数</label><input type="number" :value="map.cols" disabled /></div>
          <div class="form-row"><label>行数</label><input type="number" :value="map.rows" disabled /></div>
          <div class="form-row"><label>瓦片宽</label>
            <input type="number" :value="map.tileWidth"
              @change="mapStore.updateMap(map.id, { tileWidth: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row"><label>瓦片高</label>
            <input type="number" :value="map.tileHeight"
              @change="mapStore.updateMap(map.id, { tileHeight: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="section-group-title" style="margin-top: 10px;">图层列表</div>
          <div v-for="(l, i) in [...map.layers].sort((a,b)=>a.zIndex-b.zIndex)" :key="l.id" class="layer-row">
            <button class="layer-vis" :class="{off: !l.visible}"
              @click="mapStore.updateLayer(l.id, { visible: !l.visible })">
              {{ l.visible ? '👁' : '🚫' }}
            </button>
            <input class="layer-name" :value="l.name"
              @change="mapStore.updateLayer(l.id, { name: ($event.target as HTMLInputElement).value })" />
            <button :disabled="i === 0" @click="mapStore.moveLayer(map.id, l.id, 'up')" title="上移">↑</button>
            <button :disabled="i === map.layers.length - 1" @click="mapStore.moveLayer(map.id, l.id, 'down')" title="下移">↓</button>
          </div>
          <button class="btn-danger full" @click="mapStore.deleteMap(map.id)">🗑 删除地图</button>
        </div>
        <div v-if="layer" class="section-group">
          <div class="section-group-title">当前图层: {{ layer.name }}</div>
          <button class="full" @click="mapStore.clearLayer(layer.id)">🧹 清空图层</button>
        </div>
        <div v-if="zone" class="section-group">
          <div class="section-group-title">触发/碰撞区域</div>
          <div class="form-row"><label>类型</label>
            <select :value="zone.type"
              @change="mapStore.updateZone(zone.id, { type: ($event.target as HTMLSelectElement).value as any })">
              <option value="collision">碰撞</option>
              <option value="trigger">触发</option>
            </select>
          </div>
          <div class="form-row"><label>X</label><input type="number" :value="zone.x" @change="mapStore.updateZone(zone.id, { x: Number(($event.target as HTMLInputElement).value) })" /></div>
          <div class="form-row"><label>Y</label><input type="number" :value="zone.y" @change="mapStore.updateZone(zone.id, { y: Number(($event.target as HTMLInputElement).value) })" /></div>
          <div class="form-row"><label>W</label><input type="number" :value="zone.w" @change="mapStore.updateZone(zone.id, { w: Number(($event.target as HTMLInputElement).value) })" /></div>
          <div class="form-row"><label>H</label><input type="number" :value="zone.h" @change="mapStore.updateZone(zone.id, { h: Number(($event.target as HTMLInputElement).value) })" /></div>
          <div class="form-row"><label>音效</label>
            <select :value="zone.audioClipId || ''"
              @change="mapStore.updateZone(zone.id, { audioClipId: ($event.target as HTMLSelectElement).value || null })">
              <option v-for="o in audioOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </div>
          <button class="btn-danger full" @click="mapStore.deleteZone(zone.id)">✕ 删除区域</button>
        </div>
        <div v-if="!map" class="hint-center">创建或选择地图开始编辑</div>
      </template>

      <template v-else-if="route.name === 'audio-manager'">
        <div v-if="clip" class="section-group">
          <div class="section-group-title">音效属性</div>
          <div class="form-row"><label>名称</label><input v-model="clipRename" @blur="renameClip" /></div>
          <div class="form-row"><label>格式</label><input :value="clip.type || '未知'" disabled /></div>
          <div class="form-row"><label>时长</label><input :value="clip.duration.toFixed(2) + 's'" disabled /></div>
          <div class="form-row"><label>音量</label>
            <input type="range" min="0" max="1" step="0.05" :value="clip.volume"
              @input="audioStore.updateClip(clip.id, { volume: Number(($event.target as HTMLInputElement).value) })" />
            <span class="inline-val">{{ (clip.volume*100).toFixed(0) }}%</span>
          </div>
          <div class="form-row"><label>淡入s</label>
            <input type="number" min="0" step="0.01" :value="clip.fadeIn"
              @change="audioStore.updateClip(clip.id, { fadeIn: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row"><label>淡出s</label>
            <input type="number" min="0" step="0.01" :value="clip.fadeOut"
              @change="audioStore.updateClip(clip.id, { fadeOut: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row"><label>循环</label>
            <input type="checkbox" :checked="clip.loop"
              @change="audioStore.updateClip(clip.id, { loop: ($event.target as HTMLInputElement).checked })" style="width: auto;" />
          </div>
          <div class="form-row"><label>起始s</label>
            <input type="number" min="0" step="0.01" :value="clip.startTime"
              @change="audioStore.updateClip(clip.id, { startTime: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row"><label>结束s</label>
            <input type="number" min="0" step="0.01" :value="clip.endTime"
              @change="audioStore.updateClip(clip.id, { endTime: Number(($event.target as HTMLInputElement).value) })" />
          </div>
          <div class="form-row" style="margin-top: 8px;">
            <button class="btn-primary" @click="audioStore.playClip(clip.id)">▶ 试听</button>
            <button @click="audioStore.stopPlay()">⏹ 停止</button>
          </div>
          <div class="section-group-title" style="margin-top: 12px;">🔗 引用关系</div>
          <div v-if="referencesForAudio().length === 0" class="hint">该音效暂无被引用</div>
          <div v-else class="ref-list">
            <div v-for="r in referencesForAudio()" :key="r.id" class="ref-item">
              <span class="ref-type">{{ r.type === 'animation' ? '🎬动画' : '🗺️地图' }}</span>
              <span class="ref-name">{{ r.name }}</span>
            </div>
          </div>
          <button class="btn-danger full" style="margin-top: 12px;"
            @click="audioStore.deleteClip(clip.id)">🗑 删除音效</button>
        </div>
        <div v-if="!clip" class="hint-center">选择左侧音效或上传新音效</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.prop-panel {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  min-height: 0;
}
.panel-body {
  flex: 1; overflow-y: auto; padding: 12px;
}
.hint-center {
  padding: 40px 16px; text-align: center;
  color: var(--color-text-muted);
  font-size: 12px;
}
.hint {
  font-size: 11px; color: var(--color-text-muted);
  padding: 6px 4px; font-style: italic;
}
.full { width: 100%; }
.inline-val {
  min-width: 40px; text-align: right;
  font-size: 11px; color: var(--color-text-secondary);
}
.btn-danger {
  background: rgba(255, 77, 79, 0.1);
  border-color: var(--color-text-error);
  color: var(--color-text-error);
  margin-top: 8px;
}
.btn-danger:hover {
  box-shadow: 0 0 10px rgba(255, 77, 79, 0.3);
}
.mode-tabs {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px;
  margin-bottom: 12px;
}
.mode-tabs button {
  padding: 6px 4px; font-size: 11px;
}
.mode-tabs button.active {
  background: rgba(255, 107, 53, 0.15);
  border-color: var(--color-text-primary);
  color: var(--color-text-primary);
}
.ref-list {
  display: flex; flex-direction: column; gap: 4px;
  max-height: 160px; overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.ref-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
  font-size: 11px;
}
.ref-item:last-child { border-bottom: none; }
.ref-type {
  font-size: 12px;
  padding: 2px 4px;
  background: var(--color-bg-input);
  border-radius: var(--radius-sm);
}
.ref-name { flex: 1; }

.layer-row {
  display: flex; align-items: center; gap: 4px;
  margin-bottom: 4px;
}
.layer-vis {
  padding: 4px 6px; font-size: 11px;
}
.layer-vis.off { opacity: 0.5; }
.layer-name {
  flex: 1; font-size: 11px;
  padding: 4px 6px;
}
.layer-row button:not(.layer-vis) {
  padding: 4px 8px; font-size: 11px;
}
</style>
