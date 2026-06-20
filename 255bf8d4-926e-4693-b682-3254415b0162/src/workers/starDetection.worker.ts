import type { StarDetection, AlignmentSettings, WorkerMessage } from '@/core/types'
import { detectStars } from '@/core/StarMatcher'

interface DetectionJob {
  taskId: string
  frameId: string
  pixelData: Float32Array
  width: number
  height: number
  settings: AlignmentSettings
}

let isProcessing = false
let isCancelled = false

const sendProgress = (taskId: string, progress: number, step: string) => {
  self.postMessage({
    type: 'progress',
    payload: { taskId, progress, step }
  })
}

const sendResult = (taskId: string, frameId: string, stars: StarDetection[]) => {
  self.postMessage({
    type: 'result',
    payload: { taskId, frameId, stars }
  })
}

const sendError = (taskId: string, error: string) => {
  self.postMessage({
    type: 'error',
    payload: { taskId, error }
  })
}

const processDetection = async (job: DetectionJob) => {
  const { taskId, frameId, pixelData, width, height, settings } = job
  isProcessing = true
  isCancelled = false

  try {
    sendProgress(taskId, 0.1, '计算背景噪声')

    let sum = 0
    let sumSq = 0
    const n = pixelData.length
    for (let i = 0; i < n; i++) {
      const v = pixelData[i]
      sum += v
      sumSq += v * v
    }
    const mean = sum / n
    const variance = (sumSq / n) - mean * mean
    const std = Math.sqrt(Math.max(0, variance))
    const threshold = mean + settings.detectionThreshold * std

    sendProgress(taskId, 0.3, '检测星点候选')

    const stars = detectStars(pixelData, width, height, settings)

    if (isCancelled) {
      return
    }

    sendProgress(taskId, 0.8, `检测到 ${stars.length} 颗星`)

    if (stars.length < settings.minStars) {
      sendError(taskId, `星点数量不足: ${stars.length} < ${settings.minStars}`)
      isProcessing = false
      return
    }

    sendProgress(taskId, 1.0, '检测完成')
    sendResult(taskId, frameId, stars)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误'
    sendError(taskId, errorMsg)
  }

  isProcessing = false
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload, taskId } = e.data

  switch (type) {
    case 'detect':
      if (isProcessing) {
        self.postMessage({
          type: 'busy',
          payload: { message: 'Worker正在处理中，请稍候' }
        })
        return
      }
      processDetection(payload as DetectionJob)
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
