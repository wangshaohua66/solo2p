import { mockData } from '../data/mockData.js'

interface DailyReport {
  date: string
  totalRidership: number
  averageLoadFactor: number
  onTimeRate: number
  totalTrips: number
  completedTrips: number
  delayedTrips: number
  totalMileageKm: number
  mileageUtilizationRate: number
  activeVehicles: number
  totalVehicles: number
  vehicleUtilizationRate: number
  activeDrivers: number
  totalDrivers: number
  driverUtilizationRate: number
  anomalyCount: number
  lineReports: LineReport[]
}

interface LineReport {
  lineId: string
  lineName: string
  ridership: number
  tripCount: number
  onTimeRate: number
  averageLoadFactor: number
  mileageKm: number
}

export function generateDailyReport(date: string): DailyReport {
  const totalRidership = mockData.ridershipRecords.reduce((sum, r) => sum + r.boarding, 0)
  const averageLoadFactor = mockData.ridershipRecords.length > 0
    ? mockData.ridershipRecords.reduce((sum, r) => sum + r.loadFactor, 0) / mockData.ridershipRecords.length
    : 0

  const totalTrips = mockData.trips.length
  const completedTrips = mockData.trips.filter(t => t.status === 'completed').length
  const delayedTrips = mockData.trips.filter(t => t.delayMinutes > 0).length
  const onTimeTrips = mockData.trips.filter(t => t.delayMinutes <= 2).length
  const onTimeRate = totalTrips > 0 ? onTimeTrips / totalTrips : 0

  const totalMileageKm = mockData.trips
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => {
      const line = mockData.lines.find(l => l.id === t.lineId)
      return sum + (line?.mileage || 0)
    }, 0)

  const maxPossibleMileage = mockData.lines.reduce((sum, l) => {
    const operatingHours = parseFloat(l.lastBusTime) - parseFloat(l.firstBusTime)
    const tripCount = Math.ceil(operatingHours * 60 / l.offPeakInterval)
    return sum + l.mileage * tripCount
  }, 0)

  const mileageUtilizationRate = maxPossibleMileage > 0 ? totalMileageKm / maxPossibleMileage : 0

  const activeVehicles = mockData.vehicles.filter(v => v.status === 'active').length
  const totalVehicles = mockData.vehicles.length
  const vehicleUtilizationRate = totalVehicles > 0 ? activeVehicles / totalVehicles : 0

  const activeDrivers = mockData.drivers.filter(d => d.status === 'active').length
  const totalDrivers = mockData.drivers.length
  const driverUtilizationRate = totalDrivers > 0 ? activeDrivers / totalDrivers : 0

  const anomalyCount = mockData.anomalyRecords.filter(a => !a.resolved).length

  const lineReports: LineReport[] = mockData.lines.map(line => {
    const lineTrips = mockData.trips.filter(t => t.lineId === line.id)
    const lineRidership = mockData.ridershipRecords
      .filter(r => lineTrips.some(t => t.id === r.tripId))
      .reduce((sum, r) => sum + r.boarding, 0)

    const lineOnTime = lineTrips.filter(t => t.delayMinutes <= 2).length
    const lineLoadFactors = mockData.ridershipRecords
      .filter(r => lineTrips.some(t => t.id === r.tripId))
      .map(r => r.loadFactor)

    const lineMileage = lineTrips
      .filter(t => t.status === 'completed')
      .length * line.mileage

    return {
      lineId: line.id,
      lineName: line.name,
      ridership: lineRidership,
      tripCount: lineTrips.length,
      onTimeRate: lineTrips.length > 0 ? lineOnTime / lineTrips.length : 0,
      averageLoadFactor: lineLoadFactors.length > 0
        ? lineLoadFactors.reduce((s, f) => s + f, 0) / lineLoadFactors.length
        : 0,
      mileageKm: lineMileage,
    }
  })

  return {
    date,
    totalRidership,
    averageLoadFactor: Math.round(averageLoadFactor * 1000) / 1000,
    onTimeRate: Math.round(onTimeRate * 1000) / 1000,
    totalTrips,
    completedTrips,
    delayedTrips,
    totalMileageKm: Math.round(totalMileageKm),
    mileageUtilizationRate: Math.round(mileageUtilizationRate * 1000) / 1000,
    activeVehicles,
    totalVehicles,
    vehicleUtilizationRate: Math.round(vehicleUtilizationRate * 1000) / 1000,
    activeDrivers,
    totalDrivers,
    driverUtilizationRate: Math.round(driverUtilizationRate * 1000) / 1000,
    anomalyCount,
    lineReports,
  }
}

export function generateLineReport(lineId: string, date: string): LineReport | null {
  const line = mockData.lines.find(l => l.id === lineId)
  if (!line) return null

  const lineTrips = mockData.trips.filter(t => t.lineId === lineId)
  const lineRidership = mockData.ridershipRecords
    .filter(r => lineTrips.some(t => t.id === r.tripId))
    .reduce((sum, r) => sum + r.boarding, 0)

  const lineOnTime = lineTrips.filter(t => t.delayMinutes <= 2).length
  const lineLoadFactors = mockData.ridershipRecords
    .filter(r => lineTrips.some(t => t.id === r.tripId))
    .map(r => r.loadFactor)

  const lineMileage = lineTrips.filter(t => t.status === 'completed').length * line.mileage

  return {
    lineId,
    lineName: line.name,
    ridership: lineRidership,
    tripCount: lineTrips.length,
    onTimeRate: lineTrips.length > 0 ? Math.round((lineOnTime / lineTrips.length) * 1000) / 1000 : 0,
    averageLoadFactor: lineLoadFactors.length > 0
      ? Math.round((lineLoadFactors.reduce((s, f) => s + f, 0) / lineLoadFactors.length) * 1000) / 1000
      : 0,
    mileageKm: lineMileage,
  }
}
