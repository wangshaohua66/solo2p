<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: boolean
  minSize?: number
  initialSize?: number
  direction?: 'horizontal' | 'vertical'
}>(), {
  modelValue: true,
  minSize: 250,
  initialSize: 400,
  direction: 'horizontal'
})

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  resized: [size: number]
}>()

const open = ref(props.modelValue)
const size = ref(props.initialSize)
const dragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const startS = ref(0)
const panelRef = ref<HTMLElement | null>(null)

watch(() => props.modelValue, (v) => { open.value = v })

function toggle() {
  open.value = !open.value
  emit('update:modelValue', open.value)
  nextTick(() => {
    window.dispatchEvent(new CustomEvent('panel-resized'))
  })
}

function startDrag(e: MouseEvent) {
  dragging.value = true
  startS.value = size.value
  if (props.direction === 'horizontal') {
    startX.value = e.clientX
  } else {
    startY.value = e.clientY
  }
  document.body.style.userSelect = 'none'
  document.body.style.cursor = props.direction === 'horizontal' ? 'col-resize' : 'row-resize'
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
}

function onDrag(e: MouseEvent) {
  if (!dragging.value) return
  const delta = props.direction === 'horizontal'
    ? startX.value - e.clientX
    : startY.value - e.clientY
  size.value = Math.max(startS.value + delta, props.minSize)
  window.dispatchEvent(new CustomEvent('panel-resized'))
}

function endDrag() {
  dragging.value = false
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
  emit('resized', size.value)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
})
</script>

<template>
  <div
    class="flex flex-shrink-0"
    :class="direction === 'vertical' ? 'flex-col' : ''"
    :style="{
      width: open ? (direction === 'horizontal' ? `${size}px` : undefined) : 0,
      height: open ? (direction === 'vertical' ? `${size}px` : undefined) : 0,
      transition: dragging ? 'none' : `${direction === 'horizontal' ? 'width' : 'height'} 0.3s ease, opacity 0.2s ease`,
      overflow: 'hidden',
      opacity: open ? 1 : 0
    }"
  >
    <div
      ref="panelRef"
      class="flex h-full w-full flex-col"
      style="background: var(--bg-secondary); border-color: var(--border-color);"
      :class="direction === 'horizontal' ? 'border-l' : 'border-t'"
    >
      <div
        class="flex items-center justify-between px-3 py-2"
        style="border-color: var(--border-color);"
        :class="direction === 'horizontal' ? 'border-b' : 'border-b'"
      >
        <slot name="header" />
        <button class="btn-icon" @click="toggle">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="w-4 h-4 transition-transform"
            :style="{ transform: open ? '' : (direction === 'horizontal' ? 'rotate(180deg)' : 'rotate(90deg)') }"
          >
            <path v-if="direction === 'horizontal'" d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
            <path v-else d="M6 9l6-6 6 6M6 15l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-hidden flex flex-col">
        <slot :size="size" />
      </div>
      <div
        v-if="direction === 'vertical'"
        class="draggable-handle-h h-[3px] w-full cursor-row-resize"
        style="background: var(--bg-tertiary);"
        @mousedown="startDrag"
      />
      <div
        v-else
        class="draggable-handle w-[3px] h-full cursor-col-resize order-first"
        style="background: var(--bg-tertiary);"
        @mousedown="startDrag"
      />
    </div>
  </div>
</template>
