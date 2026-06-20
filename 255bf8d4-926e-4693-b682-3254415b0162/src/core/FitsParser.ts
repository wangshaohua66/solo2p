import type { FitsHeader, FitsFrame } from './types'
import { generateId, generateThumbnail, getExposureTime, getGain, getCCDTemp, getFilter, getObjectName, getObservationDate, getTelescope } from '@/utils/fitsUtils'

const BLOCK_SIZE = 2880
const HEADER_RECORD_SIZE = 80

export const parseFitsHeader = (dataView: DataView, offset: number = 0): { header: FitsHeader; dataOffset: number } => {
  const header: FitsHeader = {
    SIMPLE: true,
    BITPIX: 0,
    NAXIS: 0,
    NAXIS1: 0,
    NAXIS2: 0
  }

  let currentOffset = offset
  let endOfHeader = false

  while (!endOfHeader) {
    for (let record = 0; record < BLOCK_SIZE / HEADER_RECORD_SIZE; record++) {
      const recordStr = decodeRecord(dataView, currentOffset)
      currentOffset += HEADER_RECORD_SIZE

      if (recordStr.startsWith('END')) {
        endOfHeader = true
        break
      }

      if (recordStr.trim() === '') continue

      const { key, value, comment } = parseRecord(recordStr)
      if (key) {
        header[key] = value
      }
    }
  }

  const dataOffset = Math.ceil(currentOffset / BLOCK_SIZE) * BLOCK_SIZE
  return { header, dataOffset }
}

const decodeRecord = (dataView: DataView, offset: number): string => {
  let str = ''
  for (let i = 0; i < HEADER_RECORD_SIZE; i++) {
    str += String.fromCharCode(dataView.getUint8(offset + i))
  }
  return str
}

const parseRecord = (record: string): { key: string; value: any; comment?: string } => {
  const key = record.substring(0, 8).trim()
  const valuePart = record.substring(8)

  if (!valuePart.includes('=')) {
    return { key, value: null }
  }

  const valueMatch = valuePart.match(/=\s*(\'[^\']*\'|[^\s\/]+)(?:\s*\/\s*(.*))?/)
  if (!valueMatch) {
    return { key, value: null }
  }

  let value: any = valueMatch[1].trim()
  const comment = valueMatch[2]?.trim()

  if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1).trim()
  } else if (value === 'T') {
    value = true
  } else if (value === 'F') {
    value = false
  } else if (!isNaN(Number(value)) && value !== '') {
    value = Number(value)
  }

  return { key, value, comment }
}

export const parsePixelData = (
  dataView: DataView,
  header: FitsHeader,
  offset: number
): Float32Array => {
  const bitpix = header.BITPIX
  const naxis1 = header.NAXIS1
  const naxis2 = header.NAXIS2
  const pixelCount = naxis1 * naxis2

  const pixelData = new Float32Array(pixelCount)

  let currentOffset = offset

  switch (bitpix) {
    case 16: {
      for (let i = 0; i < pixelCount; i++) {
        pixelData[i] = dataView.getInt16(currentOffset, false)
        currentOffset += 2
      }
      break
    }
    case 32: {
      for (let i = 0; i < pixelCount; i++) {
        pixelData[i] = dataView.getInt32(currentOffset, false)
        currentOffset += 4
      }
      break
    }
    case -32: {
      for (let i = 0; i < pixelCount; i++) {
        pixelData[i] = dataView.getFloat32(currentOffset, false)
        currentOffset += 4
      }
      break
    }
    case -64: {
      for (let i = 0; i < pixelCount; i++) {
        pixelData[i] = dataView.getFloat64(currentOffset, false)
        currentOffset += 8
      }
      break
    }
    default:
      throw new Error(`Unsupported BITPIX value: ${bitpix}`)
  }

  const bzero = header.BZERO || 0
  const bscale = header.BSCALE || 1

  if (bzero !== 0 || bscale !== 1) {
    for (let i = 0; i < pixelCount; i++) {
      pixelData[i] = pixelData[i] * bscale + bzero
    }
  }

  return pixelData
}

export const parseFitsFile = async (file: File): Promise<FitsFrame> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        if (!arrayBuffer) {
          reject(new Error('Failed to read file'))
          return
        }

        const dataView = new DataView(arrayBuffer)
        const { header, dataOffset } = parseFitsHeader(dataView)
        const pixelData = parsePixelData(dataView, header, dataOffset)

        const width = header.NAXIS1
        const height = header.NAXIS2
        const thumbnail = generateThumbnail(pixelData, width, height)

        const frame: FitsFrame = {
          id: generateId(),
          fileName: file.name,
          header,
          pixelData,
          width,
          height,
          thumbnail,
          quality: 'pending',
          processedAt: Date.now()
        }

        resolve(frame)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export const parseFitsBuffer = async (
  arrayBuffer: ArrayBuffer,
  fileName: string = 'unknown.fits'
): Promise<FitsFrame> => {
  const dataView = new DataView(arrayBuffer)
  const { header, dataOffset } = parseFitsHeader(dataView)
  const pixelData = parsePixelData(dataView, header, dataOffset)

  const width = header.NAXIS1
  const height = header.NAXIS2
  const thumbnail = generateThumbnail(pixelData, width, height)

  return {
    id: generateId(),
    fileName,
    header,
    pixelData,
    width,
    height,
    thumbnail,
    quality: 'pending',
    processedAt: Date.now()
  }
}

export const createMockFitsFrame = (
  width: number = 512,
  height: number = 512,
  options: Partial<{
    exposureTime: number
    gain: number
    ccdTemp: number
    filter: string
    object: string
    stars: number
    noise: number
  }> = {}
): FitsFrame => {
  const {
    exposureTime = 30,
    gain = 1.0,
    ccdTemp = -15,
    filter = 'V',
    object = 'M42',
    stars = 100,
    noise = 10
  } = options

  const pixelData = new Float32Array(width * height)
  const baseBackground = 100 + Math.random() * 50

  for (let i = 0; i < pixelData.length; i++) {
    pixelData[i] = baseBackground + (Math.random() - 0.5) * noise
  }

  for (let s = 0; s < stars; s++) {
    const cx = Math.random() * width
    const cy = Math.random() * height
    const flux = 100 + Math.random() * 500
    const fwhm = 2 + Math.random() * 3
    const sigma = fwhm / 2.355

    const radius = Math.ceil(sigma * 4)
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = Math.floor(cx + dx)
        const py = Math.floor(cy + dy)
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const distSq = dx * dx + dy * dy
          const value = flux * Math.exp(-distSq / (2 * sigma * sigma))
          const idx = py * width + px
          pixelData[idx] += value
        }
      }
    }
  }

  const thumbnail = generateThumbnail(pixelData, width, height)

  return {
    id: generateId(),
    fileName: `${object}_${Date.now()}.fits`,
    header: {
      SIMPLE: true,
      BITPIX: -32,
      NAXIS: 2,
      NAXIS1: width,
      NAXIS2: height,
      EXPTIME: exposureTime,
      GAIN: gain,
      'CCD-TEMP': ccdTemp,
      FILTER: filter,
      OBJECT: object,
      'DATE-OBS': new Date().toISOString(),
      TELESCOP: 'Test Telescope',
      RA: 83.633 + (Math.random() - 0.5) * 0.1,
      DEC: -5.391 + (Math.random() - 0.5) * 0.1
    },
    pixelData,
    width,
    height,
    thumbnail,
    quality: 'pending',
    processedAt: Date.now()
  }
}

export const getFrameMetadata = (frame: FitsFrame) => {
  return {
    fileName: frame.fileName,
    object: getObjectName(frame.header),
    exposureTime: getExposureTime(frame.header),
    gain: getGain(frame.header),
    ccdTemp: getCCDTemp(frame.header),
    filter: getFilter(frame.header),
    date: getObservationDate(frame.header),
    telescope: getTelescope(frame.header),
    width: frame.width,
    height: frame.height,
    bitDepth: frame.header.BITPIX,
    quality: frame.quality,
    rejectReason: frame.rejectReason
  }
}

export const extractRegion = (
  data: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  regionWidth: number,
  regionHeight: number
): Float32Array | null => {
  if (x < 0 || y < 0 || x + regionWidth > width || y + regionHeight > height) {
    return null
  }

  const region = new Float32Array(regionWidth * regionHeight)
  for (let dy = 0; dy < regionHeight; dy++) {
    const srcRow = (y + dy) * width + x
    const dstRow = dy * regionWidth
    for (let dx = 0; dx < regionWidth; dx++) {
      region[dstRow + dx] = data[srcRow + dx]
    }
  }
  return region
}

export const downsampleFrame = (
  data: Float32Array,
  width: number,
  height: number,
  factor: number
): { data: Float32Array; width: number; height: number } => {
  const newWidth = Math.floor(width / factor)
  const newHeight = Math.floor(height / factor)
  const result = new Float32Array(newWidth * newHeight)

  for (let ny = 0; ny < newHeight; ny++) {
    for (let nx = 0; nx < newWidth; nx++) {
      let sum = 0
      let count = 0
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const px = nx * factor + dx
          const py = ny * factor + dy
          if (px < width && py < height) {
            sum += data[py * width + px]
            count++
          }
        }
      }
      result[ny * newWidth + nx] = sum / count
    }
  }

  return { data: result, width: newWidth, height: newHeight }
}
