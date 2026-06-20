import type {
  FitsFrame,
  DarkFrameInfo,
  FlatFrameInfo,
  CalibrationSettings,
  AlignmentSettings,
  StackingSettings,
  WorkerMessage,
  WorkerProgress,
  StackResult
} from '@/core/types'
import { batchCalibrate } from '@/core/AstroCalibration'
import { batchAlign } from '@/core/StarMatcher'
import { stackFrames, calculateFrameQuality } from '@/core/ImageStacker'
import { detectStars } from '@/core/StarMatcher'

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
      step: '批量校准帧数据',
      frameIndex: 0
    })

    const calibratedData = batchCalibrate(
      frames,
      calibrationSettings,
      darkFrames,
      flatFrames,
      (frameIndex, total) => {
        sendProgress({
          taskId,
          progress: 0.1 + 0.2 * (frameIndex / total),
          step: `校准帧 ${frameIndex}/${total}`,
          frameIndex
        })
      }
    )

    for (const frame of frames) {
      const calibrated = calibratedData.get(frame.id)
      if (calibrated) {
        frame.calibratedData = calibrated
      }
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
      step: `开始叠加 ${goodFrames.length} 帧`,
      frameIndex: 0
    })

    const result = stackFrames(
      goodFrames,
      refFrame.width,
      refFrame.height,
      stackingSettings,
      (frameIndex, total, step) => {
        sendProgress({
          taskId,
          progress: 0.8 + 0.15 * (frameIndex / total),
          step,
          frameIndex
        })
      }
    )

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
