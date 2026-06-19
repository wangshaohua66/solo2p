import { defineStore } from 'pinia'
import type { RunnerState, Breakpoint } from '@/types'

interface StepState {
  state: RunnerState
  currentLine: number
  startLine: number
  endLine: number
  totalLines: number
  executionSpeed: number
  logs: Array<{ type: string; line: number; message: string; timestamp: number }>
  error: string | null
}

export const useStepStore = defineStore('step', {
  state: (): StepState => ({
    state: 'idle',
    currentLine: 0,
    startLine: 1,
    endLine: 1,
    totalLines: 1,
    executionSpeed: 500,
    logs: [],
    error: null
  }),

  getters: {
    progress: (state): number => {
      if (state.totalLines <= 1) return 0
      return ((state.currentLine - state.startLine) / (state.totalLines - 1)) * 100
    },
    isRunning: (state) => state.state === 'running',
    isPaused: (state) => state.state === 'paused',
    isIdle: (state) => state.state === 'idle',
    isFinished: (state) => state.state === 'finished',
    hasError: (state) => state.state === 'error'
  },

  actions: {
    setRange(start: number, end: number) {
      this.startLine = start
      this.endLine = end
      this.totalLines = Math.max(end - start + 1, 1)
    },
    start() {
      this.state = 'running'
      this.currentLine = this.startLine
      this.error = null
      this.logs = []
      this.addLog('info', this.currentLine, '开始执行')
    },
    pause() {
      if (this.state === 'running') {
        this.state = 'paused'
        this.addLog('info', this.currentLine, '执行暂停')
      }
    },
    resume() {
      if (this.state === 'paused') {
        this.state = 'running'
        this.addLog('info', this.currentLine, '继续执行')
      }
    },
    reset() {
      this.state = 'idle'
      this.currentLine = 0
      this.error = null
      this.logs = []
    },
    finish() {
      this.state = 'finished'
      this.addLog('success', this.currentLine, '执行完成')
    },
    fail(error: string) {
      this.state = 'error'
      this.error = error
      this.addLog('error', this.currentLine, `错误: ${error}`)
    },
    goToLine(line: number) {
      const clampedLine = Math.min(Math.max(line, this.startLine), this.endLine)
      this.currentLine = clampedLine
      if (this.state === 'idle') {
        this.state = 'running'
      }
    },
    nextLine(): boolean {
      if (this.currentLine >= this.endLine) {
        this.finish()
        return false
      }
      this.currentLine++
      return true
    },
    setSpeed(speed: number) {
      this.executionSpeed = Math.min(Math.max(speed, 100), 5000)
    },
    findNextBreakpoint(breakpoints: Breakpoint[]): number | null {
      const next = breakpoints
        .filter(b => b.enabled && b.lineNumber > this.currentLine)
        .sort((a, b) => a.lineNumber - b.lineNumber)[0]
      return next ? next.lineNumber : null
    },
    isAtBreakpoint(breakpoints: Breakpoint[]): boolean {
      return breakpoints.some(b => b.enabled && b.lineNumber === this.currentLine)
    },
    addLog(type: string, line: number, message: string) {
      this.logs.push({
        type,
        line,
        message,
        timestamp: Date.now()
      })
    },
    clearLogs() {
      this.logs = []
    }
  }
})
