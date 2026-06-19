<script setup lang="ts">
import { computed } from 'vue'
import { Code2, Copy, ClipboardPaste, FilePlus, Scissors, Sparkles } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  hasSelection: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  insertSnippet: []
  cut: []
  copy: []
  paste: []
  duplicate: []
  format: []
}>()

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`
}))

function close() {
  emit('update:visible', false)
}

type ActionName = 'insertSnippet' | 'cut' | 'copy' | 'paste' | 'duplicate' | 'format'

function action(name: ActionName) {
  return () => {
    ;(emit as any)(name)
    close()
  }
}
</script>

<template>
  <Transition name="menu-in">
    <div
      v-if="visible"
      class="context-menu absolute z-40 card py-1 w-48 shadow-xl"
      :style="style"
      @click.stop
      @contextmenu.prevent
    >
      <button
        class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-700/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!hasSelection"
        style="color: var(--text-primary);"
        @click="action('cut')()"
      >
        <Scissors class="w-3.5 h-3.5" />
        剪切
        <span class="ml-auto text-[10px] opacity-50">Ctrl+X</span>
      </button>
      <button
        class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-700/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!hasSelection"
        style="color: var(--text-primary);"
        @click="action('copy')()"
      >
        <Copy class="w-3.5 h-3.5" />
        复制
        <span class="ml-auto text-[10px] opacity-50">Ctrl+C</span>
      </button>
      <button
        class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-700/40 transition-colors"
        style="color: var(--text-primary);"
        @click="action('paste')()"
      >
        <ClipboardPaste class="w-3.5 h-3.5" />
        粘贴
        <span class="ml-auto text-[10px] opacity-50">Ctrl+V</span>
      </button>
      <div class="my-1 divider" />
      <button
        class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-700/40 transition-colors"
        :style="{ color: 'var(--accent-color)' }"
        @click="action('insertSnippet')()"
      >
        <Sparkles class="w-3.5 h-3.5" />
        插入代码片段...
        <span class="ml-auto text-[10px] opacity-50">Ctrl+I</span>
      </button>
      <button
        class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-700/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!hasSelection"
        style="color: var(--text-primary);"
        @click="action('duplicate')()"
      >
        <FilePlus class="w-3.5 h-3.5" />
        复制选中行
      </button>
      <button
        class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-700/40 transition-colors"
        style="color: var(--text-primary);"
        @click="action('format')()"
      >
        <Code2 class="w-3.5 h-3.5" />
        格式化文档
        <span class="ml-auto text-[10px] opacity-50">Shift+Alt+F</span>
      </button>
    </div>
  </Transition>
  <div
    v-if="visible"
    class="fixed inset-0 z-30"
    @click="close"
    @contextmenu.prevent="close"
  />
</template>

<style scoped>
.menu-in-enter-active {
  transition: all 0.15s ease-out;
}
.menu-in-leave-active {
  transition: all 0.1s ease-in;
}
.menu-in-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
.menu-in-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
