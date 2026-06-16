import dayjs from 'dayjs'
import type { TideData, TideWindow, TideStation } from '@/types'

const HARMONIC_COMPONENTS = [
  { name: 'M2', period: 12.42, amplitude: 1.2, phase: 0 },
  { name: 'S2', period: 12.00, amplitude: 0.8, phase: 45 },
  { name: 'K1', period: 23.93, amplitude: 0.5, phase: 90 },
  { name: 'O1', period: 25.82, amplitude: 0.4, phase: 135 },
  { name: 'N2', period: 12.66, amplitude: 0.3, phase: 180 },
  { name: 'P1', period: 24.07, amplitude: 0.2, phase: 225 }
]

export function calculateTideHeight(timestamp: Date, station: TideStation): number {
  const t = dayjs(timestamp)
  const startOfDay = t.startOf('day')
  const hoursSinceStart = t.diff(startOfDay, 'minute') / 60

  let height = station.baseHeight

  for (const component of HARMONIC_COMPONENTS) {
    const angularFrequency = (2 * Math.PI) / component.period
    const phaseRad = (component.phase * Math.PI) / 180
    const stationPhase = (station.harmonicConstants[HARMONIC_COMPONENTS.indexOf(component)] || 0) * (Math.PI / 180)
    height += component.amplitude * Math.sin(angularFrequency * hoursSinceStart + phaseRad + stationPhase)
  }

  return Math.round(height * 100) / 100
}

export function generateTideForecast(
  station: TideStation,
  startTime: Date,
  hours: number = 48,
  intervalMinutes: number = 6
): TideData[] {
  const data: TideData[] = []
  const totalPoints = Math.floor((hours * 60) / intervalMinutes)
  const clampedPoints = Math.min(totalPoints, 500)
  const actualInterval = (hours * 60) / clampedPoints

  for (let i = 0; i < clampedPoints; i++) {
    const timestamp = dayjs(startTime).add(i * actualInterval, 'minute').toDate()
    data.push({
      timestamp,
      height: calculateTideHeight(timestamp, station),
      stationId: station.id
    })
  }

  return data
}

export function findTideWindows(
  tideData: TideData[],
  minDepth: number,
  berthDepth: number,
  minDurationHours: number = 1
): TideWindow[] {
  const windows: TideWindow[] = []
  const requiredHeight = minDepth - berthDepth
  let inWindow = false
  let windowStart: Date | null = null
  let currentMinHeight = Infinity

  for (let i = 0; i < tideData.length; i++) {
    const point = tideData[i]
    const sufficientDepth = point.height >= requiredHeight

    if (sufficientDepth && !inWindow) {
      inWindow = true
      windowStart = point.timestamp
      currentMinHeight = point.height
    } else if (sufficientDepth && inWindow) {
      currentMinHeight = Math.min(currentMinHeight, point.height)
    } else if (!sufficientDepth && inWindow) {
      if (windowStart) {
        const durationHours = dayjs(point.timestamp).diff(windowStart, 'minute') / 60
        if (durationHours >= minDurationHours) {
          const prevPoint = tideData[i - 1]
          windows.push({
            startTime: windowStart,
            endTime: prevPoint.timestamp,
            minHeight: Math.round(currentMinHeight * 100) / 100,
            type: currentMinHeight > requiredHeight + 0.5 ? 'high' : 'low'
          })
        }
      }
      inWindow = false
      windowStart = null
      currentMinHeight = Infinity
    }
  }

  if (inWindow && windowStart) {
    const lastPoint = tideData[tideData.length - 1]
    const durationHours = dayjs(lastPoint.timestamp).diff(windowStart, 'minute') / 60
    if (durationHours >= minDurationHours) {
      windows.push({
        startTime: windowStart,
        endTime: lastPoint.timestamp,
        minHeight: Math.round(currentMinHeight * 100) / 100,
        type: 'high'
      })
    }
  }

  return windows
}

export function isTimeInTideWindow(time: Date, windows: TideWindow[]): boolean {
  return windows.some(w => dayjs(time).isAfter(w.startTime) && dayjs(time).isBefore(w.endTime))
}

export function findNearestTideWindow(time: Date, windows: TideWindow[]): TideWindow | null {
  let nearest: TideWindow | null = null
  let minDiff = Infinity

  for (const w of windows) {
    const startDiff = Math.abs(dayjs(time).diff(w.startTime, 'minute'))
    const endDiff = Math.abs(dayjs(time).diff(w.endTime, 'minute'))
    const currentDiff = Math.min(startDiff, endDiff)

    if (dayjs(time).isAfter(w.startTime) && dayjs(time).isBefore(w.endTime)) {
      return w
    }

    if (currentDiff < minDiff) {
      minDiff = currentDiff
      nearest = w
    }
  }

  return nearest
}
