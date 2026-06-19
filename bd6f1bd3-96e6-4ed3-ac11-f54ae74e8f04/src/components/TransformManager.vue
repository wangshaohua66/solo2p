<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '@/stores/ProjectStore'
import type { Furniture } from '@/types'
import { snapToGrid, normalizeAngle } from '@/utils/geometry'

const store = useProjectStore()

const selectedFurniture = computed((): Furniture | undefined => {
  const items = store.selectedElements.furniture
  return items.length === 1 ? items[0] : undefined
})

const localPosition = ref({ x: 0, y: 0 })
const localRotation = ref(0)
const localScale = ref({ x: 1, y: 1 })

watch(selectedFurniture, (furniture) => {
  if (furniture) {
    localPosition.value = { ...furniture.position }
    localRotation.value = furniture.rotation
    localScale.value = { ...furniture.scale }
  }
}, { immediate: true })

function updatePosition(axis: 'x' | 'y', value: number) {
  if (!selectedFurniture.value) return
  
  let newPos = { ...localPosition.value }
  newPos[axis] = value
  
  if (store.state.snapEnabled) {
    newPos = snapToGrid(newPos, store.state.snapPrecision)
  }
  
  store.updateFurniture(selectedFurniture.value.id, { position: newPos })
  localPosition.value = newPos
}

function updateRotation(value: number) {
  if (!selectedFurniture.value) return
  const normalized = normalizeAngle((value * Math.PI) / 180)
  store.updateFurniture(selectedFurniture.value.id, { rotation: normalized })
  localRotation.value = normalized
}

function updateScale(axis: 'x' | 'y', value: number) {
  if (!selectedFurniture.value) return
  const newScale = { ...localScale.value }
  newScale[axis] = Math.max(0.1, Math.min(3, value))
  store.updateFurniture(selectedFurniture.value.id, { scale: newScale })
  localScale.value = newScale
}

function resetTransform() {
  if (!selectedFurniture.value) return
  store.updateFurniture(selectedFurniture.value.id, {
    rotation: 0,
    scale: { x: 1, y: 1 }
  })
  localRotation.value = 0
  localScale.value = { x: 1, y: 1 }
}

function rotate90(clockwise: boolean = true) {
  if (!selectedFurniture.value) return
  const delta = clockwise ? Math.PI / 2 : -Math.PI / 2
  const newRotation = normalizeAngle(selectedFurniture.value.rotation + delta)
  store.updateFurniture(selectedFurniture.value.id, { rotation: newRotation })
  localRotation.value = newRotation
}

const rotationDegrees = computed(() => {
  return Math.round((localRotation.value * 180) / Math.PI)
})
</script>

<template>
  <div class="transform-manager" v-if="selectedFurniture">
    <h4>🔧 变换控制</h4>
    
    <div class="transform-section">
      <div class="section-title">位置</div>
      <div class="input-row">
        <label>X</label>
        <input
          type="number"
          :value="Math.round(localPosition.x)"
          @input="updatePosition('x', Number(($event.target as HTMLInputElement).value))"
          step="10"
        />
        <span class="unit">mm</span>
      </div>
      <div class="input-row">
        <label>Y</label>
        <input
          type="number"
          :value="Math.round(localPosition.y)"
          @input="updatePosition('y', Number(($event.target as HTMLInputElement).value))"
          step="10"
        />
        <span class="unit">mm</span>
      </div>
    </div>
    
    <div class="transform-section">
      <div class="section-title">旋转</div>
      <div class="input-row">
        <label>角度</label>
        <input
          type="number"
          :value="rotationDegrees"
          @input="updateRotation(Number(($event.target as HTMLInputElement).value))"
          step="15"
          min="-180"
          max="180"
        />
        <span class="unit">°</span>
      </div>
      <div class="quick-rotate">
        <button @click="rotate90(false)" title="逆时针旋转90°">↺</button>
        <button @click="rotate90(true)" title="顺时针旋转90°">↻</button>
        <button @click="resetTransform" title="重置变换">⟲</button>
      </div>
    </div>
    
    <div class="transform-section">
      <div class="section-title">缩放</div>
      <div class="input-row">
        <label>宽</label>
        <input
          type="number"
          :value="Number(localScale.x.toFixed(2))"
          @input="updateScale('x', Number(($event.target as HTMLInputElement).value))"
          step="0.1"
          min="0.1"
          max="3"
        />
        <span class="unit">x</span>
      </div>
      <div class="input-row">
        <label>高</label>
        <input
          type="number"
          :value="Number(localScale.y.toFixed(2))"
          @input="updateScale('y', Number(($event.target as HTMLInputElement).value))"
          step="0.1"
          min="0.1"
          max="3"
        />
        <span class="unit">x</span>
      </div>
      <div class="scale-info">
        <span>实际尺寸：</span>
        <span class="dim">
          {{ Math.round(selectedFurniture.width * localScale.x) }}×
          {{ Math.round(selectedFurniture.height * localScale.y) }}mm
        </span>
      </div>
    </div>
    
    <div class="transform-section">
      <div class="section-title">操作</div>
      <div class="action-buttons">
        <button class="action-btn duplicate" @click="store.duplicateSelected">
          📋 复制
        </button>
        <button class="action-btn delete" @click="store.deleteSelected">
          🗑️ 删除
        </button>
      </div>
    </div>
  </div>
  
  <div class="transform-manager empty" v-else>
    <div class="empty-state">
      <div class="empty-icon">👆</div>
      <p>选择一个家具</p>
      <p class="hint">点击画布上的家具以编辑属性</p>
    </div>
  </div>
</template>

<style scoped>
.transform-manager {
  padding: 12px;
}

.transform-manager h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.transform-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.input-row {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
}

.input-row label {
  width: 24px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.input-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', monospace;
  outline: none;
  transition: border-color 0.2s;
}

.input-row input:focus {
  border-color: #4A90D9;
}

.input-row .unit {
  font-size: 11px;
  color: #999;
  width: 24px;
}

.quick-rotate {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.quick-rotate button {
  flex: 1;
  padding: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.quick-rotate button:hover {
  background: #f0f7ff;
  border-color: #4A90D9;
}

.scale-info {
  margin-top: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 11px;
  color: #666;
}

.scale-info .dim {
  font-family: 'Monaco', 'Menlo', monospace;
  color: #4A90D9;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.action-btn.duplicate {
  background: #e3f2fd;
  color: #1976D2;
}

.action-btn.duplicate:hover {
  background: #bbdefb;
}

.action-btn.delete {
  background: #ffebee;
  color: #c62828;
}

.action-btn.delete:hover {
  background: #ffcdd2;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  margin: 4px 0;
  font-size: 13px;
}

.empty-state .hint {
  font-size: 11px;
  color: #bbb;
}
</style>
