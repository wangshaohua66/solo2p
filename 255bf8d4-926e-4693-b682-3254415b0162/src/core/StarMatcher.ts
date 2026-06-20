import type { StarDetection, FitsFrame, AlignmentSettings } from './types'
import { generateId, getExposureTime, getGain, getCCDTemp, getFilter } from '@/utils/fitsUtils'
import { centroid, distance, solveAffineTransform, applyAffineTransform, bilinearInterpolation, gaussian } from '@/utils/mathUtils'

export const detectStars = (
  data: Float32Array,
  width: number,
  height: number,
  settings: AlignmentSettings
): StarDetection[] => {
  const stars: StarDetection[] = []
  const thresholdSigma = settings.detectionThreshold

  let sum = 0
  let sumSq = 0
  const n = data.length
  for (let i = 0; i < n; i++) {
    const v = data[i]
    sum += v
    sumSq += v * v
  }
  const mean = sum / n
  const variance = (sumSq / n) - mean * mean
  const std = Math.sqrt(Math.max(0, variance))
  const threshold = mean + thresholdSigma * std

  const visited = new Uint8Array(data.length)
  const candidates: Array<{ x: number; y: number; value: number }> = []

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x
      if (visited[idx]) continue

      const val = data[idx]
      if (val < threshold) continue

      let isLocalMax = true
      for (let dy = -2; dy <= 2 && isLocalMax; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue
          const nidx = (y + dy) * width + (x + dx)
          if (data[nidx] > val) {
            isLocalMax = false
            break
          }
        }
      }

      if (isLocalMax) {
        candidates.push({ x, y, value: val })
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              visited[ny * width + nx] = 1
            }
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.value - a.value)
  const maxStars = Math.min(settings.maxStars, candidates.length)

  for (let i = 0; i < maxStars; i++) {
    const candidate = candidates[i]
    const c = centroid(data, width, candidate.x, candidate.y, 5)

    if (c.flux <= 0) continue

    let sumDist = 0
    let count = 0
    let fluxSum = 0
    const sigma = 2

    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const d2 = dx * dx + dy * dy
        if (d2 <= 25) {
          const px = Math.floor(c.x + dx)
          const py = Math.floor(c.y + dy)
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const val = data[py * width + px] - mean
            if (val > 0) {
              const g = gaussian(Math.sqrt(d2), 0, sigma)
              fluxSum += val * g
              sumDist += val * d2
              count++
            }
          }
        }
      }
    }

    if (count === 0 || fluxSum <= 0) continue

    const fwhm = 2.355 * sigma
    const avgDist = Math.sqrt(sumDist / fluxSum)
    const ellipticity = Math.min(1, Math.abs(avgDist - sigma) / sigma)

    stars.push({
      id: generateId(),
      x: c.x,
      y: c.y,
      flux: c.flux,
      fwhm,
      ellipticity,
      background: mean
    })

    if (stars.length >= settings.maxStars) break
  }

  return stars
}

interface Triangle {
  i: number
  j: number
  k: number
  sides: [number, number, number]
}

const buildTriangles = (stars: StarDetection[]): Triangle[] => {
  const triangles: Triangle[] = []
  const n = stars.length

  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      const d1 = distance(stars[i].x, stars[i].y, stars[j].x, stars[j].y)
      if (d1 > 100) continue

      for (let k = j + 1; k < n; k++) {
        const d2 = distance(stars[i].x, stars[i].y, stars[k].x, stars[k].y)
        const d3 = distance(stars[j].x, stars[j].y, stars[k].x, stars[k].y)
        if (d2 > 100 || d3 > 100) continue

        const sides = [d1, d2, d3].sort((a, b) => a - b) as [number, number, number]
        const maxSide = sides[2]
        if (maxSide > 0 && sides[0] / maxSide < 0.2) continue

        triangles.push({ i, j, k, sides })
      }
    }
  }

  return triangles
}

const triangleMatchScore = (t1: Triangle, t2: Triangle, tolerance: number): number => {
  const r11 = t1.sides[1] / t1.sides[0]
  const r12 = t1.sides[2] / t1.sides[0]
  const r21 = t2.sides[1] / t2.sides[0]
  const r22 = t2.sides[2] / t2.sides[0]

  const d1 = Math.abs(r11 - r21)
  const d2 = Math.abs(r12 - r22)

  if (d1 > tolerance || d2 > tolerance) return 0
  return 1 - (d1 + d2) / (2 * tolerance)
}

export const matchStars = (
  refStars: StarDetection[],
  targetStars: StarDetection[],
  tolerance: number = 0.05,
  minMatches: number = 10
): Array<{ ref: StarDetection; target: StarDetection; score: number }> => {
  if (refStars.length < 3 || targetStars.length < 3) return []

  const refTriangles = buildTriangles(refStars)
  const targetTriangles = buildTriangles(targetStars)

  const matches: Array<{ ref: StarDetection; target: StarDetection; score: number }> = []
  const matchVotes = new Map<string, Map<string, number>>()

  for (const refTri of refTriangles) {
    for (const targetTri of targetTriangles) {
      const score = triangleMatchScore(refTri, targetTri, tolerance)
      if (score > 0.5) {
        const votePairs = [
          [refTri.i, targetTri.i],
          [refTri.j, targetTri.j],
          [refTri.k, targetTri.k]
        ]

        for (const [ri, ti] of votePairs) {
          const refId = refStars[ri].id
          const targetId = targetStars[ti].id
          if (!matchVotes.has(refId)) {
            matchVotes.set(refId, new Map())
          }
          const targetVotes = matchVotes.get(refId)!
          targetVotes.set(targetId, (targetVotes.get(targetId) || 0) + 1)
        }
      }
    }
  }

  const usedTargets = new Set<string>()
  const sortedRefs = refStars.slice().sort((a, b) => b.flux - a.flux)

  for (const refStar of sortedRefs) {
    const targetVotes = matchVotes.get(refStar.id)
    if (!targetVotes) continue

    let bestTarget: StarDetection | null = null
    let bestVotes = 0

    for (const [targetId, votes] of targetVotes.entries()) {
      if (usedTargets.has(targetId)) continue
      if (votes > bestVotes) {
        bestVotes = votes
        bestTarget = targetStars.find(s => s.id === targetId) || null
      }
    }

    if (bestTarget && bestVotes >= 2) {
      usedTargets.add(bestTarget.id)
      matches.push({
        ref: refStar,
        target: bestTarget,
        score: bestVotes
      })
    }
  }

  if (matches.length < minMatches) {
    return ransacRefineMatches(matches, minMatches)
  }

  return ransacRefineMatches(matches, minMatches)
}

const ransacRefineMatches = (
  initialMatches: Array<{ ref: StarDetection; target: StarDetection; score: number }>,
  minSamples: number = 3
): Array<{ ref: StarDetection; target: StarDetection; score: number }> => {
  if (initialMatches.length < minSamples) return initialMatches

  const maxIterations = 100
  const inlierThreshold = 3
  let bestInliers: typeof initialMatches = []

  for (let iter = 0; iter < maxIterations; iter++) {
    const shuffled = [...initialMatches].sort(() => Math.random() - 0.5)
    const sample = shuffled.slice(0, minSamples)

    const refPoints = sample.map(m => ({ x: m.ref.x, y: m.ref.y }))
    const targetPoints = sample.map(m => ({ x: m.target.x, y: m.target.y }))

    const matrix = solveAffineTransform(targetPoints, refPoints)
    if (!matrix) continue

    const inliers: typeof initialMatches = []
    for (const match of initialMatches) {
      const transformed = applyAffineTransform(matrix, match.target.x, match.target.y)
      const dist = distance(transformed.x, transformed.y, match.ref.x, match.ref.y)
      if (dist < inlierThreshold) {
        inliers.push(match)
      }
    }

    if (inliers.length > bestInliers.length) {
      bestInliers = inliers
    }
  }

  return bestInliers.length > 0 ? bestInliers : initialMatches
}

export const calculateTransform = (
  refStars: StarDetection[],
  targetStars: StarDetection[],
  matches: Array<{ ref: StarDetection; target: StarDetection; score: number }>
): number[] | null => {
  if (matches.length < 3) return null

  const refPoints = matches.map(m => ({ x: m.ref.x, y: m.ref.y }))
  const targetPoints = matches.map(m => ({ x: m.target.x, y: m.target.y }))

  return solveAffineTransform(targetPoints, refPoints)
}

export const applyTransform = (
  data: Float32Array,
  width: number,
  height: number,
  transformMatrix: number[],
  outputWidth?: number,
  outputHeight?: number
): Float32Array => {
  const outW = outputWidth || width
  const outH = outputHeight || height
  const result = new Float32Array(outW * outH)

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const srcX = transformMatrix[0] * x + transformMatrix[1] * y + transformMatrix[2]
      const srcY = transformMatrix[3] * x + transformMatrix[4] * y + transformMatrix[5]

      if (srcX >= 0 && srcX < width - 1 && srcY >= 0 && srcY < height - 1) {
        result[y * outW + x] = bilinearInterpolation(data, width, height, srcX, srcY)
      }
    }
  }

  return result
}

export const alignFrame = (
  refFrame: FitsFrame,
  targetFrame: FitsFrame,
  settings: AlignmentSettings,
  onProgress?: (step: string, progress: number) => void
): {
  transform: number[] | null
  alignedData: Float32Array | null
  stars: StarDetection[]
  matches: number
  error?: string
} => {
  try {
    if (onProgress) onProgress('检测参考帧星点', 0.1)
    const refStars = detectStars(
      refFrame.calibratedData || refFrame.pixelData,
      refFrame.width,
      refFrame.height,
      settings
    )

    if (refStars.length < settings.minStars) {
      return {
        transform: null,
        alignedData: null,
        stars: refStars,
        matches: 0,
        error: `参考帧星点数量不足: ${refStars.length} < ${settings.minStars}`
      }
    }

    if (onProgress) onProgress('检测目标帧星点', 0.3)
    const targetStars = detectStars(
      targetFrame.calibratedData || targetFrame.pixelData,
      targetFrame.width,
      targetFrame.height,
      settings
    )

    if (targetStars.length < settings.minStars) {
      return {
        transform: null,
        alignedData: null,
        stars: targetStars,
        matches: 0,
        error: `目标帧星点数量不足: ${targetStars.length} < ${settings.minStars}`
      }
    }

    if (onProgress) onProgress('匹配星点对', 0.5)
    const matches = matchStars(refStars, targetStars, settings.matchTolerance, settings.minStars)

    if (matches.length < settings.minStars) {
      return {
        transform: null,
        alignedData: null,
        stars: targetStars,
        matches: matches.length,
        error: `星点匹配数量不足: ${matches.length} < ${settings.minStars}`
      }
    }

    if (onProgress) onProgress('计算变换矩阵', 0.7)
    const transform = calculateTransform(refStars, targetStars, matches)
    if (!transform) {
      return {
        transform: null,
        alignedData: null,
        stars: targetStars,
        matches: matches.length,
        error: '无法计算仿射变换矩阵'
      }
    }

    if (onProgress) onProgress('应用图像变换', 0.9)
    const alignedData = applyTransform(
      targetFrame.calibratedData || targetFrame.pixelData,
      targetFrame.width,
      targetFrame.height,
      transform,
      refFrame.width,
      refFrame.height
    )

    if (onProgress) onProgress('对齐完成', 1.0)

    return {
      transform,
      alignedData,
      stars: targetStars,
      matches: matches.length
    }
  } catch (error) {
    return {
      transform: null,
      alignedData: null,
      stars: [],
      matches: 0,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

export const batchAlign = (
  refFrame: FitsFrame,
  frames: FitsFrame[],
  settings: AlignmentSettings,
  onProgress?: (frameIndex: number, total: number, step: string) => void
): Map<string, { transform: number[]; alignedData: Float32Array; fwhm: number }> => {
  const results = new Map()

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    if (onProgress) onProgress(i, frames.length, `对齐帧 ${i + 1}/${frames.length}`)

    const result = alignFrame(refFrame, frame, settings)
    if (result.transform && result.alignedData) {
      const avgFwhm = result.stars.length > 0
        ? result.stars.reduce((sum, s) => sum + s.fwhm, 0) / result.stars.length
        : 0

      results.set(frame.id, {
        transform: result.transform,
        alignedData: result.alignedData,
        fwhm: avgFwhm
      })
    } else {
      frame.quality = 'rejected'
      frame.rejectReason = result.error || '对齐失败'
    }
  }

  return results
}
