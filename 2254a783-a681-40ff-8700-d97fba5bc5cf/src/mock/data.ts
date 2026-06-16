import dayjs from 'dayjs'
import type {
  Port, Berth, Vessel, BerthSchedule, TideStation, PendingApplication,
  User, ThroughputStats, UtilizationData, Waypoint, CargoType, VesselStatus,
  ScheduleStatus, OperationType
} from '@/types'

const CARGO_TYPES: CargoType[] = ['container', 'bulk', 'liquid', 'general', 'ro-ro']
const VESSEL_STATUSES: VesselStatus[] = ['anchorage', 'entering', 'berthed', 'loading', 'unloading', 'leaving', 'departed']
const SCHEDULE_STATUSES: ScheduleStatus[] = ['pending', 'approved', 'in_progress', 'completed', 'conflict']
const OPERATION_TYPES: OperationType[] = ['load', 'unload', 'both']

const VESSEL_NAMES = [
  '远洋之星', '东方明珠', '太平洋号', '大西洋号', '印度洋号', '北冰洋号',
  '南海先锋', '东海明珠', '渤海湾号', '长江之星', '黄河号', '珠江号',
  '海龙号', '海鲸号', '海鲨号', '海豚号', '海鸥号', '海燕号',
  '华润号', '中远之星', '中海联号', '中外运号', '招商局号', '青岛港号',
  '天津港号', '上海港号', '宁波号', '广州号', '深圳号', '厦门号',
  '大连号', '营口号', '烟台号', '日照号', '连云港号', '南通号',
  '张家港号', '镇江号', '南京号', '武汉号', '重庆号', '九江号'
]

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function randomFrom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

function randomInt(min: number, max: number, rand: () => number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, rand: () => number, decimals: number = 1): number {
  return Number((rand() * (max - min) + min).toFixed(decimals))
}

export function generatePorts(): Port[] {
  return [
    { id: 'port-1', name: '青岛港', berthCount: 10 },
    { id: 'port-2', name: '日照港', berthCount: 7 },
    { id: 'port-3', name: '烟台港', berthCount: 8 },
    { id: 'port-4', name: '威海港', berthCount: 6 },
    { id: 'port-5', name: '渤海湾港', berthCount: 7 }
  ]
}

export function generateBerths(ports: Port[], seed: number = 42): Berth[] {
  const rand = seededRandom(seed)
  const berths: Berth[] = []
  let berthIndex = 0

  for (const port of ports) {
    for (let i = 0; i < port.berthCount; i++) {
      const row = Math.floor(berthIndex / 10)
      const col = berthIndex % 10
      berths.push({
        id: `berth-${berthIndex + 1}`,
        name: `${port.name}${i + 1}#泊位`,
        portId: port.id,
        length: randomInt(200, 400, rand),
        depth: randomFloat(8, 18, rand, 1),
        cargoTypes: [randomFrom(CARGO_TYPES, rand), randomFrom(CARGO_TYPES, rand)].filter((v, i, a) => a.indexOf(v) === i),
        status: randomFrom(['available', 'occupied', 'maintenance'] as const, rand),
        x: 100 + col * 80 + randomInt(-10, 10, rand),
        y: 150 + row * 60 + randomInt(-5, 5, rand)
      })
      berthIndex++
    }
  }

  return berths
}

export function generateVessels(count: number, berths: Berth[], seed: number = 100): Vessel[] {
  const rand = seededRandom(seed)
  const vessels: Vessel[] = []
  const now = dayjs()

  for (let i = 0; i < count; i++) {
    const status = randomFrom(VESSEL_STATUSES, rand)
    const route: Waypoint[] = []
    let position: { x: number; y: number } | undefined

    const startX = randomInt(20, 80, rand)
    const startY = randomInt(300, 450, rand)
    const berth = randomFrom(berths, rand)

    const waypointCount = randomInt(5, 10, rand)
    for (let j = 0; j < waypointCount; j++) {
      const progress = j / (waypointCount - 1)
      route.push({
        x: startX + (berth.x - startX) * progress + randomInt(-15, 15, rand),
        y: startY + (berth.y - startY) * progress + randomInt(-10, 10, rand),
        timestamp: now.add(j * 30, 'minute').toDate(),
        type: j === 0 ? 'anchorage' : j === waypointCount - 1 ? 'berth' : 'waypoint'
      })
    }

    if (status === 'anchorage') {
      position = { x: startX, y: startY }
    } else if (status === 'departed') {
      position = { x: randomInt(800, 900, rand), y: randomInt(200, 400, rand) }
    } else if (status === 'berthed' || status === 'loading' || status === 'unloading') {
      position = { x: berth.x, y: berth.y }
    } else {
      const progressIndex = randomInt(1, waypointCount - 2, rand)
      const wp = route[progressIndex]
      position = { x: wp.x + randomInt(-5, 5, rand), y: wp.y + randomInt(-5, 5, rand) }
    }

    vessels.push({
      id: `vessel-${i + 1}`,
      name: `${randomFrom(VESSEL_NAMES, rand)}-${randomInt(100, 999, rand)}`,
      imo: `${randomInt(1000000, 9999999, rand)}`,
      length: randomInt(150, 350, rand),
      draft: randomFloat(6, 15, rand, 1),
      cargoType: randomFrom(CARGO_TYPES, rand),
      cargoWeight: randomInt(5000, 80000, rand),
      status,
      eta: now.add(randomInt(-24, 72, rand), 'hour').toDate(),
      etd: status === 'berthed' || status === 'loading' || status === 'unloading'
        ? now.add(randomInt(12, 72, rand), 'hour').toDate()
        : undefined,
      position,
      route,
      progress: status === 'loading' || status === 'unloading' ? randomInt(10, 90, rand) : 0
    })
  }

  return vessels
}

export function generateSchedules(vessels: Vessel[], berths: Berth[], seed: number = 200): BerthSchedule[] {
  const rand = seededRandom(seed)
  const schedules: BerthSchedule[] = []
  const now = dayjs()

  let scheduleIndex = 0
  for (let day = 0; day < 30; day++) {
    const dayDate = now.add(day, 'day')
    const schedulesPerDay = randomInt(5, 15, rand)

    for (let i = 0; i < schedulesPerDay; i++) {
      const vessel = randomFrom(vessels, rand)
      const berth = randomFrom(berths, rand)
      const startHour = randomInt(0, 20, rand)
      const durationHours = randomInt(4, 36, rand)
      const arrivalTime = dayDate.hour(startHour).minute(randomInt(0, 59, rand)).toDate()
      const departureTime = dayjs(arrivalTime).add(durationHours, 'hour').toDate()
      const status = day === 0
        ? randomFrom(['in_progress', 'approved', 'conflict'] as const, rand)
        : day < 7
          ? randomFrom(['completed', 'approved'] as const, rand)
          : randomFrom(['pending', 'approved', 'conflict'] as const, rand)

      const conflicts: string[] = []
      if (status === 'conflict') {
        const conflictTypes = ['吃水不足', '泊位长度不够', '货类不兼容', '时间冲突']
        conflicts.push(randomFrom(conflictTypes, rand))
      }

      schedules.push({
        id: `schedule-${scheduleIndex + 1}`,
        vesselId: vessel.id,
        berthId: berth.id,
        arrivalTime,
        departureTime,
        operationType: randomFrom(OPERATION_TYPES, rand),
        status,
        progress: status === 'in_progress' ? randomInt(10, 90, rand) : status === 'completed' ? 100 : 0,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
        cargoWeight: vessel.cargoWeight,
        cargoType: vessel.cargoType
      })
      scheduleIndex++
    }
  }

  return schedules
}

export function generateTideStations(seed: number = 300): TideStation[] {
  const rand = seededRandom(seed)
  return [
    { id: 'station-1', name: '青岛主站', harmonicConstants: Array.from({ length: 6 }, () => randomInt(0, 360, rand)), baseHeight: 5.5 },
    { id: 'station-2', name: '日照站', harmonicConstants: Array.from({ length: 6 }, () => randomInt(0, 360, rand)), baseHeight: 4.8 },
    { id: 'station-3', name: '烟台站', harmonicConstants: Array.from({ length: 6 }, () => randomInt(0, 360, rand)), baseHeight: 5.2 },
    { id: 'station-4', name: '威海站', harmonicConstants: Array.from({ length: 6 }, () => randomInt(0, 360, rand)), baseHeight: 4.5 },
    { id: 'station-5', name: '渤海湾站', harmonicConstants: Array.from({ length: 6 }, () => randomInt(0, 360, rand)), baseHeight: 5.0 }
  ]
}

export function generatePendingApplications(vessels: Vessel[], seed: number = 400): PendingApplication[] {
  const rand = seededRandom(seed)
  const applications: PendingApplication[] = []
  const now = dayjs()
  const count = randomInt(8, 15, rand)

  const applicants = ['华运货代', '中外运', '中远货代', '青岛物流', '天海货代', '海通物流']

  for (let i = 0; i < count; i++) {
    const vessel = randomFrom(vessels, rand)
    applications.push({
      id: `app-${i + 1}`,
      vesselName: vessel.name,
      imo: vessel.imo,
      length: vessel.length,
      draft: vessel.draft,
      cargoType: vessel.cargoType,
      cargoWeight: vessel.cargoWeight,
      eta: now.add(randomInt(6, 120, rand), 'hour').toDate(),
      operationType: randomFrom(OPERATION_TYPES, rand),
      applicant: randomFrom(applicants, rand),
      submittedAt: now.subtract(randomInt(1, 48, rand), 'hour').toDate()
    })
  }

  return applications
}

export function generateCurrentUser(): User {
  return {
    id: 'user-1',
    name: '张明远',
    role: 'dispatcher',
    avatar: ''
  }
}

export function generateThroughputStats(ports: Port[], seed: number = 500): ThroughputStats[] {
  const rand = seededRandom(seed)
  const stats: ThroughputStats[] = []
  const now = dayjs()

  for (let month = 0; month < 12; month++) {
    const date = now.subtract(11 - month, 'month').format('YYYY-MM')
    for (const port of ports) {
      for (const cargoType of CARGO_TYPES) {
        stats.push({
          date,
          portId: port.id,
          cargoType,
          weight: randomInt(50000, 500000, rand)
        })
      }
    }
  }

  return stats
}

export function generateUtilizationData(berths: Berth[], seed: number = 600): UtilizationData[] {
  const rand = seededRandom(seed)
  const data: UtilizationData[] = []
  const now = dayjs()

  for (let day = 0; day < 7; day++) {
    const date = now.subtract(6 - day, 'day').format('YYYY-MM-DD')
    for (const berth of berths) {
      for (let hour = 0; hour < 24; hour++) {
        const occupiedChance = rand()
        data.push({
          berthId: berth.id,
          date,
          hour,
          occupied: occupiedChance > 0.4
        })
      }
    }
  }

  return data
}

export interface MockData {
  ports: Port[]
  berths: Berth[]
  vessels: Vessel[]
  schedules: BerthSchedule[]
  tideStations: TideStation[]
  pendingApplications: PendingApplication[]
  currentUser: User
  throughputStats: ThroughputStats[]
  utilizationData: UtilizationData[]
}

export function generateAllMockData(): MockData {
  const ports = generatePorts()
  const berths = generateBerths(ports)
  const vessels = generateVessels(500, berths)
  const schedules = generateSchedules(vessels, berths)
  const tideStations = generateTideStations()
  const pendingApplications = generatePendingApplications(vessels)
  const currentUser = generateCurrentUser()
  const throughputStats = generateThroughputStats(ports)
  const utilizationData = generateUtilizationData(berths)

  return {
    ports,
    berths,
    vessels,
    schedules,
    tideStations,
    pendingApplications,
    currentUser,
    throughputStats,
    utilizationData
  }
}
