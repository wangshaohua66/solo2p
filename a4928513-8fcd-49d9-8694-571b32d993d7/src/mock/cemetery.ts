import type { CemeteryArea, CemeteryPlot, MemorialTimeSlot, ParkingLot, MemorialBooking } from '@/types/cemetery'
import { dayjs, generateTimeSlots } from '@/utils/date'

export const mockAreas: CemeteryArea[] = [
  { id: 'A1', name: '福寿区A', code: 'FS-A', type: 'earth', rows: 8, cols: 12, orientation: '坐北朝南', description: '标准墓区，环境幽静' },
  { id: 'A2', name: '福寿区B', code: 'FS-B', type: 'earth', rows: 8, cols: 10, orientation: '坐北朝南', description: '双穴为主，绿化丰富' },
  { id: 'A3', name: '永宁区', code: 'YN', type: 'earth', rows: 10, cols: 14, orientation: '坐西朝东', description: '豪华家族墓区' },
  { id: 'A4', name: '骨灰墙', code: 'GHQ', type: 'ashes_wall', rows: 20, cols: 30, orientation: '多层格位', description: '经济实惠，格位寄存' },
  { id: 'A5', name: '草坪葬区', code: 'CP', type: 'lawn', rows: 6, cols: 15, orientation: '自由规划', description: '草坪生态葬' }
]

export function generatePlots(): CemeteryPlot[] {
  const plots: CemeteryPlot[] = []
  const types: CemeteryPlot['type'][] = ['standard', 'double', 'premium', 'family']
  const statuses: CemeteryPlot['status'][] = ['for_sale', 'for_sale', 'for_sale', 'sold', 'reserved', 'occupied', 'maintenance']
  const cellW = 50
  const cellH = 70
  const padding = 30

  mockAreas.forEach((area) => {
    const startX = padding
    const startY = padding
    for (let row = 0; row < area.rows; row++) {
      for (let col = 0; col < area.cols; col++) {
        const type = area.type === 'ashes_wall' ? 'ashes_wall' : types[Math.min(Math.floor(Math.random() * (row < 2 ? 3 : 4)), 3)]
        const priceMap: Record<string, number> = { standard: 38800, double: 58800, premium: 128800, family: 288800, ashes_wall: 6800 }
        const idx = row * area.cols + col
        const rnd = Math.random()
        let status = statuses[Math.floor(rnd * statuses.length)]
        if (rnd < 0.45) status = 'for_sale'
        if (rnd > 0.95) status = 'maintenance'

        const names = ['王某某', '李某某', '张某某', '陈某某', '赵某某', '刘某某']

        plots.push({
          id: `${area.id}-${String(row + 1).padStart(2, '0')}${String(col + 1).padStart(2, '0')}`,
          areaId: area.id,
          areaName: area.name,
          row: row + 1,
          col: col + 1,
          plotNo: `${area.code}${String(row + 1).padStart(2, '0')}-${String(col + 1).padStart(2, '0')}`,
          type,
          price: priceMap[type] || 38800,
          originalPrice: Math.floor(priceMap[type] * 1.08),
          status,
          remainsId: status === 'sold' || status === 'occupied' ? `R2026${String(10000 + idx).padStart(5, '0')}` : undefined,
          remainsName: status === 'sold' || status === 'occupied' ? names[idx % names.length] : undefined,
          burialDate: status === 'occupied' ? dayjs().subtract(Math.random() * 1800, 'day').format('YYYY-MM-DD') : undefined,
          contractNo: status === 'sold' || status === 'occupied' ? `HT${dayjs().format('YYYY')}${String(idx).padStart(6, '0')}` : undefined,
          ownerName: status === 'sold' || status === 'occupied' ? `家属${names[idx % names.length].replace('某某', '')}` : undefined,
          ownerPhone: status === 'sold' || status === 'occupied' ? `138${String(idx).padStart(8, '0')}` : undefined,
          x: startX + col * (cellW + 6),
          y: startY + row * (cellH + 6),
          width: cellW,
          height: cellH,
          hasMonument: status !== 'for_sale' && Math.random() > 0.2,
          hasVase: status !== 'for_sale' && Math.random() > 0.5
        })
      }
    }
  })
  return plots
}

export const mockPlots: CemeteryPlot[] = generatePlots()

export function generateMemorialSlots(date: string): MemorialTimeSlot[] {
  const slots = generateTimeSlots(7, 20, 120)
  const isQingming = dayjs(date).month() === 3 && dayjs(date).date() >= 1 && dayjs(date).date() <= 7
  const isWeekend = dayjs(date).day() === 0 || dayjs(date).day() === 6
  const isPeak = isQingming || isWeekend

  return slots.map((slot, idx) => {
    const baseQuota = isPeak ? 80 : 150
    const bookedRate = [0.2, 0.4, 0.7, 0.85, 0.95, 0.6, 0.4][idx % 7]
    const booked = Math.floor(baseQuota * bookedRate + Math.random() * baseQuota * 0.1)
    const peopleQuota = isPeak ? 100 : 200
    const bookedPeople = Math.floor(peopleQuota * bookedRate)
    let status: MemorialTimeSlot['status'] = 'available'
    if (bookedPeople >= peopleQuota) status = 'full'
    else if (bookedPeople >= peopleQuota * 0.8) status = 'limited'
    else if (idx < 1 || idx >= slots.length - 1) status = 'closed'

    return {
      slotId: `SLOT-${dayjs(date).format('YYYYMMDD')}-${String(idx + 1).padStart(2, '0')}`,
      date,
      timeRange: slot.label,
      startTime: slot.start,
      endTime: slot.end,
      totalQuota: peopleQuota,
      bookedCount: bookedPeople,
      vehicleQuota: Math.floor(baseQuota / 2),
      vehicleBooked: booked,
      status,
      isPeak,
      extraFee: isPeak ? 0 : undefined
    }
  })
}

export const mockParkingLots: ParkingLot[] = [
  { id: 'P1', name: 'P1-访客主停车场', area: '东门入口', totalSpots: 300, availableSpots: 87, type: 'visitor', openTime: '06:00', closeTime: '20:00' },
  { id: 'P2', name: 'P2-无障碍专用', area: '南门入口', totalSpots: 20, availableSpots: 5, type: 'accessible', openTime: '06:00', closeTime: '20:00' },
  { id: 'P3', name: 'P3-VIP停车场', area: '墓区北门', totalSpots: 30, availableSpots: 12, type: 'vip', openTime: '07:00', closeTime: '19:00' },
  { id: 'P4', name: 'P4-员工停车场', area: '行政楼', totalSpots: 100, availableSpots: 45, type: 'staff', openTime: '06:00', closeTime: '21:00' }
]

const familyNames = ['王家', '李家', '张家', '陈家', '赵家', '刘家', '周家', '吴家', '郑家', '孙家']

export function generateMemorialBookings(date: string): MemorialBooking[] {
  return Array.from({ length: 20 }).map((_, idx) => {
    const slots = generateTimeSlots(7, 20, 120)
    const slotIdx = Math.floor(Math.random() * slots.length)
    const slot = slots[slotIdx]
    const statuses: MemorialBooking['status'][] = ['booked', 'booked', 'checked_in', 'completed', 'booked', 'cancelled']
    const status = statuses[idx % statuses.length]
    const lots = mockParkingLots.filter((l) => l.type !== 'staff')
    const lot = lots[Math.floor(Math.random() * lots.length)]
    const hasCar = Math.random() > 0.3

    return {
      id: `MB${dayjs(date).format('YYYYMMDD')}${String(idx + 1).padStart(4, '0')}`,
      passCode: `JC${dayjs(date).format('MMDD')}${String(idx + 1).padStart(4, '0')}`,
      qrCode: '',
      familyName: familyNames[idx % familyNames.length],
      phone: `139${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      date,
      slotId: `SLOT-${dayjs(date).format('YYYYMMDD')}-${String(slotIdx + 1).padStart(2, '0')}`,
      timeRange: slot.label,
      peopleCount: 1 + Math.floor(Math.random() * 8),
      hasVehicle: hasCar,
      plateNumber: hasCar ? `沪${['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]}·${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}` : undefined,
      vehicleType: hasCar ? (Math.random() > 0.7 ? 'SUV' : '轿车') : undefined,
      parkingLotId: hasCar ? lot.id : undefined,
      parkingLotName: hasCar ? lot.name : undefined,
      parkingSpot: hasCar ? `${lot.id.slice(-1)}区-${Math.floor(Math.random() * 50) + 1}号` : undefined,
      deceaseName: idx % 2 === 0 ? familyNames[idx % familyNames.length].replace('家', '') + '老先生' : undefined,
      plotNo: idx % 2 === 0 ? `FS-A${String(Math.floor(Math.random() * 8) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}` : undefined,
      offerings: ['鲜花'],
      status,
      checkInTime: (status === 'checked_in' || status === 'completed') ? dayjs(`${date} ${slot.start}`).add(Math.random() * 30, 'minute').format('YYYY-MM-DD HH:mm') : undefined,
      checkOutTime: status === 'completed' ? dayjs(`${date} ${slot.end}`).subtract(Math.random() * 30, 'minute').format('YYYY-MM-DD HH:mm') : undefined,
      createTime: dayjs(date).subtract(1 + Math.random() * 10, 'day').format('YYYY-MM-DD HH:mm'),
      updateTime: dayjs().format('YYYY-MM-DD HH:mm'),
      isCarpool: false
    }
  })
}
