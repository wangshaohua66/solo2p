<script setup lang="ts">
import { ref, watch, onMounted, nextTick, provide, inject, onBeforeUnmount } from 'vue'
import { useMonaco } from '@/composables/useMonaco'
import { useThemeStore } from '@/stores/theme'
import { useEditorStore } from '@/stores/editor'
import { InjectKeys, type EditorContext, type EditorPosition } from '@/types'
import { debounce } from '@/utils'

const containerRef = ref<HTMLElement | null>(null)
const themeStore = useThemeStore()
const editorStore = useEditorStore()
const initialInjected = inject(InjectKeys.EditorContext, null)

const monacoApi = useMonaco(containerRef)

const {
  isReady,
  loadingTime,
  initMonaco,
  getContent,
  setContent,
  getSelection,
  getPosition,
  setPosition,
  focus,
  revealLine,
  setLineHighlight,
  clearLineHighlight,
  updateBreakpoints,
  setLanguage,
  updateFontSize,
  updateTheme,
  onContentChange,
  onPositionChange,
  onLineDoubleClick,
  triggerFormat,
  layout
} = monacoApi

const mounted = ref(false)

const context: EditorContext = {
  getContent,
  setContent,
  getSelection: () => {
    const sel = getSelection()
    if (!sel) return null
    return {
      startLine: sel.startLine,
      startCol: sel.startCol,
      endLine: sel.endLine,
      endCol: sel.endCol,
      text: sel.text
    }
  },
  getPosition: () => {
    const pos = getPosition()
    return pos || null
  },
  setPosition,
  focus,
  revealLine,
  addDecoration: () => {},
  removeDecoration: () => {},
  onContentChange,
  onPositionChange,
  onLineDoubleClick
}

if (!initialInjected) {
  provide(InjectKeys.EditorContext, context)
}

const debouncedUpdate = debounce((code: string) => {
  editorStore.updateContent(code)
}, 150)

onMounted(async () => {
  await nextTick()
  editorStore.init()
  const active = editorStore.activeFile
  if (active) {
    initMonaco(active.content, active.language)
  }
  mounted.value = true

  onContentChange((code) => {
    debouncedUpdate(code)
  })

  onPositionChange((pos: EditorPosition) => {
    editorStore.updateCursor(pos.lineNumber, pos.column)
  })

  onLineDoubleClick((line: number) => {
    editorStore.toggleBreakpoint(line)
  })

  updateBreakpoints(editorStore.activeBreakpoints.map(b => b.lineNumber))
})

watch(() => editorStore.activeFileId, (newId, oldId) => {
  if (!isReady.value || !newId || newId === oldId) return
  const file = editorStore.files.find(f => f.id === newId)
  if (file) {
    setContent(file.content, true)
    setLanguage(file.language)
    updateBreakpoints(file.breakpoints.map(b => b.lineNumber))
  }
}, { flush: 'post' })

watch(() => themeStore.fontSize, (size) => {
  if (isReady.value) updateFontSize(size)
})

watch(() => themeStore.currentTheme, (t) => {
  if (isReady.value) updateTheme(t)
})

watch(() => editorStore.activeBreakpoints, (bps) => {
  if (isReady.value) updateBreakpoints(bps.map(b => b.lineNumber))
}, { deep: true })

watch(() => editorStore.activeLanguage, (lang) => {
  if (isReady.value && lang) setLanguage(lang)
})

function onResize() {
  if (isReady.value) layout()
}

window.addEventListener('resize', onResize)
window.addEventListener('panel-resized', onResize)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('panel-resized', onResize)
})

const highlightLine = ref(0)
function doHighlight(line: number) {
  highlightLine.value = line
  setLineHighlight(line)
}
function doClearHighlight() {
  highlightLine.value = 0
  clearLineHighlight()
}

defineExpose({
  monaco: monacoApi.editor,
  model: monacoApi.model,
  isReady,
  loadingTime,
  ...context,
  highlightLine: doHighlight,
  clearHighlight: doClearHighlight,
  triggerFormat,
  layout,
  editorCtx: context
})
</script>

<template>
  <div class="w-full h-full relative" style="background: var(--bg-primary);">
    <div
      ref="containerRef"
      class="monaco-editor-container w-full h-full"
    />
    <div
      v-if="!mounted"
      class="absolute inset-0 flex items-center justify-center text-sm"
      style="color: var(--text-secondary); background: var(--bg-primary);"
    >
      <svg class="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
      </svg>
      编辑器加载中...
    </div>
    <div
      v-if="mounted && loadingTime > 0"
      class="absolute top-2 right-3 text-[10px] px-1.5 py-0.5 rounded opacity-60 pointer-events-none"
      style="background: var(--bg-tertiary); color: var(--text-secondary);"
    >
      {{ loadingTime }}ms
    </div>
  </div>
</template>
