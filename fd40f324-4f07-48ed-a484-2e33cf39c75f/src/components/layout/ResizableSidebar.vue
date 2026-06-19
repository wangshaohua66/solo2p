<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { useThemeStore } from '@/stores/theme'

const MIN_WIDTH = 180
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 240

const themeStore = useThemeStore()

const width = ref(themeStore.sidebarWidth || DEFAULT_WIDTH)
const dragging = ref(false)
const containerRef = ref<HTMLElement | null>(null)
let startX = 0
let startW = 0

function clampWidth(w: number): number {
  return Math.min(Math.max(w, MIN_WIDTH), MAX_WIDTH)
}

function startDrag(e: MouseEvent) {
  dragging.value = true
  startX = e.clientX
  startW = width.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
}

function onDrag(e: MouseEvent) {
  if (!dragging.value) return
  const delta = e.clientX - startX
  const newW = clampWidth(startW + delta)
  width.value = newW
  themeStore.setSidebarWidth(newW)
}

function endDrag() {
  dragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  themeStore.setSidebarWidth(width.value)
}

onBeforeUnmount(() => {
  if (dragging.value) {
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', endDrag)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="flex h-full"
    :style="{ width: `${width}px`, flexShrink: 0 }"
  >
    <div class="h-full flex-1 overflow-hidden">
      <slot :width="width" :dragging="dragging" />
    </div>
    <div
      class="draggable-handle h-full w-[3px] flex-shrink-0 hover:w-1 transition-all relative cursor-col-resize group"
      style="background: var(--bg-tertiary);"
      :class="{ '!w-1': dragging }"
      @mousedown="startDrag"
    >
      <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-[5px] rounded-full transition-colors"
        :class="dragging ? 'bg-brand-400' : 'bg-transparent group-hover:bg-slate-500/50'"
      />
      <div
        v-if="dragging"
        class="absolute inset-y-0 -left-2 -right-2"
      />
    </div>
  </div>
</template>

<style scoped>
.draggable-handle:hover {
  background: var(--accent-color) !important;
  opacity: 0.6;
}
</style>
