<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useOutputStore } from '@/stores/output'
import { useEditorStore } from '@/stores/editor'
import type { LogLevel } from '@/types'
import {
  Trash2, WrapText, Scroll, Filter,
  AlertCircle, AlertTriangle, Info, Bug, Terminal
} from 'lucide-vue-next'

defineProps<{
  headerExtra?: any
}>()

const outputStore = useOutputStore()
const editorStore = useEditorStore()
const scrollRef = ref<HTMLElement | null>(null)
const levels: Array<{ id: LogLevel | 'all'; label: string; icon: any }> = [
  { id: 'all', label: '全部', icon: Filter },
  { id: 'log', label: 'Log', icon: Terminal },
  { id: 'info', label: 'Info', icon: Info },
  { id: 'warn', label: 'Warn', icon: AlertTriangle },
  { id: 'error', label: 'Error', icon: AlertCircle },
  { id: 'debug', label: 'Debug', icon: Bug }
]

const filteredLogs = computed(() => outputStore.filteredLogs)
const wordWrap = computed(() => outputStore.wordWrap)
const autoScroll = computed(() => outputStore.autoScroll)
const counts = computed(() => {
  const all = outputStore.logs
  return {
    error: all.filter(l => l.level === 'error').length,
    warn: all.filter(l => l.level === 'warn').length
  }
})

function formatArgs(args: any[]): string {
  return outputStore.formatArgs(args)
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function clear() {
  outputStore.clearLogs(editorStore.activeFileId ?? undefined)
}

function levelStyle(level: LogLevel) {
  switch (level) {
    case 'error': return { color: '#f87171', iconBg: 'rgba(239,68,68,0.15)' }
    case 'warn': return { color: '#fbbf24', iconBg: 'rgba(245,158,11,0.15)' }
    case 'info': return { color: '#60a5fa', iconBg: 'rgba(59,130,246,0.15)' }
    case 'debug': return { color: '#a78bfa', iconBg: 'rgba(139,92,246,0.15)' }
    default: return { color: 'var(--text-primary)', iconBg: 'var(--bg-tertiary)' }
  }
}

function levelIcon(level: LogLevel) {
  switch (level) {
    case 'error': return AlertCircle
    case 'warn': return AlertTriangle
    case 'info': return Info
    case 'debug': return Bug
    default: return Terminal
  }
}

let scrollTimer: ReturnType<typeof setTimeout> | null = null
function doAutoScroll() {
  if (!autoScroll.value) return
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  }, 10)
}

watch(filteredLogs, () => doAutoScroll(), { deep: true, flush: 'post' })

onMounted(() => { doAutoScroll() })
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      class="flex items-center justify-between px-3 py-2 border-b"
      style="border-color: var(--border-color);"
    >
      <div class="flex items-center gap-2">
        <Terminal class="w-3.5 h-3.5 text-success" />
        <span class="text-sm font-medium" style="color: var(--text-primary);">控制台</span>
        <span
          v-if="counts.error > 0"
          class="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style="background: rgba(239,68,68,0.15); color: #f87171;"
        >
          {{ counts.error }} 错误
        </span>
        <span
          v-if="counts.warn > 0"
          class="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style="background: rgba(245,158,11,0.15); color: #fbbf24;"
        >
          {{ counts.warn }} 警告
        </span>
      </div>
      <div class="flex items-center gap-1">
        <select
          :value="outputStore.filterLevel"
          @change="outputStore.setFilterLevel(($event.target as any).value as any)"
          class="text-[11px] px-1.5 py-1 rounded border-none outline-none cursor-pointer"
          style="background: var(--bg-tertiary); color: var(--text-secondary);"
        >
          <option v-for="l in levels" :key="l.id" :value="l.id">{{ l.label }}</option>
        </select>
        <button
          class="btn-icon"
          :title="wordWrap ? '关闭自动换行' : '自动换行'"
          :style="{ color: wordWrap ? 'var(--accent-color)' : undefined }"
          @click="outputStore.toggleWordWrap"
        >
          <WrapText class="w-3.5 h-3.5" />
        </button>
        <button
          class="btn-icon"
          :title="autoScroll ? '关闭自动滚动' : '自动滚动'"
          :style="{ color: autoScroll ? 'var(--accent-color)' : undefined }"
          @click="outputStore.toggleAutoScroll"
        >
          <Scroll class="w-3.5 h-3.5" />
        </button>
        <button
          class="btn-icon"
          title="清空输出"
          :class="filteredLogs.length === 0 ? 'opacity-40 cursor-not-allowed' : ''"
          @click="clear"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    <div
      ref="scrollRef"
      class="flex-1 overflow-auto scrollbar-thin font-mono text-[11.5px] leading-relaxed"
      style="background: #0B1120;"
    >
      <div
        v-if="filteredLogs.length === 0"
        class="h-full flex flex-col items-center justify-center text-xs opacity-40 py-10"
        style="color: var(--text-secondary);"
      >
        <Terminal class="w-8 h-8 mb-1.5" />
        <div>暂无输出</div>
        <div class="mt-0.5 text-[10px]">运行代码后 console 输出将显示在此</div>
      </div>
      <div v-else class="p-2 space-y-0.5">
        <div
          v-for="log in filteredLogs"
          :key="log.id"
          class="flex items-start gap-1.5 px-1 py-0.5 rounded hover:bg-slate-800/50 group break-words"
          :class="{ 'whitespace-pre-wrap': wordWrap, 'whitespace-nowrap': !wordWrap }"
        >
          <span
            class="flex-shrink-0 mt-0.5 w-4 h-4 rounded flex items-center justify-center"
            :style="{ background: levelStyle(log.level).iconBg }"
          >
            <component
              :is="levelIcon(log.level)"
              class="w-2.5 h-2.5"
              :style="{ color: levelStyle(log.level).color }"
            />
          </span>
          <span class="flex-shrink-0 opacity-40 text-[10px] mt-0.5 w-[64px] text-right select-none">
            {{ formatTime(log.timestamp) }}
          </span>
          <span
            class="flex-1 min-w-0"
            :style="{ color: levelStyle(log.level).color }"
          >
            {{ formatArgs(log.args) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
