import { create } from 'zustand'
import type {
  FitsFrame,
  DarkFrameInfo,
  FlatFrameInfo,
  CalibrationSettings,
  AlignmentSettings,
  StackingSettings,
  VisualizationSettings,
  StackTask,
  StackResult,
  ObservationSession,
  CalibrationLibraryStats
} from '@/core/types'
import { generateId } from '@/utils/fitsUtils'

interface ObservationState {
  frames: FitsFrame[]
  darkFrames: DarkFrameInfo[]
  flatFrames: FlatFrameInfo[]
  sessions: ObservationSession[]
  stackTasks: StackTask[]
  selectedFrameId: string | null
  selectedStackResultId: string | null
  refFrameId: string | null
  filterOptions: string[]
  filter: string
  minExposure: number
  maxExposure: number
  calibrationSettings: CalibrationSettings
  alignmentSettings: AlignmentSettings
  stackingSettings: StackingSettings
  visualizationSettings: VisualizationSettings
  isLoading: boolean
  error: string | null

  addFrame: (frame: FitsFrame) => void
  addFrames: (frames: FitsFrame[]) => void
  removeFrame: (frameId: string) => void
  updateFrame: (frameId: string, updates: Partial<FitsFrame>) => void
  setSelectedFrame: (frameId: string | null) => void
  setRefFrame: (frameId: string | null) => void
  setSelectedStackResult: (taskId: string | null) => void

  addDarkFrame: (frame: DarkFrameInfo) => void
  addFlatFrame: (frame: FlatFrameInfo) => void
  removeDarkFrame: (frameId: string) => void
  removeFlatFrame: (frameId: string) => void

  addStackTask: (task: Omit<StackTask, 'id' | 'status' | 'progress' | 'currentStep' | 'currentFrame' | 'snrHistory' | 'createdAt'>) => void
  updateStackTask: (taskId: string, updates: Partial<StackTask>) => void
  removeStackTask: (taskId: string) => void
  clearCompletedTasks: () => void

  setFilter: (filter: string) => void
  setCalibrationSettings: (settings: Partial<CalibrationSettings>) => void
  setAlignmentSettings: (settings: Partial<AlignmentSettings>) => void
  setStackingSettings: (settings: Partial<StackingSettings>) => void
  setVisualizationSettings: (settings: Partial<VisualizationSettings>) => void

  getFrameById: (frameId: string) => FitsFrame | undefined
  getDarkFrameById: (frameId: string) => DarkFrameInfo | undefined
  getFlatFrameById: (frameId: string) => FlatFrameInfo | undefined
  getFilteredFrames: () => FitsFrame[]
  getCalibrationLibraryStats: () => CalibrationLibraryStats

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearAll: () => void
}

export const useObservationStore = create<ObservationState>((set, get) => ({
  frames: [],
  darkFrames: [],
  flatFrames: [],
  sessions: [],
  stackTasks: [],
  selectedFrameId: null,
  selectedStackResultId: null,
  refFrameId: null,
  filterOptions: [],
  filter: 'all',
  minExposure: 0,
  maxExposure: Infinity,
  calibrationSettings: {
    darkSubtraction: true,
    flatCorrection: true,
    badPixelInterpolation: true,
    badPixelThreshold: 5
  },
  alignmentSettings: {
    detectionThreshold: 5,
    minStars: 10,
    maxStars: 200,
    subpixelAccuracy: true,
    maxIterations: 100,
    matchTolerance: 0.05
  },
  stackingSettings: {
    mode: 'sigma-clip',
    sigmaThreshold: 3,
    iterations: 5,
    percentileLow: 0.1,
    percentileHigh: 99.9
  },
  visualizationSettings: {
    mode: 'mono',
    activeChannel: 'luminance',
    luminance: {
      enabled: true,
      stretchFunction: 'auto',
      blackPoint: 0,
      whitePoint: 65535,
      gamma: 1,
      colorMap: 'gray'
    },
    red: {
      enabled: true,
      stretchFunction: 'auto',
      blackPoint: 0,
      whitePoint: 65535,
      gamma: 1,
      colorMap: 'gray'
    },
    green: {
      enabled: true,
      stretchFunction: 'auto',
      blackPoint: 0,
      whitePoint: 65535,
      gamma: 1,
      colorMap: 'gray'
    },
    blue: {
      enabled: true,
      stretchFunction: 'auto',
      blackPoint: 0,
      whitePoint: 65535,
      gamma: 1,
      colorMap: 'gray'
    },
    stretchFunction: 'auto',
    blackPoint: 0,
    whitePoint: 65535,
    colorMap: 'gray',
    gamma: 1,
    showStars: true,
    showCrosshair: true
  },
  isLoading: false,
  error: null,

  addFrame: (frame) => {
    set((state) => {
      const existingFilters = new Set(state.filterOptions)
      const frameFilter = frame.header.FILTER || 'Unknown'
      existingFilters.add(frameFilter)
      return {
        frames: [...state.frames, frame],
        filterOptions: Array.from(existingFilters),
        selectedFrameId: state.selectedFrameId || frame.id
      }
    })
  },

  addFrames: (newFrames) => {
    set((state) => {
      const existingFilters = new Set(state.filterOptions)
      newFrames.forEach(frame => {
        const frameFilter = frame.header.FILTER || 'Unknown'
        existingFilters.add(frameFilter)
      })
      return {
        frames: [...state.frames, ...newFrames],
        filterOptions: Array.from(existingFilters),
        selectedFrameId: state.selectedFrameId || (newFrames[0]?.id ?? null)
      }
    })
  },

  removeFrame: (frameId) => {
    set((state) => ({
      frames: state.frames.filter(f => f.id !== frameId),
      selectedFrameId: state.selectedFrameId === frameId ? null : state.selectedFrameId,
      refFrameId: state.refFrameId === frameId ? null : state.refFrameId
    }))
  },

  updateFrame: (frameId, updates) => {
    set((state) => ({
      frames: state.frames.map(f =>
        f.id === frameId ? { ...f, ...updates } : f
      )
    }))
  },

  setSelectedFrame: (frameId) => {
    set({ selectedFrameId: frameId })
  },

  setRefFrame: (frameId) => {
    set({ refFrameId: frameId })
  },

  setSelectedStackResult: (taskId) => {
    set({ selectedStackResultId: taskId })
  },

  addDarkFrame: (frame) => {
    set((state) => ({
      darkFrames: [...state.darkFrames, frame]
    }))
  },

  addFlatFrame: (frame) => {
    set((state) => ({
      flatFrames: [...state.flatFrames, frame]
    }))
  },

  removeDarkFrame: (frameId) => {
    set((state) => ({
      darkFrames: state.darkFrames.filter(f => f.id !== frameId)
    }))
  },

  removeFlatFrame: (frameId) => {
    set((state) => ({
      flatFrames: state.flatFrames.filter(f => f.id !== frameId)
    }))
  },

  addStackTask: (task) => {
    const newTask: StackTask = {
      ...task,
      id: generateId(),
      status: 'queued',
      progress: 0,
      currentStep: '等待处理',
      currentFrame: 0,
      snrHistory: [],
      createdAt: Date.now()
    }
    set((state) => ({
      stackTasks: [...state.stackTasks, newTask]
    }))
    return newTask.id
  },

  updateStackTask: (taskId, updates) => {
    set((state) => ({
      stackTasks: state.stackTasks.map(t =>
        t.id === taskId ? { ...t, ...updates } : t
      )
    }))
  },

  removeStackTask: (taskId) => {
    set((state) => ({
      stackTasks: state.stackTasks.filter(t => t.id !== taskId),
      selectedStackResultId: state.selectedStackResultId === taskId ? null : state.selectedStackResultId
    }))
  },

  clearCompletedTasks: () => {
    set((state) => ({
      stackTasks: state.stackTasks.filter(t => t.status !== 'completed' && t.status !== 'error')
    }))
  },

  setFilter: (filter) => {
    set({ filter })
  },

  setCalibrationSettings: (settings) => {
    set((state) => ({
      calibrationSettings: { ...state.calibrationSettings, ...settings }
    }))
  },

  setAlignmentSettings: (settings) => {
    set((state) => ({
      alignmentSettings: { ...state.alignmentSettings, ...settings }
    }))
  },

  setStackingSettings: (settings) => {
    set((state) => ({
      stackingSettings: { ...state.stackingSettings, ...settings }
    }))
  },

  setVisualizationSettings: (settings) => {
    set((state) => ({
      visualizationSettings: { ...state.visualizationSettings, ...settings }
    }))
  },

  getFrameById: (frameId) => {
    return get().frames.find(f => f.id === frameId)
  },

  getDarkFrameById: (frameId) => {
    return get().darkFrames.find(f => f.id === frameId)
  },

  getFlatFrameById: (frameId) => {
    return get().flatFrames.find(f => f.id === frameId)
  },

  getFilteredFrames: () => {
    const state = get()
    return state.frames.filter(frame => {
      const frameFilter = frame.header.FILTER || 'Unknown'
      const exposureTime = frame.header.EXPTIME || 0
      const filterMatch = state.filter === 'all' || frameFilter === state.filter
      const exposureMatch = exposureTime >= state.minExposure && exposureTime <= state.maxExposure
      return filterMatch && exposureMatch
    })
  },

  getCalibrationLibraryStats: () => {
    const state = get()
    const darkByTemp: CalibrationLibraryStats['darkFrames']['byTemp'] = {}
    const flatByFilter: CalibrationLibraryStats['flatFrames']['byFilter'] = {}

    for (const dark of state.darkFrames) {
      const key = dark.ccdTemp.toFixed(0)
      if (!darkByTemp[key]) {
        darkByTemp[key] = { count: 0, exposureTimes: [] }
      }
      darkByTemp[key].count += dark.frameCount
      if (!darkByTemp[key].exposureTimes.includes(dark.exposureTime)) {
        darkByTemp[key].exposureTimes.push(dark.exposureTime)
      }
    }

    const insufficientDark: CalibrationLibraryStats['darkFrames']['insufficient'] = []
    for (const [temp, info] of Object.entries(darkByTemp)) {
      if (info.count < 10) {
        for (const exp of info.exposureTimes) {
          insufficientDark.push({
            temp: Number(temp),
            exposure: exp,
            count: info.count,
            recommended: 10
          })
        }
      }
    }

    for (const flat of state.flatFrames) {
      if (!flatByFilter[flat.filter]) {
        flatByFilter[flat.filter] = { count: 0, exposureTimes: [] }
      }
      flatByFilter[flat.filter].count += flat.frameCount
      if (!flatByFilter[flat.filter].exposureTimes.includes(flat.exposureTime)) {
        flatByFilter[flat.filter].exposureTimes.push(flat.exposureTime)
      }
    }

    const insufficientFlat: CalibrationLibraryStats['flatFrames']['insufficient'] = []
    for (const [filter, info] of Object.entries(flatByFilter)) {
      if (info.count < 10) {
        for (const exp of info.exposureTimes) {
          insufficientFlat.push({
            filter,
            exposure: exp,
            count: info.count,
            recommended: 10
          })
        }
      }
    }

    return {
      darkFrames: {
        byTemp: darkByTemp,
        total: state.darkFrames.reduce((sum, d) => sum + d.frameCount, 0),
        insufficient: insufficientDark
      },
      flatFrames: {
        byFilter: flatByFilter,
        total: state.flatFrames.reduce((sum, f) => sum + f.frameCount, 0),
        insufficient: insufficientFlat
      }
    }
  },

  setLoading: (loading) => {
    set({ isLoading: loading })
  },

  setError: (error) => {
    set({ error })
  },

  clearAll: () => {
    set({
      frames: [],
      stackTasks: [],
      selectedFrameId: null,
      selectedStackResultId: null,
      refFrameId: null,
      filterOptions: [],
      filter: 'all',
      isLoading: false,
      error: null
    })
  }
}))
