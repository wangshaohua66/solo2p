<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import { formatDate } from '@/utils/id';

defineProps<{ page: string; }>();
const emit = defineEmits<{ (e: 'toggle-left'): void; (e: 'toggle-right'): void; }>();

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();
const showProjectDropdown = ref(false);
const snapModalOpen = ref(false);
const newSnapName = ref('');

const pageButtons = [
  { name: 'sprite-editor', label: '精灵', icon: '🖼️', pathSuffix: 'sprites' },
  { name: 'animation-editor', label: '动画', icon: '🎬', pathSuffix: 'animations' },
  { name: 'tilemap-editor', label: '地图', icon: '🗺️', pathSuffix: 'tilemaps' },
  { name: 'audio-manager', label: '音效', icon: '🔊', pathSuffix: 'audio' }
];

const activePage = computed(() => route.name as string);
const sortedProjects = computed(() =>
  [...projectStore.projects].sort((a, b) => b.updatedAt - a.updatedAt)
);

function navigatePage(suffix: string) {
  const pid = route.params.projectId;
  router.push(`/projects/${pid}/${suffix}`);
}

function selectProject(id: string) {
  projectStore.openProject(id);
  router.push(`/projects/${id}/sprites`);
  showProjectDropdown.value = false;
}

function goHome() { router.push('/projects'); }

function doExport() {
  if (!projectStore.currentProject) {
    alert('请先打开项目');
    return;
  }
  projectStore.exportConfig();
}

function openSnap() {
  snapModalOpen.value = true;
  newSnapName.value = `快照 ${formatDate(Date.now())}`;
}

function createSnap() {
  if (!newSnapName.value.trim()) return;
  projectStore.saveSnapshot(newSnapName.value.trim());
  newSnapName.value = '';
}

function deleteSnap(id: string) {
  if (confirm('确定删除该快照？')) projectStore.deleteSnapshot(id);
}

function restoreSnap(id: string) {
  if (confirm('回滚到此快照将丢失当前未保存的修改，继续？')) {
    projectStore.restoreSnapshot(id);
    alert('已回滚到快照');
  }
}

watch([() => route.name, () => route.params.projectId], () => {
  showProjectDropdown.value = false;
});
</script>

<template>
  <header class="top-toolbar">
    <div class="toolbar-group">
      <button class="logo-btn" @click="goHome" title="返回项目列表">
        <span class="logo-mark">◆</span>
        <span class="logo-text">PixelForge</span>
      </button>
      <span class="sep">|</span>
      <div class="project-selector" @click.stop>
        <button class="proj-btn" @click="showProjectDropdown = !showProjectDropdown">
          <span class="proj-icon">📁</span>
          <span class="proj-name">{{ projectStore.currentProject?.name || '选择项目' }}</span>
          <span class="caret">▾</span>
        </button>
        <div v-if="showProjectDropdown" class="proj-dropdown">
          <div v-if="sortedProjects.length === 0" class="empty-list">暂无项目</div>
          <div v-for="p in sortedProjects" :key="p.id"
            class="proj-item"
            :class="{ active: p.id === projectStore.currentProjectId }"
            @click="selectProject(p.id)">
            <div class="pi-name">{{ p.name }}</div>
            <div class="pi-meta">{{ formatDate(p.updatedAt) }}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="toolbar-group page-nav" v-if="projectStore.currentProject">
      <button v-for="b in pageButtons" :key="b.name"
        :class="{ active: activePage === b.name }"
        @click="navigatePage(b.pathSuffix)">
        <span class="btn-icon">{{ b.icon }}</span>
        <span class="btn-text">{{ b.label }}</span>
      </button>
    </div>
    <div class="spacer"></div>
    <div class="toolbar-group">
      <button title="撤销" disabled>↶ 撤销</button>
      <button title="重做" disabled>↷ 重做</button>
      <button @click="openSnap" title="快照版本">📸 快照 ({{ projectStore.snapshots.length }})</button>
      <button class="btn-primary" @click="doExport" title="导出JSON">⬇ 导出配置</button>
      <button class="panel-toggle" @click="$emit('toggle-left')" title="折叠左侧">◀</button>
      <button class="panel-toggle" @click="$emit('toggle-right')" title="折叠右侧">▶</button>
    </div>
    <div v-if="snapModalOpen" class="modal-mask" @click.self="snapModalOpen = false">
      <div class="modal panel">
        <div class="modal-header">
          <h3>📸 版本快照</h3>
          <button class="close" @click="snapModalOpen = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="create-row">
            <input v-model="newSnapName" placeholder="快照名称..." />
            <button class="btn-primary" @click="createSnap">新建快照</button>
          </div>
          <div class="section-group-title">历史快照 ({{ projectStore.snapshots.length }})</div>
          <div class="snap-list">
            <div v-if="projectStore.snapshots.length === 0" class="empty-list">暂无快照</div>
            <div v-for="s in [...projectStore.snapshots].reverse()" :key="s.id" class="snap-item">
              <div class="snap-info">
                <div class="snap-name">{{ s.name }}</div>
                <div class="snap-meta">{{ formatDate(s.timestamp) }}</div>
              </div>
              <div class="snap-actions">
                <button @click="restoreSnap(s.id)">回滚</button>
                <button @click="deleteSnap(s.id)" class="btn-danger">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.logo-btn {
  display: flex; align-items: center; gap: 8px;
  background: transparent; border: none;
  font-weight: 700;
}
.logo-mark {
  color: var(--color-primary);
  font-size: 18px;
  text-shadow: 0 0 10px var(--shadow-glow-orange);
}
.logo-text {
  font-family: var(--font-pixel);
  font-size: 12px;
  color: var(--color-primary);
  letter-spacing: 1px;
}
.sep { color: var(--color-border); margin: 0 4px; }

.proj-btn {
  display: flex; align-items: center; gap: 8px;
  min-width: 180px;
}
.proj-name {
  flex: 1; text-align: left;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.caret { font-size: 10px; opacity: 0.6; }
.project-selector { position: relative; }
.proj-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0;
  width: 280px; max-height: 340px; overflow-y: auto;
  background: var(--color-bg-panel); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 200;
}
.proj-item {
  padding: 10px 12px; cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background var(--transition-fast);
}
.proj-item:hover { background: var(--color-bg-panel-hover); }
.proj-item.active { background: rgba(255, 107, 53, 0.1); border-left: 3px solid var(--color-primary); }
.pi-name { font-size: 13px; margin-bottom: 2px; }
.pi-meta { font-size: 11px; color: var(--color-text-muted); }

.page-nav button {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
}
.page-nav button.active {
  background: rgba(0, 212, 255, 0.12);
  border-color: var(--color-text-secondary);
  color: var(--color-text-secondary);
  box-shadow: 0 0 8px var(--shadow-glow-cyan);
}

.panel-toggle {
  padding: 6px 8px; font-size: 12px;
}

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 9999; display: flex; align-items: center; justify-content: center;
}
.modal {
  width: 560px; max-height: 80vh; overflow: hidden;
  display: flex; flex-direction: column;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--color-border);
}
.modal-header h3 { font-size: 15px; color: var(--color-primary); }
.close { background: none; border: none; padding: 4px 8px; }
.modal-body { padding: 18px; overflow-y: auto; }
.create-row {
  display: flex; gap: 10px; margin-bottom: 20px;
}
.create-row input { flex: 1; }
.snap-list {
  max-height: 300px; overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.snap-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid var(--color-border);
}
.snap-item:last-child { border-bottom: none; }
.snap-name { font-size: 13px; margin-bottom: 2px; }
.snap-meta { font-size: 11px; color: var(--color-text-muted); }
.snap-actions { display: flex; gap: 6px; }
.btn-danger {
  background: rgba(255, 77, 79, 0.15); border-color: var(--color-text-error);
  color: var(--color-text-error);
}

.empty-list {
  padding: 24px; text-align: center;
  color: var(--color-text-muted); font-size: 12px;
}
</style>
