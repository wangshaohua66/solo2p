import type { Vehicle, PickupMission } from '@/types/vehicle'
import { dayjs } from '@/utils/date'

const drivers = [
  { id: 'D001', name: '陈建国', phone: '13800138001' },
  { id: 'D002', name: '李卫东', phone: '13800138002' },
  { id: 'D003', name: '张卫国', phone: '13800138003' },
  { id: 'D004', name: '王建军', phone: '13800138004' },
  { id: 'D005', name: '刘志强', phone: '13800138005' },
  { id: 'D006', name: '赵晓峰', phone: '13800138006' },
  { id: 'D007', name: '孙明辉', phone: '13800138007' },
  { id: 'D008', name: '周永辉', phone: '13800138008' }
]

const plates = ['沪A-8888领', '沪B-6666领', '沪C-9999领', '沪D-7777领', '沪E-5555领', '沪A-1234领', '沪B-4321领', '沪A-1111家', '沪B-2222家', '沪C-3333家']

export const mockVehicles: Vehicle[] = plates.map((plate, idx) => {
  const driver = drivers[idx % drivers.length]
  const type = idx < 7 ? 'hearse' : 'family_car'
  return {
    id: `V${String(idx + 1).padStart(3, '0')}`,
    plateNumber: plate,
    type,
    model: type === 'hearse' ? '奔驰 威霆灵车' : '别克 GL8',
    status: (['idle', 'idle', 'on_mission', 'on_mission', 'idle', 'maintenance'] as const)[idx % 6],
    currentLocation: {
      lat: 31.2304 + (Math.random() - 0.5) * 0.1,
      lng: 121.4737 + (Math.random() - 0.5) * 0.15,
      address: idx % 2 === 0 ? '殡仪馆车库' : '执行任务中'
    },
    lastUpdateTime: dayjs().subtract(Math.random() * 5, 'minute').format('YYYY-MM-DD HH:mm:ss'),
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone,
    capacity: type === 'hearse' ? 1 : 7,
    mileage: 30000 + Math.floor(Math.random() * 50000),
    purchaseDate: dayjs().subtract(1 + Math.random() * 4, 'year').format('YYYY-MM-DD')
  }
})

const districts = ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '浦东新区', '虹口区', '杨浦区', '闵行区', '宝山区']

export const mockMissions: PickupMission[] = Array.from({ length: 15 }).map((_, idx) => {
  const statuses: PickupMission['status'][] = ['pending', 'urgent', 'assigned', 'picking', 'picking', 'arrived', 'completed', 'pending']
  const status = statuses[idx % statuses.length]
  const isUrgent = status === 'urgent'
  const missionTime = dayjs().add(idx < 5 ? idx * 30 : -(idx - 5) * 60, 'minute')
  const vehicleIdx = idx % mockVehicles.length
  const vehicle = mockVehicles[vehicleIdx]

  return {
    id: `M${dayjs().format('YYYYMMDD')}${String(idx + 1).padStart(4, '0')}`,
    code: `JY${dayjs().format('MMDD')}-${String(idx + 1).padStart(3, '0')}`,
    remainsId: `R${dayjs().format('YYYYMMDD')}${String(2000 + idx).padStart(4, '0')}`,
    remainsName: ['张某某', '李某某', '王某某', '赵某某', '陈某某', '刘某某'][idx % 6],
    pickupLocation: {
      lat: 31.2304 + (Math.random() - 0.5) * 0.15,
      lng: 121.4737 + (Math.random() - 0.5) * 0.2,
      address: `上海市${districts[idx % districts.length]}某某路${100 + idx * 7}号${Math.floor(Math.random() * 20) + 1}栋${Math.floor(Math.random() * 30) + 1}0${Math.floor(Math.random() * 10)}室`
    },
    destination: {
      lat: 31.2304,
      lng: 121.4737,
      address: ['第一殡仪馆', '第二殡仪馆', '第三殡仪馆'][idx % 3]
    },
    appointmentTime: missionTime.format('YYYY-MM-DD HH:mm'),
    vehicleId: status !== 'pending' && status !== 'urgent' ? vehicle.id : undefined,
    vehiclePlate: status !== 'pending' && status !== 'urgent' ? vehicle.plateNumber : undefined,
    driverId: status !== 'pending' && status !== 'urgent' ? vehicle.driverId : undefined,
    driverName: status !== 'pending' && status !== 'urgent' ? vehicle.driverName : undefined,
    driverPhone: status !== 'pending' && status !== 'urgent' ? vehicle.driverPhone : undefined,
    status: isUrgent ? 'urgent' : status,
    distanceKm: +(5 + Math.random() * 25).toFixed(1),
    estimatedDuration: 20 + Math.floor(Math.random() * 60),
    actualDepartTime: status === 'picking' || status === 'arrived' || status === 'completed'
      ? missionTime.subtract(Math.random() * 30, 'minute').format('YYYY-MM-DD HH:mm') : undefined,
    actualArriveTime: status === 'arrived' || status === 'completed'
      ? missionTime.add(20 + Math.random() * 40, 'minute').format('YYYY-MM-DD HH:mm') : undefined,
    actualCompleteTime: status === 'completed'
      ? missionTime.add(40 + Math.random() * 40, 'minute').format('YYYY-MM-DD HH:mm') : undefined,
    createTime: missionTime.subtract(1 + Math.random() * 3, 'hour').format('YYYY-MM-DD HH:mm'),
    createOperator: ['调度员A', '调度员B', '调度员C'][idx % 3],
    isUrgent
  }
}).sort((a, b) => {
  const priority: Record<string, number> = { urgent: 0, pending: 1, assigned: 2, picking: 3, arrived: 4, completed: 5, cancelled: 6 }
  return priority[a.status] - priority[b.status]
})
