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

let wasmExports: {
  memory: WebAssembly.Memory
  alloc_u8: (size: number) => number
  dealloc_u8: (ptr: number, size: number) => void
  alloc_f32: (count: number) => number
  dealloc_f32: (ptr: number, count: number) => void
  parse_pixels_u8: (input: number, count: number, bzero: number, bscale: number, output: number) => number
  parse_pixels_i16: (input: number, count: number, bzero: number, bscale: number, output: number) => number
  parse_pixels_i32: (input: number, count: number, bzero: number, bscale: number, output: number) => number
  parse_pixels_f32: (input: number, count: number, bzero: number, bscale: number, output: number) => number
  parse_pixels_f64: (input: number, count: number, bzero: number, bscale: number, output: number) => number
  bytes_per_pixel: (bitpix: number) => number
  version: () => number
} | null = null
let wasmReady = false

export const initWasmFitsParser = async (): Promise<boolean> => {
  if (wasmReady) return true

  try {
    const response = await fetch('/fits-parser.wasm')
    const wasm = await WebAssembly.instantiateStreaming(response, {})
    wasmExports = wasm.instance.exports as any
    wasmReady = true
    console.info('[FitsParser] WASM module loaded successfully, version:', wasmExports!.version())
    return true
  } catch (e) {
    console.warn('[FitsParser] Failed to load WASM module, falling back to JS:', e)
    wasmReady = false
    return false
  }
}

export const isWasmAvailable = (): boolean => wasmReady

const getWasmParseFn = (bitpix: number) => {
  if (!wasmExports) return null
  switch (bitpix) {
    case 8: return wasmExports.parse_pixels_u8
    case 16: return wasmExports.parse_pixels_i16
    case 32: return wasmExports.parse_pixels_i32
    case -32: return wasmExports.parse_pixels_f32
    case -64: return wasmExports.parse_pixels_f64
    default: return null
  }
}

export const parsePixelDataWasm = async (
  dataView: DataView,
  header: FitsHeader,
  offset: number
): Promise<Float32Array> => {
  if (!wasmReady || !wasmExports) {
    return parsePixelDataFast(dataView, header, offset)
  }

  try {
    const bzero = header.BZERO || 0
    const bscale = header.BSCALE || 1
    const naxis1 = header.NAXIS1
    const naxis2 = header.NAXIS2
    const pixelCount = naxis1 * naxis2
    const bitpix = header.BITPIX

    const bpp = wasmExports.bytes_per_pixel(bitpix)
    if (bpp === 0) {
      throw new Error(`Unsupported BITPIX: ${bitpix}`)
    }

    const inputSize = pixelCount * bpp
    const inputPtr = wasmExports.alloc_u8(inputSize)
    const outputPtr = wasmExports.alloc_f32(pixelCount)

    try {
      const memory = new Uint8Array(wasmExports.memory.buffer)
      const inputBytes = new Uint8Array(dataView.buffer, dataView.byteOffset + offset, inputSize)
      memory.set(inputBytes, inputPtr)

      const parseFn = getWasmParseFn(bitpix)
      if (!parseFn) {
        throw new Error(`No WASM parser for BITPIX: ${bitpix}`)
      }

      parseFn(inputPtr, pixelCount, bzero, bscale, outputPtr)

      const result = new Float32Array(wasmExports.memory.buffer, outputPtr, pixelCount)
      return new Float32Array(result)
    } finally {
      wasmExports.dealloc_u8(inputPtr, inputSize)
      wasmExports.dealloc_f32(outputPtr, pixelCount)
    }
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
  return parsePixelTile(dataView, header, offset, tileX, tileY, tileWidth, tileHeight)
}
