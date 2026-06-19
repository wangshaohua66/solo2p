import { useOutputStore } from '@/stores/output'
import { useEditorStore } from '@/stores/editor'
import { useTsCompiler } from '@/composables/useTsCompiler'
import type { ExecutionResult, ExecutionOptions, LogLevel } from '@/types'
import { createId } from '@/utils'

function serializeArgs(args: any[]): any[] {
  return args.map(a => {
    if (a === null || a === undefined) return a
    if (typeof a === 'bigint') return String(a) + 'n'
    if (a instanceof Error) return {
      __error__: true,
      name: a.name,
      message: a.message,
      stack: a.stack
    }
    if (typeof a === 'object') {
      try {
        return JSON.parse(JSON.stringify(a, (_, v) => typeof v === 'bigint' ? String(v) : v))
      } catch {
        return String(a)
      }
    }
    return a
  })
}

export function useExecution() {
  const outputStore = useOutputStore()
  const editorStore = useEditorStore()
  const tsCompiler = useTsCompiler()

  let iframeEl: HTMLIFrameElement | null = null
  const mockedApis = new Map<string, any>()

  function mockApi(url: string, response: any) {
    mockedApis.set(url, response)
  }

  function clearMocks() {
    mockedApis.clear()
  }

  async function run(
    code: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const fileId = editorStore.activeFileId || ''
    const activeFile = editorStore.activeFile
    const language = activeFile?.language || 'javascript'
    const { timeout = 5000, captureConsole = true } = options
    const collectedLogs: Array<{ level: LogLevel; args: any[]; stack?: string }> = []
    const startTime = performance.now()

    let success = true
    let returnValue: any = undefined
    let error: ExecutionResult['error'] = undefined

    let execCode = code
    if (tsCompiler.isTypeScript(language)) {
      try {
        const compiled = tsCompiler.transpile(code, 'codestage.ts')
        if (compiled.diagnostics.length > 0) {
          const errMsg = tsCompiler.formatDiagnostics(compiled.diagnostics)
          if (errMsg) {
            outputStore.addLog('error', [`TypeScript 编译错误:\n${errMsg}`], fileId)
            return {
              success: false,
              returnValue: undefined,
              error: { name: 'TSError', message: errMsg, stack: undefined },
              logs: [],
              duration: Math.round(performance.now() - startTime)
            }
          }
        }
        execCode = compiled.output
      } catch (e: any) {
        outputStore.addLog('error', [`TypeScript 转译失败: ${e?.message || String(e)}`], fileId)
        return {
          success: false,
          returnValue: undefined,
          error: { name: 'TSError', message: e?.message || String(e), stack: e?.stack },
          logs: [],
          duration: Math.round(performance.now() - startTime)
        }
      }
    }

    try {
      const levels: LogLevel[] = ['log', 'warn', 'error', 'info', 'debug']
      const win = window
      const originals: Record<string, any> = {}
      levels.forEach(l => { originals[l] = (console as any)[l] })

      if (captureConsole) {
        levels.forEach(level => {
          const orig = (console as any)[level]
          ;(console as any)[level] = (...args: any[]) => {
            let stack: string | undefined
            if (level === 'error') {
              try { throw new Error() } catch (e: any) { stack = e.stack }
            }
            collectedLogs.push({ level, args: serializeArgs(args), stack })
            outputStore.addLog(level, serializeArgs(args), fileId, stack)
            orig.apply(console, args)
          }
        })
      }

      const origFetch = win.fetch
      if (mockedApis.size > 0) {
        ;(win as any).fetch = (url: string, init: any) => {
          if (mockedApis.has(url)) {
            const data = mockedApis.get(url)
            return Promise.resolve({
              ok: true, status: 200, statusText: 'OK',
              json: () => Promise.resolve(data),
              text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data))
            })
          }
          return origFetch.apply(win, [url, init])
        }
      }

      let timeoutId: ReturnType<typeof setTimeout> | null = null
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`执行超时 (${timeout}ms)`))
        }, timeout)
      })

      const execPromise = (async () => {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
        const fn = new AsyncFunction(`${execCode}`)
        return await fn.call({})
      })()

      returnValue = await Promise.race([execPromise, timeoutPromise])

      if (timeoutId) clearTimeout(timeoutId)

      if (captureConsole) {
        levels.forEach(l => { (console as any)[l] = originals[l] })
      }
      ;(win as any).fetch = origFetch

    } catch (e: any) {
      success = false
      error = {
        name: e?.name || 'Error',
        message: e?.message || String(e),
        stack: e?.stack
      }
      outputStore.addLog('error', serializeArgs([error.message]), fileId, error.stack)
      collectedLogs.push({
        level: 'error',
        args: serializeArgs([error.message]),
        stack: error.stack
      })
    }

    const duration = Math.round(performance.now() - startTime)
    return {
      success,
      returnValue,
      error,
      logs: collectedLogs.map(l => ({
        id: createId('log'),
        level: l.level,
        args: l.args,
        stack: l.stack,
        timestamp: startTime,
        fileId
      })),
      duration
    }
  }

  async function runAsync(code: string, options: ExecutionOptions = {}): Promise<void> {
    await run(code, options)
  }

  function clearLogs(fileId?: string) {
    outputStore.clearLogs(fileId)
  }

  function dispose() {
    if (iframeEl) {
      document.body.removeChild(iframeEl)
      iframeEl = null
    }
    mockedApis.clear()
  }

  return {
    run,
    runAsync,
    mockApi,
    clearMocks,
    clearLogs,
    dispose,
    tsCompiler
  }
}

export type ExecutionAPI = ReturnType<typeof useExecution>
