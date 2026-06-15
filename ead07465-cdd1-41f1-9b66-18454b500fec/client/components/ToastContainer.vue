<template>
  <Teleport to="body">
    <div class="fixed top-16 right-4 z-100 flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in dispatch.toasts"
          :key="toast.id"
          class="toast-enter pointer-events-auto w-80 card p-3 shadow-lg border-l-4"
          :class="{
            'border-l-danger': toast.type === 'error',
            'border-l-warning': toast.type === 'warning',
            'border-l-success': toast.type === 'success',
            'border-l-info': toast.type === 'info'
          }"
        >
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 mt-0.5">
              <div v-if="toast.type === 'error'" class="w-6 h-6 rounded-full bg-danger/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>
              <div v-else-if="toast.type === 'warning'" class="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div v-else-if="toast.type === 'success'" class="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div v-else class="w-6 h-6 rounded-full bg-info/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-primary">{{ toast.title }}</div>
              <div v-if="toast.message" class="text-xs text-muted mt-0.5">{{ toast.message }}</div>
            </div>
            <button class="text-muted hover:text-primary transition" @click="dispatch.removeToast(toast.id)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useDispatchStore } from '~/stores/dispatch'
const dispatch = useDispatchStore()
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
.toast-move {
  transition: transform 0.3s ease;
}
</style>
