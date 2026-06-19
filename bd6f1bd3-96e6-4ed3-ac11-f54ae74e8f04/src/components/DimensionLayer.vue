<script setup lang="ts">
import { useProjectStore } from '@/stores/ProjectStore'
import { computed } from 'vue'

const store = useProjectStore()

const dimensions = computed(() => store.allDimensions)

function formatValue(value: number, unit: string): string {
  if (unit === '㎡') {
    return `${value.toFixed(2)}${unit}`
  }
  return `${Math.round(value)}${unit}`
}
</script>

<template>
  <div class="dimension-layer">
    <div
      v-for="dim in dimensions"
      :key="dim.id"
      :class="[
        'dimension-label',
        { 'is-area': dim.type === 'room-area', 'is-length': dim.type === 'wall-length' }
      ]"
    >
      <span class="dimension-value">
        {{ formatValue(dim.value, dim.unit) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.dimension-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.dimension-label {
  position: absolute;
  background: rgba(255, 255, 255, 0.95);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dimension-label.is-length {
  color: #4CAF50;
  border: 1px solid #A5D6A7;
}

.dimension-label.is-area {
  color: #9C27B0;
  border: 1px solid #CE93D8;
  font-weight: 600;
  padding: 4px 8px;
}

.dimension-value {
  font-family: 'Monaco', 'Menlo', monospace;
}
</style>
