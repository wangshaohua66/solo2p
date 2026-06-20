<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import { formatDate } from '@/utils/id';

const router = useRouter();
const projectStore = useProjectStore();

const showCreateModal = ref(false);
const showCopyModal = ref(false);
const newProjectName = ref('');
const newProjectDesc = ref('');
const copySourceId = ref('');
const copyName = ref('');
const searchQuery = ref('');

const filteredProjects = computed(() => {
  if (!searchQuery.value) return [...projectStore.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  const q = searchQuery.value.toLowerCase();
  return projectStore.projects
    .filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);
});

function openProject(id: string) {
  projectStore.openProject(id);
  router.push(`/projects/${id}/sprites`);
}

function createProject() {
  if (!newProjectName.value.trim()) return;
  const p = projectStore.createProject(newProjectName.value.trim(), newProjectDesc.value.trim());
  newProjectName.value = ''; newProjectDesc.value = '';
  showCreateModal.value = false;
  openProject(p.id);
}

function deleteProject(id: string, e: MouseEvent) {
  e.stopPropagation();
  if (confirm('确定删除该项目？所有资源将被永久删除！')) {
    projectStore.deleteProject(id);
  }
}

function openCopyModal(id: string, name: string, e: MouseEvent) {
  e.stopPropagation();
  copySourceId.value = id;
  copyName.value = `${name} 副本`;
  showCopyModal.value = true;
}

function doCopy() {
  if (!copyName.value.trim() || !copySourceId.value) return;
  const p = projectStore.duplicateProject(copySourceId.value, copyName.value.trim());
  showCopyModal.value = false;
  copyName.value = ''; copySourceId.value = '';
  if (p) alert(`已复制为: ${p.name}`);
}

function makeThumbColors(i: number) {
  const palette = [
    ['#ff6b35', '#ff9966'], ['#00d4ff', '#66e5ff'], ['#52c41a', '#89e051'],
    ['#faad14', '#ffd666'], ['#ff4d4f', '#ff7875'], ['#722ed1', '#9254de']
  ];
  return palette[i % palette.length];
}
</script>

<template>
  <div class="project-list-page">
    <header class="page-header">
      <div class="branding">
        <div class="logo-big">◆</div>
        <div>
          <h1>PixelForge Studio</h1>
          <p class="subtitle">2D游戏资源编排与预览工具 · 纯前端一站式精灵/动画/地图/音效解决方案</p>
        </div>
      </div>
      <div class="header-actions">
        <div class="search-wrap">
          <input v-model="searchQuery" class="search-input" placeholder="🔍 搜索项目..." />
        </div>
        <button class="btn-primary big" @click="showCreateModal = true">
          ＋ 新建项目
        </button>
      </div>
    </header>

    <section class="projects-section">
      <div class="section-title-row">
        <h2>📁 我的项目 <span class="count">{{ projectStore.projects.length }}</span></h2>
        <div class="tips">
          <span class="tip">💡 双击项目卡片直接打开</span>
        </div>
      </div>

      <div v-if="filteredProjects.length === 0" class="empty-state">
        <div class="empty-illustration">🎮</div>
        <h3>暂无项目，立即创建第一个吧！</h3>
        <p>支持精灵切割、动画编排、瓦片地图、音效挂载，一键导出JSON到游戏引擎</p>
        <button class="btn-primary big" @click="showCreateModal = true">🚀 新建项目</button>
      </div>

      <div v-else class="projects-grid">
        <div v-for="(p, i) in filteredProjects" :key="p.id"
          class="project-card panel card-hover"
          @click="openProject(p.id)"
          @dblclick="openProject(p.id)">
          <div class="card-cover checkerboard" :style="{ background: `linear-gradient(135deg, ${makeThumbColors(i)[0]}33, ${makeThumbColors(i)[1]}22)` }">
            <div class="cover-grid">
              <div v-for="n in 9" :key="n" class="cover-cell" :style="{ background: makeThumbColors(i)[Math.floor(Math.random()*2)] + '66' }"></div>
            </div>
            <div class="cover-badge" :style="{ background: makeThumbColors(i)[0] }">
              {{ p.name.charAt(0).toUpperCase() }}
            </div>
            <div class="corner-deco tl"></div>
            <div class="corner-deco tr"></div>
            <div class="corner-deco bl"></div>
            <div class="corner-deco br"></div>
          </div>
          <div class="card-body">
            <h3 class="card-title">{{ p.name }}</h3>
            <p v-if="p.description" class="card-desc">{{ p.description }}</p>
            <p v-else class="card-desc muted">暂无描述</p>
            <div class="card-stats">
              <div class="stat-chip sprites"><span>🖼️</span>精灵</div>
              <div class="stat-chip anims"><span>🎬</span>动画</div>
              <div class="stat-chip maps"><span>🗺️</span>地图</div>
              <div class="stat-chip audio"><span>🔊</span>音效</div>
            </div>
            <div class="card-meta">
              <span>更新于 {{ formatDate(p.updatedAt) }}</span>
            </div>
            <div class="card-actions" @click.stop>
              <button class="btn-secondary" @click="openCopyModal(p.id, p.name, $event)">⎘ 复制</button>
              <button @click="openProject(p.id)" class="btn-primary">打开 →</button>
              <button class="delete-btn" @click="deleteProject(p.id, $event)" title="删除项目">🗑</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div v-if="showCreateModal" class="modal-mask" @click.self="showCreateModal = false">
      <div class="modal panel">
        <div class="modal-header">
          <h3>🌟 创建新项目</h3>
          <button class="close" @click="showCreateModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row big">
            <label>项目名称 *</label>
            <input v-model="newProjectName" placeholder="如：勇者传说_第一章" maxlength="50" @keyup.enter="createProject" />
          </div>
          <div class="form-row big">
            <label>项目描述</label>
            <textarea v-model="newProjectDesc" placeholder="简要说明项目内容（可选）..." rows="3"></textarea>
          </div>
          <div class="info-box">
            <div class="info-title">📋 快速上手指南</div>
            <ul>
              <li>上传精灵图PNG，一键自动切割帧</li>
              <li>拖拽帧到时间轴编排动画，挂载音效</li>
              <li>从精灵集取瓦片，绘制多层地图</li>
              <li>点击顶部「导出配置」获取标准JSON</li>
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showCreateModal = false">取消</button>
          <button class="btn-primary" @click="createProject" :disabled="!newProjectName.trim()">创建项目</button>
        </div>
      </div>
    </div>

    <div v-if="showCopyModal" class="modal-mask" @click.self="showCopyModal = false">
      <div class="modal panel small">
        <div class="modal-header">
          <h3>⎘ 复制项目</h3>
          <button class="close" @click="showCopyModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row big">
            <label>新项目名称 *</label>
            <input v-model="copyName" placeholder="副本项目名" @keyup.enter="doCopy" />
          </div>
          <p class="hint-sm">将完整复制项目内所有资源、动画、地图和音效配置</p>
        </div>
        <div class="modal-footer">
          <button @click="showCopyModal = false">取消</button>
          <button class="btn-primary" @click="doCopy" :disabled="!copyName.trim()">确认复制</button>
        </div>
      </div>
    </div>

    <footer class="page-footer">
      <span>PixelForge Studio v1.0.0 · 本地安全存储，数据永不离开你的浏览器</span>
    </footer>
  </div>
</template>

<style scoped>
.project-list-page {
  width: 100vw; height: 100vh; overflow-y: auto;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(255, 107, 53, 0.1), transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(0, 212, 255, 0.08), transparent 50%),
    var(--color-bg-canvas);
  color: var(--color-text-main);
}

.page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 28px 48px 20px;
  gap: 24px;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}
.branding { display: flex; align-items: center; gap: 20px; }
.logo-big {
  font-size: 48px; color: var(--color-primary);
  text-shadow: 0 0 20px var(--shadow-glow-orange);
  line-height: 1;
}
h1 {
  font-family: var(--font-pixel);
  font-size: 20px; letter-spacing: 1px;
  color: var(--color-primary);
  margin-bottom: 6px;
}
.subtitle {
  font-size: 13px; color: var(--color-text-muted);
}
.header-actions { display: flex; align-items: center; gap: 12px; }
.search-input {
  min-width: 280px; padding: 10px 14px;
  font-size: 13px;
}
.btn-primary.big {
  padding: 10px 22px; font-size: 13px; font-weight: 600;
}

.projects-section { padding: 28px 48px 80px; }
.section-title-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.section-title-row h2 {
  font-size: 18px; font-weight: 700;
}
.count {
  background: var(--color-bg-input);
  color: var(--color-text-secondary);
  font-size: 12px; font-weight: 600;
  padding: 2px 10px; border-radius: 10px;
  margin-left: 8px;
}
.tips { font-size: 11px; color: var(--color-text-muted); }
.tip { padding: 4px 10px; background: var(--color-bg-input); border-radius: 12px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 24px;
  gap: 14px; text-align: center;
}
.empty-illustration { font-size: 84px; opacity: 0.5; margin-bottom: 12px; }
.empty-state h3 { font-size: 18px; color: var(--color-text-main); }
.empty-state p { color: var(--color-text-muted); max-width: 440px; margin-bottom: 12px; }

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.project-card {
  display: flex; flex-direction: column;
  overflow: hidden; cursor: pointer;
  transition: all var(--transition-base);
}
.card-cover {
  position: relative;
  height: 140px; overflow: hidden;
  border-bottom: 1px solid var(--color-border);
}
.cover-grid {
  position: absolute; inset: 20px;
  display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);
  gap: 4px;
}
.cover-cell {
  border-radius: 2px;
  image-rendering: pixelated;
}
.cover-badge {
  position: absolute; top: 10px; right: 10px;
  width: 40px; height: 40px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-pixel); font-size: 14px;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.corner-deco {
  position: absolute; width: 10px; height: 10px;
  border: 2px solid var(--color-primary);
  opacity: 0.7;
}
.corner-deco.tl { top: 6px; left: 6px; border-right: none; border-bottom: none; }
.corner-deco.tr { top: 6px; right: 6px; border-left: none; border-bottom: none; }
.corner-deco.bl { bottom: 6px; left: 6px; border-right: none; border-top: none; }
.corner-deco.br { bottom: 6px; right: 6px; border-left: none; border-top: none; }

.card-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.card-title {
  font-size: 15px; font-weight: 700;
  color: var(--color-text-main);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.card-desc {
  font-size: 12px; color: var(--color-text-muted);
  line-height: 1.5; min-height: 36px;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.card-desc.muted { opacity: 0.6; font-style: italic; }
.card-stats { display: flex; gap: 6px; flex-wrap: wrap; }
.stat-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; padding: 2px 8px;
  background: var(--color-bg-input);
  border-radius: 10px; color: var(--color-text-muted);
}
.stat-chip.sprites { color: #ff6b35; }
.stat-chip.anims { color: #00d4ff; }
.stat-chip.maps { color: #52c41a; }
.stat-chip.audio { color: #faad14; }
.card-meta {
  font-size: 11px; color: var(--color-text-muted);
  padding-top: 4px;
  border-top: 1px dashed var(--color-border);
}
.card-actions {
  display: flex; gap: 8px; align-items: center;
  margin-top: auto; padding-top: 8px;
}
.card-actions button { flex: 0 0 auto; font-size: 11px; padding: 6px 10px; }
.card-actions .btn-primary { flex: 1; }
.delete-btn {
  background: transparent; border: 1px solid transparent;
  color: var(--color-text-muted);
}
.delete-btn:hover {
  color: var(--color-text-error);
  border-color: var(--color-text-error);
  box-shadow: 0 0 8px rgba(255, 77, 79, 0.3);
}

.modal-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal {
  width: 520px; max-width: 92vw;
  display: flex; flex-direction: column;
  max-height: 86vh; overflow: hidden;
  animation: slideUp 0.25s ease-out;
}
.modal.small { width: 420px; }
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 {
  font-size: 16px; font-weight: 700;
  color: var(--color-primary);
}
.close { background: none; border: none; font-size: 16px; padding: 4px 8px; }
.modal-body { padding: 20px; overflow-y: auto; }
.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
  display: flex; justify-content: flex-end; gap: 10px;
}

.form-row.big { margin-bottom: 16px; }
.form-row.big > label {
  display: block; margin-bottom: 6px;
  font-size: 12px; font-weight: 600; color: var(--color-text-muted);
}
.form-row.big > input, .form-row.big > textarea {
  width: 100%; font-size: 13px; padding: 8px 12px;
}
.info-box {
  margin-top: 16px; padding: 14px;
  background: linear-gradient(135deg, rgba(0,212,255,0.06), rgba(255,107,53,0.06));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.info-title {
  font-size: 12px; font-weight: 700;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}
.info-box ul { padding-left: 18px; font-size: 12px; line-height: 1.9; color: var(--color-text-muted); }
.hint-sm {
  margin-top: 8px; font-size: 11px;
  color: var(--color-text-muted); font-style: italic;
}

.page-footer {
  padding: 16px 48px;
  border-top: 1px solid var(--color-border);
  text-align: center;
  font-size: 11px; color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .page-header { padding: 18px 20px; }
  .projects-section { padding: 18px 20px 40px; }
  .page-footer { padding: 12px 20px; }
  .search-input { min-width: 180px; }
  h1 { font-size: 14px; }
  .logo-big { font-size: 36px; }
}
</style>
