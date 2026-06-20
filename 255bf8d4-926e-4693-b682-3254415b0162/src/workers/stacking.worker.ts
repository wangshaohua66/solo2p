import type {
  FitsFrame,
  DarkFrameInfo,
  FlatFrameInfo,
  CalibrationSettings,
  AlignmentSettings,
  StackingSettings,
  WorkerMessage,
  WorkerProgress,
  StackResult,
  Tile
} from '@/core/types'
import { matchCalibrationFrames, createMasterDarkTiled, createMasterFlatTiled, calibrateFrameTiled } from '@/core/AstroCalibration'
import { batchAlign } from '@/core/StarMatcher'
import { stackFrames, calculateFrameQuality, stackTiledFrames } from '@/core/ImageStacker'
import { detectStars } from '@/core/StarMatcher'
import { tilesToImage, imageToTiles } from '@/utils/tiledImage'

interface StackJob {
  taskId: string
  frameIds: string[]
  frames: FitsFrame[]
  refFrame: FitsFrame | null
  darkFrames: DarkFrameInfo[]
  flatFrames: FlatFrameInfo[]
  calibrationSettings: CalibrationSettings
  alignmentSettings: AlignmentSettings
  stackingSettings: StackingSettings
}

let currentJob: StackJob | null = null
let isCancelled = false

const sendProgress = (progress: WorkerProgress) => {
  self.postMessage({
    type: 'progress',
    payload: progress
  })
}

const sendResult = (taskId: string, result: StackResult) => {
  self.postMessage({
    type: 'result',
    payload: { taskId, result }
  })
}

const sendError = (taskId: string, error: string) => {
  self.postMessage({
    type: 'error',
    payload: { taskId, error }
  })
}

const processStackJob = async (job: StackJob) => {
  const { taskId, frames, refFrame, darkFrames, flatFrames, calibrationSettings, alignmentSettings, stackingSettings } = job
  isCancelled = false

  try {
    sendProgress({
      taskId,
      progress: 0.05,
      step: '开始处理',
      frameIndex: 0
    })

    sendProgress({
      taskId,
      progress: 0.1,
      step: '构建主暗帧/平场帧分块缓存',
      frameIndex: 0
    })

    const masterDarkTiles = darkFrames.length > 0 && calibrationSettings.darkSubtraction
      ? createMasterDarkTiled(darkFrames, 'median', 512)
      : null

    const masterFlatResult = flatFrames.length > 0 && calibrationSettings.flatCorrection
      ? createMasterFlatTiled(flatFrames, 'median', 512)
      : null

    const masterFlatTiles = masterFlatResult?.tiles
    const flatMean = masterFlatResult?.flatMean

    sendProgress({
      taskId,
      progress: 0.12,
      step: '逐帧分块校准',
      frameIndex: 0
    })

    for (let i = 0; i < frames.length; i++) {
      if (isCancelled) return

      const frame = frames[i]

      const darkCache = new Map<string, DarkFrameInfo>()
      for (const dark of darkFrames) darkCache.set(dark.id, dark)
      const flatCache = new Map<string, FlatFrameInfo>()
      for (const flat of flatFrames) flatCache.set(flat.id, flat)

      const match = frame.calibrationMatch || matchCalibrationFrames(frame, darkFrames, flatFrames)
      const dark = match.darkFrameId ? darkCache.get(match.darkFrameId) : undefined
      const flat = match.flatFrameId ? flatCache.get(match.flatFrameId) : undefined

      let darkTiles = masterDarkTiles
      let flatTiles = masterFlatTiles
      if (dark) {
        const tiles: Tile[] = []
        const tilesX = Math.ceil(frame.width / 512)
        const tilesY = Math.ceil(frame.height / 512)
        for (let ty = 0; ty < tilesY; ty++) {
          for (let tx = 0; tx < tilesX; tx++) {
            const offsetX = tx * 512
            const offsetY = ty * 512
            const w = Math.min(512, frame.width - offsetX)
            const h = Math.min(512, frame.height - offsetY)
            const tileData = new Float32Array(w * h)
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                tileData[y * w + x] = dark.pixelData[(offsetY + y) * frame.width + (offsetX + x)]
              }
            }
            tiles.push({ tileX: tx, tileY: ty, offsetX, offsetY, width: w, height: h, data: tileData })
          }
        }
        darkTiles = tiles
      }
      if (flat) {
        const tiles: Tile[] = []
        const tilesX = Math.ceil(frame.width / 512)
        const tilesY = Math.ceil(frame.height / 512)
        for (let ty = 0; ty < tilesY; ty++) {
          for (let tx = 0; tx < tilesX; tx++) {
            const offsetX = tx * 512
            const offsetY = ty * 512
            const w = Math.min(512, frame.width - offsetX)
            const h = Math.min(512, frame.height - offsetY)
            const tileData = new Float32Array(w * h)
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                tileData[y * w + x] = flat.pixelData[(offsetY + y) * frame.width + (offsetX + x)]
              }
            }
            tiles.push({ tileX: tx, tileY: ty, offsetX, offsetY, width: w, height: h, data: tileData })
          }
        }
        flatTiles = tiles
      }

      const calibratedTiles = calibrateFrameTiled(
        frame,
        calibrationSettings,
        darkTiles ?? undefined,
        flatTiles ?? undefined,
        flatMean,
        512
      )

      const calibratedData = tilesToImage(calibratedTiles, frame.width, frame.height, 0)
      frame.calibratedData = calibratedData

      for (const t of calibratedTiles) {
        t.data = new Float32Array(0)
      }

      sendProgress({
        taskId,
        progress: 0.12 + 0.18 * ((i + 1) / frames.length),
        step: `分块校准帧 ${i + 1}/${frames.length}`,
        frameIndex: i
      })
    }

    if (!refFrame) {
      sendError(taskId, '未指定参考帧')
      return
    }

    sendProgress({
      taskId,
      progress: 0.3,
      step: '检测参考帧星点',
      frameIndex: 0
    })

    const refStars = detectStars(
      refFrame.calibratedData || refFrame.pixelData,
      refFrame.width,
      refFrame.height,
      alignmentSettings
    )

    if (refStars.length < alignmentSettings.minStars) {
      sendError(taskId, `参考帧星点数量不足: ${refStars.length} < ${alignmentSettings.minStars}`)
      return
    }

    sendProgress({
      taskId,
      progress: 0.35,
      step: '批量对齐帧',
      frameIndex: 0
    })

    const otherFrames = frames.filter(f => f.id !== refFrame!.id)
    const alignedResults = batchAlign(
      refFrame,
      otherFrames,
      alignmentSettings,
      (frameIndex, total, step) => {
        sendProgress({
          taskId,
          progress: 0.35 + 0.35 * (frameIndex / total),
          step,
          frameIndex
        })
      }
    )

    for (const frame of frames) {
      if (frame.id === refFrame.id) {
        frame.alignedData = frame.calibratedData
        frame.starDetection = refStars
      } else {
        const aligned = alignedResults.get(frame.id)
        if (aligned) {
          frame.alignedData = aligned.alignedData
          frame.transformMatrix = aligned.transform
        }
      }
    }

    sendProgress({
      taskId,
      progress: 0.7,
      step: '评估帧质量',
      frameIndex: 0
    })

    const goodFrames = []
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      if (!frame.alignedData) continue

      const quality = calculateFrameQuality(
        frame.alignedData,
        frame.width,
        frame.height,
        frame.starDetection || []
      )

      frame.quality = quality.quality
      frame.rejectReason = quality.reason

      if (quality.quality === 'good') {
        const fwhm = frame.starDetection && frame.starDetection.length > 0
          ? frame.starDetection.reduce((sum, s) => sum + s.fwhm, 0) / frame.starDetection.length
          : 0

        goodFrames.push({
          id: frame.id,
          data: frame.alignedData,
          fwhm
        })
      }

      sendProgress({
        taskId,
        progress: 0.7 + 0.1 * (i / frames.length),
        step: `评估帧质量 ${i + 1}/${frames.length}`,
        frameIndex: i
      })
    }

    if (goodFrames.length < 3) {
      sendError(taskId, `有效帧数量不足: ${goodFrames.length} < 3`)
      return
    }

    sendProgress({
      taskId,
      progress: 0.8,
      step: `开始叠加 ${goodFrames.length} 帧 (分块流水线)`,
      frameIndex: 0
    })

    const frameTilesList: Tile[][] = []
    for (const gf of goodFrames) {
      const frame = frames.find(f => f.id === gf.id)
      if (frame && frame.alignedData) {
        const tiles = imageToTiles(frame.alignedData, refFrame.width, refFrame.height, 512, 0)
        frameTilesList.push(tiles)
      }
    }

    const tiledResult = stackTiledFrames(
      frameTilesList,
      refFrame.width,
      refFrame.height,
      stackingSettings,
      512,
      (step, progress) => {
        sendProgress({
          taskId,
          progress: 0.8 + 0.15 * progress,
          step: `分块叠加: ${step}`,
          frameIndex: 0
        })
      }
    )

    const stackedPixelData = tilesToImage(tiledResult.tiles, refFrame.width, refFrame.height, 0)

    const result: StackResult = {
      width: refFrame.width,
      height: refFrame.height,
      pixelData: stackedPixelData,
      snr: tiledResult.snr,
      snrHistory: [tiledResult.snr],
      stackedCount: tiledResult.stackedCount,
      rejectedCount: tiledResult.rejectedCount,
      rejectedFrameIds: [],
      meanFwhm: 0
    }

    sendProgress({
      taskId,
      progress: 0.95,
      step: '计算信噪比',
      snr: result.snr
    })

    sendProgress({
      taskId,
      progress: 1.0,
      step: '处理完成'
    })

    sendResult(taskId, result)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误'
    sendError(taskId, errorMsg)
  }
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload, taskId } = e.data

  switch (type) {
    case 'start':
      currentJob = payload as StackJob
      processStackJob(currentJob)
      break

    case 'cancel':
      isCancelled = true
      currentJob = null
      self.postMessage({
        type: 'cancelled',
        payload: { taskId }
      })
      break

    case 'status':
      self.postMessage({
        type: 'status',
        payload: {
          isProcessing: currentJob !== null,
          currentTaskId: currentJob?.taskId
        }
      })
      break

    default:
      console.warn(`Unknown message type: ${type}`)
  }
}

export {}
