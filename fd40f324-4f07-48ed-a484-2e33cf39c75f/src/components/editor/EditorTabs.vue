<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { X, Plus, FileCode } from 'lucide-vue-next'

const editorStore = useEditorStore()

const files = computed(() => editorStore.files)
const activeId = computed(() => editorStore.activeFileId)

function switchFile(id: string) {
  editorStore.setActiveFile(id)
}

function closeFile(id: string, e: MouseEvent) {
  e.stopPropagation()
  editorStore.closeFile(id)
}

function createNew() {
  editorStore.createFile()
}
</script>

<template>
  <div
    class="flex items-stretch h-full select-none"
    style="background: var(--bg-secondary); border-color: var(--border-color);"
  >
    <div class="flex items-stretch flex-1 overflow-x-auto scrollbar-thin">
      <div
        v-for="f in files"
        :key="f.id"
        class="flex items-center gap-2 px-3 h-full cursor-pointer border-r text-sm transition-colors whitespace-nowrap group"
        :class="activeId === f.id
          ? 'border-b-2 border-b-brand-500'
          : 'hover:bg-slate-700/30'"
        :style="{
          background: activeId === f.id ? 'var(--bg-primary)' : 'transparent',
          borderColor: 'var(--border-color)',
          color: activeId === f.id ? 'var(--text-primary)' : 'var(--text-secondary)'
        }"
        @click="switchFile(f.id)"
      >
        <FileCode class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
        <span class="truncate max-w-[140px]">{{ f.name }}</span>
        <span v-if="f.dirty" class="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />
        <button
          v-if="files.length > 1"
          class="opacity-0 group-hover:opacity-100 transition-opacity ml-1 rounded hover:bg-slate-600/40 p-0.5 flex-shrink-0"
          @click="closeFile(f.id, $event)"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>
    <div
      class="flex items-center border-l h-full px-2"
      style="border-color: var(--border-color);"
    >
      <button
        class="btn-icon"
        title="新建文件 (Ctrl+N)"
        @click="createNew"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
