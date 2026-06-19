import { defineStore } from 'pinia'
import type { OutputLog, LogLevel } from '@/types'
import { createId } from '@/utils'

interface OutputState {
  logs: OutputLog[]
  filterLevel: LogLevel | 'all'
  autoScroll: boolean
  wordWrap: boolean
  maxLogs: number
}

export const useOutputStore = defineStore('output', {
  state: (): OutputState => ({
    logs: [],
    filterLevel: 'all',
    autoScroll: true,
    wordWrap: true,
    maxLogs: 1000
  }),

  getters: {
    filteredLogs: (state): OutputLog[] => {
      const levels: LogLevel[] = ['log', 'warn', 'error', 'info', 'debug']
      if (state.filterLevel === 'all') return state.logs
      const startIdx = levels.indexOf(state.filterLevel)
      const allowed = levels.slice(startIdx)
      return state.logs.filter(l => allowed.includes(l.level))
    },
    errorCount: (state) => state.logs.filter(l => l.level === 'error').length,
    warnCount: (state) => state.logs.filter(l => l.level === 'warn').length,
    hasContent: (state) => state.logs.length > 0
  },

  actions: {
    addLog(level: LogLevel, args: any[], fileId: string, stack?: string) {
      const log: OutputLog = {
        id: createId('log'),
        level,
        args,
        stack,
        timestamp: Date.now(),
        fileId
      }
      this.logs.push(log)
      if (this.logs.length > this.maxLogs) {
        this.logs.splice(0, this.logs.length - this.maxLogs)
      }
    },

    addLogs(logs: Array<{ level: LogLevel; args: any[]; stack?: string }>, fileId: string) {
      const now = Date.now()
      logs.forEach((l, i) => {
        this.logs.push({
          id: createId('log'),
          level: l.level,
          args: l.args,
          stack: l.stack,
          timestamp: now + i,
          fileId
        })
      })
      if (this.logs.length > this.maxLogs) {
        this.logs.splice(0, this.logs.length - this.maxLogs)
      }
    },

    clearLogs(fileId?: string) {
      if (fileId) {
        this.logs = this.logs.filter(l => l.fileId !== fileId)
      } else {
        this.logs = []
      }
    },

    setFilterLevel(level: LogLevel | 'all') {
      this.filterLevel = level
    },

    toggleAutoScroll() {
      this.autoScroll = !this.autoScroll
    },

    toggleWordWrap() {
      this.wordWrap = !this.wordWrap
    },

    formatArgs(args: any[]): string {
      return args.map(a => {
        if (a === null) return 'null'
        if (a === undefined) return 'undefined'
        if (typeof a === 'object') {
          try {
            return JSON.stringify(a, null, 2)
          } catch {
            return String(a)
          }
        }
        return String(a)
      }).join(' ')
    }
  }
})
