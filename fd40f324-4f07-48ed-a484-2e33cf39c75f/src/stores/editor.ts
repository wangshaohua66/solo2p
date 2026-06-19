import { defineStore } from 'pinia'
import { createId } from '@/utils'
import type { EditorFile, LanguageId, Breakpoint } from '@/types'
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '@/utils/storage'

interface EditorState {
  files: EditorFile[]
  activeFileId: string | null
  cursorLine: number
  cursorColumn: number
  totalLines: number
}

const DEFAULT_JS_CODE = `// 欢迎使用 CodeStage - 专业代码演示工作台
// 按 F10 开始分步执行，按 F8 跳到下一断点
// 双击行号添加断点

function fibonacci(n) {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

// 计算前10个斐波那契数
const results = []
for (let i = 0; i < 10; i++) {
  const val = fibonacci(i)
  results.push(val)
  console.log(\`fib(\${i}) = \${val}\`)
}

console.log('结果:', results)

// 模拟异步操作
async function fetchData() {
  console.log('开始获取数据...')
  await new Promise(r => setTimeout(r, 200))
  const data = { status: 'ok', items: [1, 2, 3, 4, 5] }
  console.log('获取成功:', data)
  return data
}

fetchData().then(() => console.log('演示完成!'))
`

function createDefaultFile(): EditorFile {
  return {
    id: createId('file'),
    name: 'demo.js',
    language: 'javascript',
    content: DEFAULT_JS_CODE,
    path: '/demo.js',
    dirty: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    breakpoints: []
  }
}

function loadPersistedFiles(): EditorFile[] {
  const files = getLocalStorage<EditorFile[]>(STORAGE_KEYS.FILES, [])
  if (files.length > 0) return files
  return [createDefaultFile()]
}

export const useEditorStore = defineStore('editor', {
  state: (): EditorState => ({
    files: loadPersistedFiles(),
    activeFileId: null,
    cursorLine: 1,
    cursorColumn: 1,
    totalLines: 0
  }),

  getters: {
    activeFile: (state): EditorFile | undefined => {
      return state.files.find(f => f.id === state.activeFileId)
    },
    activeContent(): string {
      return this.activeFile?.content || ''
    },
    activeLanguage(): LanguageId {
      return (this.activeFile?.language || 'javascript') as LanguageId
    },
    activeBreakpoints(): Breakpoint[] {
      return this.activeFile?.breakpoints || []
    },
    hasDirtyFiles(state): boolean {
      return state.files.some(f => f.dirty)
    }
  },

  actions: {
    init() {
      if (!this.activeFileId && this.files.length > 0) {
        this.activeFileId = this.files[0].id
        this.totalLines = this.files[0].content.split('\n').length
      }
    },
    persist() {
      setLocalStorage(STORAGE_KEYS.FILES, this.files)
    },
    setActiveFile(id: string) {
      const file = this.files.find(f => f.id === id)
      if (file) {
        this.activeFileId = id
        this.totalLines = file.content.split('\n').length
        this.cursorLine = 1
        this.cursorColumn = 1
      }
    },
    createFile(name = 'untitled.js', language: LanguageId = 'javascript', content = ''): EditorFile {
      const file: EditorFile = {
        id: createId('file'),
        name,
        language,
        content,
        path: `/${name}`,
        dirty: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        breakpoints: []
      }
      this.files.push(file)
      this.setActiveFile(file.id)
      this.persist()
      return file
    },
    closeFile(id: string) {
      const idx = this.files.findIndex(f => f.id === id)
      if (idx === -1) return
      this.files.splice(idx, 1)
      if (this.activeFileId === id) {
        if (this.files.length > 0) {
          const newIdx = Math.min(idx, this.files.length - 1)
          this.activeFileId = this.files[newIdx].id
          this.totalLines = this.files[newIdx].content.split('\n').length
        } else {
          const newFile = createDefaultFile()
          this.files.push(newFile)
          this.activeFileId = newFile.id
          this.totalLines = newFile.content.split('\n').length
        }
      }
      this.persist()
    },
    updateContent(content: string) {
      const file = this.activeFile
      if (!file) return
      file.content = content
      file.dirty = true
      file.updatedAt = Date.now()
      this.totalLines = content.split('\n').length
      this.persist()
    },
    updateFileLanguage(id: string, language: LanguageId) {
      const file = this.files.find(f => f.id === id)
      if (file) {
        file.language = language
        file.dirty = true
        this.persist()
      }
    },
    renameFile(id: string, name: string) {
      const file = this.files.find(f => f.id === id)
      if (file) {
        file.name = name
        file.path = `/${name}`
        file.dirty = true
        this.persist()
      }
    },
    updateCursor(line: number, column: number) {
      this.cursorLine = line
      this.cursorColumn = column
    },
    toggleBreakpoint(lineNumber: number) {
      const file = this.activeFile
      if (!file) return
      const idx = file.breakpoints.findIndex(b => b.lineNumber === lineNumber)
      if (idx >= 0) {
        file.breakpoints.splice(idx, 1)
      } else {
        file.breakpoints.push({ lineNumber, enabled: true })
        file.breakpoints.sort((a, b) => a.lineNumber - b.lineNumber)
      }
      this.persist()
    },
    hasBreakpoint(lineNumber: number): boolean {
      return this.activeBreakpoints.some(b => b.lineNumber === lineNumber)
    },
    clearBreakpoints() {
      const file = this.activeFile
      if (file) {
        file.breakpoints = []
        this.persist()
      }
    },
    markClean(id: string) {
      const file = this.files.find(f => f.id === id)
      if (file) {
        file.dirty = false
        this.persist()
      }
    }
  }
})
