<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick, provide } from 'vue'
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
import ResizablePanel from '@/components/layout/ResizablePanel.vue'

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
const sidebarWidth = computed(() => themeStore.sidebarWidth)
const consoleOpen = computed(() => themeStore.consoleOpen)
const isPresentation = computed(() => themeStore.presentationMode)
const isCompact = computed(() => responsive.isMobile.value || responsive.isTablet.value)

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

    <div ref="contentRef" class="flex-1 flex overflow-hidden min-h-0">
      <Transition name="sidebar">
        <div v-show="sidebarOpen" class="h-full flex-shrink-0 hide-in-presentation">
          <ResizableSidebar
            :initial-width="sidebarWidth"
            :persist-key="'sidebar'"
            @resized="themeStore.setSidebarWidth($event)"
          >
            <template #default>
              <SnippetPanel />
            </template>
          </ResizableSidebar>
        </div>
      </Transition>

      <div class="flex-1 flex flex-col overflow-hidden min-w-0">
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

      <div class="h-full flex hide-in-presentation">
        <ResizablePanel
          v-model="consoleOpen"
          direction="horizontal"
          :initial-size="420"
          :min-size="300"
        >
          <template #header>
            <div class="flex items-center gap-2 flex-1">
              <div class="text-xs font-medium" style="color: var(--text-primary);">
                同步 / 输出
              </div>
            </div>
          </template>
          <template #default>
            <div class="flex flex-col h-full">
              <div class="max-h-[40%] overflow-hidden" style="border-color: var(--border-color); border-bottom: 1px solid;">
                <SyncBoard />
              </div>
              <div class="flex-1 overflow-hidden min-h-0">
                <OutputConsole />
              </div>
            </div>
          </template>
        </ResizablePanel>
      </div>
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
</style>
