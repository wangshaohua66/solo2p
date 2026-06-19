<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useEditorStore } from '@/stores/editor'
import { useExecution } from '@/composables/useExecution'
import { LANGUAGES, type ThemeName } from '@/types'
import {
  FilePlus, FolderOpen, Moon, Sun, Contrast,
  Maximize2, Minimize2, ZoomIn, ZoomOut,
  PlayCircle, Download, PanelLeftClose, PanelLeftOpen,
  PanelRightOpen, PanelRightClose, Settings, Layers
} from 'lucide-vue-next'

const themeStore = useThemeStore()
const editorStore = useEditorStore()
const execution = useExecution()
const showThemeMenu = ref(false)
const showFileMenu = ref(false)
const showZoomMenu = ref(false)
const isRunning = ref(false)

const presentationActive = computed(() => themeStore.presentationMode)
const currentTheme = computed(() => themeStore.currentTheme)
const sidebarOpen = computed(() => themeStore.sidebarOpen)
const consoleOpen = computed(() => themeStore.consoleOpen)
const fontSize = computed(() => themeStore.fontSize)
const activeFile = computed(() => editorStore.activeFile)

const themes: Array<{ id: ThemeName; icon: any; label: string }> = [
  { id: 'dark', icon: Moon, label: '深色' },
  { id: 'light', icon: Sun, label: '浅色' },
  { id: 'high-contrast', icon: Contrast, label: '高对比度' }
]

async function runCode() {
  if (isRunning.value || !activeFile.value) return
  isRunning.value = true
  await execution.run(activeFile.value.content, { timeout: 10000 })
  isRunning.value = false
}

function newFile() {
  editorStore.createFile()
}

function openFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.js,.ts,.py,.json,.md,.html,.css,.go,.java,.rs,.cpp,.c,.sql,.txt'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const langMatch = LANGUAGES.find(l => file.name.toLowerCase().endsWith(l.ext))
    editorStore.createFile(file.name, langMatch?.id || 'javascript', text)
  }
  input.click()
}

function setTheme(t: ThemeName) {
  themeStore.setTheme(t)
  showThemeMenu.value = false
}

function exportCurrent() {
  if (!activeFile.value) return
  const blob = new Blob([activeFile.value.content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = activeFile.value.name
  a.click()
  URL.revokeObjectURL(url)
}

function closeMenu() {
  showThemeMenu.value = false
  showFileMenu.value = false
  showZoomMenu.value = false
}

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement
  if (!t.closest('.menu-root')) closeMenu()
})

const { mockApi } = execution
mockApi('/api/users', [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }])
mockApi('/api/config', { version: '1.0.0', env: 'demo' })
</script>

<template>
  <header
    class="flex items-center justify-between px-3 gap-3 h-full hide-in-presentation"
    style="background: var(--bg-secondary); border-color: var(--border-color); border-bottom: 1px solid;"
  >
    <div class="flex items-center gap-1.5">
      <div
        class="flex items-center gap-1.5 px-2 py-1 rounded-md font-bold text-base"
        style="background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(236,72,153,0.15));"
      >
        <div
          class="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-sm"
          style="background: linear-gradient(135deg, #6366F1, #EC4899);"
        >
          <span v-text="'&#60;&#47;&#62;'" />
        </div>
        <span
          class="font-bold tracking-tight"
          style="background: linear-gradient(135deg, #818CF8, #F472B6); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;"
        >CodeStage</span>
      </div>

      <div class="w-px h-5 mx-1.5" style="background: var(--border-color);" />

      <div class="menu-root relative">
        <button
          class="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-700/30 text-sm transition-colors"
          style="color: var(--text-secondary);"
          @click.stop="showFileMenu = !showFileMenu"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>文件</span>
        </button>
        <div
          v-if="showFileMenu"
          class="card absolute top-full left-0 mt-1 w-44 py-1 z-40 animate-fade-in-up"
        >
          <button
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-700/40 transition-colors"
            style="color: var(--text-primary);"
            @click="newFile"
          >
            <FilePlus class="w-3.5 h-3.5" />
            新建文件
            <span class="ml-auto text-[10px] opacity-50">Ctrl+N</span>
          </button>
          <button
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-700/40 transition-colors"
            style="color: var(--text-primary);"
            @click="openFile"
          >
            <FolderOpen class="w-3.5 h-3.5" />
            打开文件
            <span class="ml-auto text-[10px] opacity-50">Ctrl+O</span>
          </button>
          <div class="my-1 divider" />
          <button
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-700/40 transition-colors"
            :class="{ 'opacity-40 cursor-not-allowed': !activeFile }"
            :disabled="!activeFile"
            style="color: var(--text-primary);"
            @click="exportCurrent"
          >
            <Download class="w-3.5 h-3.5" />
            导出当前
          </button>
        </div>
      </div>

      <button
        class="btn-icon"
        :style="{ color: sidebarOpen ? 'var(--accent-color)' : undefined }"
        title="切换侧边栏"
        @click="themeStore.toggleSidebar"
      >
        <component :is="sidebarOpen ? PanelLeftClose : PanelLeftOpen" class="w-4 h-4" />
      </button>
    </div>

    <div class="flex items-center gap-1.5 flex-1 justify-center">
      <button
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-md font-medium text-sm transition-all"
        :class="isRunning ? 'opacity-60' : ''"
        :disabled="isRunning"
        style="background: linear-gradient(135deg, #10B981, #059669); color: white; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);"
        @click="runCode"
      >
        <PlayCircle class="w-4 h-4" :class="isRunning ? 'animate-pulse' : ''" />
        运行代码
      </button>
    </div>

    <div class="flex items-center gap-1">
      <div class="menu-root relative">
        <button
          class="btn-icon"
          title="字体大小"
          @click.stop="showZoomMenu = !showZoomMenu"
        >
          <span class="font-mono text-xs font-bold" style="color: var(--text-secondary);">A</span>
        </button>
        <div
          v-if="showZoomMenu"
          class="card absolute top-full right-0 mt-1 w-40 py-1.5 px-2 z-40 animate-fade-in-up"
        >
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs" style="color: var(--text-secondary);">字号</span>
            <span class="text-sm font-mono font-bold" style="color: var(--text-primary);">{{ fontSize }}px</span>
          </div>
          <div class="flex items-center gap-1">
            <button class="btn-icon flex-1" title="减小" @click="themeStore.decreaseFontSize">
              <ZoomOut class="w-3.5 h-3.5" />
            </button>
            <button class="btn-icon flex-1" title="增大" @click="themeStore.increaseFontSize">
              <ZoomIn class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div class="menu-root relative">
        <button
          class="btn-icon relative"
          title="切换主题"
          @click.stop="showThemeMenu = !showThemeMenu"
        >
          <component :is="themes.find(t => t.id === currentTheme)?.icon || Moon" class="w-4 h-4" />
        </button>
        <div
          v-if="showThemeMenu"
          class="card absolute top-full right-0 mt-1 w-40 py-1 z-40 animate-fade-in-up"
        >
          <button
            v-for="t in themes"
            :key="t.id"
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-700/40 transition-colors"
            :style="{ color: currentTheme === t.id ? 'var(--accent-color)' : 'var(--text-primary)' }"
            @click="setTheme(t.id)"
          >
            <component :is="t.icon" class="w-3.5 h-3.5" />
            {{ t.label }}
            <span v-if="currentTheme === t.id" class="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
          </button>
        </div>
      </div>

      <button
        class="btn-icon"
        :style="{ color: consoleOpen ? 'var(--accent-color)' : undefined }"
        title="切换控制台"
        @click="themeStore.toggleConsole"
      >
        <component :is="consoleOpen ? PanelRightClose : PanelRightOpen" class="w-4 h-4" />
      </button>

      <button
        class="btn-icon"
        :style="{ color: presentationActive ? 'var(--accent-color)' : undefined }"
        title="演示模式 (F11)"
        @click="themeStore.togglePresentationMode"
      >
        <component :is="presentationActive ? Minimize2 : Maximize2" class="w-4 h-4" />
      </button>

      <div class="w-px h-5 mx-1" style="background: var(--border-color);" />
      <button
        class="btn-icon"
        title="更多"
      >
        <Settings class="w-4 h-4" />
      </button>
    </div>
  </header>
</template>
