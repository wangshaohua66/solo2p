<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores/ProjectStore'

const emit = defineEmits<{
  (e: 'export-png'): void
  (e: 'export-json'): void
  (e: 'import-json'): void
}>()

const store = useProjectStore()
const fileInput = ref<HTMLInputElement | null>(null)

const tools = [
  { id: 'select', name: '选择', icon: '👆', shortcut: 'V' },
  { id: 'wall-straight', name: '直线墙', icon: '📏', shortcut: 'W' },
  { id: 'wall-arc', name: '弧形墙', icon: '〰️', shortcut: 'A' },
  { id: 'door', name: '门', icon: '🚪', shortcut: 'D' },
  { id: 'window', name: '窗', icon: '🪟', shortcut: 'N' }
]

const viewTools = [
  { id: 'zoom-in', name: '放大', icon: '🔍+', action: () => store.zoomIn(), shortcut: '+' },
  { id: 'zoom-out', name: '缩小', icon: '🔍-', action: () => store.zoomOut(), shortcut: '-' },
  { id: 'zoom-reset', name: '重置视图', icon: '🎯', action: () => { store.setZoom(1); store.setPan({ x: 0, y: 0 }) }, shortcut: '0' }
]

function handleImportClick() {
  fileInput.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const content = event.target?.result as string
      store.importJSON(content)
    } catch (err) {
      alert('导入失败：文件格式不正确')
    }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <div class="top-toolbar">
    <div class="toolbar-left">
      <div class="app-logo">
        <span class="logo-icon">🏠</span>
        <span class="logo-text">户型设计工具</span>
      </div>
      
      <div class="divider"></div>
      
      <div class="tool-group">
        <button
          v-for="tool in tools"
          :key="tool.id"
          :class="['tool-btn', { active: store.state.selectedTool === tool.id }]"
          @click="store.setTool(tool.id)"
          :title="`${tool.name} (${tool.shortcut})`"
        >
          <span class="icon">{{ tool.icon }}</span>
          <span class="name">{{ tool.name }}</span>
        </button>
      </div>
      
      <div class="divider"></div>
      
      <div class="tool-group">
        <button
          v-for="tool in viewTools"
          :key="tool.id"
          class="tool-btn"
          @click="tool.action"
          :title="`${tool.name} (${tool.shortcut})`"
        >
          <span class="icon">{{ tool.icon }}</span>
          <span class="name">{{ tool.name }}</span>
        </button>
      </div>
      
      <div class="divider"></div>
      
      <div class="tool-group">
        <button
          class="tool-btn"
          :class="{ active: store.state.showGrid }"
          @click="store.toggleGrid"
          title="显示/隐藏网格"
        >
          <span class="icon">📐</span>
          <span class="name">网格</span>
        </button>
        <button
          class="tool-btn"
          :class="{ active: store.state.snapEnabled }"
          @click="store.toggleSnap"
          title="开启/关闭吸附"
        >
          <span class="icon">🧲</span>
          <span class="name">吸附</span>
        </button>
        <button
          class="tool-btn"
          :class="{ active: store.state.showDimensions }"
          @click="store.toggleDimensions"
          title="显示/隐藏标注"
        >
          <span class="icon">📏</span>
          <span class="name">标注</span>
        </button>
      </div>
    </div>
    
    <div class="toolbar-center">
      <div class="history-group">
        <button
          class="tool-btn"
          :disabled="!store.canUndo"
          @click="store.undo"
          title="撤销 (Ctrl+Z)"
        >
          <span class="icon">↩️</span>
          <span class="name">撤销</span>
        </button>
        <button
          class="tool-btn"
          :disabled="!store.canRedo"
          @click="store.redo"
          title="重做 (Ctrl+Y)"
        >
          <span class="icon">↪️</span>
          <span class="name">重做</span>
        </button>
      </div>
    </div>
    
    <div class="toolbar-right">
      <div class="file-group">
        <button class="tool-btn import" @click="handleImportClick" title="导入JSON">
          <span class="icon">📂</span>
          <span class="name">导入</span>
        </button>
        <button class="tool-btn export" @click="emit('export-json')" title="导出JSON">
          <span class="icon">💾</span>
          <span class="name">JSON</span>
        </button>
        <button class="tool-btn export-png" @click="emit('export-png')" title="导出PNG">
          <span class="icon">🖼️</span>
          <span class="name">PNG</span>
        </button>
      </div>
      
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleFileChange"
      />
    </div>
  </div>
</template>

<style scoped>
.top-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 8px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.divider {
  width: 1px;
  height: 32px;
  background: #e0e0e0;
  margin: 0 8px;
}

.tool-group,
.history-group,
.file-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 44px;
  padding: 4px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  gap: 2px;
}

.tool-btn:hover:not(:disabled) {
  background: #f0f7ff;
}

.tool-btn.active {
  background: #4A90D9;
}

.tool-btn.active .icon,
.tool-btn.active .name {
  color: #ffffff;
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn .icon {
  font-size: 18px;
  line-height: 1;
}

.tool-btn .name {
  font-size: 10px;
  color: #666;
  line-height: 1;
}

.tool-btn.import {
  background: #e8f5e9;
}

.tool-btn.import:hover {
  background: #c8e6c9;
}

.tool-btn.export {
  background: #fff3e0;
}

.tool-btn.export:hover {
  background: #ffe0b2;
}

.tool-btn.export-png {
  background: #e3f2fd;
}

.tool-btn.export-png:hover {
  background: #bbdefb;
}
</style>
