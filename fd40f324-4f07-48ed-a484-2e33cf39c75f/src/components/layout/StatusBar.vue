<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useThemeStore } from '@/stores/theme'
import { useSyncStore } from '@/stores/sync'
import { useStepStore } from '@/stores/step'
import { LANGUAGES } from '@/types'
import {
  WifiOff, Palette, Code2, Fullscreen, Minimize2, Radio
} from 'lucide-vue-next'

const editorStore = useEditorStore()
const themeStore = useThemeStore()
const syncStore = useSyncStore()
const stepStore = useStepStore()

const position = computed(() => ({
  line: editorStore.cursorLine,
  col: editorStore.cursorColumn
}))
const language = computed(() => {
  const l = LANGUAGES.find(l => l.id === editorStore.activeLanguage)
  return l?.label || editorStore.activeLanguage
})
const theme = computed(() => themeStore.themeConfig.label)
const total = computed(() => editorStore.totalLines)
const isConnected = computed(() => syncStore.isConnected)
const roleLabel = computed(() => {
  if (!isConnected.value) return '离线'
  return syncStore.role === 'editor' ? '编辑' : '观看'
})
const presentationActive = computed(() => themeStore.presentationMode)
</script>

<template>
  <div
    class="flex items-center justify-between px-3 h-full text-xs select-none hide-in-presentation"
    style="background: var(--bg-secondary); color: var(--text-secondary); border-color: var(--border-color); border-top: 1px solid;"
  >
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-1.5">
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="stepStore.state === 'running' ? 'bg-success animate-pulse' : stepStore.state === 'error' ? 'bg-red-400' : 'bg-slate-500'"
        />
        <span>
          {{ stepStore.state === 'idle' ? '就绪' : stepStore.state === 'running' ? '执行中' : stepStore.state === 'paused' ? '已暂停' : stepStore.state === 'error' ? '错误' : '已完成' }}
        </span>
      </div>
      <div class="flex items-center gap-1" title="代码语言">
        <Code2 class="w-3 h-3" />
        <span>{{ language }}</span>
      </div>
      <div class="flex items-center gap-1" title="总行数">
        <span>共 <b style="color: var(--text-primary);">{{ total }}</b> 行</span>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div
        class="flex items-center gap-1.5 px-2 py-0.5 rounded"
        :style="{ background: isConnected ? 'rgba(16, 185, 129, 0.1)' : undefined }"
      >
        <Radio
          v-if="isConnected"
          class="w-3 h-3 text-success"
        />
        <WifiOff v-else class="w-3 h-3 opacity-60" />
        <span :style="{ color: isConnected ? 'var(--success)' : undefined }">
          {{ isConnected ? `${syncStore.channelId} · ${roleLabel}` : '离线' }}
        </span>
        <span v-if="isConnected" class="opacity-60">({{ syncStore.clientCount }})</span>
      </div>
      <div class="flex items-center gap-1 cursor-pointer" @click="themeStore.cycleTheme" title="切换主题">
        <Palette class="w-3 h-3" />
        <span>{{ theme }}</span>
      </div>
      <div title="光标位置">
        行 <b style="color: var(--text-primary);">{{ position.line }}</b>
        <span class="opacity-60">,</span>
        列 <b style="color: var(--text-primary);">{{ position.col }}</b>
      </div>
      <div class="opacity-60">UTF-8</div>
      <button
        class="flex items-center gap-1 hover:text-brand-400 transition-colors"
        title="切换演示模式"
        @click="themeStore.togglePresentationMode"
      >
        <component :is="presentationActive ? Minimize2 : Fullscreen" class="w-3 h-3" />
        <span>{{ presentationActive ? '退出演示' : '演示模式' }}</span>
      </button>
    </div>
  </div>
</template>
