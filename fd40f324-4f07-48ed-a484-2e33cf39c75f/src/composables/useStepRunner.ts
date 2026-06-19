import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useStepStore } from '@/stores/step'
import { useEditorStore } from '@/stores/editor'
import { useOutputStore } from '@/stores/output'
import type { RunnerState, Breakpoint } from '@/types'

export function useStepRunner() {
  const stepStore = useStepStore()
  const editorStore = useEditorStore()
  const outputStore = useOutputStore()

  const running = ref(false)
  const currentLineRef = ref(0)
  const cancelToken = ref(false)
  const onHighlightHandlers: Array<(line: number) => void> = []
  const onClearHandlers: Array<() => void> = []

  function onHighlight(cb: (line: number) => void): () => void {
    onHighlightHandlers.push(cb)
    return () => {
      const idx = onHighlightHandlers.indexOf(cb)
      if (idx >= 0) onHighlightHandlers.splice(idx, 1)
    }
  }

  function onClear(cb: () => void): () => void {
    onClearHandlers.push(cb)
    return () => {
      const idx = onClearHandlers.indexOf(cb)
      if (idx >= 0) onClearHandlers.splice(idx, 1)
    }
  }

  function getLines(): string[] {
    return (editorStore.activeContent || '').split('\n')
  }

  function isEmptyLine(line: string): boolean {
    return line.trim().length === 0 || line.trim().startsWith('//') || line.trim().startsWith('*')
  }

  function findStatementEnd(lines: string[], startIdx: number): number {
    let depth = 0
    let inMultiLineComment = false
    let inTemplate = false
    let inString: string | null = null

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i]
      for (let j = 0; j < line.length; j++) {
        const ch = line[j]
        const next = line[j + 1]

        if (inMultiLineComment) {
          if (ch === '*' && next === '/') {
            inMultiLineComment = false
            j++
          }
          continue
        }
        if (inString) {
          if (ch === '\\') { j++; continue }
          if (ch === inString) inString = null
          continue
        }
        if (inTemplate) {
          if (ch === '\\') { j++; continue }
          if (ch === '`') inTemplate = false
          continue
        }
        if (ch === '/' && next === '*') {
          inMultiLineComment = true; j++
          continue
        }
        if (ch === '/' && next === '/') break
        if (ch === '`') { inTemplate = true; continue }
        if (ch === '"' || ch === "'") { inString = ch; continue }
        if (ch === '{' || ch === '(' || ch === '[') depth++
        if (ch === '}' || ch === ')' || ch === ']') depth--
      }
      if (depth <= 0) {
        const trimmed = line.trim()
        if (trimmed.endsWith(';') || trimmed.endsWith('}') || trimmed.endsWith(')') || trimmed.endsWith(']') || i === lines.length - 1) {
          return i
        }
        if (!line.trim().endsWith(',') && !line.trim().endsWith('.') && !line.trim().endsWith('(') && !line.trim().endsWith('{')) {
          if (!trimmed.startsWith('for') && !trimmed.startsWith('while') && !trimmed.startsWith('if') && !trimmed.startsWith('else') && !trimmed.startsWith('function') && !trimmed.match(/^(const|let|var).*=$/) && !trimmed.match(/^.*=>\s*\{?$/)) {
            return i
          }
        }
      }
    }
    return lines.length - 1
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  function shouldPauseAtBreakpoint(line: number, breakpoints: Breakpoint[]): boolean {
    return breakpoints.some(b => b.enabled && b.lineNumber === line + 1)
  }

  function start(startLine = 1, endLine?: number) {
    const lines = getLines()
    const actualEnd = endLine ?? lines.length
    stepStore.setRange(startLine, actualEnd)
    stepStore.start()
    currentLineRef.value = startLine
    onHighlightHandlers.forEach(cb => cb(startLine))
    running.value = false
  }

  async function runAll() {
    if (running.value) return
    running.value = true
    cancelToken.value = false
    const lines = getLines()
    const breakpoints = editorStore.activeBreakpoints
    stepStore.setRange(1, lines.length)
    stepStore.start()

    let lineIdx = 0
    while (lineIdx < lines.length && !cancelToken.value) {
      if (isEmptyLine(lines[lineIdx])) { lineIdx++; continue }

      const stmtEnd = findStatementEnd(lines, lineIdx)
      stepStore.goToLine(lineIdx + 1)
      onHighlightHandlers.forEach(cb => cb(lineIdx + 1))
      currentLineRef.value = lineIdx + 1

      await sleep(stepStore.executionSpeed)

      if (shouldPauseAtBreakpoint(stmtEnd, breakpoints)) {
        stepStore.goToLine(stmtEnd + 1)
        onHighlightHandlers.forEach(cb => cb(stmtEnd + 1))
        stepStore.pause()
        stepStore.addLog('info', stmtEnd + 1, '遇到断点，执行暂停')
        running.value = false
        return
      }
      lineIdx = stmtEnd + 1
    }
    if (!cancelToken.value) {
      stepStore.goToLine(lines.length)
      stepStore.finish()
    }
    running.value = false
  }

  function stepOver(): boolean {
    const lines = getLines()
    const breakpoints = editorStore.activeBreakpoints
    const current = currentLineRef.value

    if (stepStore.state === 'idle' || stepStore.state === 'finished') {
      stepStore.setRange(1, lines.length)
      stepStore.start()
    }

    if (stepStore.state === 'paused') {
      stepStore.resume()
    }

    let lineIdx = Math.max(current - 1, 0)
    while (lineIdx < lines.length && isEmptyLine(lines[lineIdx])) {
      lineIdx++
    }

    if (lineIdx >= lines.length) {
      stepStore.finish()
      return false
    }

    const stmtEnd = findStatementEnd(lines, lineIdx)
    stepStore.goToLine(stmtEnd + 1)
    onHighlightHandlers.forEach(cb => cb(stmtEnd + 1))
    currentLineRef.value = stmtEnd + 1
    stepStore.addLog('info', stmtEnd + 1, `执行第 ${stmtEnd + 1} 行`)

    if (shouldPauseAtBreakpoint(stmtEnd, breakpoints)) {
      stepStore.pause()
      stepStore.addLog('info', stmtEnd + 1, '遇到断点')
    }

    if (stmtEnd >= lines.length - 1) {
      stepStore.finish()
      return false
    }
    return true
  }

  function stepContinue(): boolean {
    const lines = getLines()
    const breakpoints = editorStore.activeBreakpoints
    const current = currentLineRef.value

    if (stepStore.state === 'idle') {
      stepStore.setRange(1, lines.length)
      stepStore.start()
    }
    if (stepStore.state === 'paused') stepStore.resume()

    let lineIdx = Math.max(current - 1, 0)
    const nextBp = stepStore.findNextBreakpoint(breakpoints)
    const target = nextBp ? nextBp - 1 : lines.length - 1

    while (lineIdx <= target) {
      if (!isEmptyLine(lines[lineIdx])) {
        onHighlightHandlers.forEach(cb => cb(lineIdx + 1))
        currentLineRef.value = lineIdx + 1
      }
      lineIdx++
    }

    stepStore.goToLine(target + 1)
    if (nextBp) {
      stepStore.pause()
      stepStore.addLog('info', nextBp, '到达断点')
      return true
    } else {
      stepStore.finish()
      return false
    }
  }

  function runSelection() {
    const selection = editorStore.activeContent
    if (!selection) return
    const lines = selection.split('\n')
    stepStore.setRange(1, lines.length)
    stepStore.start()
    currentLineRef.value = 1
    onHighlightHandlers.forEach(cb => cb(1))
  }

  function pause() {
    stepStore.pause()
    running.value = false
    cancelToken.value = true
  }

  function resume() {
    stepStore.resume()
    runAll()
  }

  function reset() {
    cancelToken.value = true
    running.value = false
    currentLineRef.value = 0
    stepStore.reset()
    outputStore.clearLogs(editorStore.activeFileId ?? undefined)
    onClearHandlers.forEach(cb => cb())
  }

  function setSpeed(speed: number) {
    stepStore.setSpeed(speed)
  }

  function toggleBreakpoint(line: number) {
    editorStore.toggleBreakpoint(line)
  }

  function clearBreakpoints() {
    editorStore.clearBreakpoints()
  }

  watch(() => editorStore.activeBreakpoints, (_bps) => {
    // breakpoint updates handled by CodeEditor component
  }, { deep: true })

  onBeforeUnmount(() => {
    cancelToken.value = true
    running.value = false
    onHighlightHandlers.length = 0
    onClearHandlers.length = 0
  })

  return {
    running,
    currentLine: computed(() => currentLineRef.value),
    state: computed(() => stepStore.state as RunnerState),
    progress: computed(() => stepStore.progress),
    start,
    pause,
    resume,
    reset,
    stepOver,
    stepContinue,
    runAll,
    runSelection,
    setSpeed,
    toggleBreakpoint,
    clearBreakpoints,
    onHighlight,
    onClear
  }
}

export type StepRunnerAPI = ReturnType<typeof useStepRunner>
