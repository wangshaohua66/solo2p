import type {
  FitsFrame,
  DarkFrameInfo,
  FlatFrameInfo,
  CalibrationSettings,
  WorkerMessage,
  Tile
} from '@/core/types'
import { applyCalibration, matchCalibrationFrames, calibrateFrameTiled, createMasterDarkTiled, createMasterFlatTiled } from '@/core/AstroCalibration'
import { tilesToImage } from '@/utils/tiledImage'

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

    const masterDarkTiles = darkFrames.length > 0 && settings.darkSubtraction
      ? createMasterDarkTiled(darkFrames, 'median', 512)
      : null

    const masterFlatResult = flatFrames.length > 0 && settings.flatCorrection
      ? createMasterFlatTiled(flatFrames, 'median', 512)
      : null

    const masterFlatTiles = masterFlatResult?.tiles
    const flatMean = masterFlatResult?.flatMean

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

      const darkTiles = dark 
        ? imageToTilesSingle(dark.pixelData, frame.width, frame.height, 512)
        : masterDarkTiles ?? undefined
      const flatTiles = flat
        ? imageToTilesSingle(flat.pixelData, frame.width, frame.height, 512)
        : masterFlatTiles ?? undefined

      const calibratedTiles = calibrateFrameTiled(
        frame,
        settings,
        darkTiles,
        flatTiles,
        flatMean,
        512
      )

      const calibrated = tilesToImage(calibratedTiles, frame.width, frame.height, 0)
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

const imageToTilesSingle = (data: Float32Array, width: number, height: number, tileSize: number): Tile[] => {
  const tiles: Tile[] = []
  const tilesX = Math.ceil(width / tileSize)
  const tilesY = Math.ceil(height / tileSize)

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const offsetX = tx * tileSize
      const offsetY = ty * tileSize
      const w = Math.min(tileSize, width - offsetX)
      const h = Math.min(tileSize, height - offsetY)
      const tileData = new Float32Array(w * h)

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          tileData[y * w + x] = data[(offsetY + y) * width + (offsetX + x)]
        }
      }

      tiles.push({
        tileX: tx,
        tileY: ty,
        offsetX,
        offsetY,
        width: w,
        height: h,
        data: tileData
      })
    }
  }

  return tiles
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
