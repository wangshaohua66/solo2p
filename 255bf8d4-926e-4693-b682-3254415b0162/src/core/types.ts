export interface FitsHeader {
  SIMPLE: boolean
  BITPIX: number
  NAXIS: number
  NAXIS1: number
  NAXIS2: number
  EXTEND?: boolean
  EXPTIME?: number
  GAIN?: number
  'CCD-TEMP'?: number
  FILTER?: string
  RA?: number
  DEC?: number
  'DATE-OBS'?: string
  OBJECT?: string
  TELESCOP?: string
  INSTRUME?: string
  AIRMASS?: number
  [key: string]: any
}

export interface StarDetection {
  id: string
  x: number
  y: number
  flux: number
  fwhm: number
  ellipticity: number
  background: number
}

export interface CalibrationMatch {
  id: string
  targetFrameId: string
  darkFrameId?: string
  flatFrameId?: string
  matchScore: number
  manualOverride: boolean
}

export interface DarkFrameInfo {
  id: string
  fileName: string
  exposureTime: number
  gain: number
  ccdTemp: number
  frameCount: number
  pixelData: Float32Array
  width: number
  height: number
}

export interface FlatFrameInfo {
  id: string
  fileName: string
  filter: string
  exposureTime: number
  gain: number
  frameCount: number
  pixelData: Float32Array
  width: number
  height: number
}

export interface FitsFrame {
  id: string
  fileName: string
  header: FitsHeader
  pixelData: Float32Array
  calibratedData?: Float32Array
  alignedData?: Float32Array
  width: number
  height: number
  thumbnail: string
  calibrationMatch?: CalibrationMatch
  starDetection?: StarDetection[]
  transformMatrix?: number[]
  quality: 'pending' | 'good' | 'rejected'
  rejectReason?: string
  processedAt?: number
}

export interface CalibrationSettings {
  darkSubtraction: boolean
  flatCorrection: boolean
  badPixelInterpolation: boolean
  darkFrameId?: string
  flatFrameId?: string
  badPixelThreshold: number
}

export interface AlignmentSettings {
  detectionThreshold: number
  minStars: number
  maxStars: number
  subpixelAccuracy: boolean
  maxIterations: number
  matchTolerance: number
}

export interface StackingSettings {
  mode: 'mean' | 'median' | 'sigma-clip'
  sigmaThreshold: number
  iterations: number
  percentileLow: number
  percentileHigh: number
}

export interface VisualizationSettings {
  stretchFunction: 'linear' | 'log' | 'asinh' | 'auto'
  blackPoint: number
  whitePoint: number
  colorMap: 'gray' | 'heat' | 'cool' | 'viridis'
  gamma: number
  showStars: boolean
  showCrosshair: boolean
}

export interface StackResult {
  width: number
  height: number
  pixelData: Float32Array
  snr: number
  snrHistory: number[]
  stackedCount: number
  rejectedCount: number
  rejectedFrameIds: string[]
  meanFwhm: number
}

export interface StackTask {
  id: string
  name: string
  frameIds: string[]
  status: 'queued' | 'processing' | 'completed' | 'error'
  progress: number
  currentStep: string
  currentFrame: number
  totalFrames: number
  snrHistory: number[]
  calibrationSettings: CalibrationSettings
  alignmentSettings: AlignmentSettings
  stackingSettings: StackingSettings
  result?: StackResult
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export interface ObservationSession {
  id: string
  name: string
  date: string
  target: string
  filter: string
  frameCount: number
  frameIds: string[]
}

export interface WorkerMessage {
  type: string
  payload: any
  taskId?: string
}

export interface WorkerProgress {
  taskId: string
  progress: number
  step: string
  frameIndex?: number
  snr?: number
}

export interface HistogramData {
  bins: number[]
  min: number
  max: number
  mean: number
  median: number
  stdDev: number
}

export interface PixelInfo {
  x: number
  y: number
  value: number
  adu: number
}

export interface CanvasViewport {
  scale: number
  offsetX: number
  offsetY: number
}

export interface CalibrationLibraryStats {
  darkFrames: {
    byTemp: Record<string, { count: number; exposureTimes: number[] }>
    total: number
    insufficient: Array<{ temp: number; exposure: number; count: number; recommended: number }>
  }
  flatFrames: {
    byFilter: Record<string, { count: number; exposureTimes: number[] }>
    total: number
    insufficient: Array<{ filter: string; exposure: number; count: number; recommended: number }>
  }
}
