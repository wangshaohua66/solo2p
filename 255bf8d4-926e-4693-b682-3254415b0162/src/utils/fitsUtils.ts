import type { FitsHeader } from '@/core/types'

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export const formatRA = (ra: number): string => {
  const hours = ra / 15
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  const s = ((hours - h) * 60 - m) * 60
  return `${h}h ${m}m ${s.toFixed(2)}s`
}

export const formatDEC = (dec: number): string => {
  const sign = dec >= 0 ? '+' : '-'
  const absDec = Math.abs(dec)
  const d = Math.floor(absDec)
  const m = Math.floor((absDec - d) * 60)
  const s = ((absDec - d) * 60 - m) * 60
  return `${sign}${d}° ${m}' ${s.toFixed(2)}"`
}

export const formatExposure = (exptime: number): string => {
  if (exptime >= 60) {
    const m = Math.floor(exptime / 60)
    const s = exptime % 60
    return s > 0 ? `${m}m ${s.toFixed(1)}s` : `${m}m`
  }
  return `${exptime.toFixed(1)}s`
}

export const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return dateStr
  }
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export const formatADU = (value: number): string => {
  if (Math.abs(value) >= 1000) {
    return value.toFixed(0)
  }
  return value.toFixed(2)
}

export const formatSNR = (snr: number): string => {
  return `${snr.toFixed(1)} σ`
}

export const getHeaderValue = (
  header: FitsHeader,
  key: string,
  defaultValue: any = undefined
): any => {
  const upperKey = key.toUpperCase()
  if (header[upperKey] !== undefined) return header[upperKey]
  if (header[key] !== undefined) return header[key]
  return defaultValue
}

export const getExposureTime = (header: FitsHeader): number => {
  return getHeaderValue(header, 'EXPTIME', 0) as number
}

export const getGain = (header: FitsHeader): number => {
  return getHeaderValue(header, 'GAIN', 1) as number
}

export const getCCDTemp = (header: FitsHeader): number => {
  return getHeaderValue(header, 'CCD-TEMP', 0) as number
}

export const getFilter = (header: FitsHeader): string => {
  return (getHeaderValue(header, 'FILTER', 'Unknown') as string).trim()
}

export const getObjectName = (header: FitsHeader): string => {
  return (getHeaderValue(header, 'OBJECT', 'Unknown') as string).trim()
}

export const getTelescope = (header: FitsHeader): string => {
  return (getHeaderValue(header, 'TELESCOP', 'Unknown') as string).trim()
}

export const getObservationDate = (header: FitsHeader): string => {
  return getHeaderValue(header, 'DATE-OBS', '') as string
}

export const getRA = (header: FitsHeader): number | undefined => {
  const ra = getHeaderValue(header, 'RA')
  if (typeof ra === 'number') return ra
  return undefined
}

export const getDEC = (header: FitsHeader): number | undefined => {
  const dec = getHeaderValue(header, 'DEC')
  if (typeof dec === 'number') return dec
  return undefined
}

export const generateThumbnail = (
  pixelData: Float32Array,
  width: number,
  height: number,
  thumbSize: number = 128
): string => {
  const scale = Math.min(thumbSize / width, thumbSize / height)
  const thumbWidth = Math.floor(width * scale)
  const thumbHeight = Math.floor(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = thumbWidth
  canvas.height = thumbHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < pixelData.length; i++) {
    const v = pixelData[i]
    if (isFinite(v)) {
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
  }
  if (max === min) {
    max = min + 1
  }

  const imageData = ctx.createImageData(thumbWidth, thumbHeight)
  const rgba = imageData.data

  for (let ty = 0; ty < thumbHeight; ty++) {
    for (let tx = 0; tx < thumbWidth; tx++) {
      const sx = Math.floor(tx / scale)
      const sy = Math.floor(ty / scale)
      const srcIdx = sy * width + sx
      let val = pixelData[srcIdx] || 0

      val = Math.max(0, Math.min(1, (val - min) / (max - min)))
      val = Math.pow(val, 0.45)

      const dstIdx = (ty * thumbWidth + tx) * 4
      const gray = Math.floor(val * 255)
      rgba[dstIdx] = gray
      rgba[dstIdx + 1] = gray
      rgba[dstIdx + 2] = gray
      rgba[dstIdx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export const calibrationMatchScore = (
  target: { exposureTime: number; gain: number; ccdTemp: number; filter?: string },
  reference: { exposureTime: number; gain: number; ccdTemp: number; filter?: string },
  type: 'dark' | 'flat'
): number => {
  let score = 0

  const exposureDiff = Math.abs(target.exposureTime - reference.exposureTime)
  const exposureMatch = Math.max(0, 1 - exposureDiff / Math.max(target.exposureTime, 1))
  score += exposureMatch * (type === 'dark' ? 0.5 : 0.3)

  const gainDiff = Math.abs(target.gain - reference.gain)
  const gainMatch = Math.max(0, 1 - gainDiff / Math.max(target.gain, 1))
  score += gainMatch * 0.2

  const tempDiff = Math.abs(target.ccdTemp - reference.ccdTemp)
  const tempMatch = Math.max(0, 1 - Math.abs(tempDiff) / 10)
  score += tempMatch * 0.3

  if (type === 'flat' && target.filter && reference.filter) {
    const filterMatch = target.filter === reference.filter ? 1 : 0
    score += filterMatch * 0.2
  }

  return Math.min(1, score)
}
