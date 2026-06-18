import type { Line } from '../models/Line.js'
import type { Route } from '../models/Route.js'
import type { Stop } from '../models/Stop.js'
import type { Trip } from '../models/Trip.js'
import type { Vehicle } from '../models/Vehicle.js'
import type { Driver } from '../models/Driver.js'
import type { GPSRecord } from '../models/GPSRecord.js'
import type { RidershipRecord } from '../models/RidershipRecord.js'
import type { MaintenanceRecord } from '../models/MaintenanceRecord.js'
import type { AnomalyRecord } from '../models/AnomalyRecord.js'

const STOP_NAMES = [
  '天安门东','天安门西','王府井','西单','东直门','建国门','朝阳门','前门','复兴门','阜成门',
  '德胜门','安定门','和平门','宣武门','崇文门','广渠门','永定门','左安门','右安门','广安门',
  '动物园','西直门','北太平庄','牡丹园','安贞里','惠新西街','望京','国贸','大望路','四惠',
  '双井','劲松','潘家园','中关村','海淀黄庄','知春路','学院路','五道口','上地','西二旗',
  '颐和园','圆明园','清华大学','北京大学','香山','北京站','北京西站','北京南站','三里屯','工体',
  '团结湖','呼家楼','亚运村','奥体中心','丰台','六里桥','莲花池','公主坟','五棵松','万寿路',
  '木樨地','南礼士路','长椿街','菜市口','珠市口','磁器口','方庄','蒲黄榆','刘家窑','宋家庄',
  '马家堡','大红门','旧宫','亦庄桥','天通苑北','天通苑','回龙观','龙泽','霍营','西三旗',
  '清河小营','软件园','西北旺','马连洼','温泉','北安河','南口','居庸关','延庆','通州北苑',
  '梨园','临河里','土桥','潞城','黄村','枣园','高米店','生物医药基地','天宫院','良乡',
  '长阳','篱笆房','广阳城','大学城','阎村','燕山','石景山','苹果园','金安桥','古城',
  '八角游乐园','八宝山','玉泉路','科丰桥','世界公园','总部基地','丰台科技园','看丹桥','北大地','丰益桥',
  '丽泽桥','草桥','角门东','大红门南','和义','东高地','万源街','荣京东街','经海路','次渠',
  '科创十七街','肖村','宋家庄','分钟寺','十里河','松榆里','华威桥','首都图书馆','平乐园','南磨房',
  '劲松北路','光明桥','广渠门内','幸福大街','培新街','安化楼','体育馆路','法华寺','红桥','花市',
  '铁匠营','赵公口','刘家窑桥','顺四条','宋庄路','贾家花园','景泰里','安乐林','蒲黄榆北','东侧路',
  '琉璃井','金鱼池','天桥','先农坛','永定门内','沙子口','木樨园','洋桥','马家堡东','角门北路',
  '嘉园路','翠林小区','右安门外','白纸坊','南樱桃园','牛街','教子胡同','菜市口西','虎坊桥','珠市口西',
  '大栅栏','前门西','正义路','台基厂','崇文门西','北京站口','建国门南','朝阳门南','东四','灯市口',
  '东单','崇文门','北京站东','北京站西','北京站前街','建国门内','东便门','广渠门北','光明路','夕照寺',
]

const SURNAMES = ['张','王','李','赵','刘','陈','杨','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗']
const GIVEN_M = ['伟','强','磊','军','勇','杰','涛','明','辉','鹏','飞','刚','峰','超','波','斌','健','亮','浩','宁']
const GIVEN_F = ['芳','敏','静','丽','娟','艳','秀英','玉兰','桂兰','淑芬','惠芬','丽华','美玲','婷','雯','萍','燕','瑛','玲','颖']

const VEHICLE_MODELS = ['宇通ZK6125','金龙XMQ6127','比亚迪K9','北汽福田BJ6123','中通LCK6125','申龙SLK6129']
const CAPACITIES = [80, 90, 75, 85, 88, 82]

let _id = 0
const nextId = (prefix: string): string => `${prefix}_${++_id}`

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

const rand = seededRandom(42)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5)
  return shuffled.slice(0, n)
}

const stops: Stop[] = []
for (let i = 0; i < STOP_NAMES.length; i++) {
  stops.push({
    id: `stop_${i + 1}`,
    name: STOP_NAMES[i],
    latitude: 39.85 + rand() * 0.25,
    longitude: 116.2 + rand() * 0.35,
  })
}

const lines: Line[] = []
for (let i = 1; i <= 58; i++) {
  const stopCount = 12 + Math.floor(rand() * 10)
  const lineStops = pickN(stops, stopCount)
  const mileage = 8 + Math.floor(rand() * 28)
  const peak = 3 + Math.floor(rand() * 5)
  const offPeak = 8 + Math.floor(rand() * 8)
  const vc = 18 + Math.floor(rand() * 12)
  const firstH = 5 + Math.floor(rand() * 2)
  const lastH = 21 + Math.floor(rand() * 3)
  lines.push({
    id: `line_${i}`,
    lineNo: i,
    name: `${i}路`,
    startStop: lineStops[0].name,
    endStop: lineStops[lineStops.length - 1].name,
    firstBusTime: `${String(firstH).padStart(2, '0')}:00`,
    lastBusTime: `${String(lastH).padStart(2, '0')}:${rand() > 0.5 ? '00' : '30'}`,
    mileage,
    peakInterval: peak,
    offPeakInterval: offPeak,
    vehicleCount: vc,
  })
}

const routes: Route[] = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const lineStops = stops.filter(() => rand() > 0.5).slice(0, 12 + Math.floor(rand() * 10))
  if (lineStops.length < 4) {
    lineStops.push(...pickN(stops, 4 - lineStops.length + 4))
  }
  const upStopIds = lineStops.map(s => s.id)
  const downStopIds = [...upStopIds].reverse()
  routes.push({
    id: `route_${i * 2 + 1}`,
    lineId: line.id,
    direction: 0,
    stopIds: upStopIds,
    distance: line.mileage,
  })
  routes.push({
    id: `route_${i * 2 + 2}`,
    lineId: line.id,
    direction: 1,
    stopIds: downStopIds,
    distance: line.mileage,
  })
}

const vehicles: Vehicle[] = []
for (let i = 0; i < 1260; i++) {
  const lineIdx = i % 58
  const mi = Math.floor(rand() * VEHICLE_MODELS.length)
  const plate = `京A·${String(10000 + i).slice(1)}`
  const statusRoll = rand()
  let status = 'active'
  if (statusRoll > 0.92) status = 'maintenance'
  else if (statusRoll > 0.88) status = 'idle'
  vehicles.push({
    id: `veh_${i + 1}`,
    plateNumber: plate,
    model: VEHICLE_MODELS[mi],
    capacity: CAPACITIES[mi],
    status,
    lineId: lines[lineIdx].id,
    totalMileage: 50000 + Math.floor(rand() * 250000),
  })
}

const drivers: Driver[] = []
for (let i = 0; i < 3200; i++) {
  const lineIdx = i % 58
  const isFemale = rand() > 0.75
  const surname = pick(SURNAMES)
  const given = isFemale ? pick(GIVEN_F) : pick(GIVEN_M)
  const statusRoll = rand()
  let status = 'active'
  if (statusRoll > 0.95) status = 'leave'
  else if (statusRoll > 0.9) status = 'off'
  const license = rand() > 0.3 ? 'A1' : 'A3'
  drivers.push({
    id: `drv_${i + 1}`,
    name: `${surname}${given}`,
    employeeId: `EMP${String(10000 + i).slice(1)}`,
    licenseType: license,
    status,
    lineId: lines[lineIdx].id,
    dailyWorkMinutes: 300 + Math.floor(rand() * 180),
    phone: `138${String(10000000 + Math.floor(rand() * 90000000)).slice(1)}`,
  })
}

const now = Date.now()
const gpsRecords: GPSRecord[] = []
for (let i = 0; i < 500; i++) {
  const veh = vehicles[i % vehicles.length]
  const line = lines.find(l => l.id === veh.lineId)!
  gpsRecords.push({
    id: `gps_${i + 1}`,
    vehicleId: veh.id,
    lineId: line.id,
    tripId: `trip_${(i % 200) + 1}`,
    latitude: 39.85 + rand() * 0.25,
    longitude: 116.2 + rand() * 0.35,
    speed: Math.floor(rand() * 55),
    heading: Math.floor(rand() * 360),
    timestamp: now - Math.floor(rand() * 3600000),
  })
}

const ridershipRecords: RidershipRecord[] = []
for (let i = 0; i < 800; i++) {
  const tripId = `trip_${(i % 200) + 1}`
  const stopId = stops[i % stops.length].id
  const boarding = Math.floor(rand() * 30)
  const alighting = Math.floor(rand() * 25)
  const onboard = Math.max(0, boarding - alighting + Math.floor(rand() * 40))
  const capacity = 80
  const loadFactor = Math.min(1.0, onboard / capacity)
  ridershipRecords.push({
    id: `rid_${i + 1}`,
    tripId,
    stopId,
    boarding,
    alighting,
    onboardCount: onboard,
    loadFactor: Math.round(loadFactor * 100) / 100,
    timestamp: now - Math.floor(rand() * 86400000),
  })
}

const maintenanceRecords: MaintenanceRecord[] = []
for (let i = 0; i < 200; i++) {
  const veh = vehicles[i]
  const typeRoll = rand()
  let mType = 'routine'
  if (typeRoll > 0.8) mType = 'major'
  else if (typeRoll > 0.6) mType = 'minor'
  const startDt = new Date(now - Math.floor(rand() * 30 * 86400000))
  const endDt = new Date(startDt.getTime() + Math.floor(rand() * 7 * 86400000))
  const nextDt = new Date(endDt.getTime() + (mType === 'major' ? 180 : mType === 'minor' ? 90 : 30) * 86400000)
  maintenanceRecords.push({
    id: `mnt_${i + 1}`,
    vehicleId: veh.id,
    type: mType,
    startDate: startDt.toISOString().split('T')[0],
    endDate: endDt.toISOString().split('T')[0],
    nextDate: nextDt.toISOString().split('T')[0],
    cost: Math.round(500 + rand() * 19500),
    description: mType === 'major' ? '大修保养' : mType === 'minor' ? '小修维护' : '常规保养',
    status: rand() > 0.3 ? 'completed' : 'pending',
  })
}

const anomalyRecords: AnomalyRecord[] = []
for (let i = 0; i < 50; i++) {
  const lineIdx = Math.floor(rand() * 58)
  const aType = rand() > 0.5 ? 'overload' : 'delay'
  anomalyRecords.push({
    id: `anm_${i + 1}`,
    type: aType,
    lineId: lines[lineIdx].id,
    tripId: `trip_${Math.floor(rand() * 200) + 1}`,
    vehicleId: vehicles[Math.floor(rand() * 1260)].id,
    driverId: drivers[Math.floor(rand() * 3200)].id,
    description: aType === 'overload' ? '连续3班满载率超90%' : '晚点超过5分钟',
    severity: aType === 'overload' ? 'high' : 'medium',
    timestamp: now - Math.floor(rand() * 86400000),
    resolved: rand() > 0.6,
    recommendation: aType === 'overload' ? '建议加密该时段班次' : '建议调整发车间距或增派车辆',
  })
}

const trips: Trip[] = []
for (let i = 0; i < 200; i++) {
  const lineIdx = i % 58
  const line = lines[lineIdx]
  const dir = i % 2
  const route = routes.find(r => r.lineId === line.id && r.direction === dir)!
  const h = 5 + Math.floor(rand() * 18)
  const m = Math.floor(rand() * 60)
  const delay = rand() > 0.8 ? Math.floor(rand() * 12) : 0
  const statusRoll = rand()
  let tStatus = 'completed'
  if (statusRoll > 0.85) tStatus = 'running'
  else if (statusRoll > 0.75) tStatus = 'scheduled'
  trips.push({
    id: `trip_${i + 1}`,
    lineId: line.id,
    routeId: route.id,
    vehicleId: vehicles[i % 1260].id,
    driverId: drivers[i % 3200].id,
    departureTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    arrivalTime: tStatus === 'completed' ? `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}` : undefined,
    direction: dir,
    status: tStatus,
    delayMinutes: delay,
  })
}

export const mockData = {
  lines,
  routes,
  stops,
  trips,
  vehicles,
  drivers,
  gpsRecords,
  ridershipRecords,
  maintenanceRecords,
  anomalyRecords,
}
