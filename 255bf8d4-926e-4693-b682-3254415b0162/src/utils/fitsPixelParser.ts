import type { FitsHeader } from '@/core/types'

export const parsePixelDataFast = (
  dataView: DataView,
  header: FitsHeader,
  offset: number
): Float32Array => {
  const bitpix = header.BITPIX
  const naxis1 = header.NAXIS1
  const naxis2 = header.NAXIS2
  const pixelCount = naxis1 * naxis2
  const bzero = header.BZERO || 0
  const bscale = header.BSCALE || 1

  const buffer = dataView.buffer
  const byteOffset = dataView.byteOffset + offset

  const pixelData = new Float32Array(pixelCount)

  switch (bitpix) {
    case 8: {
      const src = new Uint8Array(buffer, byteOffset, pixelCount)
      if (bzero === 0 && bscale === 1) {
        pixelData.set(src as any)
      } else {
        for (let i = 0; i < pixelCount; i++) {
          pixelData[i] = src[i] * bscale + bzero
        }
      }
      break
    }
    case 16: {
      const src = new Int16Array(buffer, byteOffset, pixelCount)
      if (bzero === 0 && bscale === 1) {
        pixelData.set(src as any)
      } else {
        for (let i = 0; i < pixelCount; i++) {
          pixelData[i] = src[i] * bscale + bzero
        }
      }
      break
    }
    case 32: {
      const src = new Int32Array(buffer, byteOffset, pixelCount)
      if (bzero === 0 && bscale === 1) {
        pixelData.set(src as any)
      } else {
        for (let i = 0; i < pixelCount; i++) {
          pixelData[i] = src[i] * bscale + bzero
        }
      }
      break
    }
    case -32: {
      const src = new Float32Array(buffer, byteOffset, pixelCount)
      if (bzero === 0 && bscale === 1) {
        pixelData.set(src)
      } else {
        for (let i = 0; i < pixelCount; i++) {
          pixelData[i] = src[i] * bscale + bzero
        }
      }
      break
    }
    case -64: {
      const src = new Float64Array(buffer, byteOffset, pixelCount)
      for (let i = 0; i < pixelCount; i++) {
        pixelData[i] = src[i] * bscale + bzero
      }
      break
    }
    default:
      throw new Error(`Unsupported BITPIX value: ${bitpix}`)
  }

  return pixelData
}

export const parsePixelTile = (
  dataView: DataView,
  header: FitsHeader,
  offset: number,
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number
): Float32Array => {
  const bitpix = header.BITPIX
  const imageWidth = header.NAXIS1
  const bzero = header.BZERO || 0
  const bscale = header.BSCALE || 1

  const bytesPerPixel = Math.abs(bitpix) / 8
  const buffer = dataView.buffer
  const baseOffset = dataView.byteOffset + offset

  const tileData = new Float32Array(tileWidth * tileHeight)

  for (let y = 0; y < tileHeight; y++) {
    const srcRow = tileY + y
    const srcRowOffset = baseOffset + srcRow * imageWidth * bytesPerPixel + tileX * bytesPerPixel

    const dstStart = y * tileWidth

    switch (bitpix) {
      case 8: {
        const src = new Uint8Array(buffer, srcRowOffset, tileWidth)
        if (bzero === 0 && bscale === 1) {
          tileData.set(src as any, dstStart)
        } else {
          for (let x = 0; x < tileWidth; x++) {
            tileData[dstStart + x] = src[x] * bscale + bzero
          }
        }
        break
      }
      case 16: {
        const src = new Int16Array(buffer, srcRowOffset, tileWidth)
        if (bzero === 0 && bscale === 1) {
          tileData.set(src as any, dstStart)
        } else {
          for (let x = 0; x < tileWidth; x++) {
            tileData[dstStart + x] = src[x] * bscale + bzero
          }
        }
        break
      }
      case 32: {
        const src = new Int32Array(buffer, srcRowOffset, tileWidth)
        if (bzero === 0 && bscale === 1) {
          tileData.set(src as any, dstStart)
        } else {
          for (let x = 0; x < tileWidth; x++) {
            tileData[dstStart + x] = src[x] * bscale + bzero
          }
        }
        break
      }
      case -32: {
        const src = new Float32Array(buffer, srcRowOffset, tileWidth)
        if (bzero === 0 && bscale === 1) {
          tileData.set(src, dstStart)
        } else {
          for (let x = 0; x < tileWidth; x++) {
            tileData[dstStart + x] = src[x] * bscale + bzero
          }
        }
        break
      }
      case -64: {
        const src = new Float64Array(buffer, srcRowOffset, tileWidth)
        for (let x = 0; x < tileWidth; x++) {
          tileData[dstStart + x] = src[x] * bscale + bzero
        }
        break
      }
      default:
        throw new Error(`Unsupported BITPIX value: ${bitpix}`)
    }
  }

  return tileData
}

let wasmModule: any = null
let wasmReady = false

export const initWasmFitsParser = async (): Promise<boolean> => {
  if (wasmReady) return true

  try {
    const wasmPath = '../wasm/fits-parser'
    // @ts-ignore - WASM module is optional, will fall back to JS if not available
    const wasm = await import(/* @vite-ignore */ wasmPath)
    wasmModule = wasm
    wasmReady = true
    console.info('[FitsParser] WASM module loaded successfully')
    return true
  } catch (e) {
    console.warn('[FitsParser] Failed to load WASM module, falling back to JS:', e)
    wasmReady = false
    return false
  }
}

export const isWasmAvailable = (): boolean => wasmReady

export const parsePixelDataWasm = async (
  dataView: DataView,
  header: FitsHeader,
  offset: number
): Promise<Float32Array> => {
  if (!wasmReady) {
    return parsePixelDataFast(dataView, header, offset)
  }

  try {
    const bzero = header.BZERO || 0
    const bscale = header.BSCALE || 1
    const naxis1 = header.NAXIS1
    const naxis2 = header.NAXIS2

    const result = wasmModule.parse_fits_pixels(
      dataView,
      offset,
      naxis1,
      naxis2,
      header.BITPIX,
      bzero,
      bscale
    )

    return new Float32Array(result)
  } catch (e) {
    console.warn('[FitsParser] WASM parse failed, falling back to JS:', e)
    return parsePixelDataFast(dataView, header, offset)
  }
}

export const parsePixelTileWasm = async (
  dataView: DataView,
  header: FitsHeader,
  offset: number,
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number
): Promise<Float32Array> => {
  if (!wasmReady) {
    return parsePixelTile(dataView, header, offset, tileX, tileY, tileWidth, tileHeight)
  }

  try {
    const bzero = header.BZERO || 0
    const bscale = header.BSCALE || 1

    const result = wasmModule.parse_fits_pixels_tile(
      dataView,
      offset,
      header.NAXIS1,
      header.BITPIX,
      bzero,
      bscale,
      tileX,
      tileY,
      tileWidth,
      tileHeight
    )

    return new Float32Array(result)
  } catch (e) {
    console.warn('[FitsParser] WASM tile parse failed, falling back to JS:', e)
    return parsePixelTile(dataView, header, offset, tileX, tileY, tileWidth, tileHeight)
  }
}
