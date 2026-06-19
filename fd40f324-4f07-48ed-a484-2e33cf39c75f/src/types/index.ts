import type { ComputedRef } from 'vue'

export type RunnerState = 'idle' | 'running' | 'paused' | 'finished' | 'error'

export type ThemeName = 'dark' | 'light' | 'high-contrast'

export type ToolType = 'pen' | 'rect' | 'arrow' | 'text' | 'number' | 'eraser' | 'none'

export type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'

export type SyncRole = 'editor' | 'viewer'

export type LanguageId =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'java'
  | 'html'
  | 'css'
  | 'json'
  | 'markdown'
  | 'rust'
  | 'cpp'
  | 'c'
  | 'sql'

export interface Breakpoint {
  lineNumber: number
  enabled: boolean
  condition?: string
}

export interface Snippet {
  id: string
  name: string
  code: string
  language: LanguageId
  tags: string[]
  categoryId: string
  createdAt: number
  updatedAt: number
  description: string
  favorite: boolean
}

export interface Category {
  id: string
  name: string
  parentId: string | null
  order: number
  expanded: boolean
}

export interface AnnotationPoint {
  x: number
  y: number
}

export interface Annotation {
  id: string
  type: ToolType
  color: string
  strokeWidth: number
  points: AnnotationPoint[]
  text?: string
  numberValue?: number
  fontSize?: number
  page: number
  timestamp: number
}

export interface AnnotationPreset {
  id: string
  name: string
  annotations: Annotation[]
  createdAt: number
  thumbnail?: string
}

export interface SyncMessage<T = any> {
  channelId: string
  senderId: string
  type: SyncType
  payload: T
  timestamp: number
}

export type SyncType =
  | 'code:change'
  | 'cursor:change'
  | 'line:highlight'
  | 'breakpoint:toggle'
  | 'theme:change'
  | 'file:switch'
  | 'step:control'
  | 'annotation:add'
  | 'sync:hello'
  | 'sync:bye'
  | 'sync:state'

export interface OutputLog {
  id: string
  level: LogLevel
  args: any[]
  stack?: string
  timestamp: number
  fileId: string
}

export interface EditorFile {
  id: string
  name: string
  language: LanguageId
  content: string
  path: string
  dirty: boolean
  createdAt: number
  updatedAt: number
  breakpoints: Breakpoint[]
}

export interface EditorPosition {
  lineNumber: number
  column: number
}

export interface EditorSelection {
  startLine: number
  startCol: number
  endLine: number
  endCol: number
  text: string
}

export interface ThemeConfig {
  name: ThemeName
  label: string
  monacoTheme: 'vs-dark' | 'vs' | 'hc-black'
  colors: {
    bgPrimary: string
    bgSecondary: string
    bgTertiary: string
    textPrimary: string
    textSecondary: string
    border: string
    accent: string
    lineHighlight: string
    breakpoint: string
    annotation: string[]
  }
}

export interface SyncChannelInfo {
  channelId: string
  role: SyncRole
  isConnected: boolean
  clients: Array<{ id: string; role: SyncRole; connectedAt: number }>
}

export interface ExecutionResult {
  success: boolean
  returnValue?: any
  error?: {
    name: string
    message: string
    stack?: string
  }
  logs: OutputLog[]
  duration: number
}

export interface ExecutionOptions {
  timeout?: number
  captureConsole?: boolean
  mockApis?: Record<string, any>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export const THEMES: Record<ThemeName, ThemeConfig> = {
  dark: {
    name: 'dark',
    label: '深色主题',
    monacoTheme: 'vs-dark',
    colors: {
      bgPrimary: '#0F172A',
      bgSecondary: '#1E293B',
      bgTertiary: '#334155',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      border: '#334155',
      accent: '#6366F1',
      lineHighlight: 'rgba(99, 102, 241, 0.15)',
      breakpoint: '#F59E0B',
      annotation: ['#EC4899', '#10B981', '#F59E0B', '#6366F1', '#06B6D4', '#EF4444']
    }
  },
  light: {
    name: 'light',
    label: '浅色主题',
    monacoTheme: 'vs',
    colors: {
      bgPrimary: '#FFFFFF',
      bgSecondary: '#F8FAFC',
      bgTertiary: '#F1F5F9',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      accent: '#6366F1',
      lineHighlight: 'rgba(99, 102, 241, 0.12)',
      breakpoint: '#F59E0B',
      annotation: ['#EC4899', '#10B981', '#F59E0B', '#6366F1', '#06B6D4', '#EF4444']
    }
  },
  'high-contrast': {
    name: 'high-contrast',
    label: '高对比度',
    monacoTheme: 'hc-black',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#1A1A1A',
      bgTertiary: '#333333',
      textPrimary: '#FFFFFF',
      textSecondary: '#CCCCCC',
      border: '#666666',
      accent: '#FFD700',
      lineHighlight: 'rgba(255, 215, 0, 0.25)',
      breakpoint: '#FF6B6B',
      annotation: ['#FF00FF', '#00FF00', '#FFFF00', '#FFD700', '#00FFFF', '#FF0000']
    }
  }
}

export const LANGUAGES: Array<{ id: LanguageId; label: string; ext: string }> = [
  { id: 'javascript', label: 'JavaScript', ext: '.js' },
  { id: 'typescript', label: 'TypeScript', ext: '.ts' },
  { id: 'python', label: 'Python', ext: '.py' },
  { id: 'go', label: 'Go', ext: '.go' },
  { id: 'java', label: 'Java', ext: '.java' },
  { id: 'html', label: 'HTML', ext: '.html' },
  { id: 'css', label: 'CSS', ext: '.css' },
  { id: 'json', label: 'JSON', ext: '.json' },
  { id: 'markdown', label: 'Markdown', ext: '.md' },
  { id: 'rust', label: 'Rust', ext: '.rs' },
  { id: 'cpp', label: 'C++', ext: '.cpp' },
  { id: 'c', label: 'C', ext: '.c' },
  { id: 'sql', label: 'SQL', ext: '.sql' }
]

export const ANNOTATION_COLORS = [
  '#EC4899', '#10B981', '#F59E0B',
  '#6366F1', '#06B6D4', '#EF4444'
]

export const InjectKeys = {
  EditorContext: Symbol('editor-context'),
  RunnerContext: Symbol('runner-context'),
  AnnotationContext: Symbol('annotation-context')
} as const

export interface EditorContext {
  getContent: () => string
  setContent: (code: string, fromSync?: boolean) => void
  getSelection: () => EditorSelection | null
  getPosition: () => EditorPosition | null
  setPosition: (line: number, col: number) => void
  focus: () => void
  revealLine: (line: number) => void
  addDecoration: (line: number, key: string) => void
  removeDecoration: (key: string) => void
  onContentChange: (cb: (code: string) => void) => () => void
  onPositionChange: (cb: (pos: EditorPosition) => void) => () => void
  onLineDoubleClick: (cb: (line: number) => void) => () => void
}

export interface RunnerContext {
  state: ComputedRef<RunnerState>
  currentLine: ComputedRef<number>
  progress: ComputedRef<number>
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  stepOver: () => void
  stepContinue: () => void
  runSelection: () => void
  runAll: () => void
  toggleBreakpoint: (line: number) => void
  clearBreakpoints: () => void
}
