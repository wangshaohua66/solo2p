<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSpriteStore } from '@/stores/sprite';
import { useAnimationStore } from '@/stores/animation';
import SpriteCanvas from '@/components/canvas/SpriteCanvas.vue';

const spriteStore = useSpriteStore();
const animStore = useAnimationStore();
const canvasComp = ref<InstanceType<typeof SpriteCanvas> | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

function triggerUpload() { fileInput.value?.click(); }

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files) return;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.type.startsWith('image/')) await spriteStore.addSpriteSheet(f);
    else alert(`不支持的文件类型: ${f.name}`);
  }
  input.value = '';
}

function addFrameToAnimation() {
  if (!spriteStore.selectedFrame) {
    alert('请先选择一个帧');
    return;
  }
  if (!animStore.selectedAnim) {
    alert('请先到动画编排页创建或选择动画');
    return;
  }
  const track = animStore.selectedAnim.tracks[0];
  if (!track) { alert('该动画暂无轨道'); return; }
  const kf = animStore.addKeyframe(track.id, spriteStore.selectedFrame.id);
  if (kf) alert(`已添加到动画「${animStore.selectedAnim.name}」-「${track.name}」`);
}
</script>

<template>
  <div class="sprite-page">
    <div class="page-toolbar">
      <div class="tool-group">
        <button class="btn-primary" @click="triggerUpload">⬆ 上传精灵表</button>
        <input ref="fileInput" type="file" accept="image/png,image/webp,image/gif" multiple style="display: none;" @change="onFile" />
        <button @click="canvasComp?.fitToScreen()" title="适配屏幕">⛶ 适配</button>
        <button @click="canvasComp?.zoomIn()">＋ 放大</button>
        <button @click="canvasComp?.zoomOut()">－ 缩小</button>
      </div>
      <div class="spacer"></div>
      <div class="tool-group">
        <button class="btn-secondary" @click="addFrameToAnimation" :disabled="!spriteStore.selectedFrame">🎬 加到当前动画</button>
        <button :disabled="!spriteStore.selectedSheet" title="拖拽帧到动画页面可快捷添加">
          💡 提示: 选中帧后可添加到动画
        </button>
      </div>
    </div>
    <div class="canvas-container">
      <SpriteCanvas ref="canvasComp" />
    </div>
    <div class="frames-strip">
      <div class="strip-header">
        <span>📋 帧列表 <b>{{ spriteStore.selectedSheet?.frames.length || 0 }}</b> 帧</span>
        <span class="hint">按住Shift拖拽画布平移 · 滚轮缩放</span>
      </div>
      <div class="frames-scroll">
        <div v-if="!spriteStore.selectedSheet" class="empty-frames">选择精灵表查看帧</div>
        <div v-else-if="spriteStore.selectedSheet.frames.length === 0" class="empty-frames">该精灵表暂无切割帧</div>
        <div v-else
          v-for="f in spriteStore.selectedSheet.frames" :key="f.id"
          class="frame-chip"
          :class="{ active: spriteStore.selectedFrameId === f.id }"
          @click="spriteStore.selectFrame(f.id)"
          draggable="true"
          @dragstart="(e: DragEvent) => e.dataTransfer?.setData('frame-id', f.id)">
          <div class="chip-name">{{ f.name }}</div>
          <div class="chip-size">{{ f.width }}×{{ f.height }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sprite-page {
  display: flex; flex-direction: column;
  width: 100%; height: 100%;
  min-height: 0; min-width: 0;
  background: var(--color-bg-canvas);
}
.page-toolbar {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 12px;
  padding: 8px 14px;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
}
.tool-group { display: flex; gap: 6px; align-items: center; }
.spacer { flex: 1; }

.canvas-container {
  flex: 1; min-height: 0; overflow: hidden;
  padding: 12px;
}

.frames-strip {
  flex: 0 0 auto;
  background: var(--color-bg-panel);
  border-top: 1px solid var(--color-border);
  max-height: 180px;
  display: flex; flex-direction: column;
}
.strip-header {
  display: flex; justify-content: space-between;
  align-items: center;
  padding: 6px 14px;
  border-bottom: 1px solid var(--color-border);
  font-size: 12px; color: var(--color-text-muted);
}
.strip-header b {
  color: var(--color-text-primary);
  font-weight: 700;
}
.hint { font-size: 10px; font-style: italic; }

.frames-scroll {
  flex: 1; overflow-x: auto; overflow-y: hidden;
  padding: 10px 12px;
  display: flex; gap: 8px;
}
.empty-frames {
  padding: 20px; color: var(--color-text-muted);
  font-size: 12px; font-style: italic;
}
.frame-chip {
  flex: 0 0 auto;
  width: 110px;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 6px;
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}
.frame-chip:hover {
  border-color: var(--color-text-secondary);
  transform: translateY(-2px);
}
.frame-chip.active {
  border-color: var(--color-text-primary);
  box-shadow: 0 0 10px var(--shadow-glow-orange);
  background: rgba(255, 107, 53, 0.08);
}
.chip-name {
  font-size: 11px; font-weight: 600;
  margin-bottom: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chip-size {
  font-size: 9px; color: var(--color-text-muted);
}
</style>
