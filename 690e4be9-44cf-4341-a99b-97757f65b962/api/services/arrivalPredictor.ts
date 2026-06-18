import { mockData } from '../data/mockData.js'

interface ArrivalPrediction {
  vehicleId: string
  stopId: string
  stopName: string
  estimatedArrivalMinutes: number
  estimatedArrivalTime: string
  confidence: number
  distanceRemaining: number
  speedEstimate: number
}

function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function getAverageSpeedForHour(hour: number): number {
  if (hour >= 7 && hour <= 9) return 18
  if (hour >= 17 && hour <= 19) return 16
  if (hour >= 10 && hour <= 16) return 28
  if (hour >= 20 && hour <= 22) return 32
  return 35
}

function getHistoricalTravelTime(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  hour: number
): number {
  const distance = calculateDistance(fromLat, fromLon, toLat, toLon)
  const speed = getAverageSpeedForHour(hour)
  const baseMinutes = (distance / speed) * 60
  const noise = (Math.random() - 0.5) * 1.5
  return Math.max(0.5, baseMinutes + noise)
}

export function predictArrival(
  vehicleId: string,
  targetStopId: string
): ArrivalPrediction | null {
  const vehicle = mockData.vehicles.find(v => v.id === vehicleId)
  if (!vehicle) return null

  const latestGps = mockData.gpsRecords
    .filter(g => g.vehicleId === vehicleId)
    .sort((a, b) => b.timestamp - a.timestamp)[0]
  if (!latestGps) return null

  const targetStop = mockData.stops.find(s => s.id === targetStopId)
  if (!targetStop) return null

  const now = new Date()
  const currentHour = now.getHours()

  const distanceRemaining = calculateDistance(
    latestGps.latitude, latestGps.longitude,
    targetStop.latitude, targetStop.longitude
  )

  const speedEstimate = getAverageSpeedForHour(currentHour)
  const baseMinutes = (distanceRemaining / speedEstimate) * 60

  const historicalAdjust = getHistoricalTravelTime(
    latestGps.latitude, latestGps.longitude,
    targetStop.latitude, targetStop.longitude,
    currentHour
  )

  const estimatedMinutes = Math.max(0.5, (baseMinutes * 0.6 + historicalAdjust * 0.4))

  const predictionError = Math.abs(baseMinutes - historicalAdjust)
  const confidence = Math.max(0.6, Math.min(0.95, 1 - predictionError / 10))

  const arrivalMinutes = now.getMinutes() + estimatedMinutes
  const arrivalHour = now.getHours() + Math.floor(arrivalMinutes / 60)
  const arrivalMin = arrivalMinutes % 60
  const estimatedArrivalTime = `${String(arrivalHour).padStart(2, '0')}:${String(Math.floor(arrivalMin)).padStart(2, '0')}`

  return {
    vehicleId,
    stopId: targetStopId,
    stopName: targetStop.name,
    estimatedArrivalMinutes: Math.round(estimatedMinutes * 10) / 10,
    estimatedArrivalTime,
    confidence: Math.round(confidence * 100) / 100,
    distanceRemaining: Math.round(distanceRemaining * 1000 * 10) / 10,
    speedEstimate,
  }
}

export function predictArrivalsForLine(
  lineId: string,
  stopId: string
): ArrivalPrediction[] {
  const lineVehicles = mockData.vehicles.filter(v => v.lineId === lineId && v.status === 'active')
  const predictions: ArrivalPrediction[] = []

  for (const veh of lineVehicles.slice(0, 10)) {
    const hasGps = mockData.gpsRecords.some(g => g.vehicleId === veh.id)
    if (hasGps) {
      const prediction = predictArrival(veh.id, stopId)
      if (prediction) predictions.push(prediction)
    }
  }

  return predictions.sort((a, b) => a.estimatedArrivalMinutes - b.estimatedArrivalMinutes)
}

export function predictArrivalsForStop(stopId: string): ArrivalPrediction[] {
  const predictions: ArrivalPrediction[] = []
  const recentGps = mockData.gpsRecords
    .filter(g => Date.now() - g.timestamp < 3600000)
    .sort((a, b) => b.timestamp - a.timestamp)

  const seenVehicles = new Set<string>()
  for (const gps of recentGps) {
    if (!seenVehicles.has(gps.vehicleId)) {
      seenVehicles.add(gps.vehicleId)
      const prediction = predictArrival(gps.vehicleId, stopId)
      if (prediction && prediction.estimatedArrivalMinutes <= 60) {
        predictions.push(prediction)
      }
    }
  }

  return predictions.sort((a, b) => a.estimatedArrivalMinutes - b.estimatedArrivalMinutes)
}
