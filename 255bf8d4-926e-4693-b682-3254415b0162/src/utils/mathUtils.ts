export const mean = (values: number[]): number => {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

export const stdDev = (values: number[]): number => {
  if (values.length === 0) return 0
  const m = mean(values)
  const squareDiffs = values.map(value => Math.pow(value - m, 2))
  return Math.sqrt(mean(squareDiffs))
}

export const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const floor = Math.floor(index)
  const ceil = Math.ceil(index)
  if (floor === ceil) return sorted[floor]
  const fraction = index - floor
  return sorted[floor] + (sorted[ceil] - sorted[floor]) * fraction
}

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t
}

export const gaussian = (x: number, mu: number, sigma: number): number => {
  return Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2)) / (sigma * Math.sqrt(2 * Math.PI))
}

export const degToRad = (deg: number): number => {
  return deg * Math.PI / 180
}

export const radToDeg = (rad: number): number => {
  return rad * 180 / Math.PI
}

export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

export const centroid = (
  data: Float32Array,
  width: number,
  cx: number,
  cy: number,
  radius: number
): { x: number; y: number; flux: number } => {
  let sumX = 0
  let sumY = 0
  let sumFlux = 0
  const r2 = radius * radius

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= r2) {
        const px = Math.floor(cx + dx)
        const py = Math.floor(cy + dy)
        if (px >= 0 && px < width && py >= 0) {
          const idx = py * width + px
          if (idx < data.length) {
            const val = data[idx]
            sumX += val * (cx + dx)
            sumY += val * (cy + dy)
            sumFlux += val
          }
        }
      }
    }
  }

  if (sumFlux === 0) return { x: cx, y: cy, flux: 0 }
  return {
    x: sumX / sumFlux,
    y: sumY / sumFlux,
    flux: sumFlux
  }
}

export const bilinearInterpolation = (
  data: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number
): number => {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = x0 + 1
  const y1 = y0 + 1
  const fx = x - x0
  const fy = y - y0

  if (x0 < 0 || x1 >= width || y0 < 0 || y1 >= height) return 0

  const v00 = data[y0 * width + x0] || 0
  const v10 = data[y0 * width + x1] || 0
  const v01 = data[y1 * width + x0] || 0
  const v11 = data[y1 * width + x1] || 0

  const v0 = v00 * (1 - fx) + v10 * fx
  const v1 = v01 * (1 - fx) + v11 * fx

  return v0 * (1 - fy) + v1 * fy
}

export const applyAffineTransform = (
  matrix: number[],
  x: number,
  y: number
): { x: number; y: number } => {
  return {
    x: matrix[0] * x + matrix[1] * y + matrix[2],
    y: matrix[3] * x + matrix[4] * y + matrix[5]
  }
}

export const solveAffineTransform = (
  srcPoints: Array<{ x: number; y: number }>,
  dstPoints: Array<{ x: number; y: number }>
): number[] | null => {
  if (srcPoints.length < 3 || dstPoints.length < 3) return null
  const n = Math.min(srcPoints.length, dstPoints.length)
  if (n < 3) return null

  const A: number[] = []
  const B: number[] = []

  for (let i = 0; i < n; i++) {
    const s = srcPoints[i]
    const d = dstPoints[i]
    A.push(s.x, s.y, 1, 0, 0, 0)
    A.push(0, 0, 0, s.x, s.y, 1)
    B.push(d.x, d.y)
  }

  const AT = new Array(6).fill(0).map(() => new Array(2 * n).fill(0))
  for (let i = 0; i < 2 * n; i++) {
    for (let j = 0; j < 6; j++) {
      AT[j][i] = A[i * 6 + j]
    }
  }

  const ATA = new Array(6).fill(0).map(() => new Array(6).fill(0))
  const ATB = new Array(6).fill(0)

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      let sum = 0
      for (let k = 0; k < 2 * n; k++) {
        sum += AT[i][k] * A[k * 6 + j]
      }
      ATA[i][j] = sum
    }
    let sum = 0
    for (let k = 0; k < 2 * n; k++) {
      sum += AT[i][k] * B[k]
    }
    ATB[i] = sum
  }

  for (let i = 0; i < 6; i++) {
    let maxRow = i
    for (let k = i + 1; k < 6; k++) {
      if (Math.abs(ATA[k][i]) > Math.abs(ATA[maxRow][i])) {
        maxRow = k
      }
    }
    [ATA[i], ATA[maxRow]] = [ATA[maxRow], ATA[i]]
    ;[ATB[i], ATB[maxRow]] = [ATB[maxRow], ATB[i]]

    const pivot = ATA[i][i]
    if (Math.abs(pivot) < 1e-10) return null

    for (let j = i; j < 6; j++) {
      ATA[i][j] /= pivot
    }
    ATB[i] /= pivot

    for (let k = 0; k < 6; k++) {
      if (k !== i && Math.abs(ATA[k][i]) > 1e-10) {
        const factor = ATA[k][i]
        for (let j = i; j < 6; j++) {
          ATA[k][j] -= factor * ATA[i][j]
        }
        ATB[k] -= factor * ATB[i]
      }
    }
  }

  return ATB
}

export const calculateSNR = (data: Float32Array): number => {
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

  return std === 0 ? 0 : mean / std
}

export const quickSortMedian = (arr: number[], n: number): number => {
  if (n === 0) return 0
  const mid = Math.floor(n / 2)
  let left = 0
  let right = n - 1

  while (left < right) {
    const pivot = arr[right]
    let i = left - 1
    for (let j = left; j < right; j++) {
      if (arr[j] <= pivot) {
        i++
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
    }
    i++
    ;[arr[i], arr[right]] = [arr[right], arr[i]]

    if (mid === i) return arr[i]
    if (mid < i) right = i - 1
    else left = i + 1
  }
  return arr[left]
}

export const madMedian = (data: number[]): { median: number; mad: number } => {
  const med = median(data)
  const deviations = data.map(x => Math.abs(x - med))
  const mad = median(deviations) * 1.4826
  return { median: med, mad }
}
