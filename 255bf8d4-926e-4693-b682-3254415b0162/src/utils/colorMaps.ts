export type ColorMapName = 'gray' | 'heat' | 'cool' | 'viridis'

export interface RGB {
  r: number
  g: number
  b: number
}

const createLUT = (stops: Array<[number, number, number, number]>, size: number = 256): RGB[] => {
  const lut: RGB[] = new Array(size)
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1)
    let idx = 0
    while (idx < stops.length - 1 && t > stops[idx + 1][0]) {
      idx++
    }
    if (idx === stops.length - 1) {
      lut[i] = {
        r: stops[idx][1] * 255,
        g: stops[idx][2] * 255,
        b: stops[idx][3] * 255
      }
    } else {
      const t0 = stops[idx][0]
      const t1 = stops[idx + 1][0]
      const f = (t - t0) / (t1 - t0)
      lut[i] = {
        r: (stops[idx][1] + (stops[idx + 1][1] - stops[idx][1]) * f) * 255,
        g: (stops[idx][2] + (stops[idx + 1][2] - stops[idx][2]) * f) * 255,
        b: (stops[idx][3] + (stops[idx + 1][3] - stops[idx][3]) * f) * 255
      }
    }
  }
  return lut
}

const grayStops: Array<[number, number, number, number]> = [
  [0, 0, 0, 0],
  [1, 1, 1, 1]
]

const heatStops: Array<[number, number, number, number]> = [
  [0, 0, 0, 0],
  [0.2, 0.2, 0, 0.3],
  [0.4, 0.5, 0, 0.4],
  [0.6, 0.8, 0.2, 0],
  [0.8, 1, 0.6, 0],
  [1, 1, 1, 0.5]
]

const coolStops: Array<[number, number, number, number]> = [
  [0, 0, 0, 0.2],
  [0.3, 0, 0.2, 0.5],
  [0.5, 0, 0.5, 0.7],
  [0.7, 0.2, 0.7, 0.8],
  [1, 0.5, 0.9, 1]
]

const viridisStops: Array<[number, number, number, number]> = [
  [0, 0.267004, 0.004874, 0.329415],
  [0.1, 0.282656, 0.096516, 0.413393],
  [0.2, 0.279553, 0.175701, 0.484504],
  [0.3, 0.263657, 0.248888, 0.538861],
  [0.4, 0.237441, 0.320606, 0.577528],
  [0.5, 0.206756, 0.391785, 0.597993],
  [0.6, 0.179567, 0.461741, 0.597803],
  [0.7, 0.163625, 0.531396, 0.576378],
  [0.8, 0.179424, 0.60117, 0.533905],
  [0.9, 0.246214, 0.672144, 0.464757],
  [1, 0.993248, 0.906157, 0.143936]
]

const colorMaps: Record<ColorMapName, RGB[]> = {
  gray: createLUT(grayStops),
  heat: createLUT(heatStops),
  cool: createLUT(coolStops),
  viridis: createLUT(viridisStops)
}

export const applyColorMap = (
  value: number,
  min: number,
  max: number,
  colorMap: ColorMapName
): RGB => {
  if (max <= min) return { r: 0, g: 0, b: 0 }
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const lut = colorMaps[colorMap]
  const idx = Math.floor(normalized * (lut.length - 1))
  return lut[idx]
}

export type StretchFunction = 'linear' | 'log' | 'arctan' | 'auto'

export const applyStretch = (
  value: number,
  blackPoint: number,
  whitePoint: number,
  stretch: StretchFunction,
  gamma: number = 1
): number => {
  if (whitePoint <= blackPoint) return 0
  let normalized = (value - blackPoint) / (whitePoint - blackPoint)
  normalized = Math.max(0, Math.min(1, normalized))

  switch (stretch) {
    case 'log':
      normalized = Math.log(1 + normalized * 9) / Math.log(10)
      break
    case 'arctan':
      const stretchAmount = 10
      normalized = Math.atan(normalized * stretchAmount) / Math.atan(stretchAmount)
      break
    case 'auto':
      const mid = 0.5
      if (normalized < mid) {
        normalized = 0.5 * Math.pow(normalized / mid, 0.7)
      } else {
        normalized = 0.5 + 0.5 * (1 - Math.pow((1 - normalized) / (1 - mid), 1.5))
      }
      break
    case 'linear':
    default:
      break
  }

  if (gamma !== 1) {
    normalized = Math.pow(normalized, gamma)
  }

  return normalized
}

export const autoStretchParams = (
  data: Float32Array
): { blackPoint: number; whitePoint: number } => {
  const values = Array.from(data).filter(v => isFinite(v) && !isNaN(v))
  if (values.length === 0) return { blackPoint: 0, whitePoint: 1 }

  values.sort((a, b) => a - b)
  const p1 = values[Math.floor(values.length * 0.01)]
  const p99 = values[Math.floor(values.length * 0.99)]

  return {
    blackPoint: p1,
    whitePoint: p99
  }
}

export const calculateHistogram = (
  data: Float32Array,
  bins: number = 256
): { counts: number[]; min: number; max: number } => {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (isFinite(v)) {
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
  }

  const counts = new Array(bins).fill(0)
  if (max === min) return { counts, min, max }

  const range = max - min
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (isFinite(v)) {
      const bin = Math.min(bins - 1, Math.floor(((v - min) / range) * bins))
      counts[bin]++
    }
  }

  return { counts, min, max }
}

export const pixelToImageData = (
  pixelData: Float32Array,
  width: number,
  height: number,
  blackPoint: number,
  whitePoint: number,
  stretch: StretchFunction,
  colorMap: ColorMapName,
  gamma: number = 1
): ImageData => {
  const imageData = new ImageData(width, height)
  const rgba = imageData.data

  for (let i = 0; i < pixelData.length; i++) {
    const stretched = applyStretch(pixelData[i], blackPoint, whitePoint, stretch, gamma)
    const color = applyColorMap(stretched, 0, 1, colorMap)
    const rgbaIdx = i * 4
    rgba[rgbaIdx] = color.r
    rgba[rgbaIdx + 1] = color.g
    rgba[rgbaIdx + 2] = color.b
    rgba[rgbaIdx + 3] = 255
  }

  return imageData
}

export interface ChannelRenderParams {
  pixelData: Float32Array | null
  blackPoint: number
  whitePoint: number
  stretch: StretchFunction
  gamma: number
  weight: number
}

export const pixelToImageDataRGB = (
  red: ChannelRenderParams,
  green: ChannelRenderParams,
  blue: ChannelRenderParams,
  width: number,
  height: number
): ImageData => {
  const imageData = new ImageData(width, height)
  const rgba = imageData.data
  const pixelCount = width * height

  for (let i = 0; i < pixelCount; i++) {
    const rgbaIdx = i * 4

    let r = 0, g = 0, b = 0

    if (red.pixelData && i < red.pixelData.length) {
      const stretched = applyStretch(red.pixelData[i], red.blackPoint, red.whitePoint, red.stretch, red.gamma)
      r = Math.max(0, Math.min(1, stretched)) * red.weight * 255
    }

    if (green.pixelData && i < green.pixelData.length) {
      const stretched = applyStretch(green.pixelData[i], green.blackPoint, green.whitePoint, green.stretch, green.gamma)
      g = Math.max(0, Math.min(1, stretched)) * green.weight * 255
    }

    if (blue.pixelData && i < blue.pixelData.length) {
      const stretched = applyStretch(blue.pixelData[i], blue.blackPoint, blue.whitePoint, blue.stretch, blue.gamma)
      b = Math.max(0, Math.min(1, stretched)) * blue.weight * 255
    }

    rgba[rgbaIdx] = r
    rgba[rgbaIdx + 1] = g
    rgba[rgbaIdx + 2] = b
    rgba[rgbaIdx + 3] = 255
  }

  return imageData
}

export const stretchPixelChannel = (
  pixelData: Float32Array,
  blackPoint: number,
  whitePoint: number,
  stretch: StretchFunction,
  gamma: number
): Float32Array => {
  const result = new Float32Array(pixelData.length)
  for (let i = 0; i < pixelData.length; i++) {
    result[i] = applyStretch(pixelData[i], blackPoint, whitePoint, stretch, gamma)
  }
  return result
}
