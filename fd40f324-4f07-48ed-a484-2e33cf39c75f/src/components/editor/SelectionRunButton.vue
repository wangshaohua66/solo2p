<script setup lang="ts">
import { computed } from 'vue'
import { Play } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  run: []
  dismiss: []
}>()

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`
}))
</script>

<template>
  <Transition name="float-in">
    <div
      v-if="visible"
      class="selection-run-btn absolute z-30 pointer-events-auto"
      :style="style"
      @click.stop="emit('run')"
      @mousedown.stop
    >
      <button
        class="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shadow-lg"
        style="background: linear-gradient(135deg, #10B981, #059669); color: white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);"
        title="仅执行选中代码"
      >
        <Play class="w-3 h-3" />
        <span>执行选中</span>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.float-in-enter-active {
  transition: all 0.18s ease-out;
}
.float-in-leave-active {
  transition: all 0.12s ease-in;
}
.float-in-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.9);
}
.float-in-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.95);
}
.selection-run-btn {
  transform: translateY(-100%);
}
</style>
