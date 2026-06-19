// 光影院线 — Mock API 服务层（模拟 PHP/Symfony 控制器分层）
// 每个 async 函数模拟一次网络请求，返回 OpenAPI 风格 JSON
import {
  cinemas,
  halls,
  movies,
  schedules,
  dcps,
  members,
  concessions,
  stockDocs,
  dashboardMetrics,
  alerts,
  monitorHalls,
  generateSeats
} from '@/mock/data'
import type {
  Cinema,
  Hall,
  Movie,
  ScheduleItem,
  DcpCopy,
  Member,
  ConcessionSku,
  StockDoc,
  DashboardMetrics,
  AlertItem,
  MonitorHall,
  Seat
} from '@/types'

function delay<T>(data: T, ms = 280): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(JSON.parse(JSON.stringify(data))), ms))
}

// ============ DashboardController ============
export const dashboardApi = {
  getMetrics: (): Promise<DashboardMetrics> => delay(dashboardMetrics),
  getAlerts: (): Promise<AlertItem[]> => delay(alerts),
  getCinemas: (): Promise<Cinema[]> => delay(cinemas)
}

// ============ MovieController ============
export const movieApi = {
  getMovies: (): Promise<Movie[]> => delay(movies),
  getHalls: (cinemaId?: string): Promise<Hall[]> => delay(cinemaId ? halls.filter((h) => h.cinemaId === cinemaId) : halls)
}

// ============ ScheduleController ============
export const scheduleApi = {
  getSchedules: (params?: { cinemaId?: string; date?: string }): Promise<ScheduleItem[]> =>
    delay(
      schedules.filter(
        (s) => (!params?.cinemaId || s.cinemaId === params.cinemaId) && (!params?.date || s.date === params.date)
      )
    ),
  saveSchedule: (item: Partial<ScheduleItem>): Promise<ScheduleItem> => {
    const newItem: ScheduleItem = {
      id: `S${String(schedules.length + 1).padStart(3, '0')}`,
      movieId: item.movieId || '',
      movieName: item.movieName || '',
      cinemaId: item.cinemaId || '',
      cinemaName: item.cinemaName || '',
      hallId: item.hallId || '',
      hallName: item.hallName || '',
      date: item.date || '2026-06-19',
      startTime: item.startTime || '00:00',
      endTime: item.endTime || '00:00',
      price: item.price || 45,
      seatsTotal: item.seatsTotal || 150,
      seatsSold: 0,
      status: 'planned',
      weight: item.weight || 0.7
    }
    schedules.push(newItem)
    return delay(newItem, 400)
  },
  detectConflict: (item: { hallId: string; date: string; startTime: string; endTime: string }): Promise<{ conflict: boolean; reason: string }> => {
    const hit = schedules.find(
      (s) => s.hallId === item.hallId && s.date === item.date && !(item.endTime <= s.startTime || item.startTime >= s.endTime)
    )
    return delay({ conflict: !!hit, reason: hit ? `${hit.hallName} 该时段已有《${hit.movieName}》${hit.startTime}-${hit.endTime}场次` : '' }, 200)
  }
}

// ============ BookingController ============
export const bookingApi = {
  getOnSaleSchedules: (): Promise<ScheduleItem[]> => delay(schedules.filter((s) => s.status === 'on_sale')),
  getSeats: (scheduleId: string): Promise<{ seats: Seat[]; hall: Hall; schedule: ScheduleItem }> => {
    const schedule = schedules.find((s) => s.id === scheduleId) || schedules[0]
    const hall = halls.find((h) => h.id === schedule.hallId) || halls[0]
    const seats = generateSeats(hall.id, hall.rows, hall.cols, schedule.price)
    return delay({ seats, hall, schedule }, 350)
  },
  lockSeats: (seatIds: string[]): Promise<{ success: boolean; orderId: string }> =>
    delay({ success: true, orderId: `OD${Date.now()}` }, 300),
  createOrder: (data: { scheduleId: string; seatIds: string[]; memberId?: string; usePoints: number }): Promise<{ orderId: string; totalAmount: number; payAmount: number; discount: number; qrCode: string }> => {
    const schedule = schedules.find((s) => s.id === data.scheduleId) || schedules[0]
    const hall = halls.find((h) => h.id === schedule.hallId) || halls[0]
    const seats = generateSeats(hall.id, hall.rows, hall.cols, schedule.price)
    const selected = seats.filter((s) => data.seatIds.includes(s.id))
    const total = selected.reduce((sum, s) => sum + s.price, 0)
    const discount = Math.min(data.usePoints / 100, total * 0.5)
    return delay(
      {
        orderId: `OD${Date.now()}`,
        totalAmount: total,
        payAmount: Math.round((total - discount) * 100) / 100,
        discount,
        qrCode: `TICKET-${Date.now()}-${data.seatIds.length}`
      },
      500
    )
  }
}

// ============ DCP 调度 ============
export const dcpApi = {
  getList: (): Promise<DcpCopy[]> => delay(dcps),
  approve: (id: string): Promise<{ success: boolean }> => delay({ success: true }, 400)
}

// ============ MemberController ============
export const memberApi = {
  getMembers: (): Promise<Member[]> => delay(members),
  addPoints: (id: string, points: number): Promise<{ success: boolean; points: number }> =>
    delay({ success: true, points }, 300)
}

// ============ ConcessionController ============
export const concessionApi = {
  getSkus: (): Promise<ConcessionSku[]> => delay(concessions),
  getDocs: (): Promise<StockDoc[]> => delay(stockDocs),
  submitDoc: (doc: Partial<StockDoc>): Promise<StockDoc> =>
    delay({ ...doc, id: `SD${String(stockDocs.length + 1).padStart(3, '0')}`, status: '待审', time: '2026-06-19 14:00' } as StockDoc, 400)
}

// ============ MonitorController ============
export const monitorApi = {
  getHalls: (): Promise<MonitorHall[]> => delay(monitorHalls, 350)
}
