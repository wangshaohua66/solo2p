import { defineStore } from 'pinia'
import type { Annotation, AnnotationPreset, ToolType, AnnotationPoint } from '@/types'
import { createId, deepClone } from '@/utils'
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '@/utils/storage'
import { ANNOTATION_COLORS } from '@/types'

interface AnnotationState {
  annotations: Annotation[]
  presets: AnnotationPreset[]
  currentTool: ToolType
  currentColor: string
  strokeWidth: number
  fontSize: number
  visible: boolean
  active: boolean
  history: Annotation[][]
  historyIndex: number
  nextNumber: number
}

function loadPresets(): AnnotationPreset[] {
  return getLocalStorage<AnnotationPreset[]>(STORAGE_KEYS.ANNOTATION_PRESETS, [])
}

const MAX_HISTORY = 50

export const useAnnotationStore = defineStore('annotation', {
  state: (): AnnotationState => ({
    annotations: [],
    presets: loadPresets(),
    currentTool: 'none',
    currentColor: ANNOTATION_COLORS[0],
    strokeWidth: 3,
    fontSize: 18,
    visible: true,
    active: false,
    history: [[]],
    historyIndex: 0,
    nextNumber: 1
  }),

  getters: {
    canUndo: (state) => state.historyIndex > 0,
    canRedo: (state) => state.historyIndex < state.history.length - 1,
    visibleAnnotations: (state) => state.visible ? state.annotations : [],
    presetsCount: (state) => state.presets.length
  },

  actions: {
    persistPresets() {
      setLocalStorage(STORAGE_KEYS.ANNOTATION_PRESETS, this.presets)
    },

    pushHistory() {
      const snapshot = deepClone(this.annotations)
      this.history = this.history.slice(0, this.historyIndex + 1)
      this.history.push(snapshot)
      if (this.history.length > MAX_HISTORY) {
        this.history.shift()
      } else {
        this.historyIndex++
      }
    },

    setTool(tool: ToolType) {
      this.currentTool = tool
      if (tool === 'number') {
        this.nextNumber = 1
      }
    },

    setColor(color: string) {
      this.currentColor = color
    },

    setStrokeWidth(width: number) {
      this.strokeWidth = Math.min(Math.max(width, 1), 20)
    },

    setFontSize(size: number) {
      this.fontSize = Math.min(Math.max(size, 10), 48)
    },

    setActive(active: boolean) {
      this.active = active
      if (!active) {
        this.currentTool = 'none'
      }
    },

    toggleVisible() {
      this.visible = !this.visible
    },

    addAnnotation(
      type: ToolType,
      points: AnnotationPoint[],
      text?: string,
      numberValue?: number
    ): Annotation {
      const annotation: Annotation = {
        id: createId('ann'),
        type,
        color: this.currentColor,
        strokeWidth: this.strokeWidth,
        points,
        text,
        numberValue,
        fontSize: this.fontSize,
        page: 0,
        timestamp: Date.now()
      }
      this.annotations.push(annotation)
      this.pushHistory()
      return annotation
    },

    removeAnnotation(id: string) {
      const idx = this.annotations.findIndex(a => a.id === id)
      if (idx >= 0) {
        this.annotations.splice(idx, 1)
        this.pushHistory()
      }
    },

    clear() {
      if (this.annotations.length > 0) {
        this.annotations = []
        this.nextNumber = 1
        this.pushHistory()
      }
    },

    undo() {
      if (this.historyIndex > 0) {
        this.historyIndex--
        this.annotations = deepClone(this.history[this.historyIndex])
      }
    },

    redo() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++
        this.annotations = deepClone(this.history[this.historyIndex])
      }
    },

    savePreset(name: string): string {
      const preset: AnnotationPreset = {
        id: createId('preset'),
        name: name.trim() || '未命名预设',
        annotations: deepClone(this.annotations),
        createdAt: Date.now()
      }
      this.presets.push(preset)
      this.persistPresets()
      return preset.id
    },

    applyPreset(id: string) {
      const preset = this.presets.find(p => p.id === id)
      if (preset) {
        this.annotations = deepClone(preset.annotations)
        this.nextNumber = 1
        this.pushHistory()
      }
    },

    deletePreset(id: string) {
      const idx = this.presets.findIndex(p => p.id === id)
      if (idx >= 0) {
        this.presets.splice(idx, 1)
        this.persistPresets()
      }
    },

    renamePreset(id: string, name: string) {
      const preset = this.presets.find(p => p.id === id)
      if (preset) {
        preset.name = name.trim() || '未命名预设'
        this.persistPresets()
      }
    },

    incrementNumber() {
      this.nextNumber++
    },

    exportAnnotations(): Annotation[] {
      return deepClone(this.annotations)
    },

    importAnnotations(items: Annotation[]) {
      this.annotations = deepClone(items)
      this.pushHistory()
    }
  }
})
