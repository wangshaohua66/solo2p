import type { StackingSettings, StackResult } from './types'
import { calculateSNR, mean, quickSortMedian, madMedian } from '@/utils/mathUtils'

export const stackMean = (
  frames: Array<{ id: string; data: Float32Array }>,
  width: number,
  height: number,
  onProgress?: (frameIndex: number, total: number) => void
): StackResult => {
  const pixelCount = width * height
  const result = new Float32Array(pixelCount)
  const frameCount = frames.length
  const snrHistory: number[] = []

  for (let i = 0; i < frameCount; i++) {
    const frameData = frames[i].data
    for (let p = 0; p < pixelCount; p++) {
      result[p] += frameData[p]
    }

    if (i > 0 && (i % 5 === 0 || i === frameCount - 1)) {
      const tempStack = new Float32Array(pixelCount)
      for (let p = 0; p < pixelCount; p++) {
        tempStack[p] = result[p] / (i + 1)
      }
      snrHistory.push(calculateSNR(tempStack))
    }

    if (onProgress) onProgress(i + 1, frameCount)
  }

  for (let p = 0; p < pixelCount; p++) {
    result[p] /= frameCount
  }

  const snr = calculateSNR(result)
  snrHistory.push(snr)

  return {
    width,
    height,
    pixelData: result,
    snr,
    snrHistory,
    stackedCount: frameCount,
    rejectedCount: 0,
    rejectedFrameIds: [],
    meanFwhm: 0
  }
}

export const stackMedian = (
  frames: Array<{ id: string; data: Float32Array }>,
  width: number,
  height: number,
  onProgress?: (frameIndex: number, total: number) => void
): StackResult => {
  const pixelCount = width * height
  const frameCount = frames.length
  const values = new Array(frameCount)
  const result = new Float32Array(pixelCount)
  const snrHistory: number[] = []
  const rejectedFrames: string[] = []

  for (let p = 0; p < pixelCount; p++) {
    for (let f = 0; f < frameCount; f++) {
      values[f] = frames[f].data[p]
    }
    result[p] = quickSortMedian(values, frameCount)
  }

  for (let i = 5; i <= frameCount; i += 5) {
    const tempStack = new Float32Array(pixelCount)
    for (let p = 0; p < pixelCount; p++) {
      for (let f = 0; f < i; f++) {
        values[f] = frames[f].data[p]
      }
      tempStack[p] = quickSortMedian(values, i)
    }
    snrHistory.push(calculateSNR(tempStack))
    if (onProgress) onProgress(i, frameCount)
  }

  const snr = calculateSNR(result)
  snrHistory.push(snr)

  return {
    width,
    height,
    pixelData: result,
    snr,
    snrHistory,
    stackedCount: frameCount,
    rejectedCount: rejectedFrames.length,
    rejectedFrameIds: rejectedFrames,
    meanFwhm: 0
  }
}

export const stackSigmaClip = (
  frames: Array<{ id: string; data: Float32Array; fwhm?: number }>,
  width: number,
  height: number,
  settings: StackingSettings,
  onProgress?: (frameIndex: number, total: number, iter: number, rejected: number) => void
): StackResult => {
  const pixelCount = width * height
  const frameCount = frames.length
  const result = new Float32Array(pixelCount)
  const snrHistory: number[] = []
  const rejectedFrames = new Set<string>()
  let iteration = 0

  let acceptedFrames = frames.map((f, idx) => ({ ...f, idx }))

  while (iteration < settings.iterations && acceptedFrames.length >= 3) {
    const tempResult = new Float32Array(pixelCount)
    const currentCount = acceptedFrames.length
    const values = new Array(currentCount)

    for (let p = 0; p < pixelCount; p++) {
      for (let f = 0; f < currentCount; f++) {
        values[f] = acceptedFrames[f].data[p]
      }
      tempResult[p] = quickSortMedian(values, currentCount)
    }

    const frameDeviations = new Map<number, number>()
    const residuals = new Array(currentCount).fill(0)

    for (let f = 0; f < currentCount; f++) {
      let sumAbsDev = 0
      for (let p = 0; p < pixelCount; p += 100) {
        sumAbsDev += Math.abs(acceptedFrames[f].data[p] - tempResult[p])
      }
      residuals[f] = sumAbsDev / (pixelCount / 100)
    }

    const { median: medRes, mad } = madMedian(residuals)
    const upperLimit = medRes + settings.sigmaThreshold * mad
    const lowerLimit = medRes - settings.sigmaThreshold * mad

    const newAccepted = []
    for (let f = 0; f < currentCount; f++) {
      if (residuals[f] >= lowerLimit && residuals[f] <= upperLimit) {
        newAccepted.push(acceptedFrames[f])
      } else {
        rejectedFrames.add(acceptedFrames[f].id)
      }
    }

    if (newAccepted.length === acceptedFrames.length) {
      break
    }

    acceptedFrames = newAccepted
    iteration++

    if (onProgress) {
      onProgress(
        acceptedFrames.length,
        frameCount,
        iteration,
        rejectedFrames.size
      )
    }

    if (iteration % 2 === 0 || iteration === settings.iterations) {
      const tempStack = new Float32Array(pixelCount)
      const vals = new Array(acceptedFrames.length)
      for (let p = 0; p < pixelCount; p++) {
        for (let f = 0; f < acceptedFrames.length; f++) {
          vals[f] = acceptedFrames[f].data[p]
        }
        tempStack[p] = mean(vals.slice(0, acceptedFrames.length))
      }
      snrHistory.push(calculateSNR(tempStack))
    }
  }

  const finalCount = acceptedFrames.length
  const values = new Array(finalCount)

  for (let p = 0; p < pixelCount; p++) {
    for (let f = 0; f < finalCount; f++) {
      values[f] = acceptedFrames[f].data[p]
    }
    result[p] = mean(values.slice(0, finalCount))
  }

  const snr = calculateSNR(result)
  snrHistory.push(snr)

  const meanFwhm = acceptedFrames.reduce((sum, f) => sum + (f.fwhm || 0), 0) / finalCount

  return {
    width,
    height,
    pixelData: result,
    snr,
    snrHistory,
    stackedCount: finalCount,
    rejectedCount: rejectedFrames.size,
    rejectedFrameIds: Array.from(rejectedFrames),
    meanFwhm
  }
}

export const stackFrames = (
  frames: Array<{ id: string; data: Float32Array; fwhm?: number }>,
  width: number,
  height: number,
  settings: StackingSettings,
  onProgress?: (frameIndex: number, total: number, step: string) => void
): StackResult => {
  const validFrames = frames.filter(f => f && f.data && f.data.length > 0)
  if (validFrames.length === 0) {
    throw new Error('没有有效的帧可用于叠加')
  }

  const totalFrames = frames.length

  switch (settings.mode) {
    case 'mean':
      return stackMean(
        validFrames,
        width,
        height,
        (i, t) => onProgress?.(i, t, '均值叠加')
      )

    case 'median':
      return stackMedian(
        validFrames,
        width,
        height,
        (i, t) => onProgress?.(i, t, '中值叠加')
      )

    case 'sigma-clip':
    default:
      return stackSigmaClip(
        validFrames,
        width,
        height,
        settings,
        (i, t, iter, rej) => onProgress?.(i, t, `Sigma-clip 迭代 ${iter}, 已剔除 ${rej} 帧`)
      )
  }
}

export const calculateFrameQuality = (
  frameData: Float32Array,
  width: number,
  height: number,
  stars: Array<{ fwhm: number; flux: number }>
): { quality: 'good' | 'rejected'; score: number; reason?: string } => {
  let score = 100
  const reasons: string[] = []

  if (stars.length < 5) {
    score -= 50
    reasons.push('星点数量过少')
  }

  if (stars.length > 0) {
    const avgFwhm = stars.reduce((sum, s) => sum + s.fwhm, 0) / stars.length
    if (avgFwhm > 5) {
      score -= 30
      reasons.push(`星点过胖 (FWHM=${avgFwhm.toFixed(1)})`)
    } else if (avgFwhm > 3) {
      score -= 10
    }
  }

  let sum = 0
  let sumSq = 0
  for (let i = 0; i < frameData.length; i++) {
    const v = frameData[i]
    sum += v
    sumSq += v * v
  }
  const mean = sum / frameData.length
  const variance = (sumSq / frameData.length) - mean * mean
  const std = Math.sqrt(Math.max(0, variance))
  const snr = std > 0 ? mean / std : 0

  if (snr < 2) {
    score -= 40
    reasons.push(`信噪比过低 (SNR=${snr.toFixed(1)})`)
  }

  return {
    quality: score >= 60 ? 'good' : 'rejected',
    score,
    reason: reasons.join('; ') || undefined
  }
}
