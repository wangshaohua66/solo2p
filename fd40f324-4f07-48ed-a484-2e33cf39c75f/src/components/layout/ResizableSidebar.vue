<script setup lang="ts">
import { ref, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'

const props = withDefaults(defineProps<{
  modelValue?: number
  minWidth?: number
  maxWidth?: number
  initialWidth?: number
  persistKey?: string
}>(), {
  modelValue: 240,
  minWidth: 180,
  maxWidth: 420,
  initialWidth: 240
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
  resized: [value: number]
}>()

const themeStore = useThemeStore()
const width = ref(props.modelValue || props.initialWidth)
const dragging = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const startX = ref(0)
const startW = ref(0)

watch(() => props.modelValue, (v) => {
  if (!dragging.value && v) width.value = v
})

function startDrag(e: MouseEvent) {
  dragging.value = true
  startX.value = e.clientX
  startW.value = width.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
}

function onDrag(e: MouseEvent) {
  if (!dragging.value) return
  const delta = e.clientX - startX.value
  let newW = startW.value + delta
  newW = Math.min(Math.max(newW, props.minWidth), props.maxWidth)
  width.value = newW
  emit('update:modelValue', newW)
}

function endDrag() {
  dragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  emit('resized', width.value)
  if (props.persistKey) {
    themeStore.setSidebarWidth(width.value)
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="flex h-full"
    :style="{ width: `${width}px`, flexShrink: 0 }"
  >
    <div class="h-full flex-1 overflow-hidden">
      <slot :width="width" />
    </div>
    <div
      class="draggable-handle h-full w-[3px] flex-shrink-0 hover:w-1 transition-all relative"
      style="background: var(--bg-tertiary);"
      @mousedown="startDrag"
    >
      <div
        v-if="dragging"
        class="absolute inset-y-0 -left-2 -right-2"
      />
    </div>
  </div>
</template>
