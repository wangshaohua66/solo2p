import type { FitsHeader, FitsFrame, FitsHDU, HduType } from './types'
import { parsePixelDataFast, parsePixelTile, initWasmFitsParser, isWasmAvailable, parsePixelDataWasm } from '@/utils/fitsPixelParser'

export { initWasmFitsParser, isWasmAvailable }
import { generateId, generateThumbnail, getExposureTime, getGain, getCCDTemp, getFilter, getObjectName, getObservationDate, getTelescope } from '@/utils/fitsUtils'

const BLOCK_SIZE = 2880
const HEADER_RECORD_SIZE = 80

export const parseFitsHeader = (dataView: DataView, offset: number = 0): { header: FitsHeader; dataOffset: number } => {
  const header: FitsHeader = {
    BITPIX: 0,
    NAXIS: 0,
    NAXIS1: 0,
    NAXIS2: 0
  } as FitsHeader

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

const detectHduType = (header: FitsHeader): HduType => {
  if (header.SIMPLE || !header.XTENSION) return 'image'
  const xtension = header.XTENSION.toLowerCase()
  if (xtension === 'image') return 'image'
  if (xtension === 'bintable') return 'binaryTable'
  if (xtension === 'table') return 'asciiTable'
  return 'unknown'
}

const calculateDataSize = (header: FitsHeader): number => {
  const bitpix = Math.abs(header.BITPIX)
  const naxis = header.NAXIS || 0

  if (naxis === 0) return 0

  let totalPixels = 1
  for (let i = 1; i <= naxis; i++) {
    const naxisKey = `NAXIS${i}` as keyof FitsHeader
    totalPixels *= (header[naxisKey] as number) || 1
  }

  return totalPixels * (bitpix / 8)
}

export const parseAllHDUs = (dataView: DataView): FitsHDU[] => {
  const hdus: FitsHDU[] = []
  let currentOffset = 0
  let hduIndex = 0

  while (currentOffset < dataView.byteLength) {
    try {
      const { header, dataOffset } = parseFitsHeader(dataView, currentOffset)
      const type = detectHduType(header)
      const dataSize = calculateDataSize(header)

      const hdu: FitsHDU = {
        index: hduIndex,
        type,
        header
      }

      if (type === 'image' && header.NAXIS >= 2) {
        const pixelData = parsePixelData(dataView, header, dataOffset)
        hdu.pixelData = pixelData
        hdu.width = header.NAXIS1
        hdu.height = header.NAXIS2
        if (header.NAXIS3) hdu.depth = header.NAXIS3
      } else if (type === 'binaryTable') {
        hdu.tableData = parseBinaryTable(dataView, header, dataOffset)
      } else if (type === 'asciiTable') {
        hdu.tableData = parseAsciiTable(dataView, header, dataOffset)
      }

      hdus.push(hdu)
      hduIndex++

      const nextOffset = dataOffset + Math.ceil(dataSize / BLOCK_SIZE) * BLOCK_SIZE
      if (nextOffset <= currentOffset || nextOffset >= dataView.byteLength) break
      currentOffset = nextOffset
    } catch (e) {
      console.warn(`Failed to parse HDU ${hduIndex}:`, e)
      break
    }
  }

  return hdus
}

const parseBinaryTable = (dataView: DataView, header: FitsHeader, offset: number): any[][] => {
  const rows = header.NAXIS2 || 0
  const rowBytes = header.NAXIS1 || 0
  const tfields = header.TFIELDS || 0
  const result: any[][] = []

  if (rows === 0 || tfields === 0) return result

  const types: string[] = []
  for (let i = 1; i <= tfields; i++) {
    const tform = header[`TFORM${i}`] as string
    if (tform) types.push(tform.trim().toUpperCase())
  }

  for (let row = 0; row < Math.min(rows, 1000); row++) {
    const rowData: any[] = []
    let colOffset = offset + row * rowBytes
    for (let col = 0; col < types.length; col++) {
      const tform = types[col]
      const repeatMatch = tform.match(/^(\d+)([A-Z])/)
      const repeat = repeatMatch ? parseInt(repeatMatch[1]) : 1
      const format = repeatMatch ? repeatMatch[2] : tform[0]

      let value: any = null
      switch (format) {
        case 'I':
          value = dataView.getInt16(colOffset, false)
          colOffset += 2 * repeat
          break
        case 'J':
          value = dataView.getInt32(colOffset, false)
          colOffset += 4 * repeat
          break
        case 'E':
          value = dataView.getFloat32(colOffset, false)
          colOffset += 4 * repeat
          break
        case 'D':
          value = dataView.getFloat64(colOffset, false)
          colOffset += 8 * repeat
          break
        case 'L':
          value = dataView.getUint8(colOffset) !== 0
          colOffset += repeat
          break
        case 'A':
          let str = ''
          for (let s = 0; s < repeat; s++) {
            str += String.fromCharCode(dataView.getUint8(colOffset + s))
          }
          value = str.trim()
          colOffset += repeat
          break
        default:
          colOffset += repeat
          break
      }
      rowData.push(value)
    }
    result.push(rowData)
  }

  return result
}

const parseAsciiTable = (dataView: DataView, header: FitsHeader, offset: number): any[][] => {
  const rows = header.NAXIS2 || 0
  const rowBytes = header.NAXIS1 || 0
  const result: any[][] = []

  if (rows === 0) return result

  for (let row = 0; row < Math.min(rows, 1000); row++) {
    const rowOffset = offset + row * rowBytes
    let rowStr = ''
    for (let i = 0; i < rowBytes; i++) {
      rowStr += String.fromCharCode(dataView.getUint8(rowOffset + i))
    }
    result.push([rowStr.trim()])
  }

  return result
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
  return parsePixelDataFast(dataView, header, offset)
}

export const parsePixelDataAsync = async (
  dataView: DataView,
  header: FitsHeader,
  offset: number
): Promise<Float32Array> => {
  if (isWasmAvailable()) {
    return parsePixelDataWasm(dataView, header, offset)
  }
  return parsePixelDataFast(dataView, header, offset)
}

export const parsePixelTileData = (
  dataView: DataView,
  header: FitsHeader,
  offset: number,
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number
): Float32Array => {
  return parsePixelTile(dataView, header, offset, tileX, tileY, tileWidth, tileHeight)
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

        const frame = parseFitsBufferSync(arrayBuffer, file.name)
        resolve(frame)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

const parseFitsBufferSync = (
  arrayBuffer: ArrayBuffer,
  fileName: string = 'unknown.fits'
): FitsFrame => {
  const dataView = new DataView(arrayBuffer)
  const hdus = parseAllHDUs(dataView)

  const primaryHdu = hdus.find(h => h.type === 'image' && h.pixelData) || hdus[0]
  const header = primaryHdu.header
  const pixelData = primaryHdu.pixelData || new Float32Array(0)
  const width = primaryHdu.width || 0
  const height = primaryHdu.height || 0
  const thumbnail = pixelData.length > 0 ? generateThumbnail(pixelData, width, height) : ''

  return {
    id: generateId(),
    fileName,
    header,
    pixelData,
    width,
    height,
    thumbnail,
    quality: 'pending',
    processedAt: Date.now(),
    hdus
  }
}

export const parseFitsBuffer = async (
  arrayBuffer: ArrayBuffer,
  fileName: string = 'unknown.fits'
): Promise<FitsFrame> => {
  return parseFitsBufferSync(arrayBuffer, fileName)
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
