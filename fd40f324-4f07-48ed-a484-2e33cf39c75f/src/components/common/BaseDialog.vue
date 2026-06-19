<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: boolean
  title?: string
  width?: string
  closeOnBackdrop?: boolean
}>(), {
  modelValue: false,
  title: '',
  width: '480px',
  closeOnBackdrop: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  open: []
}>()

const visible = ref(props.modelValue)
const dialogRef = ref<HTMLDivElement | null>(null)

watch(() => props.modelValue, (v) => {
  visible.value = v
  if (v) {
    nextTick(() => {
      const el = dialogRef.value?.querySelector('input,button,textarea') as HTMLElement | null
      el?.focus()
    })
    emit('open')
  }
})

function close() {
  visible.value = false
  emit('update:modelValue', false)
  emit('close')
}

function onBackdrop() {
  if (props.closeOnBackdrop) close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);"
        @mousedown.self="onBackdrop"
      >
        <div
          ref="dialogRef"
          class="card animate-fade-in-up"
          :style="{ width, maxWidth: '92vw', maxHeight: '86vh' }"
        >
          <div
            v-if="title || $slots.header"
            class="flex items-center justify-between px-5 py-4 border-b"
            style="border-color: var(--border-color);"
          >
            <h3 class="font-semibold text-base" style="color: var(--text-primary);">
              <slot name="header">{{ title }}</slot>
            </h3>
            <button
              class="btn-icon"
              @click="close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div
            class="px-5 py-4 overflow-auto scrollbar-thin"
            :style="{ maxHeight: 'calc(86vh - 140px)' }"
          >
            <slot />
          </div>
          <div
            v-if="$slots.footer"
            class="px-5 py-4 flex justify-end gap-2 border-t"
            style="border-color: var(--border-color);"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
