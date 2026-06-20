import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { calculateHistogram, autoStretchParams } from '@/utils/colorMaps'
import type { HistogramData } from '@/core/types'

interface UseHistogramOptions {
  pixelData: Float32Array | null
  bins?: number
  autoUpdate?: boolean
}

export const useHistogram = ({
  pixelData,
  bins = 256,
  autoUpdate = true
}: UseHistogramOptions) => {
  const [histogram, setHistogram] = useState<HistogramData | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  const calculateStats = useMemo(() => {
    if (!pixelData || pixelData.length === 0) return null

    let sum = 0
    let sumSq = 0
    let min = Infinity
    let max = -Infinity
    const n = pixelData.length

    for (let i = 0; i < n; i++) {
      const v = pixelData[i]
      if (!isFinite(v)) continue
      sum += v
      sumSq += v * v
      min = Math.min(min, v)
      max = Math.max(max, v)
    }

    if (min === Infinity) {
      min = 0
      max = 1
    }

    const mean = sum / n
    const variance = (sumSq / n) - mean * mean
    const stdDev = Math.sqrt(Math.max(0, variance))

    const values = Array.from(pixelData).filter(v => isFinite(v))
    values.sort((a, b) => a - b)
    const median = values[Math.floor(values.length / 2)] || 0

    return { min, max, mean, median, stdDev }
  }, [pixelData])

  useEffect(() => {
    if (!pixelData || !autoUpdate) return

    const calculate = async () => {
      setIsCalculating(true)

      try {
        const result = calculateHistogram(pixelData, bins)
        const stats = calculateStats

        if (stats) {
          setHistogram({
            bins: result.counts,
            min: stats.min,
            max: stats.max,
            mean: stats.mean,
            median: stats.median,
            stdDev: stats.stdDev
          })
        }
      } catch (error) {
        console.error('Histogram calculation error:', error)
      } finally {
        setIsCalculating(false)
      }
    }

    const timeoutId = setTimeout(calculate, 100)
    return () => clearTimeout(timeoutId)
  }, [pixelData, bins, autoUpdate, calculateStats])

  const getAutoStretchParams = useCallback(() => {
    if (!pixelData) return { blackPoint: 0, whitePoint: 65535 }
    return autoStretchParams(pixelData)
  }, [pixelData])

  const getPercentile = useCallback((percentile: number) => {
    if (!histogram || !pixelData) return 0

    const total = histogram.bins.reduce((a, b) => a + b, 0)
    if (total === 0) return 0

    const targetCount = total * percentile / 100
    let cumulative = 0

    for (let i = 0; i < histogram.bins.length; i++) {
      cumulative += histogram.bins[i]
      if (cumulative >= targetCount) {
        const t = (targetCount - (cumulative - histogram.bins[i])) / histogram.bins[i]
        return histogram.min + (histogram.max - histogram.min) * ((i + t) / bins)
      }
    }

    return histogram.max
  }, [histogram, pixelData, bins])

  return {
    histogram,
    isCalculating,
    stats: calculateStats,
    getAutoStretchParams,
    getPercentile,
    recalculate: () => {
      if (pixelData) {
        const result = calculateHistogram(pixelData, bins)
        const stats = calculateStats
        if (stats) {
          setHistogram({
            bins: result.counts,
            min: stats.min,
            max: stats.max,
            mean: stats.mean,
            median: stats.median,
            stdDev: stats.stdDev
          })
        }
      }
    }
  }
}
