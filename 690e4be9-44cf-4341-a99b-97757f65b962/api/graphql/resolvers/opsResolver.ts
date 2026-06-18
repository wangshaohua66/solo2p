import { mockData } from '../../data/mockData.js'
import { generateScheduleForLine, generateAllSchedules } from '../../services/dispatchEngine.js'
import { predictArrival, predictArrivalsForLine } from '../../services/arrivalPredictor.js'
import { detectAnomalies, getActiveAnomalies } from '../../services/anomalyDetector.js'
import { findSubstitute, applySubstitute } from '../../services/substituteMatcher.js'
import { generateDailyReport } from '../../services/reportGenerator.js'
import { PubSub } from './pubsub.js'

const pubsub = new PubSub()

const GPS_UPDATED = 'GPS_UPDATED'
const ANOMALY_ALERT = 'ANOMALY_ALERT'

export { pubsub, GPS_UPDATED, ANOMALY_ALERT }

const MAX_PAGE_SIZE = 200

function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number; page: number; pageSize: number } {
  const ps = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize || 20))
  const p = Math.max(1, page || 1)
  return {
    items: items.slice((p - 1) * ps, p * ps),
    total: items.length,
    page: p,
    pageSize: ps,
  }
}

export const resolvers = {
  Line: {
    routes: (parent: { id: string }) => mockData.routes.filter(r => r.lineId === parent.id),
    vehicles: (parent: { id: string }) => mockData.vehicles.filter(v => v.lineId === parent.id),
    drivers: (parent: { id: string }) => mockData.drivers.filter(d => d.lineId === parent.id),
    trips: (parent: { id: string }) => mockData.trips.filter(t => t.lineId === parent.id),
  },
  Route: {
    stops: (parent: { stopIds: string[] }) => mockData.stops.filter(s => parent.stopIds.includes(s.id)),
  },
  Trip: {
    line: (parent: { lineId: string }) => mockData.lines.find(l => l.id === parent.lineId),
    vehicle: (parent: { vehicleId: string }) => mockData.vehicles.find(v => v.id === parent.vehicleId),
    driver: (parent: { driverId: string }) => mockData.drivers.find(d => d.id === parent.driverId),
    ridership: (parent: { id: string }) => mockData.ridershipRecords.filter(r => r.tripId === parent.id),
  },
  Vehicle: {
    line: (parent: { lineId: string }) => mockData.lines.find(l => l.id === parent.lineId),
    gpsRecords: (parent: { id: string }) => mockData.gpsRecords.filter(g => g.vehicleId === parent.id).slice(-20),
    maintenanceRecords: (parent: { id: string }) => mockData.maintenanceRecords.filter(m => m.vehicleId === parent.id),
  },
  Driver: {
    line: (parent: { lineId: string }) => mockData.lines.find(l => l.id === parent.lineId),
  },
  Schedule: {
    line: (parent: { lineId: string }) => mockData.lines.find(l => l.id === parent.lineId),
  },
  Query: {
    line: (_: unknown, { id }: { id: string }) => mockData.lines.find(l => l.id === id),
    lines: (_: unknown, { page, pageSize }: { page?: number; pageSize?: number }) => {
      const result = paginate(mockData.lines, page || 1, pageSize || 20)
      return result.items
    },
    route: (_: unknown, { id }: { id: string }) => mockData.routes.find(r => r.id === id),
    stop: (_: unknown, { id }: { id: string }) => mockData.stops.find(s => s.id === id),
    stops: (_: unknown, { page, pageSize }: { page?: number; pageSize?: number }) => {
      const result = paginate(mockData.stops, page || 1, pageSize || 20)
      return result.items
    },
    trip: (_: unknown, { id }: { id: string }) => mockData.trips.find(t => t.id === id),
    trips: (_: unknown, { lineId, page, pageSize }: { lineId?: string; page?: number; pageSize?: number }) => {
      let filtered = mockData.trips
      if (lineId) filtered = filtered.filter(t => t.lineId === lineId)
      return paginate(filtered, page || 1, pageSize || 20)
    },
    vehicle: (_: unknown, { id }: { id: string }) => mockData.vehicles.find(v => v.id === id),
    vehicles: (_: unknown, { status, lineId, page, pageSize }: { status?: string; lineId?: string; page?: number; pageSize?: number }) => {
      let filtered = mockData.vehicles
      if (status) filtered = filtered.filter(v => v.status === status)
      if (lineId) filtered = filtered.filter(v => v.lineId === lineId)
      return paginate(filtered, page || 1, pageSize || 20)
    },
    driver: (_: unknown, { id }: { id: string }) => mockData.drivers.find(d => d.id === id),
    drivers: (_: unknown, { status, lineId, page, pageSize }: { status?: string; lineId?: string; page?: number; pageSize?: number }) => {
      let filtered = mockData.drivers
      if (status) filtered = filtered.filter(d => d.status === status)
      if (lineId) filtered = filtered.filter(d => d.lineId === lineId)
      return paginate(filtered, page || 1, pageSize || 20)
    },
    gpsRecords: (_: unknown, { vehicleId, page, pageSize }: { vehicleId: string; page?: number; pageSize?: number }) => {
      const filtered = mockData.gpsRecords.filter(g => g.vehicleId === vehicleId).sort((a, b) => b.timestamp - a.timestamp)
      const result = paginate(filtered, page || 1, pageSize || 50)
      return result.items
    },
    ridershipRecords: (_: unknown, { tripId, page, pageSize }: { tripId?: string; page?: number; pageSize?: number }) => {
      let filtered = mockData.ridershipRecords
      if (tripId) filtered = filtered.filter(r => r.tripId === tripId)
      const result = paginate(filtered, page || 1, pageSize || 20)
      return result.items
    },
    schedule: (_: unknown, { lineId, date }: { lineId: string; date: string }) => {
      return generateScheduleForLine(lineId, date)
    },
    schedules: (_: unknown, { date }: { date: string }) => {
      return generateAllSchedules(date)
    },
    arrivalPrediction: (_: unknown, { vehicleId, stopId }: { vehicleId: string; stopId: string }) => {
      return predictArrival(vehicleId, stopId)
    },
    arrivalPredictionsByLine: (_: unknown, { lineId, stopId }: { lineId: string; stopId: string }) => {
      return predictArrivalsForLine(lineId, stopId)
    },
    dailyReport: (_: unknown, { date }: { date: string }) => {
      return generateDailyReport(date)
    },
    anomalies: (_: unknown, { active }: { active?: boolean }) => {
      if (active) {
        return { anomalies: getActiveAnomalies(), recommendations: [] }
      }
      return detectAnomalies()
    },
    substitute: (_: unknown, { driverId }: { driverId: string }) => {
      return findSubstitute(driverId)
    },
  },
  Mutation: {
    generateSchedule: (_: unknown, { lineId, date }: { lineId?: string; date: string }) => {
      if (lineId) {
        return [generateScheduleForLine(lineId, date)]
      }
      return generateAllSchedules(date)
    },
    updateTrip: (_: unknown, args: { id: string; vehicleId?: string; driverId?: string; departureTime?: string; status?: string; delayMinutes?: number }) => {
      const trip = mockData.trips.find(t => t.id === args.id)
      if (!trip) throw new Error('班次不存在')
      if (args.vehicleId) trip.vehicleId = args.vehicleId
      if (args.driverId) trip.driverId = args.driverId
      if (args.departureTime) trip.departureTime = args.departureTime
      if (args.status) trip.status = args.status
      if (args.delayMinutes !== undefined) trip.delayMinutes = args.delayMinutes
      return trip
    },
    reportGPS: (_: unknown, args: { vehicleId: string; lineId: string; latitude: number; longitude: number; speed?: number; heading?: number }) => {
      const record: import('../../models/GPSRecord.js').GPSRecord = {
        id: `gps_${Date.now()}`,
        vehicleId: args.vehicleId,
        lineId: args.lineId,
        tripId: undefined,
        latitude: args.latitude,
        longitude: args.longitude,
        speed: args.speed || 0,
        heading: args.heading || 0,
        timestamp: Date.now(),
      }
      mockData.gpsRecords.push(record)
      pubsub.publish(GPS_UPDATED, { gpsUpdated: record })
      return record
    },
    reportRidership: (_: unknown, args: { tripId: string; stopId: string; boarding: number; alighting: number; onboardCount: number; loadFactor: number }) => {
      const record = {
        id: `rid_${Date.now()}`,
        tripId: args.tripId,
        stopId: args.stopId,
        boarding: args.boarding,
        alighting: args.alighting,
        onboardCount: args.onboardCount,
        loadFactor: args.loadFactor,
        timestamp: Date.now(),
      }
      mockData.ridershipRecords.push(record)
      return record
    },
    requestLeave: (_: unknown, { driverId }: { driverId: string }) => {
      const driver = mockData.drivers.find(d => d.id === driverId)
      if (!driver) throw new Error('司机不存在')
      driver.status = 'leave'
      return findSubstitute(driverId)
    },
    applySubstitute: (_: unknown, { absentDriverId, substituteDriverId }: { absentDriverId: string; substituteDriverId: string }) => {
      return applySubstitute(absentDriverId, substituteDriverId)
    },
    resolveAnomaly: (_: unknown, { id }: { id: string }) => {
      const anomaly = mockData.anomalyRecords.find(a => a.id === id)
      if (!anomaly) return false
      anomaly.resolved = true
      return true
    },
  },
  Subscription: {
    gpsUpdated: {
      subscribe: () => pubsub.asyncIterator(GPS_UPDATED),
    },
    anomalyAlert: {
      subscribe: () => pubsub.asyncIterator(ANOMALY_ALERT),
    },
  },
}
