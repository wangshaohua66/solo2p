<script setup lang="ts">
import { useProjectStore } from '@/stores/ProjectStore'
import { computed } from 'vue'

const store = useProjectStore()

const zoomPercent = computed(() => Math.round(store.state.zoom * 100))

const mouseWorldPos = computed(() => ({
  x: Math.round(store.state.mousePos.x),
  y: Math.round(store.state.mousePos.y)
}))

const collisionCount = computed(() => {
  return store.allFurniture.filter(f => f.isColliding).length
})
</script>

<template>
  <div class="bottom-status-bar">
    <div class="status-left">
      <div class="status-item">
        <span class="status-label">缩放</span>
        <span class="status-value zoom">{{ zoomPercent }}%</span>
        <div class="zoom-controls">
          <button class="zoom-btn" @click="store.zoomOut" title="缩小">−</button>
          <button class="zoom-btn" @click="store.zoomIn" title="放大">+</button>
        </div>
      </div>
      
      <div class="status-divider"></div>
      
      <div class="status-item">
        <span class="status-label">鼠标</span>
        <span class="status-value coord">
          X: {{ mouseWorldPos.x }}mm, Y: {{ mouseWorldPos.y }}mm
        </span>
      </div>
      
      <div class="status-divider"></div>
      
      <div class="status-item">
        <span class="status-label">画布</span>
        <span class="status-value">
          {{ Math.round(store.state.canvasSize.x) }} × {{ Math.round(store.state.canvasSize.y) }}
        </span>
      </div>
    </div>
    
    <div class="status-right">
      <div v-if="collisionCount > 0" class="status-item warning">
        <span class="status-icon">⚠️</span>
        <span class="status-value">{{ collisionCount }} 处碰撞</span>
      </div>
      
      <div class="status-divider"></div>
      
      <div class="status-item">
        <span class="status-icon">🧱</span>
        <span class="status-value">{{ store.allWalls.length }} 墙体</span>
      </div>
      
      <div class="status-item">
        <span class="status-icon">🪑</span>
        <span class="status-value">{{ store.allFurniture.length }} 家具</span>
      </div>
      
      <div class="status-item">
        <span class="status-icon">🏠</span>
        <span class="status-value">{{ store.allRooms.length }} 房间</span>
      </div>
      
      <div class="status-divider"></div>
      
      <div class="status-item">
        <span class="status-icon">📂</span>
        <span class="status-value">{{ store.state.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bottom-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  padding: 0 16px;
  background: #fafafa;
  border-top: 1px solid #e0e0e0;
  font-size: 11px;
  color: #666;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-label {
  color: #999;
  font-weight: 500;
}

.status-value {
  font-family: 'Monaco', 'Menlo', monospace;
  font-weight: 500;
}

.status-value.zoom {
  color: #4A90D9;
  min-width: 48px;
}

.status-value.coord {
  color: #333;
}

.status-icon {
  font-size: 12px;
}

.status-divider {
  width: 1px;
  height: 16px;
  background: #e0e0e0;
}

.zoom-controls {
  display: flex;
  gap: 2px;
  margin-left: 4px;
}

.zoom-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  transition: all 0.2s;
  line-height: 1;
  padding: 0;
}

.zoom-btn:hover {
  background: #f0f7ff;
  border-color: #4A90D9;
  color: #4A90D9;
}

.status-item.warning {
  color: #E57373;
}

.status-item.warning .status-value {
  color: #E57373;
  font-weight: 600;
}
</style>
