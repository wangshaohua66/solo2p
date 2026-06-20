<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import { builtInTemplates } from '@/utils/exporter';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();

const menuOpen = ref<string | null>(null);
const snapshotModalOpen = ref(false);
const compareModalOpen = ref(false);
const compareSnapshotA = ref<string>('');
const compareSnapshotB = ref<string>('');
const autoSnapshotInterval = ref<number>(projectStore.autoSnapshotInterval || 0);
const autoSnapshotEnabled = ref<boolean>(projectStore.autoSnapshotEnabled || false);

const canUndo = computed(() => projectStore.canUndo);
const canRedo = computed(() => projectStore.canRedo);

function toggleMenu(key: string) {
  menuOpen.value = menuOpen.value === key ? null : key;
  setTimeout(() => {
    if (menuOpen.value === key) {
      const handler = () => { menuOpen.value = null; document.removeEventListener('click', handler); };
      document.addEventListener('click', handler);
    }
  }, 0);
}

function handleNewProject() {
  if (confirm('创建新项目？当前未保存数据将丢失。')) {
    projectStore.createProject('未命名项目');
    router.push('/editor/sprite');
  }
  menuOpen.value = null;
}

function handleSaveProject() { projectStore.persistAll(); menuOpen.value = null; }

function undoAction() { projectStore.undo(); }
function redoAction() { projectStore.redo(); }

function openSnapshotManager() {
  snapshotModalOpen.value = true;
  menuOpen.value = null;
}

function openCompare() {
  if (projectStore.snapshots.length < 2) {
    alert('至少需要2个快照才能对比');
    return;
  }
  compareSnapshotA.value = projectStore.snapshots[0]?.id || '';
  compareSnapshotB.value = projectStore.snapshots[1]?.id || '';
  compareModalOpen.value = true;
}

function doCompare() {
  if (!compareSnapshotA.value || !compareSnapshotB.value) return;
  const diffs = projectStore.compareSnapshots(compareSnapshotA.value, compareSnapshotB.value);
  if (!diffs || diffs.length === 0) {
    alert('两个快照完全相同，无差异');
    return;
  }
  const lines = diffs.slice(0, 50).map(d =>
    `[${d.type}] ${d.pathStr}: ${String(d.before)} → ${String(d.after)}`).join('\n');
  alert(`发现 ${diffs.length} 处差异：\n\n${lines}${diffs.length > 50 ? '\n...（仅显示前50条）' : ''}`);
}

function toggleAutoSnapshot() {
  projectStore.setAutoSnapshot(!autoSnapshotEnabled.value, autoSnapshotInterval.value || 60000);
  autoSnapshotEnabled.value = !autoSnapshotEnabled.value;
}

function applyInterval() {
  projectStore.setAutoSnapshot(autoSnapshotEnabled.value, autoSnapshotInterval.value || 60000);
}

const exportTemplateId = ref('standard');
function exportWithTemplate() {
  projectStore.exportConfig(exportTemplateId.value);
  menuOpen.value = null;
}

function handleSaveSnapshot() {
  projectStore.saveSnapshot('手动快照');
  alert('快照已创建');
}

function handleRestoreSnapshot(id: string) {
  projectStore.restoreSnapshot(id);
  alert('已恢复');
  snapshotModalOpen.value = false;
}

const pages = [
  { path: '/editor/sprite', name: '精灵', icon: '🖼️' },
  { path: '/editor/animation', name: '动画', icon: '🎬' },
  { path: '/editor/map', name: '地图', icon: '🗺️' },
  { path: '/editor/audio', name: '音效', icon: '🔊' }
];

function goHome() { router.push('/'); }
</script>

<template>
  <div class="top-toolbar">
    <div class="brand" @click="goHome">
      <div class="logo">PF</div>
      <div class="title">
        <div class="name">PixelForge Studio</div>
        <div v-if="projectStore.currentProject" class="sub">
          {{ projectStore.currentProject.name }} · {{ projectStore.snapshots.length }}快照
          <span v-if="autoSnapshotEnabled" class="auto-dot">●</span>
        </div>
        <div v-else class="sub">未打开项目</div>
      </div>
    </div>

    <div class="menu-bar">
      <div class="menu-item" :class="{ open: menuOpen === 'file' }" @click.stop="toggleMenu('file')">
        <span>文件</span>
        <div v-if="menuOpen === 'file'" class="dropdown" @click.stop>
          <div class="dd-item" @click="handleNewProject">📄 新建项目</div>
          <div class="dd-item" @click="handleSaveProject">💾 保存项目</div>
          <div class="dd-sep"></div>
          <div class="dd-item">
            📤 导出配置
            <select v-model="exportTemplateId" class="dd-select" @click.stop>
              <option v-for="t in builtInTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <button class="dd-btn" @click="exportWithTemplate">导出</button>
          </div>
        </div>
      </div>

      <div class="menu-item" :class="{ open: menuOpen === 'edit' }" @click.stop="toggleMenu('edit')">
        <span>编辑</span>
        <div v-if="menuOpen === 'edit'" class="dropdown" @click.stop>
          <div class="dd-item" :class="{ disabled: !canUndo }" @click="canUndo && undoAction()">↶ 撤销 <span class="kbd">Ctrl+Z</span></div>
          <div class="dd-item" :class="{ disabled: !canRedo }" @click="canRedo && redoAction()">↷ 重做 <span class="kbd">Ctrl+Y</span></div>
        </div>
      </div>

      <div class="menu-item" :class="{ open: menuOpen === 'view' }" @click.stop="toggleMenu('view')">
        <span>视图</span>
        <div v-if="menuOpen === 'view'" class="dropdown" @click.stop>
          <div v-for="p in pages" :key="p.path"
            class="dd-item"
            :class="{ active: route.path === p.path }"
            @click="router.push(p.path)">
            {{ p.icon }} {{ p.name }}
          </div>
        </div>
      </div>

      <div class="menu-item" :class="{ open: menuOpen === 'snapshot' }" @click.stop="toggleMenu('snapshot')">
        <span>快照</span>
        <div v-if="menuOpen === 'snapshot'" class="dropdown wide" @click.stop>
          <div class="dd-item" @click="handleSaveSnapshot">📷 新建快照</div>
          <div class="dd-item" @click="openSnapshotManager">📋 管理快照 ({{ projectStore.snapshots.length }})</div>
          <div class="dd-item" @click="openCompare">🔍 对比快照...</div>
          <div class="dd-sep"></div>
          <div class="dd-item" @click.stop>
            <label>
              <input type="checkbox" v-model="autoSnapshotEnabled" @change="toggleAutoSnapshot" />
              自动快照
            </label>
          </div>
          <div class="dd-item" @click.stop>
            <label class="dd-label">
              间隔（毫秒）：
              <input type="number" v-model.number="autoSnapshotInterval" min="10000" step="10000"
                class="dd-input" @change="applyInterval" />
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="nav-tabs">
      <div v-for="p in pages" :key="p.path"
        class="nav-tab"
        :class="{ active: route.path === p.path }"
        @click="router.push(p.path)">
        <span class="nav-icon">{{ p.icon }}</span>
        <span class="nav-name">{{ p.name }}</span>
      </div>
    </div>

    <div class="spacer"></div>

    <div class="action-group">
      <button class="btn ghost" :disabled="!canUndo" title="撤销" @click="undoAction">↶</button>
      <button class="btn ghost" :disabled="!canRedo" title="重做" @click="redoAction">↷</button>
      <button class="btn ghost" title="保存" @click="handleSaveProject">💾</button>
      <button class="btn ghost" title="快速快照" @click="projectStore.saveSnapshot('快速快照')">📷</button>
      <button class="btn ghost" title="对比快照" @click="openCompare">🔍</button>
      <button class="btn primary" @click="goHome">🏠 项目列表</button>
    </div>

    <Teleport to="body">
      <div v-if="snapshotModalOpen" class="modal-mask" @click.self="snapshotModalOpen = false">
        <div class="modal">
          <div class="modal-head">
            <span>快照管理</span>
            <button class="close" @click="snapshotModalOpen = false">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="projectStore.snapshots.length === 0" class="empty">暂无快照</div>
            <div v-else class="snap-list">
              <div v-for="s in projectStore.snapshots" :key="s.id" class="snap-item">
                <div class="snap-info">
                  <div class="snap-name">📷 {{ s.label || s.name }}</div>
                  <div class="snap-meta">{{ new Date(s.timestamp).toLocaleString() }} · {{ s.resourceCount }}资源</div>
                </div>
                <div class="snap-actions">
                  <button class="btn small" @click="handleRestoreSnapshot(s.id)">恢复</button>
                  <button class="btn small danger" @click="projectStore.deleteSnapshot(s.id)">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="compareModalOpen" class="modal-mask" @click.self="compareModalOpen = false">
        <div class="modal">
          <div class="modal-head">
            <span>快照对比</span>
            <button class="close" @click="compareModalOpen = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="compare-row">
              <div class="compare-col">
                <label>快照 A（基线）</label>
                <select v-model="compareSnapshotA">
                  <option v-for="s in projectStore.snapshots" :key="s.id" :value="s.id">
                    {{ s.label || s.name }} · {{ new Date(s.timestamp).toLocaleString() }}
                  </option>
                </select>
              </div>
              <div class="compare-col">
                <label>快照 B（对比）</label>
                <select v-model="compareSnapshotB">
                  <option v-for="s in projectStore.snapshots" :key="s.id" :value="s.id">
                    {{ s.label || s.name }} · {{ new Date(s.timestamp).toLocaleString() }}
                  </option>
                </select>
              </div>
            </div>
            <div class="compare-actions">
              <button class="btn primary" :disabled="!compareSnapshotA || !compareSnapshotB || compareSnapshotA === compareSnapshotB"
                @click="doCompare">🔍 执行对比</button>
              <button class="btn" @click="compareModalOpen = false">取消</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.top-toolbar {
  display: flex; align-items: center; gap: 16px;
  height: 52px; padding: 0 16px;
  background: linear-gradient(180deg, rgba(35, 39, 47, 0.98) 0%, rgba(28, 30, 36, 0.98) 100%);
  border-bottom: 1px solid var(--color-border);
  position: relative; z-index: 100;
}
.brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.logo {
  width: 32px; height: 32px; border-radius: 6px;
  background: linear-gradient(135deg, #ff6b35 0%, #00d4ff 100%);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 800; font-size: 13px;
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.4);
}
.title { display: flex; flex-direction: column; }
.title .name { font-size: 13px; font-weight: 700; color: var(--color-text-primary); }
.title .sub {
  font-size: 10px; color: var(--color-text-muted);
  font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; gap: 4px;
}
.auto-dot { color: #00ff88; animation: blink 1.5s infinite; font-size: 8px; }
@keyframes blink { 50% { opacity: 0.3; } }
.menu-bar { display: flex; gap: 2px; position: relative; }
.menu-item {
  position: relative;
  padding: 6px 12px; font-size: 12px; color: var(--color-text-secondary);
  cursor: pointer; border-radius: 3px;
}
.menu-item:hover, .menu-item.open { background: rgba(255,107,53,0.12); color: var(--color-text-primary); }
.dropdown {
  position: absolute; top: 100%; left: 0;
  min-width: 200px; margin-top: 4px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  overflow: hidden; z-index: 1000;
}
.dropdown.wide { min-width: 240px; }
.dd-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; font-size: 12px; color: var(--color-text-secondary);
  cursor: pointer;
}
.dd-item:hover { background: rgba(255,107,53,0.12); color: var(--color-text-primary); }
.dd-item.active { color: var(--color-text-primary); background: rgba(0,212,255,0.08); }
.dd-item.disabled { opacity: 0.4; cursor: not-allowed; }
.dd-item.disabled:hover { background: transparent; color: var(--color-text-secondary); }
.dd-sep { height: 1px; background: var(--color-border); margin: 4px 0; }
.kbd {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: var(--color-text-muted); background: rgba(255,255,255,0.06);
  padding: 1px 5px; border-radius: 2px;
}
.dd-select, .dd-input {
  background: var(--color-bg-input); color: var(--color-text-secondary);
  border: 1px solid var(--color-border); border-radius: 2px;
  padding: 2px 6px; font-size: 11px; margin-left: 6px;
}
.dd-btn {
  background: var(--color-text-primary); color: #fff; border: none;
  padding: 2px 10px; border-radius: 2px; font-size: 11px;
  margin-left: 6px; cursor: pointer;
}
.dd-label { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--color-text-secondary); }
.dd-input { width: 80px; }
.nav-tabs { display: flex; gap: 4px; }
.nav-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 12px;
  color: var(--color-text-muted); cursor: pointer;
  border-radius: 3px; border: 1px solid transparent;
}
.nav-tab:hover { color: var(--color-text-secondary); background: rgba(255,255,255,0.04); }
.nav-tab.active {
  color: var(--color-text-primary);
  background: rgba(255,107,53,0.1);
  border-color: rgba(255,107,53,0.3);
}
.nav-icon { font-size: 13px; }
.spacer { flex: 1; }
.action-group { display: flex; gap: 4px; align-items: center; }
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 6px 12px; font-size: 12px; color: var(--color-text-secondary);
  background: rgba(255,255,255,0.04); border: 1px solid var(--color-border);
  border-radius: 3px; cursor: pointer; transition: all 0.15s;
  height: 30px;
}
.btn:hover:not(:disabled) {
  background: rgba(255,107,53,0.1); color: var(--color-text-primary);
  border-color: rgba(255,107,53,0.3);
}
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn.ghost { background: transparent; }
.btn.primary {
  background: linear-gradient(180deg, #ff8050 0%, var(--color-text-primary) 100%);
  border-color: var(--color-text-primary); color: #fff;
  box-shadow: 0 0 10px var(--shadow-glow-orange);
}
.btn.primary:hover:not(:disabled) { filter: brightness(1.1); }
.btn.small { padding: 3px 8px; font-size: 11px; height: 24px; }
.btn.danger { background: rgba(255, 77, 79, 0.12); border-color: rgba(255, 77, 79, 0.4); color: #ff8a8b; }
.btn.danger:hover { background: rgba(255, 77, 79, 0.25); }

.modal-mask {
  position: fixed; inset: 0;
  background: rgba(10, 12, 16, 0.75);
  display: flex; align-items: center; justify-content: center;
  z-index: 99999; backdrop-filter: blur(4px);
}
.modal {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px; width: 640px; max-width: 90vw;
  max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--color-border);
  font-weight: 600; color: var(--color-text-primary); font-size: 14px;
}
.close { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 14px; }
.close:hover { color: var(--color-text-primary); }
.modal-body { padding: 16px 18px; overflow-y: auto; }
.empty {
  text-align: center; padding: 40px;
  color: var(--color-text-muted); font-size: 12px;
}
.snap-list { display: flex; flex-direction: column; gap: 6px; max-height: 400px; overflow-y: auto; }
.snap-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: 4px;
  background: rgba(255,255,255,0.02); border: 1px solid var(--color-border);
}
.snap-item:hover { background: rgba(255,107,53,0.06); border-color: rgba(255,107,53,0.3); }
.snap-info { display: flex; flex-direction: column; gap: 2px; }
.snap-name { font-size: 12px; color: var(--color-text-primary); font-weight: 500; }
.snap-meta { font-size: 10px; color: var(--color-text-muted); font-family: 'JetBrains Mono', monospace; }
.snap-actions { display: flex; gap: 6px; }

.compare-row { display: flex; gap: 16px; margin-bottom: 20px; }
.compare-col { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.compare-col label { font-size: 11px; color: var(--color-text-muted); }
.compare-col select {
  background: var(--color-bg-input); color: var(--color-text-secondary);
  border: 1px solid var(--color-border); border-radius: 3px;
  padding: 8px 10px; font-size: 12px;
}
.compare-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
