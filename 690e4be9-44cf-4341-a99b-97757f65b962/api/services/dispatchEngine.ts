import type { Line } from '../models/Line.js'
import type { Vehicle } from '../models/Vehicle.js'
import type { Driver } from '../models/Driver.js'
import type { Schedule, ScheduleTripItem } from '../models/Schedule.js'
import { mockData } from '../data/mockData.js'

interface Chromosome {
  trips: ScheduleTripItem[]
  fitness: number
  conflicts: string[]
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function getPeakMinutes(): { morning: [number, number]; evening: [number, number] } {
  return { morning: [420, 540], evening: [1020, 1140] }
}

function isPeakTime(minute: number): boolean {
  const { morning, evening } = getPeakMinutes()
  return (minute >= morning[0] && minute <= morning[1]) || (minute >= evening[0] && minute <= evening[1])
}

function generateInitialSchedule(
  line: Line,
  lineVehicles: Vehicle[],
  lineDrivers: Driver[]
): Chromosome {
  const trips: ScheduleTripItem[] = []
  const conflicts: string[] = []
  const startMin = timeToMinutes(line.firstBusTime)
  const endMin = timeToMinutes(line.lastBusTime)
  const driverWorkMap = new Map<string, number>()
  const vehicleTripMap = new Map<string, number[]>()

  let currentMin = startMin
  let tripIdx = 0
  let vehIdx = 0
  let drvIdx = 0

  while (currentMin <= endMin) {
    const direction = tripIdx % 2
    const interval = isPeakTime(currentMin) ? line.peakInterval : line.offPeakInterval
    const roundTripMinutes = Math.ceil((line.mileage * 2) / 20) + interval
    const veh = lineVehicles[vehIdx % lineVehicles.length]
    const drv = lineDrivers[drvIdx % lineDrivers.length]

    const driverCurrentWork = driverWorkMap.get(drv.id) || 0
    if (driverCurrentWork + roundTripMinutes > 480) {
      conflicts.push(`司机${drv.name}工时将超8小时`)
      drvIdx++
      continue
    }

    const vehicleTrips = vehicleTripMap.get(veh.id) || []
    const lastTripEnd = vehicleTrips.length > 0 ? Math.max(...vehicleTrips) : 0
    if (currentMin < lastTripEnd + 5) {
      conflicts.push(`车辆${veh.plateNumber}存在时间冲突`)
      vehIdx++
      continue
    }

    driverWorkMap.set(drv.id, driverCurrentWork + roundTripMinutes)
    vehicleTrips.push(currentMin + roundTripMinutes)
    vehicleTripMap.set(veh.id, vehicleTrips)

    trips.push({
      tripId: `trip_${line.lineNo}_${tripIdx + 1}`,
      vehicleId: veh.id,
      driverId: drv.id,
      departureTime: minutesToTime(currentMin),
      direction,
    })

    currentMin += interval
    tripIdx++
    vehIdx++
    drvIdx++
  }

  const fitness = calculateFitness(trips, line, driverWorkMap, vehicleTripMap)
  return { trips, fitness, conflicts }
}

function calculateFitness(
  trips: ScheduleTripItem[],
  line: Line,
  driverWorkMap: Map<string, number>,
  vehicleTripMap: Map<string, number[]>
): number {
  if (trips.length === 0) return 0

  const startMin = timeToMinutes(line.firstBusTime)
  const endMin = timeToMinutes(line.lastBusTime)
  const totalOperatingMinutes = endMin - startMin

  let coverageScore = 0
  let peakCount = 0
  let offPeakCount = 0
  for (const trip of trips) {
    const depMin = timeToMinutes(trip.departureTime)
    if (isPeakTime(depMin)) peakCount++
    else offPeakCount++
  }

  const peakExpected = Math.ceil((120 * 2) / line.peakInterval)
  const offPeakExpected = Math.ceil((totalOperatingMinutes - 240) / line.offPeakInterval)
  coverageScore = Math.min(1, peakCount / Math.max(1, peakExpected)) * 0.4 +
    Math.min(1, offPeakCount / Math.max(1, offPeakExpected)) * 0.3

  let constraintPenalty = 0
  for (const [, work] of driverWorkMap) {
    if (work > 480) constraintPenalty += (work - 480) * 0.1
  }

  let vehicleUtilization = 0
  for (const [, tripEnds] of vehicleTripMap) {
    vehicleUtilization += tripEnds.length
  }
  vehicleUtilization = vehicleUtilization > 0 ? Math.min(1, trips.length / Math.max(1, vehicleUtilization)) * 0.3 : 0

  return Math.max(0, coverageScore + vehicleUtilization - constraintPenalty * 0.01)
}

function crossover(parent1: Chromosome, parent2: Chromosome, line: Line): Chromosome {
  const splitPoint = Math.floor(parent1.trips.length / 2)
  const childTrips = [
    ...parent1.trips.slice(0, splitPoint),
    ...parent2.trips.slice(splitPoint),
  ]
  const driverWorkMap = new Map<string, number>()
  const vehicleTripMap = new Map<string, number[]>()
  const conflicts: string[] = []

  for (const trip of childTrips) {
    const work = driverWorkMap.get(trip.driverId) || 0
    driverWorkMap.set(trip.driverId, work + 60)
    const vTrips = vehicleTripMap.get(trip.vehicleId) || []
    vTrips.push(timeToMinutes(trip.departureTime) + 60)
    vehicleTripMap.set(trip.vehicleId, vTrips)
  }

  const fitness = calculateFitness(childTrips, line, driverWorkMap, vehicleTripMap)
  return { trips: childTrips, fitness, conflicts }
}

function mutate(chromosome: Chromosome, mutationRate: number): Chromosome {
  const trips = [...chromosome.trips]
  for (let i = 0; i < trips.length; i++) {
    if (Math.random() < mutationRate) {
      const depMin = timeToMinutes(trips[i].departureTime)
      const offset = Math.floor(Math.random() * 5) - 2
      trips[i] = {
        ...trips[i],
        departureTime: minutesToTime(Math.max(0, depMin + offset)),
      }
    }
  }
  return { ...chromosome, trips }
}

function selectParent(population: Chromosome[]): Chromosome {
  const tournamentSize = 3
  let best = population[Math.floor(Math.random() * population.length)]
  for (let i = 1; i < tournamentSize; i++) {
    const contender = population[Math.floor(Math.random() * population.length)]
    if (contender.fitness > best.fitness) best = contender
  }
  return best
}

export function generateScheduleForLine(lineId: string, date: string): Schedule {
  const line = mockData.lines.find(l => l.id === lineId)
  if (!line) throw new Error(`线路${lineId}不存在`)

  const lineVehicles = mockData.vehicles.filter(v => v.lineId === lineId && v.status === 'active')
  const lineDrivers = mockData.drivers.filter(d => d.lineId === lineId && d.status === 'active')

  if (lineVehicles.length === 0 || lineDrivers.length === 0) {
    return {
      id: `sched_${lineId}_${date}`,
      lineId,
      date,
      trips: [],
      status: 'failed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  const populationSize = 20
  const generations = 50
  const mutationRate = 0.1

  let population: Chromosome[] = []
  for (let i = 0; i < populationSize; i++) {
    population.push(generateInitialSchedule(line, lineVehicles, lineDrivers))
  }

  for (let gen = 0; gen < generations; gen++) {
    const newPopulation: Chromosome[] = []
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness)
    newPopulation.push(sorted[0], sorted[1])

    while (newPopulation.length < populationSize) {
      const parent1 = selectParent(population)
      const parent2 = selectParent(population)
      const child = crossover(parent1, parent2, line)
      const mutated = mutate(child, mutationRate)
      newPopulation.push(mutated)
    }

    population = newPopulation
  }

  const best = [...population].sort((a, b) => b.fitness - a.fitness)[0]

  return {
    id: `sched_${lineId}_${date}`,
    lineId,
    date,
    trips: best.trips,
    status: best.conflicts.length > 0 ? 'warning' : 'approved',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function generateAllSchedules(date: string): Schedule[] {
  const startTime = Date.now()
  const schedules: Schedule[] = []

  for (const line of mockData.lines) {
    schedules.push(generateScheduleForLine(line.id, date))
  }

  const elapsed = Date.now() - startTime
  if (elapsed > 15000) {
    console.warn(`排班生成耗时${elapsed}ms，超过15秒阈值`)
  }

  return schedules
}

export function detectConflicts(schedule: Schedule): string[] {
  const conflicts: string[] = []
  const driverWork = new Map<string, number>()
  const vehicleSchedule = new Map<string, number[]>()

  for (const trip of schedule.trips) {
    const work = driverWork.get(trip.driverId) || 0
    driverWork.set(trip.driverId, work + 60)

    const times = vehicleSchedule.get(trip.vehicleId) || []
    const depMin = timeToMinutes(trip.departureTime)
    times.push(depMin)
    vehicleSchedule.set(trip.vehicleId, times)
  }

  for (const [drvId, totalWork] of driverWork) {
    if (totalWork > 480) {
      const drv = mockData.drivers.find(d => d.id === drvId)
      conflicts.push(`司机${drv?.name || drvId}工时${totalWork}分钟，超过8小时限制`)
    }
  }

  for (const [vehId, times] of vehicleSchedule) {
    const sorted = times.sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] < 5) {
        const veh = mockData.vehicles.find(v => v.id === vehId)
        conflicts.push(`车辆${veh?.plateNumber || vehId}存在发车时间冲突`)
      }
    }
  }

  return conflicts
}
