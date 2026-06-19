<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick, provide } from 'vue'
import { PanelRightClose, PanelRightOpen } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'
import { useEditorStore } from '@/stores/editor'
import { useStepRunner } from '@/composables/useStepRunner'
import { usePresentation } from '@/composables/usePresentation'
import { useShortcuts } from '@/composables/useShortcuts'
import { useGsap } from '@/composables/useGsap'
import { useResponsive } from '@/composables/useResponsive'
import { InjectKeys, type RunnerContext } from '@/types'

import ToolBar from '@/components/layout/ToolBar.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import ResizableSidebar from '@/components/layout/ResizableSidebar.vue'

import EditorTabs from '@/components/editor/EditorTabs.vue'
import CodeEditor from '@/components/editor/CodeEditor.vue'
import StepRunner from '@/components/step-runner/StepRunner.vue'
import SnippetPanel from '@/components/snippets/SnippetPanel.vue'
import LiveAnnotation from '@/components/annotation/LiveAnnotation.vue'
import SyncBoard from '@/components/sync/SyncBoard.vue'
import OutputConsole from '@/components/output/OutputConsole.vue'

const themeStore = useThemeStore()
const editorStore = useEditorStore()
const gsapApi = useGsap()
const responsive = useResponsive()

const appRef = ref<HTMLElement | null>(null)
const editorRef = ref<InstanceType<typeof CodeEditor> | null>(null)
const editorContainerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

const runner = useStepRunner()
usePresentation(appRef)
const shortcuts = useShortcuts()

const sidebarOpen = computed(() => themeStore.sidebarOpen)
const consoleOpen = computed(() => themeStore.consoleOpen)
const isPresentation = computed(() => themeStore.presentationMode)
const isCompact = computed(() => responsive.isNotebook.value)

const editorAreaStyle = computed(() => ({
  width: consoleOpen.value ? '70%' : '100%',
  flexShrink: 0
}))

onMounted(() => {
  themeStore.applyThemeClass()
  nextTick(() => editorStore.init())

  shortcuts.register('Ctrl+F5', () => {}, { preventDefault: true })
  shortcuts.register('F5', () => {}, { preventDefault: true })
  shortcuts.register('Shift+F5', () => { runner.reset() }, { preventDefault: true })
  shortcuts.register('F8', () => { runner.stepContinue() }, { preventDefault: true })
  shortcuts.register('F10', () => { runner.stepOver() }, { preventDefault: true })
  shortcuts.register('F11', () => { themeStore.togglePresentationMode() }, { preventDefault: true })
  shortcuts.register('Escape', () => {
    if (themeStore.presentationMode) themeStore.exitPresentationMode()
  })
  shortcuts.register('Ctrl+N', () => { editorStore.createFile() }, { preventDefault: true })
  shortcuts.register('Ctrl+B', () => { themeStore.toggleSidebar() }, { preventDefault: true })
  shortcuts.register('Ctrl+J', () => { themeStore.toggleConsole() }, { preventDefault: true })
  shortcuts.register('Ctrl+T', () => { themeStore.cycleTheme() }, { preventDefault: true })
  shortcuts.register('Ctrl+Plus', () => { themeStore.increaseFontSize() }, { preventDefault: true })
  shortcuts.register('Ctrl+-', () => { themeStore.decreaseFontSize() }, { preventDefault: true })
  shortcuts.register('Ctrl+Shift+Z', () => {}, { preventDefault: true })

  shortcuts.register('Ctrl+F', () => {
    window.dispatchEvent(new CustomEvent('codestage:editor-find'))
  }, { preventDefault: true })
  shortcuts.register('Ctrl+H', () => {
    window.dispatchEvent(new CustomEvent('codestage:editor-replace'))
  }, { preventDefault: true })
  shortcuts.register('Ctrl+I', () => {
    window.dispatchEvent(new CustomEvent('codestage:editor-insert-snippet'))
  }, { preventDefault: true })

  shortcuts.register('Space', () => {
    if (themeStore.presentationMode) {
      runner.stepOver()
    }
  }, { preventDefault: true })
  shortcuts.register('ArrowRight', () => {
    if (themeStore.presentationMode) runner.stepOver()
  })
  shortcuts.register('ArrowLeft', () => {
    if (themeStore.presentationMode) runner.reset()
  })
  shortcuts.register('PageDown', () => {
    if (themeStore.presentationMode) runner.stepOver()
  }, { preventDefault: true })
  shortcuts.register('PageUp', () => {
    if (themeStore.presentationMode) runner.reset()
  }, { preventDefault: true })

  runner.onHighlight((line) => {
    editorRef.value?.highlightLine(line)
  })
  runner.onClear(() => {
    editorRef.value?.clearHighlight()
  })

  nextTick(() => {
    if (contentRef.value) {
      gsapApi.fadeInUp(contentRef.value, { duration: 0.4 })
    }
  })
})

watch(() => themeStore.presentationMode, (active) => {
  if (active) {
    nextTick(() => {
      if (appRef.value) {
        gsapApi.gsap.fromTo(appRef.value,
          { opacity: 0.85, scale: 0.98 },
          { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }
        )
      }
    })
  }
})

watch(() => themeStore.currentTheme, () => {
  themeStore.applyThemeClass()
}, { flush: 'post' })

const runnerCtx: RunnerContext = {
  state: runner.state,
  currentLine: runner.currentLine,
  progress: runner.progress,
  start: () => runner.start(),
  pause: runner.pause,
  resume: runner.resume,
  reset: runner.reset,
  stepOver: runner.stepOver,
  stepContinue: runner.stepContinue,
  runSelection: runner.runSelection,
  runAll: runner.runAll,
  toggleBreakpoint: runner.toggleBreakpoint,
  clearBreakpoints: runner.clearBreakpoints
}

provide(InjectKeys.RunnerContext, runnerCtx)
</script>

<template>
  <div
    ref="appRef"
    class="w-full h-full flex flex-col"
    :class="{ 'presentation-mode': isPresentation, 'compact-mode': isCompact }"
  >
    <div style="height: var(--toolbar-height); flex-shrink: 0;">
      <ToolBar />
    </div>

    <div ref="contentRef" class="flex-1 flex overflow-hidden min-h-0 relative">
      <Transition name="sidebar">
        <div v-show="sidebarOpen" class="h-full flex-shrink-0 hide-in-presentation">
          <ResizableSidebar>
            <template #default>
              <SnippetPanel />
            </template>
          </ResizableSidebar>
        </div>
      </Transition>

      <div class="flex flex-col overflow-hidden min-w-0" :style="editorAreaStyle">
        <div style="height: var(--tabbar-height); flex-shrink: 0;">
          <EditorTabs />
        </div>

        <div
          ref="editorContainerRef"
          class="flex-1 relative overflow-hidden min-h-0 flex"
        >
          <div class="flex-1 relative min-h-0">
            <CodeEditor ref="editorRef" />
            <LiveAnnotation
              :container-ref="editorContainerRef as any"
            />
          </div>
        </div>

        <div class="hide-in-presentation" style="height: 36px; flex-shrink: 0;">
          <StepRunner />
        </div>
      </div>

      <Transition name="console">
        <div
          v-show="consoleOpen"
          class="h-full hide-in-presentation overflow-hidden"
          style="width: 30%; flex-shrink: 0;"
        >
          <div class="flex flex-col h-full" style="border-left: 1px solid var(--border-color);">
            <div class="flex items-center gap-2 px-3 h-9 flex-shrink-0" style="border-bottom: 1px solid var(--border-color); background: var(--bg-secondary);">
              <div class="text-xs font-medium" style="color: var(--text-primary);">
                同步 / 输出
              </div>
              <div class="text-[10px] px-1.5 py-0.5 rounded" style="background: var(--bg-tertiary); color: var(--text-secondary);">
                30%
              </div>
              <button
                class="ml-auto btn-icon"
                title="关闭输出面板 (Ctrl+J)"
                @click="themeStore.toggleConsole()"
              >
                <PanelRightClose class="w-3.5 h-3.5" />
              </button>
            </div>
            <div class="flex flex-col flex-1 overflow-hidden min-h-0">
              <div class="overflow-hidden" style="height: 40%; border-bottom: 1px solid var(--border-color);">
                <SyncBoard />
              </div>
              <div class="flex-1 overflow-hidden min-h-0">
                <OutputConsole />
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <button
        v-if="!consoleOpen && !isPresentation"
        class="console-open-btn hide-in-presentation absolute right-2 top-1/2 -translate-y-1/2 z-10"
        title="打开输出面板 (Ctrl+J)"
        @click="themeStore.toggleConsole()"
      >
        <PanelRightOpen class="w-4 h-4" />
      </button>
    </div>

    <div style="height: var(--statusbar-height); flex-shrink: 0;">
      <StatusBar />
    </div>
  </div>
</template>

<style scoped>
.sidebar-enter-active,
.sidebar-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
  margin-left: -40px;
}
.console-enter-active,
.console-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.console-enter-from,
.console-leave-to {
  opacity: 0;
  width: 0 !important;
}
.console-open-btn {
  width: 32px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px 0 0 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-right: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.console-open-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transform: translateX(-2px);
}
</style>
