import type { Tile, TileGrid, TiledImage, TileProcessor, TiledStackAccumulator } from '@/core/types'
import { generateThumbnail } from './fitsUtils'

export const createTileGrid = (
  imageWidth: number,
  imageHeight: number,
  tileSize: number = 512,
  overlap: number = 16
): TileGrid => {
  const tilesX = Math.ceil((imageWidth - overlap) / (tileSize - overlap))
  const tilesY = Math.ceil((imageHeight - overlap) / (tileSize - overlap))
  const tiles: Tile[] = []

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const offsetX = tx * (tileSize - overlap)
      const offsetY = ty * (tileSize - overlap)
      const width = Math.min(tileSize, imageWidth - offsetX)
      const height = Math.min(tileSize, imageHeight - offsetY)
      const data = new Float32Array(width * height)

      tiles.push({
        tileX: tx,
        tileY: ty,
        offsetX,
        offsetY,
        width,
        height,
        data
      })
    }
  }

  return {
    imageWidth,
    imageHeight,
    tileSize,
    overlap,
    tilesX,
    tilesY,
    tiles
  }
}

export const imageToTiles = (
  imageData: Float32Array,
  imageWidth: number,
  imageHeight: number,
  tileSize: number = 512,
  overlap: number = 16
): Tile[] => {
  const grid = createTileGrid(imageWidth, imageHeight, tileSize, overlap)

  for (const tile of grid.tiles) {
    for (let y = 0; y < tile.height; y++) {
      for (let x = 0; x < tile.width; x++) {
        const srcX = tile.offsetX + x
        const srcY = tile.offsetY + y
        if (srcX >= 0 && srcX < imageWidth && srcY >= 0 && srcY < imageHeight) {
          tile.data[y * tile.width + x] = imageData[srcY * imageWidth + srcX]
        }
      }
    }
  }

  return grid.tiles
}

export const tilesToImage = (
  tiles: Tile[],
  imageWidth: number,
  imageHeight: number,
  overlap: number = 16
): Float32Array => {
  const result = new Float32Array(imageWidth * imageHeight)
  const weight = new Float32Array(imageWidth * imageHeight)

  for (const tile of tiles) {
    const feather = Math.min(overlap, 16)

    for (let y = 0; y < tile.height; y++) {
      for (let x = 0; x < tile.width; x++) {
        const dstX = tile.offsetX + x
        const dstY = tile.offsetY + y

        if (dstX < 0 || dstX >= imageWidth || dstY < 0 || dstY >= imageHeight) continue

        let wx = 1
        let wy = 1

        if (tile.offsetX > 0 && x < feather) {
          wx = x / feather
        } else if (tile.offsetX + tile.width < imageWidth && x > tile.width - feather) {
          wx = (tile.width - x) / feather
        }

        if (tile.offsetY > 0 && y < feather) {
          wy = y / feather
        } else if (tile.offsetY + tile.height < imageHeight && y > tile.height - feather) {
          wy = (tile.height - y) / feather
        }

        const w = wx * wy
        const idx = dstY * imageWidth + dstX
        result[idx] += tile.data[y * tile.width + x] * w
        weight[idx] += w
      }
    }
  }

  for (let i = 0; i < result.length; i++) {
    if (weight[i] > 0) {
      result[i] /= weight[i]
    }
  }

  return result
}

export const processTiles = async (
  tiles: Tile[],
  processor: TileProcessor
): Promise<Tile[]> => {
  const total = tiles.length
  const result: Tile[] = []

  for (let i = 0; i < tiles.length; i++) {
    const processed = await processor(tiles[i], i, total)
    result.push(processed)
  }

  return result
}

export const createTiledImage = (
  pixelData: Float32Array,
  width: number,
  height: number,
  tileSize: number = 512
): TiledImage => {
  const tiles = imageToTiles(pixelData, width, height, tileSize)
  const thumbnail = generateThumbnail(pixelData, width, height)

  return {
    width,
    height,
    tileSize,
    overlap: 16,
    tiles,
    thumbnail
  }
}

export const getTileAt = (
  tiles: Tile[],
  x: number,
  y: number
): Tile | null => {
  for (const tile of tiles) {
    if (
      x >= tile.offsetX &&
      x < tile.offsetX + tile.width &&
      y >= tile.offsetY &&
      y < tile.offsetY + tile.height
    ) {
      return tile
    }
  }
  return null
}

export const getPixelFromTiles = (
  tiles: Tile[],
  x: number,
  y: number,
  imageWidth: number
): number | null => {
  const tile = getTileAt(tiles, x, y)
  if (!tile) return null

  const localX = x - tile.offsetX
  const localY = y - tile.offsetY
  if (localX < 0 || localX >= tile.width || localY < 0 || localY >= tile.height) {
    return null
  }

  return tile.data[localY * tile.width + localX]
}

export const createTiledStackAccumulator = (
  width: number,
  height: number,
  tileSize: number = 512
): TiledStackAccumulator => {
  const grid = createTileGrid(width, height, tileSize, 0)
  const sumTiles: Float32Array[] = []
  const sumSqTiles: Float32Array[] = []
  const countTiles: Float32Array[] = []

  for (const tile of grid.tiles) {
    sumTiles.push(new Float32Array(tile.width * tile.height))
    sumSqTiles.push(new Float32Array(tile.width * tile.height))
    countTiles.push(new Float32Array(tile.width * tile.height))
  }

  return {
    width,
    height,
    tileSize,
    sumTiles,
    sumSqTiles,
    countTiles,
    tileCount: 0
  }
}

export const addFrameToTiledStack = (
  accumulator: TiledStackAccumulator,
  frameTiles: Tile[]
): void => {
  if (frameTiles.length !== accumulator.sumTiles.length) return

  for (let i = 0; i < frameTiles.length; i++) {
    const tile = frameTiles[i]
    const sum = accumulator.sumTiles[i]
    const sumSq = accumulator.sumSqTiles[i]
    const count = accumulator.countTiles[i]

    for (let j = 0; j < tile.data.length; j++) {
      const v = tile.data[j]
      if (isFinite(v)) {
        sum[j] += v
        sumSq[j] += v * v
        count[j] += 1
      }
    }
  }

  accumulator.tileCount++
}

export const finalizeTiledStackMean = (
  accumulator: TiledStackAccumulator
): Tile[] => {
  const result: Tile[] = []

  for (let i = 0; i < accumulator.sumTiles.length; i++) {
    const sum = accumulator.sumTiles[i]
    const count = accumulator.countTiles[i]
    const data = new Float32Array(sum.length)

    for (let j = 0; j < sum.length; j++) {
      if (count[j] > 0) {
        data[j] = sum[j] / count[j]
      }
    }

    const tilesX = Math.ceil(accumulator.width / accumulator.tileSize)
    const tileX = i % tilesX
    const tileY = Math.floor(i / tilesX)

    result.push({
      tileX,
      tileY,
      offsetX: tileX * accumulator.tileSize,
      offsetY: tileY * accumulator.tileSize,
      width: Math.min(accumulator.tileSize, accumulator.width - tileX * accumulator.tileSize),
      height: Math.min(accumulator.tileSize, accumulator.height - tileY * accumulator.tileSize),
      data
    })
  }

  return result
}

export const calculateTiledSNR = (accumulator: TiledStackAccumulator): number => {
  let totalMean = 0
  let totalStd = 0
  let totalPixels = 0

  for (let i = 0; i < accumulator.sumTiles.length; i++) {
    const sum = accumulator.sumTiles[i]
    const sumSq = accumulator.sumSqTiles[i]
    const count = accumulator.countTiles[i]

    for (let j = 0; j < sum.length; j++) {
      if (count[j] >= 2) {
        const mean = sum[j] / count[j]
        const variance = (sumSq[j] / count[j]) - mean * mean
        const std = Math.sqrt(Math.max(0, variance))
        if (std > 0) {
          totalMean += mean
          totalStd += std
          totalPixels++
        }
      }
    }
  }

  if (totalPixels === 0 || totalStd === 0) return 0
  return (totalMean / totalPixels) / (totalStd / totalPixels) * Math.sqrt(accumulator.tileCount)
}
