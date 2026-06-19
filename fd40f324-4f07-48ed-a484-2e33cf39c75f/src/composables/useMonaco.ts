import { ref, shallowRef, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import * as monaco from 'monaco-editor'
import { useThemeStore } from '@/stores/theme'
import type { EditorPosition, EditorSelection, LanguageId } from '@/types'

export function useMonaco(containerRef: Ref<HTMLElement | null>) {
  const themeStore = useThemeStore()

  const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const model = shallowRef<monaco.editor.ITextModel | null>(null)
  const decorationsRef = ref<string[]>([])
  const isReady = ref(false)
  const loadingTime = ref(0)

  const contentHandlers: Array<(code: string) => void> = []
  const positionHandlers: Array<(pos: EditorPosition) => void> = []
  const lineDoubleClickHandlers: Array<(line: number) => void> = []
  const selectionChangeHandlers: Array<(sel: { hasSelection: boolean; text: string; startLine: number; endLine: number }) => void> = []
  const contextMenuHandlers: Array<(e: { x: number; y: number; lineNumber: number; column: number }) => void> = []

  let disposeFns: Array<() => void> = []

  function initMonaco(initialContent: string, language: LanguageId) {
    if (!containerRef.value || editor.value) return

    const start = performance.now()

    monaco.editor.defineTheme('codestage-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1E293B',
        'editor.lineHighlightBackground': 'rgba(99, 102, 241, 0.15)',
        'editor.selectionBackground': 'rgba(99, 102, 241, 0.25)',
        'editorCursor.foreground': '#6366F1',
        'editorGutter.background': '#151F35',
        'editorLineNumber.foreground': '#64748B',
        'editorLineNumber.activeForeground': '#F8FAFC',
        'editorIndentGuide.background': '#334155',
        'editorIndentGuide.activeBackground': '#6366F1'
      }
    })

    monaco.editor.defineTheme('codestage-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.lineHighlightBackground': 'rgba(99, 102, 241, 0.12)',
        'editor.selectionBackground': 'rgba(99, 102, 241, 0.2)',
        'editorCursor.foreground': '#6366F1'
      }
    })

    monaco.editor.defineTheme('codestage-hc', {
      base: 'hc-black',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#000000',
        'editor.lineHighlightBackground': 'rgba(255, 215, 0, 0.25)',
        'editorCursor.foreground': '#FFD700'
      }
    })

    const opts: monaco.editor.IStandaloneEditorConstructionOptions = {
      value: initialContent,
      language,
      theme: getMonacoThemeName(themeStore.currentTheme),
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: themeStore.fontSize,
      lineHeight: themeStore.fontSize + 8,
      minimap: { enabled: true, renderCharacters: false, maxColumn: 120 },
      renderLineHighlight: 'all',
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      cursorBlinking: 'smooth',
      automaticLayout: true,
      folding: true,
      foldingStrategy: 'auto',
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      wordWrap: 'off',
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      formatOnType: true,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      },
      glyphMargin: true,
      padding: { top: 12, bottom: 12 },
      quickSuggestions: { other: true, comments: false, strings: false },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'smart',
      accessibilitySupport: 'off',
      find: {
        addExtraSpaceOnTop: true,
        autoFindInSelection: 'always'
      }
    }

    editor.value = monaco.editor.create(containerRef.value, opts)
    model.value = editor.value.getModel()

    const onContent = editor.value.onDidChangeModelContent(() => {
      const code = model.value?.getValue() || ''
      contentHandlers.forEach(cb => cb(code))
    })

    const onPos = editor.value.onDidChangeCursorPosition((e) => {
      positionHandlers.forEach(cb => cb({
        lineNumber: e.position.lineNumber,
        column: e.position.column
      }))
    })

    const onMouse = editor.value.onMouseDown((e) => {
      if (e.event.detail === 2 && e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
        const line = e.target.position?.lineNumber
        if (line) lineDoubleClickHandlers.forEach(cb => cb(line))
      }
      if (e.event.rightButton) {
        const pos = e.target.position
        if (pos) {
          contextMenuHandlers.forEach(cb => cb({
            x: e.event.posx,
            y: e.event.posy,
            lineNumber: pos.lineNumber,
            column: pos.column
          }))
        }
      }
    })

    const onSel = editor.value.onDidChangeCursorSelection((e) => {
      const sel = e.selection
      const hasSelection = sel.startLineNumber !== sel.endLineNumber || sel.startColumn !== sel.endColumn
      let text = ''
      if (hasSelection && model.value) {
        text = model.value.getValueInRange(sel)
      }
      selectionChangeHandlers.forEach(cb => cb({
        hasSelection,
        text,
        startLine: sel.startLineNumber,
        endLine: sel.endLineNumber
      }))
    })

    disposeFns = [onContent.dispose, onPos.dispose, onMouse.dispose, onSel.dispose]

    isReady.value = true
    loadingTime.value = Math.round(performance.now() - start)
  }

  function getMonacoThemeName(theme: string): string {
    switch (theme) {
      case 'light': return 'codestage-light'
      case 'high-contrast': return 'codestage-hc'
      default: return 'codestage-dark'
    }
  }

  function getContent(): string {
    return model.value?.getValue() || ''
  }

  function setContent(code: string, fromSync = false) {
    if (!model.value) return
    if (model.value.getValue() === code) return
    model.value.setValue(code)
    if (fromSync) {
      // skip store update to prevent loops
    }
  }

  function getSelection(): EditorSelection | null {
    if (!editor.value || !model.value) return null
    const sel = editor.value.getSelection()
    if (!sel) return null
    const text = model.value.getValueInRange(sel)
    return {
      startLine: sel.startLineNumber,
      startCol: sel.startColumn,
      endLine: sel.endLineNumber,
      endCol: sel.endColumn,
      text
    }
  }

  function getPosition(): EditorPosition | null {
    if (!editor.value) return null
    const pos = editor.value.getPosition()
    if (!pos) return null
    return { lineNumber: pos.lineNumber, column: pos.column }
  }

  function setPosition(line: number, col: number) {
    editor.value?.setPosition({ lineNumber: line, column: col })
    editor.value?.revealLineInCenter(line)
  }

  function focus() {
    editor.value?.focus()
  }

  function revealLine(line: number, center = true) {
    if (center) {
      editor.value?.revealLineInCenter(line, monaco.editor.ScrollType.Smooth)
    } else {
      editor.value?.revealLine(line, monaco.editor.ScrollType.Smooth)
    }
  }

  function addDecoration(line: number, key: string) {
    if (!editor.value || !model.value) return
    const delta: monaco.editor.IModelDeltaDecoration[] = [
      {
        range: new monaco.Range(line, 1, line, model.value.getLineMaxColumn(line)),
        options: {
          isWholeLine: true,
          className: `decoration-${key}`,
          linesDecorationsClassName: ''
        }
      }
    ]
    decorationsRef.value = editor.value.deltaDecorations(decorationsRef.value, delta)
  }

  function removeDecoration(_key: string) {
    if (!editor.value) return
    decorationsRef.value = editor.value.deltaDecorations(decorationsRef.value, [])
  }

  function setLineHighlight(line: number) {
    if (!editor.value || !model.value) return
    const delta: monaco.editor.IModelDeltaDecoration[] = [
      {
        range: new monaco.Range(line, 1, line, model.value.getLineMaxColumn(line)),
        options: {
          isWholeLine: true,
          className: 'line-highlight',
          linesDecorationsClassName: 'step-line-gutter'
        }
      }
    ]
    decorationsRef.value = editor.value.deltaDecorations(decorationsRef.value, delta)
  }

  function clearLineHighlight() {
    if (!editor.value) return
    decorationsRef.value = editor.value.deltaDecorations(decorationsRef.value, [])
  }

  function updateBreakpoints(lines: number[]) {
    if (!editor.value || !model.value) return
    const delta: monaco.editor.IModelDeltaDecoration[] = lines.map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'breakpoint-glyph',
        glyphMarginHoverMessage: { value: `断点: 第 ${line} 行` }
      }
    }))
    decorationsRef.value = editor.value.deltaDecorations(decorationsRef.value, delta)
  }

  function setLanguage(language: LanguageId) {
    if (model.value) {
      monaco.editor.setModelLanguage(model.value, language)
    }
  }

  function updateFontSize(size: number) {
    if (editor.value) {
      editor.value.updateOptions({
        fontSize: size,
        lineHeight: size + 8
      })
    }
  }

  function updateTheme(theme: string) {
    monaco.editor.setTheme(getMonacoThemeName(theme))
  }

  function onContentChange(cb: (code: string) => void): () => void {
    contentHandlers.push(cb)
    return () => {
      const idx = contentHandlers.indexOf(cb)
      if (idx >= 0) contentHandlers.splice(idx, 1)
    }
  }

  function onPositionChange(cb: (pos: EditorPosition) => void): () => void {
    positionHandlers.push(cb)
    return () => {
      const idx = positionHandlers.indexOf(cb)
      if (idx >= 0) positionHandlers.splice(idx, 1)
    }
  }

  function onLineDoubleClick(cb: (line: number) => void): () => void {
    lineDoubleClickHandlers.push(cb)
    return () => {
      const idx = lineDoubleClickHandlers.indexOf(cb)
      if (idx >= 0) lineDoubleClickHandlers.splice(idx, 1)
    }
  }

  function onSelectionChange(cb: (sel: { hasSelection: boolean; text: string; startLine: number; endLine: number }) => void): () => void {
    selectionChangeHandlers.push(cb)
    return () => {
      const idx = selectionChangeHandlers.indexOf(cb)
      if (idx >= 0) selectionChangeHandlers.splice(idx, 1)
    }
  }

  function onContextMenu(cb: (e: { x: number; y: number; lineNumber: number; column: number }) => void): () => void {
    contextMenuHandlers.push(cb)
    return () => {
      const idx = contextMenuHandlers.indexOf(cb)
      if (idx >= 0) contextMenuHandlers.splice(idx, 1)
    }
  }

  function openFind() {
    editor.value?.getAction('actions.find')?.run()
  }

  function closeFind() {
    editor.value?.trigger('codestage', 'closeFindWidget', null)
  }

  function openReplace() {
    editor.value?.trigger('codestage', 'editor.action.startFindReplaceAction', null)
  }

  function findNext() {
    editor.value?.getAction('editor.action.nextSelectionMatchFindAction')?.run()
    editor.value?.trigger('codestage', 'editor.action.nextMatchFindAction', null)
  }

  function findPrev() {
    editor.value?.trigger('codestage', 'editor.action.previousMatchFindAction', null)
  }

  function replaceAll(findValue: string, replaceValue: string) {
    if (!model.value || !findValue) return
    const fullText = model.value.getValue()
    const newText = fullText.split(findValue).join(replaceValue)
    model.value.applyEdits([{
      range: model.value.getFullModelRange(),
      text: newText,
      forceMoveMarkers: true
    }])
  }

  function replaceCurrent(findValue: string, replaceValue: string) {
    if (!editor.value || !findValue) return
    const sel = editor.value.getSelection()
    if (!sel) return
    const selectedText = model.value?.getValueInRange(sel) || ''
    if (selectedText === findValue) {
      model.value?.applyEdits([{
        range: sel,
        text: replaceValue,
        forceMoveMarkers: true
      }])
    }
    findNext()
  }

  function insertSnippet(code: string) {
    if (!editor.value) return
    const sel = editor.value.getSelection()
    if (sel) {
      editor.value.executeEdits('codestage-insert', [{
        range: sel,
        text: code,
        forceMoveMarkers: true
      }])
    } else {
      const pos = editor.value.getPosition()
      if (pos) {
        editor.value.executeEdits('codestage-insert', [{
          range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
          text: code,
          forceMoveMarkers: true
        }])
      }
    }
    focus()
  }

  function getSelectedText(): string {
    if (!editor.value || !model.value) return ''
    const sel = editor.value.getSelection()
    if (!sel) return ''
    return model.value.getValueInRange(sel)
  }

  function triggerFormat() {
    editor.value?.getAction('editor.action.formatDocument')?.run()
  }

  function layout() {
    editor.value?.layout()
  }

  onBeforeUnmount(() => {
    disposeFns.forEach(fn => fn())
    disposeFns = []
    contentHandlers.length = 0
    positionHandlers.length = 0
    lineDoubleClickHandlers.length = 0
    selectionChangeHandlers.length = 0
    contextMenuHandlers.length = 0
    if (model.value) model.value.dispose()
    if (editor.value) editor.value.dispose()
    model.value = null
    editor.value = null
  })

  return {
    editor,
    model,
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
    addDecoration,
    removeDecoration,
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
    closeFind,
    openReplace,
    findNext,
    findPrev,
    replaceAll,
    replaceCurrent,
    insertSnippet,
    getSelectedText,
    triggerFormat,
    layout
  }
}

export type MonacoAPI = ReturnType<typeof useMonaco>
