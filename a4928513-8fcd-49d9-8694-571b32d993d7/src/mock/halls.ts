import type { FarewellHall, Booking } from '@/types/hall'
import { dayjs, getWeekRange } from '@/utils/date'

const funeralHomes = [
  { id: 'fh1', name: '第一殡仪馆' },
  { id: 'fh2', name: '第二殡仪馆' },
  { id: 'fh3', name: '第三殡仪馆' }
]

export const mockHalls: FarewellHall[] = [
  { id: 'h1', name: '追思厅-1号', funeralHomeId: 'fh1', funeralHomeName: '第一殡仪馆', capacity: 200, facilities: ['音响', '投影', '鲜花台', '电子屏'], basePrice: 1200, status: 'available', area: 180 },
  { id: 'h2', name: '追思厅-2号', funeralHomeId: 'fh1', funeralHomeName: '第一殡仪馆', capacity: 120, facilities: ['音响', '投影', '鲜花台'], basePrice: 900, status: 'available', area: 120 },
  { id: 'h3', name: '追思厅-3号', funeralHomeId: 'fh1', funeralHomeName: '第一殡仪馆', capacity: 60, facilities: ['音响', '鲜花台'], basePrice: 600, status: 'available', area: 80 },
  { id: 'h4', name: '永怀厅-A', funeralHomeId: 'fh2', funeralHomeName: '第二殡仪馆', capacity: 300, facilities: ['高级音响', '4K投影', '鲜花台', '电子屏', '独立休息室'], basePrice: 2000, status: 'available', area: 260 },
  { id: 'h5', name: '永怀厅-B', funeralHomeId: 'fh2', funeralHomeName: '第二殡仪馆', capacity: 150, facilities: ['音响', '投影', '鲜花台'], basePrice: 1000, status: 'maintenance', area: 140, description: '临时维护，预计3天后开放' },
  { id: 'h6', name: '安宁厅-1', funeralHomeId: 'fh3', funeralHomeName: '第三殡仪馆', capacity: 80, facilities: ['音响', '鲜花台'], basePrice: 700, status: 'available', area: 90 },
  { id: 'h7', name: '安宁厅-2', funeralHomeId: 'fh3', funeralHomeName: '第三殡仪馆', capacity: 180, facilities: ['音响', '投影', '鲜花台', '电子屏'], basePrice: 1500, status: 'available', area: 160 },
  { id: 'h8', name: '莲花厅', funeralHomeId: 'fh1', funeralHomeName: '第一殡仪馆', capacity: 50, facilities: ['音响', '鲜花台'], basePrice: 500, status: 'available', area: 60 }
]

export function generateBookings(): Booking[] {
  const week = getWeekRange()
  const rituals = ['礼仪师王建国', '礼仪师李淑芬', '礼仪师张美玲', '礼仪师刘振华']
  const remainsNames = ['张伟告别仪式', '李桂英追悼会', '王建国追思会', '陈秀兰告别会', '赵美玲追悼仪式', '孙德福告别会']
  const bookings: Booking[] = []

  week.days.forEach((date, dayIdx) => {
    const dateBookings = 2 + Math.floor(Math.random() * 4)
    for (let b = 0; b < dateBookings; b++) {
      const hall = mockHalls[Math.floor(Math.random() * mockHalls.length)]
      const startHour = 8 + Math.floor(Math.random() * 10)
      const duration = [60, 90, 120, 180][Math.floor(Math.random() * 4)]
      const startTime = `${String(startHour).padStart(2, '0')}:${Math.random() > 0.5 ? '00' : '30'}`
      const startMin = startHour * 60 + (startTime.includes('30') ? 30 : 0)
      const endMin = startMin + duration
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`

      bookings.push({
        id: `BK${dayjs(date).format('MMDD')}${String(b + 1).padStart(3, '0')}`,
        hallId: hall.id,
        hallName: hall.name,
        funeralHomeId: hall.funeralHomeId,
        remainsId: `R${dayjs().format('YYYYMMDD')}${String(1000 + dayIdx * 10 + b).padStart(4, '0')}`,
        remainsName: remainsNames[(dayIdx + b) % remainsNames.length],
        date,
        startTime,
        endTime,
        duration,
        ritualistId: `RT${String(b + 1).padStart(3, '0')}`,
        ritualistName: rituals[b % rituals.length],
        services: [],
        totalFee: Math.ceil(hall.basePrice * (duration / 60) + Math.random() * 1000),
        status: ['pending', 'confirmed', 'confirmed', 'completed'][Math.min(Math.floor(Math.random() * 4), 3)] as any,
        createTime: dayjs(date).subtract(1 + Math.random() * 5, 'day').format('YYYY-MM-DD HH:mm'),
        confirmTime: Math.random() > 0.2 ? dayjs(date).subtract(1, 'day').format('YYYY-MM-DD HH:mm') : undefined
      })
    }
  })

  return bookings.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.startTime.localeCompare(b.startTime)
  })
}

export const mockBookings: Booking[] = generateBookings()
