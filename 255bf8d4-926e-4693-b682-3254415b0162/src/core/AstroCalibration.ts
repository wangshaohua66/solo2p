import type { FitsFrame, DarkFrameInfo, FlatFrameInfo, CalibrationSettings, CalibrationMatch, Tile } from './types'
import { generateId, calibrationMatchScore, getExposureTime, getGain, getCCDTemp, getFilter } from '@/utils/fitsUtils'
import { median, quickSortMedian } from '@/utils/mathUtils'
import { createTileGrid, imageToTiles, tilesToImage } from '@/utils/tiledImage'

export const subtractDark = (
  targetData: Float32Array,
  darkData: Float32Array
): Float32Array => {
  const result = new Float32Array(targetData.length)
  for (let i = 0; i < targetData.length; i++) {
    result[i] = Math.max(0, targetData[i] - darkData[i])
  }
  return result
}

export const divideFlat = (
  targetData: Float32Array,
  flatData: Float32Array
): Float32Array => {
  let flatSum = 0
  for (let i = 0; i < flatData.length; i++) {
    flatSum += flatData[i]
  }
  const flatMean = flatSum / flatData.length
  if (flatMean <= 0) {
    return new Float32Array(targetData.length)
  }

  const result = new Float32Array(targetData.length)
  for (let i = 0; i < targetData.length; i++) {
    const normalizedFlat = flatData[i] / flatMean
    result[i] = normalizedFlat > 0 ? targetData[i] / normalizedFlat : 0
  }
  return result
}

export const interpolateBadPixels = (
  data: Float32Array,
  width: number,
  height: number,
  threshold: number = 5
): Float32Array => {
  const result = new Float32Array(data)
  const neighborhood = new Array(9)

  let mean = 0
  for (let i = 0; i < data.length; i++) {
    mean += data[i]
  }
  mean /= data.length

  let sumSq = 0
  for (let i = 0; i < data.length; i++) {
    const diff = data[i] - mean
    sumSq += diff * diff
  }
  const std = Math.sqrt(sumSq / data.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const val = data[idx]
      const zScore = Math.abs((val - mean) / std)

      if (zScore > threshold) {
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              neighborhood[count++] = data[ny * width + nx]
            }
          }
        }
        result[idx] = quickSortMedian(neighborhood.slice(0, count), count)
      }
    }
  }

  return result
}

export const applyCalibration = (
  frame: FitsFrame,
  settings: CalibrationSettings,
  darkFrame?: DarkFrameInfo,
  flatFrame?: FlatFrameInfo
): Float32Array => {
  let result = new Float32Array(frame.pixelData)

  if (settings.darkSubtraction && darkFrame) {
    result = subtractDark(result, darkFrame.pixelData)
  }

  if (settings.flatCorrection && flatFrame) {
    result = divideFlat(result, flatFrame.pixelData)
  }

  if (settings.badPixelInterpolation) {
    result = interpolateBadPixels(result, frame.width, frame.height, settings.badPixelThreshold)
  }

  return result
}

export const createMasterDark = (
  darkFrames: DarkFrameInfo[],
  mode: 'mean' | 'median' = 'median'
): Float32Array | null => {
  if (darkFrames.length === 0) return null

  const { width, height } = darkFrames[0]
  const frameCount = darkFrames.length
  const result = new Float32Array(width * height)

  if (mode === 'mean') {
    for (let i = 0; i < width * height; i++) {
      let sum = 0
      for (let f = 0; f < frameCount; f++) {
        sum += darkFrames[f].pixelData[i]
      }
      result[i] = sum / frameCount
    }
  } else {
    const values = new Array(frameCount)
    for (let i = 0; i < width * height; i++) {
      for (let f = 0; f < frameCount; f++) {
        values[f] = darkFrames[f].pixelData[i]
      }
      result[i] = quickSortMedian(values, frameCount)
    }
  }

  return result
}

export const createMasterFlat = (
  flatFrames: FlatFrameInfo[],
  mode: 'mean' | 'median' = 'median'
): Float32Array | null => {
  if (flatFrames.length === 0) return null

  const { width, height } = flatFrames[0]
  const frameCount = flatFrames.length
  const result = new Float32Array(width * height)

  const normalizedFrames = flatFrames.map(ff => {
    const normalized = new Float32Array(ff.pixelData.length)
    let sum = 0
    for (let i = 0; i < ff.pixelData.length; i++) {
      sum += ff.pixelData[i]
    }
    const mean = sum / ff.pixelData.length
    for (let i = 0; i < ff.pixelData.length; i++) {
      normalized[i] = ff.pixelData[i] / mean
    }
    return normalized
  })

  if (mode === 'mean') {
    for (let i = 0; i < width * height; i++) {
      let sum = 0
      for (let f = 0; f < frameCount; f++) {
        sum += normalizedFrames[f][i]
      }
      result[i] = sum / frameCount
    }
  } else {
    const values = new Array(frameCount)
    for (let i = 0; i < width * height; i++) {
      for (let f = 0; f < frameCount; f++) {
        values[f] = normalizedFrames[f][i]
      }
      result[i] = quickSortMedian(values, frameCount)
    }
  }

  return result
}

export const matchCalibrationFrames = (
  targetFrame: FitsFrame,
  darkFrames: DarkFrameInfo[],
  flatFrames: FlatFrameInfo[]
): CalibrationMatch => {
  const targetInfo = {
    exposureTime: getExposureTime(targetFrame.header),
    gain: getGain(targetFrame.header),
    ccdTemp: getCCDTemp(targetFrame.header),
    filter: getFilter(targetFrame.header)
  }

  let bestDarkMatch = -1
  let bestDarkId: string | undefined
  for (const dark of darkFrames) {
    const score = calibrationMatchScore(
      targetInfo,
      { exposureTime: dark.exposureTime, gain: dark.gain, ccdTemp: dark.ccdTemp },
      'dark'
    )
    if (score > bestDarkMatch) {
      bestDarkMatch = score
      bestDarkId = dark.id
    }
  }

  let bestFlatMatch = -1
  let bestFlatId: string | undefined
  for (const flat of flatFrames) {
    const score = calibrationMatchScore(
      targetInfo,
      { exposureTime: flat.exposureTime, gain: flat.gain, ccdTemp: 0, filter: flat.filter },
      'flat'
    )
    if (score > bestFlatMatch) {
      bestFlatMatch = score
      bestFlatId = flat.id
    }
  }

  return {
    id: generateId(),
    targetFrameId: targetFrame.id,
    darkFrameId: bestDarkMatch >= 0.5 ? bestDarkId : undefined,
    flatFrameId: bestFlatMatch >= 0.5 ? bestFlatId : undefined,
    matchScore: Math.max(bestDarkMatch, bestFlatMatch),
    manualOverride: false
  }
}

export const batchCalibrate = (
  frames: FitsFrame[],
  settings: CalibrationSettings,
  darkFrames: DarkFrameInfo[],
  flatFrames: FlatFrameInfo[],
  onProgress?: (frameIndex: number, total: number) => void
): Map<string, Float32Array> => {
  const results = new Map<string, Float32Array>()
  const darkCache = new Map<string, DarkFrameInfo>()
  const flatCache = new Map<string, FlatFrameInfo>()

  for (const dark of darkFrames) {
    darkCache.set(dark.id, dark)
  }
  for (const flat of flatFrames) {
    flatCache.set(flat.id, flat)
  }

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const match = frame.calibrationMatch || matchCalibrationFrames(frame, darkFrames, flatFrames)

    const dark = match.darkFrameId ? darkCache.get(match.darkFrameId) : undefined
    const flat = match.flatFrameId ? flatCache.get(match.flatFrameId) : undefined

    const calibrated = applyCalibration(frame, settings, dark, flat)
    results.set(frame.id, calibrated)

    if (onProgress) {
      onProgress(i + 1, frames.length)
    }
  }

  return results
}

export const estimateBackground = (
  data: Float32Array,
  sampleSize: number = 10000
): { mean: number; std: number } => {
  const samples: number[] = []
  const step = Math.max(1, Math.floor(data.length / sampleSize))

  for (let i = 0; i < data.length; i += step) {
    if (isFinite(data[i])) {
      samples.push(data[i])
    }
  }

  samples.sort((a, b) => a - b)
  const trimmed = samples.slice(
    Math.floor(samples.length * 0.1),
    Math.floor(samples.length * 0.9)
  )

  const bgMean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length
  const variance = trimmed.reduce((a, b) => a + (b - bgMean) * (b - bgMean), 0) / trimmed.length
  const bgStd = Math.sqrt(variance)

  return { mean: bgMean, std: bgStd }
}

export const subtractDarkTile = (
  targetTile: Tile,
  darkTile: Tile
): Tile => {
  const result = new Float32Array(targetTile.data.length)
  for (let i = 0; i < targetTile.data.length; i++) {
    result[i] = Math.max(0, targetTile.data[i] - darkTile.data[i])
  }
  return { ...targetTile, data: result }
}

export const divideFlatTile = (
  targetTile: Tile,
  flatTile: Tile,
  flatMean: number
): Tile => {
  const result = new Float32Array(targetTile.data.length)
  if (flatMean <= 0) {
    return { ...targetTile, data: result }
  }

  for (let i = 0; i < targetTile.data.length; i++) {
    const normalizedFlat = flatTile.data[i] / flatMean
    result[i] = normalizedFlat > 0 ? targetTile.data[i] / normalizedFlat : 0
  }
  return { ...targetTile, data: result }
}

export const interpolateBadPixelsTile = (
  tile: Tile,
  threshold: number = 5,
  imageMean: number,
  imageStd: number
): Tile => {
  const result = new Float32Array(tile.data)
  const neighborhood = new Array(9)

  for (let y = 0; y < tile.height; y++) {
    for (let x = 0; x < tile.width; x++) {
      const idx = y * tile.width + x
      const val = tile.data[idx]
      const zScore = Math.abs((val - imageMean) / imageStd)

      if (zScore > threshold) {
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < tile.width && ny >= 0 && ny < tile.height) {
              neighborhood[count++] = tile.data[ny * tile.width + nx]
            }
          }
        }
        result[idx] = quickSortMedian(neighborhood.slice(0, count), count)
      }
    }
  }

  return { ...tile, data: result }
}

export const applyCalibrationTile = (
  targetTile: Tile,
  settings: CalibrationSettings,
  darkTile?: Tile,
  flatTile?: Tile,
  flatMean?: number,
  imageMean?: number,
  imageStd?: number
): Tile => {
  let result = { ...targetTile, data: new Float32Array(targetTile.data) }

  if (settings.darkSubtraction && darkTile) {
    result = subtractDarkTile(result, darkTile)
  }

  if (settings.flatCorrection && flatTile && flatMean !== undefined) {
    result = divideFlatTile(result, flatTile, flatMean)
  }

  if (settings.badPixelInterpolation && imageMean !== undefined && imageStd !== undefined) {
    result = interpolateBadPixelsTile(result, settings.badPixelThreshold, imageMean, imageStd)
  }

  return result
}

export const createMasterDarkTiled = (
  darkFrames: DarkFrameInfo[],
  mode: 'mean' | 'median' = 'median',
  tileSize: number = 512
): Tile[] | null => {
  if (darkFrames.length === 0) return null

  const { width, height } = darkFrames[0]
  const grid = createTileGrid(width, height, tileSize, 0)
  const frameCount = darkFrames.length
  const frameTiles: Tile[][] = []

  for (const dark of darkFrames) {
    frameTiles.push(imageToTiles(dark.pixelData, width, height, tileSize, 0))
  }

  const resultTiles: Tile[] = []

  for (let tileIdx = 0; tileIdx < grid.tiles.length; tileIdx++) {
    const tile = grid.tiles[tileIdx]
    const pixelCount = tile.width * tile.height
    const result = new Float32Array(pixelCount)

    if (mode === 'mean') {
      for (let p = 0; p < pixelCount; p++) {
        let sum = 0
        for (let f = 0; f < frameCount; f++) {
          sum += frameTiles[f][tileIdx].data[p]
        }
        result[p] = sum / frameCount
      }
    } else {
      const values = new Array(frameCount)
      for (let p = 0; p < pixelCount; p++) {
        for (let f = 0; f < frameCount; f++) {
          values[f] = frameTiles[f][tileIdx].data[p]
        }
        result[p] = quickSortMedian(values, frameCount)
      }
    }

    resultTiles.push({ ...tile, data: result })
  }

  return resultTiles
}

export const createMasterFlatTiled = (
  flatFrames: FlatFrameInfo[],
  mode: 'mean' | 'median' = 'median',
  tileSize: number = 512
): { tiles: Tile[]; flatMean: number } | null => {
  if (flatFrames.length === 0) return null

  const { width, height } = flatFrames[0]
  const grid = createTileGrid(width, height, tileSize, 0)
  const frameCount = flatFrames.length

  const normalizedFrameTiles: Tile[][] = []
  let globalFlatMean = 0

  for (let fi = 0; fi < flatFrames.length; fi++) {
    const ff = flatFrames[fi]
    const tiles = imageToTiles(ff.pixelData, width, height, tileSize, 0)

    let frameSum = 0
    let framePixelCount = 0
    for (const tile of tiles) {
      for (let i = 0; i < tile.data.length; i++) {
        frameSum += tile.data[i]
        framePixelCount++
      }
    }
    const frameMean = frameSum / framePixelCount
    if (fi === 0) globalFlatMean = frameMean

    const normalizedTiles = tiles.map(tile => {
      const normalized = new Float32Array(tile.data.length)
      for (let i = 0; i < tile.data.length; i++) {
        normalized[i] = tile.data[i] / frameMean
      }
      return { ...tile, data: normalized }
    })

    normalizedFrameTiles.push(normalizedTiles)
  }

  const resultTiles: Tile[] = []

  for (let tileIdx = 0; tileIdx < grid.tiles.length; tileIdx++) {
    const tile = grid.tiles[tileIdx]
    const pixelCount = tile.width * tile.height
    const result = new Float32Array(pixelCount)

    if (mode === 'mean') {
      for (let p = 0; p < pixelCount; p++) {
        let sum = 0
        for (let f = 0; f < frameCount; f++) {
          sum += normalizedFrameTiles[f][tileIdx].data[p]
        }
        result[p] = sum / frameCount
      }
    } else {
      const values = new Array(frameCount)
      for (let p = 0; p < pixelCount; p++) {
        for (let f = 0; f < frameCount; f++) {
          values[f] = normalizedFrameTiles[f][tileIdx].data[p]
        }
        result[p] = quickSortMedian(values, frameCount)
      }
    }

    resultTiles.push({ ...tile, data: result })
  }

  return { tiles: resultTiles, flatMean: globalFlatMean }
}

export const calibrateFrameTiled = (
  frame: FitsFrame,
  settings: CalibrationSettings,
  darkTiles?: Tile[],
  flatTiles?: Tile[],
  flatMean?: number,
  tileSize: number = 512
): Tile[] => {
  const tiles = imageToTiles(frame.pixelData, frame.width, frame.height, tileSize, 0)

  let imageMean = 0
  let imageStd = 0
  if (settings.badPixelInterpolation) {
    let sum = 0
    let sumSq = 0
    let count = 0
    for (const tile of tiles) {
      for (let i = 0; i < tile.data.length; i++) {
        const v = tile.data[i]
        if (isFinite(v)) {
          sum += v
          sumSq += v * v
          count++
        }
      }
    }
    imageMean = sum / count
    const variance = (sumSq / count) - imageMean * imageMean
    imageStd = Math.sqrt(Math.max(0, variance))
  }

  const resultTiles: Tile[] = []

  for (let i = 0; i < tiles.length; i++) {
    const calibrated = applyCalibrationTile(
      tiles[i],
      settings,
      darkTiles?.[i],
      flatTiles?.[i],
      flatMean,
      imageMean,
      imageStd
    )
    resultTiles.push(calibrated)
  }

  return resultTiles
}
