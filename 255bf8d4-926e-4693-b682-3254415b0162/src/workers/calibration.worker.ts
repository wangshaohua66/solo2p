import type {
  FitsFrame,
  DarkFrameInfo,
  FlatFrameInfo,
  CalibrationSettings,
  WorkerMessage
} from '@/core/types'
import { applyCalibration, matchCalibrationFrames } from '@/core/AstroCalibration'

interface CalibrationJob {
  taskId: string
  frames: FitsFrame[]
  darkFrames: DarkFrameInfo[]
  flatFrames: FlatFrameInfo[]
  settings: CalibrationSettings
}

let isProcessing = false
let isCancelled = false

const sendProgress = (taskId: string, progress: number, step: string, frameIndex?: number, total?: number) => {
  self.postMessage({
    type: 'progress',
    payload: { taskId, progress, step, frameIndex, total }
  })
}

const sendResult = (taskId: string, results: Map<string, Float32Array>) => {
  const resultsObj: Record<string, Float32Array> = {}
  results.forEach((value, key) => {
    resultsObj[key] = value
  })
  self.postMessage({
    type: 'result',
    payload: { taskId, results: resultsObj }
  })
}

const sendError = (taskId: string, error: string) => {
  self.postMessage({
    type: 'error',
    payload: { taskId, error }
  })
}

const processCalibration = async (job: CalibrationJob) => {
  const { taskId, frames, darkFrames, flatFrames, settings } = job
  isProcessing = true
  isCancelled = false

  try {
    const results = new Map<string, Float32Array>()
    const darkCache = new Map<string, DarkFrameInfo>()
    const flatCache = new Map<string, FlatFrameInfo>()

    for (const dark of darkFrames) {
      darkCache.set(dark.id, dark)
    }
    for (const flat of flatFrames) {
      flatCache.set(flat.id, flat)
    }

    sendProgress(taskId, 0.1, '开始校准处理', 0, frames.length)

    for (let i = 0; i < frames.length; i++) {
      if (isCancelled) {
        return
      }

      const frame = frames[i]
      const match = frame.calibrationMatch || matchCalibrationFrames(frame, darkFrames, flatFrames)

      sendProgress(
        taskId,
        0.1 + 0.8 * (i / frames.length),
        `校准帧 ${i + 1}/${frames.length}`,
        i,
        frames.length
      )

      const dark = match.darkFrameId ? darkCache.get(match.darkFrameId) : undefined
      const flat = match.flatFrameId ? flatCache.get(match.flatFrameId) : undefined

      const calibrated = applyCalibration(frame, settings, dark, flat)
      results.set(frame.id, calibrated)
    }

    sendProgress(taskId, 1.0, '校准完成', frames.length, frames.length)
    sendResult(taskId, results)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误'
    sendError(taskId, errorMsg)
  }

  isProcessing = false
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload, taskId } = e.data

  switch (type) {
    case 'calibrate':
      if (isProcessing) {
        self.postMessage({
          type: 'busy',
          payload: { message: 'Worker正在处理中，请稍候' }
        })
        return
      }
      processCalibration(payload as CalibrationJob)
      break

    case 'cancel':
      isCancelled = true
      isProcessing = false
      self.postMessage({
        type: 'cancelled',
        payload: { taskId }
      })
      break

    case 'status':
      self.postMessage({
        type: 'status',
        payload: { isProcessing }
      })
      break

    default:
      console.warn(`Unknown message type: ${type}`)
  }
}

export {}
