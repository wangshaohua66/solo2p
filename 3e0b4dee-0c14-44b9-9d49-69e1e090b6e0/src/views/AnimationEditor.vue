<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAnimationStore } from '@/stores/animation';
import { useSpriteStore } from '@/stores/sprite';
import { useProjectStore } from '@/stores/project';
import AnimationPlayer from '@/components/canvas/AnimationPlayer.vue';
import Timeline from '@/components/common/Timeline.vue';

const animStore = useAnimationStore();
const spriteStore = useSpriteStore();
const projectStore = useProjectStore();
const playerRef = ref<InstanceType<typeof AnimationPlayer> | null>(null);
const showNewModal = ref(false);
const newAnimName = ref('');
const newAnimRate = ref(24);

const allFrames = computed(() => {
  const list: { id: string; name: string; sheetName: string; w: number; h: number }[] = [];
  for (const ss of projectStore.spriteSheets) {
    for (const f of ss.frames) {
      list.push({ id: f.id, name: f.name, sheetName: ss.name, w: f.width, h: f.height });
    }
  }
  return list;
});

function createAnim() {
  if (!newAnimName.value.trim()) return;
  const a = animStore.createAnimation(newAnimName.value.trim());
  if (a) {
    a.frameRate = newAnimRate.value;
    projectStore.persistCurrent();
  }
  newAnimName.value = '';
  newAnimRate.value = 24;
  showNewModal.value = false;
}

function selectFrameAndUse(id: string) {
  spriteStore.selectFrame(id);
  const ss = projectStore.spriteSheets.find(s => s.frames.some(f => f.id === id));
  if (ss) spriteStore.selectSheet(ss.id);
}
</script>

<template>
  <div class="anim-page">
    <div class="page-toolbar">
      <div class="tool-group">
        <button class="btn-primary" @click="showNewModal = true">＋ 新建动画</button>
        <select class="anim-select"
          :value="animStore.selectedAnimId || ''"
          @change="animStore.selectAnim(($event.target as HTMLSelectElement).value || null)">
          <option value="">选择动画...</option>
          <option v-for="a in projectStore.animations" :key="a.id" :value="a.id">
            🎬 {{ a.name }} ({{ a.tracks.reduce((s, t) => s + t.keyframes.length, 0) }}帧)
          </option>
        </select>
      </div>
      <div class="spacer"></div>
      <div class="tool-group">
        <span class="frame-hint">选中精灵后点「＋」键添加关键帧</span>
      </div>
    </div>

    <div class="main-body">
      <div class="left-col">
        <div class="panel frames-library" style="height: 100%; display: flex; flex-direction: column;">
          <div class="panel-header">🖼 帧素材库 ({{ allFrames.length }})</div>
          <div class="lib-body">
            <div v-if="allFrames.length === 0" class="empty-lib">
              <div class="big">🖼️</div>
              <p>先到精灵编辑页切割精灵帧</p>
            </div>
            <div v-else class="frames-grid">
              <div v-for="f in allFrames" :key="f.id"
                class="frame-item"
                :class="{ active: spriteStore.selectedFrameId === f.id }"
                @click="selectFrameAndUse(f.id)"
                draggable="true"
                @dragstart="(e: DragEvent) => e.dataTransfer?.setData('frame-id', f.id)">
                <div class="f-thumb checkerboard">
                  <div class="f-icon">🖼</div>
                </div>
                <div class="f-info">
                  <div class="f-name">{{ f.name }}</div>
                  <div class="f-meta">{{ f.w }}×{{ f.h }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="center-col">
        <div class="preview-box">
          <AnimationPlayer ref="playerRef" />
        </div>
        <div class="timeline-box">
          <Timeline />
        </div>
      </div>
    </div>

    <div v-if="showNewModal" class="modal-mask" @click.self="showNewModal = false">
      <div class="modal panel small">
        <div class="modal-header">
          <h3>🎬 新建动画序列</h3>
          <button class="close" @click="showNewModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row big">
            <label>动画名称 *</label>
            <input v-model="newAnimName" placeholder="如 player_run / attack" maxlength="40" @keyup.enter="createAnim" />
          </div>
          <div class="form-row big">
            <label>目标帧率</label>
            <input type="number" min="1" max="120" v-model.number="newAnimRate" />
          </div>
          <p class="hint-sm">默认创建身体、武器、特效3个轨道，可在属性面板调节</p>
        </div>
        <div class="modal-footer">
          <button @click="showNewModal = false">取消</button>
          <button class="btn-primary" @click="createAnim" :disabled="!newAnimName.trim()">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.anim-page {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  min-height: 0;
  background: var(--color-bg-canvas);
}
.page-toolbar {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 12px;
  padding: 8px 14px;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
}
.tool-group { display: flex; gap: 8px; align-items: center; }
.spacer { flex: 1; }
.anim-select {
  min-width: 240px; padding: 6px 10px;
  font-size: 12px;
}
.frame-hint { font-size: 11px; color: var(--color-text-muted); }

.main-body {
  flex: 1; min-height: 0;
  display: flex;
  padding: 10px;
  gap: 10px;
}
.left-col {
  flex: 0 0 240px;
  display: flex; flex-direction: column;
  min-height: 0;
}
.frames-library .panel-header { font-size: 12px; }
.lib-body {
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
.frames-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 8px;
}
.frame-item {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.frame-item:hover {
  border-color: var(--color-text-secondary);
  transform: translateY(-1px);
}
.frame-item.active {
  border-color: var(--color-text-primary);
  box-shadow: 0 0 8px var(--shadow-glow-orange);
}
.f-thumb {
  height: 60px;
  display: flex; align-items: center; justify-content: center;
  border-bottom: 1px solid var(--color-border);
}
.f-icon { font-size: 20px; }
.f-info { padding: 6px 6px 8px; }
.f-name {
  font-size: 10px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.f-meta { font-size: 9px; color: var(--color-text-muted); margin-top: 2px; }

.center-col {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.preview-box {
  flex: 0 0 300px;
  min-height: 0;
}
.timeline-box {
  flex: 1; min-height: 0;
}

.modal-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.modal {
  width: 440px; max-width: 92vw;
  display: flex; flex-direction: column;
  max-height: 86vh; overflow: hidden;
}
.modal.small { width: 420px; }
.modal-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border);
  display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 {
  font-size: 15px; font-weight: 700;
  color: var(--color-primary);
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
.hint-sm {
  font-size: 11px; color: var(--color-text-muted); font-style: italic;
}
</style>
