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
import { calculateFrameQuality, stackTiledFrames } from '@/core/ImageStacker'
import { detectStars, alignFrame } from '@/core/StarMatcher'
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

  const calibrateSingleFrame = (frame: FitsFrame, masterDarkTiles: Tile[] | null, masterFlatTiles: Tile[] | undefined, flatMean: number | undefined): Float32Array => {
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
    for (const t of calibratedTiles) t.data = new Float32Array(0)
    if (dark) for (const t of (darkTiles as Tile[])) t.data = new Float32Array(0)
    if (flat) for (const t of (flatTiles as Tile[])) t.data = new Float32Array(0)
    return calibratedData
  }

  try {
    sendProgress({ taskId, progress: 0.05, step: '开始处理', frameIndex: 0 })

    if (!refFrame) {
      sendError(taskId, '未指定参考帧')
      return
    }

    sendProgress({ taskId, progress: 0.1, step: '构建主暗帧/平场帧分块缓存', frameIndex: 0 })

    const masterDarkTiles = darkFrames.length > 0 && calibrationSettings.darkSubtraction
      ? createMasterDarkTiled(darkFrames, 'median', 512)
      : null

    const masterFlatResult = flatFrames.length > 0 && calibrationSettings.flatCorrection
      ? createMasterFlatTiled(flatFrames, 'median', 512)
      : null

    const masterFlatTiles = masterFlatResult?.tiles
    const flatMean = masterFlatResult?.flatMean

    sendProgress({ taskId, progress: 0.12, step: '校准参考帧', frameIndex: 0 })

    const refCalibrated = calibrateSingleFrame(refFrame, masterDarkTiles, masterFlatTiles, flatMean)
    const refStars = detectStars(refCalibrated, refFrame.width, refFrame.height, alignmentSettings)

    if (refStars.length < alignmentSettings.minStars) {
      sendError(taskId, `参考帧星点数量不足: ${refStars.length} < ${alignmentSettings.minStars}`)
      return
    }

    sendProgress({ taskId, progress: 0.15, step: '【第1遍】逐帧质量评估（流式，处理完立即释放）', frameIndex: 0 })

    const qualityResults = new Map<string, { good: boolean; fwhm: number; stars: any[]; alignedDataRef?: Float32Array }>()

    for (let i = 0; i < frames.length; i++) {
      if (isCancelled) return

      const frame = frames[i]
      const isRef = frame.id === refFrame.id

      let frameCalibrated: Float32Array
      let frameStars: any[]
      let frameAligned: Float32Array | null

      if (isRef) {
        frameCalibrated = refCalibrated
        frameStars = refStars
        frameAligned = refCalibrated
      } else {
        frameCalibrated = calibrateSingleFrame(frame, masterDarkTiles, masterFlatTiles, flatMean)

        const alignedRes = alignFrame(
          { ...refFrame, calibratedData: refCalibrated } as FitsFrame,
          { ...frame, calibratedData: frameCalibrated } as FitsFrame,
          alignmentSettings,
          () => {}
        )

        frameStars = alignedRes.stars
        frameAligned = alignedRes.alignedData

        if (!frameAligned) {
          qualityResults.set(frame.id, { good: false, fwhm: 0, stars: frameStars })
          if (!isRef) (frameCalibrated as any) = null
          sendProgress({
            taskId,
            progress: 0.15 + 0.45 * ((i + 1) / frames.length),
            step: `【第1遍】跳过帧 ${i + 1}/${frames.length}: ${alignedRes.error || '对齐失败'}`,
            frameIndex: i
          })
          continue
        }
      }

      const quality = calculateFrameQuality(frameAligned, frame.width, frame.height, frameStars || [])
      frame.quality = quality.quality
      frame.rejectReason = quality.reason

      const fwhm = (frameStars && frameStars.length > 0)
        ? frameStars.reduce((sum: number, s: any) => sum + s.fwhm, 0) / frameStars.length
        : 0

      qualityResults.set(frame.id, {
        good: quality.quality === 'good',
        fwhm,
        stars: frameStars
      })

      if (!isRef) {
        (frameCalibrated as any) = null
        if (frameAligned && frameAligned !== refCalibrated) {
          (frameAligned as any) = null
        }
      }

      sendProgress({
        taskId,
        progress: 0.15 + 0.45 * ((i + 1) / frames.length),
        step: `【第1遍】质量评估 ${i + 1}/${frames.length}: ${quality.quality === 'good' ? `通过(score=${quality.score})` : `拒绝(${quality.reason})`}`,
        frameIndex: i
      })
    }

    const acceptedFrameIds = frames
      .filter(f => qualityResults.get(f.id)?.good)
      .map(f => f.id)

    if (acceptedFrameIds.length < 3) {
      sendError(taskId, `有效帧数量不足: ${acceptedFrameIds.length} < 3`)
      return
    }

    sendProgress({
      taskId,
      progress: 0.6,
      step: `【第2遍】逐帧校准→对齐→叠加入累加器 (通过 ${acceptedFrameIds.length}/${frames.length} 帧)`,
      frameIndex: 0
    })

    const acceptedFrameTilesList: Tile[][] = []
    for (let i = 0; i < frames.length; i++) {
      if (isCancelled) return

      const frame = frames[i]
      if (!acceptedFrameIds.includes(frame.id)) continue

      const isRef = frame.id === refFrame.id

      let frameCalibrated: Float32Array
      let frameAligned: Float32Array

      if (isRef) {
        frameCalibrated = refCalibrated
        frameAligned = refCalibrated
      } else {
        frameCalibrated = calibrateSingleFrame(frame, masterDarkTiles, masterFlatTiles, flatMean)

        const alignedRes = alignFrame(
          { ...refFrame, calibratedData: refCalibrated } as FitsFrame,
          { ...frame, calibratedData: frameCalibrated } as FitsFrame,
          alignmentSettings,
          () => {}
        )

        if (!alignedRes.alignedData) {
          (frameCalibrated as any) = null
          continue
        }
        frameAligned = alignedRes.alignedData
      }

      const tiles = imageToTiles(frameAligned, refFrame.width, refFrame.height, 512, 0)
      acceptedFrameTilesList.push(tiles)

      if (!isRef) {
        (frameCalibrated as any) = null
        if (frameAligned !== refCalibrated) {
          (frameAligned as any) = null
        }
      }

      sendProgress({
        taskId,
        progress: 0.6 + 0.25 * ((i + 1) / frames.length),
        step: `【第2遍】叠加帧 ${i + 1}/${frames.length} (已入累加器)`,
        frameIndex: i
      })
    }

    (refCalibrated as any) = null
    if (masterDarkTiles) for (const t of masterDarkTiles) t.data = new Float32Array(0)
    if (masterFlatTiles) for (const t of masterFlatTiles) t.data = new Float32Array(0)

    sendProgress({
      taskId,
      progress: 0.85,
      step: `从累加器合成最终图像 (${acceptedFrameTilesList.length} 帧分块)`,
      frameIndex: 0
    })

    const tiledResult = stackTiledFrames(
      acceptedFrameTilesList,
      refFrame.width,
      refFrame.height,
      stackingSettings,
      512,
      (step, progress) => {
        sendProgress({
          taskId,
          progress: 0.85 + 0.1 * progress,
          step: `分块合成: ${step}`,
          frameIndex: 0
        })
      }
    )

    for (const tiles of acceptedFrameTilesList) {
      for (const t of tiles) t.data = new Float32Array(0)
    }

    const stackedPixelData = tilesToImage(tiledResult.tiles, refFrame.width, refFrame.height, 0)
    for (const t of tiledResult.tiles) t.data = new Float32Array(0)

    const meanFwhm = acceptedFrameIds.length > 0
      ? acceptedFrameIds.reduce((sum, id) => sum + (qualityResults.get(id)?.fwhm || 0), 0) / acceptedFrameIds.length
      : 0

    const rejectedIds = frames.filter(f => !acceptedFrameIds.includes(f.id)).map(f => f.id)

    const result: StackResult = {
      width: refFrame.width,
      height: refFrame.height,
      pixelData: stackedPixelData,
      snr: tiledResult.snr,
      snrHistory: [tiledResult.snr],
      stackedCount: tiledResult.stackedCount,
      rejectedCount: tiledResult.rejectedCount + rejectedIds.length,
      rejectedFrameIds: rejectedIds,
      meanFwhm
    }

    sendProgress({ taskId, progress: 0.95, step: '计算信噪比', snr: result.snr })
    sendProgress({ taskId, progress: 1.0, step: '处理完成' })

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
