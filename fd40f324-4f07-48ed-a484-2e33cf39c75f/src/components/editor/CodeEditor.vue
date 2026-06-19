<script setup lang="ts">
import { ref, watch, onMounted, nextTick, provide, inject, onBeforeUnmount, computed } from 'vue'
import { useMonaco } from '@/composables/useMonaco'
import { useExecution } from '@/composables/useExecution'
import { useThemeStore } from '@/stores/theme'
import { useEditorStore } from '@/stores/editor'
import { InjectKeys, type EditorContext, type EditorPosition } from '@/types'
import { debounce } from '@/utils'
import FindReplacePanel from './FindReplacePanel.vue'
import SelectionRunButton from './SelectionRunButton.vue'
import EditorContextMenu from './EditorContextMenu.vue'
import SnippetPicker from './SnippetPicker.vue'
import { Search } from 'lucide-vue-next'

const containerRef = ref<HTMLElement | null>(null)
const themeStore = useThemeStore()
const editorStore = useEditorStore()
const execution = useExecution()
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
  onSelectionChange,
  onContextMenu,
  openFind,
  openReplace,
  findNext,
  findPrev,
  replaceAll,
  replaceCurrent,
  insertSnippet,
  getSelectedText,
  triggerFormat,
  layout
} = monacoApi

const mounted = ref(false)
const showFindPanel = ref(false)
const replaceMode = ref(false)
const matchCount = ref(0)
const currentMatch = ref(0)
const showSelectionBtn = ref(false)
const selectionBtnPos = ref({ x: 0, y: 0 })
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const hasSelection = ref(false)
const showSnippetPicker = ref(false)

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

  onSelectionChange((sel) => {
    hasSelection.value = sel.hasSelection
    if (sel.hasSelection && sel.text.split('\n').length >= 1 && sel.text.trim().length > 0) {
      showSelectionBtn.value = true
      const container = containerRef.value
      if (container) {
        const rect = container.getBoundingClientRect()
        selectionBtnPos.value = {
          x: rect.width / 2,
          y: 40
        }
      }
    } else {
      showSelectionBtn.value = false
    }
  })

  onContextMenu((e) => {
    contextMenuPos.value = { x: e.x, y: e.y }
    showContextMenu.value = true
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

function onGlobalFind() {
  toggleFind()
}

function onGlobalReplace() {
  toggleReplace()
}

function onGlobalInsertSnippet() {
  openSnippetPicker()
}

window.addEventListener('resize', onResize)
window.addEventListener('panel-resized', onResize)
window.addEventListener('codestage:editor-find', onGlobalFind)
window.addEventListener('codestage:editor-replace', onGlobalReplace)
window.addEventListener('codestage:editor-insert-snippet', onGlobalInsertSnippet)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('panel-resized', onResize)
  window.removeEventListener('codestage:editor-find', onGlobalFind)
  window.removeEventListener('codestage:editor-replace', onGlobalReplace)
  window.removeEventListener('codestage:editor-insert-snippet', onGlobalInsertSnippet)
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

function toggleFind() {
  showFindPanel.value = !showFindPanel.value
  replaceMode.value = false
  if (showFindPanel.value) {
    nextTick(() => openFind())
  }
}

function toggleReplace() {
  showFindPanel.value = true
  replaceMode.value = true
  nextTick(() => openReplace())
}

function onSearch(query: string, _options: { caseSensitive: boolean; wholeWord: boolean; regex: boolean }) {
  const text = getContent()
  if (!query) {
    matchCount.value = 0
    currentMatch.value = 0
    return
  }
  try {
    let pattern: RegExp
    if (_options.regex) {
      pattern = new RegExp(query, _options.caseSensitive ? 'g' : 'gi')
    } else if (_options.wholeWord) {
      pattern = new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, _options.caseSensitive ? 'g' : 'gi')
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      pattern = new RegExp(escaped, _options.caseSensitive ? 'g' : 'gi')
    }
    const matches = text.match(pattern)
    matchCount.value = matches ? matches.length : 0
    currentMatch.value = matches ? 1 : 0
    findNext()
  } catch {
    matchCount.value = 0
    currentMatch.value = 0
  }
}

function onReplace(query: string, replaceValue: string) {
  replaceCurrent(query, replaceValue)
}

function onReplaceAll(query: string, replaceValue: string) {
  replaceAll(query, replaceValue)
  matchCount.value = 0
  currentMatch.value = 0
}

async function runSelection() {
  const selected = getSelectedText()
  if (!selected.trim()) return
  showSelectionBtn.value = false
  await execution.run(selected, { timeout: 10000 })
}

function onInsertSnippet(snippet: any) {
  insertSnippet(snippet.code)
}

function onCut() {
  document.execCommand('cut')
}

function onCopy() {
  document.execCommand('copy')
}

async function onPaste() {
  try {
    const text = await navigator.clipboard.readText()
    insertSnippet(text)
  } catch { /* ignore */ }
}

function onDuplicate() {
  const sel = getSelection()
  if (sel && sel.text) {
    insertSnippet(sel.text + '\n')
  }
}

function onFormat() {
  triggerFormat()
}

function openSnippetPicker() {
  showSnippetPicker.value = true
}

const showRunButton = computed(() => showSelectionBtn.value && hasSelection.value)

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
  toggleFind,
  toggleReplace,
  openSnippetPicker,
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

    <button
      v-if="mounted && !showFindPanel"
      class="absolute top-2 right-3 z-20 btn-icon"
      :style="{ marginTop: loadingTime > 0 ? '20px' : '0' }"
      title="查找/替换 (Ctrl+F)"
      @click="toggleFind"
    >
      <Search class="w-3.5 h-3.5" />
    </button>

    <FindReplacePanel
      v-model:visible="showFindPanel"
      :match-count="matchCount"
      :current-match="currentMatch"
      @search="onSearch"
      @replace="onReplace"
      @replace-all="onReplaceAll"
      @next="findNext"
      @prev="findPrev"
    />

    <SelectionRunButton
      :visible="showRunButton"
      :x="selectionBtnPos.x"
      :y="selectionBtnPos.y"
      @run="runSelection"
      @dismiss="showSelectionBtn = false"
    />

    <EditorContextMenu
      v-model:visible="showContextMenu"
      :x="contextMenuPos.x"
      :y="contextMenuPos.y"
      :has-selection="hasSelection"
      @insert-snippet="openSnippetPicker"
      @cut="onCut"
      @copy="onCopy"
      @paste="onPaste"
      @duplicate="onDuplicate"
      @format="onFormat"
    />

    <SnippetPicker
      v-model:visible="showSnippetPicker"
      @insert="onInsertSnippet"
    />
  </div>
</template>
