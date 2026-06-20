import Taro from '@tarojs/taro'
import type { Cinema, Movie, ScheduleItem, Seat, BookingOrder, MemberInfo, CouponItem, ConcessionSku, ApiResult } from '@/types'
import { cinemas, movies, generateSchedules, generateSeats, orders, currentMember, coupons, concessions } from '@/data'

const BASE_URL = 'https://api.guangying-cinema.com/v1'

async function request<T>(url: string, options: Taro.request.Option = {}): Promise<ApiResult<T>> {
  try {
    const res = await Taro.request({
      url: `${BASE_URL}${url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Taro.getStorageSync('token') || ''}`,
        ...(options.header || {})
      },
      timeout: 10000
    })
    if (res.statusCode === 200) {
      console.log(`[API] GET ${url} success`)
      return res.data as ApiResult<T>
    }
    console.error(`[API] ${url} status=${res.statusCode}`)
    return { success: false, message: `HTTP ${res.statusCode}` }
  } catch (e) {
    console.error(`[API] ${url} error:`, (e as Error).message)
    return { success: false, message: (e as Error).message }
  }
}

const delay = <T>(data: T, ms = 300): Promise<ApiResult<T>> =>
  new Promise((resolve) => setTimeout(() => resolve({ success: true, data }), ms))

export const cinemaApi = {
  list: (params?: { keyword?: string; city?: string }): Promise<ApiResult<Cinema[]>> => {
    let list = cinemas
    if (params?.keyword) {
      list = list.filter(c => c.name.includes(params.keyword!) || c.address.includes(params.keyword!))
    }
    console.log('[API] cinema.list count=', list.length)
    return delay(list)
  },
  detail: (id: string): Promise<ApiResult<Cinema | null>> =>
    delay(cinemas.find(c => c.id === id) || null)
}

export const movieApi = {
  list: (status?: string): Promise<ApiResult<Movie[]>> => {
    const list = status ? movies.filter(m => m.status === status) : movies
    console.log('[API] movie.list status=', status, 'count=', list.length)
    return delay(list)
  },
  detail: (id: string): Promise<ApiResult<Movie | null>> =>
    delay(movies.find(m => m.id === id) || null)
}

export const scheduleApi = {
  list: (params: { cinemaId?: string; movieId?: string; date?: string }): Promise<ApiResult<ScheduleItem[]>> => {
    const cinemaId = params.cinemaId || cinemas[0].id
    const list = generateSchedules(cinemaId, params.movieId)
    console.log('[API] schedule.list params=', params, 'count=', list.length)
    return delay(list)
  },
  detail: (id: string): Promise<ApiResult<ScheduleItem | null>> =>
    delay(generateSchedules('C01').find(s => s.id === id) || null)
}

export const seatApi = {
  getSeats: (scheduleId: string, rows = 8, cols = 15): Promise<ApiResult<{ scheduleId: string; rows: number; cols: number; seats: Seat[] }>> => {
    const seats = generateSeats(rows, cols)
    console.log(`[API] seat.getSeats scheduleId=${scheduleId}, total=${seats.length}`)
    return delay({ scheduleId, rows, cols, seats })
  },
  lock: (params: { scheduleId: string; seatIds: string[]; userId: string }): Promise<ApiResult<{ locked: boolean; expiresAt: number; failedSeats?: string[] }>> => {
    console.log('[API] seat.lock', params)
    return delay({ locked: true, expiresAt: Date.now() + 300000 })
  },
  unlock: (params: { scheduleId: string; seatIds: string[]; userId: string }): Promise<ApiResult<{ unlocked: boolean }>> => {
    console.log('[API] seat.unlock', params)
    return delay({ unlocked: true })
  }
}

export const bookingApi = {
  create: (data: Partial<BookingOrder>): Promise<ApiResult<BookingOrder>> => {
    console.log('[API] booking.create', data)
    const order: BookingOrder = {
      id: `O${Date.now()}`,
      orderNo: `GY${Date.now()}`,
      scheduleId: data.scheduleId || '',
      movieName: data.movieName || '',
      cinemaName: data.cinemaName || '',
      hallName: data.hallName || '',
      showTime: data.showTime || '',
      seats: data.seats || [],
      totalAmount: data.totalAmount || 0,
      paidAmount: 0,
      pointsUsed: data.pointsUsed || 0,
      status: 'pending',
      qrCode: '',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
    }
    orders.unshift(order)
    return delay(order, 500)
  },
  pay: (orderId: string, payMethod: string, amount: number, pointsUsed = 0): Promise<ApiResult<BookingOrder>> => {
    console.log(`[API] booking.pay orderId=${orderId}, method=${payMethod}, amount=${amount}, points=${pointsUsed}`)
    const idx = orders.findIndex(o => o.id === orderId)
    if (idx >= 0) {
      orders[idx].status = 'paid'
      orders[idx].paidAmount = amount
      orders[idx].pointsUsed = pointsUsed
      orders[idx].paidAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
      orders[idx].qrCode = `GY-O-${orderId}`
      return delay(orders[idx], 800)
    }
    return delay(orders[0], 500)
  },
  list: (status?: string): Promise<ApiResult<BookingOrder[]>> => {
    const list = status ? orders.filter(o => o.status === status) : orders
    console.log('[API] booking.list count=', list.length)
    return delay(list)
  },
  detail: (id: string): Promise<ApiResult<BookingOrder | null>> =>
    delay(orders.find(o => o.id === id) || null)
}

export const memberApi = {
  login: (phone: string, code: string): Promise<ApiResult<{ token: string; member: MemberInfo }>> => {
    console.log(`[API] member.login phone=${phone}, code=${code}`)
    return delay({ token: 'mock-token-' + Date.now(), member: currentMember })
  },
  info: (): Promise<ApiResult<MemberInfo>> => delay(currentMember),
  coupons: (used = false): Promise<ApiResult<CouponItem[]>> =>
    delay(coupons.filter(c => c.used === used)),
  pointsHistory: (): Promise<ApiResult<Array<{ id: string; type: string; points: number; desc: string; time: string }>>> =>
    delay([
      { id: 'P01', type: 'earn', points: 176, desc: '《银河孤舟》购票', time: '2026-06-19 15:42' },
      { id: 'P02', type: 'earn', points: 135, desc: '《深海回声》购票', time: '2026-06-18 10:15' },
      { id: 'P03', type: 'spend', points: -500, desc: '兑换IMAX通兑券', time: '2026-06-10 21:30' },
      { id: 'P04', type: 'earn', points: 88, desc: '生日双倍积分', time: '2026-05-12 09:00' }
    ])
}

export const concessionApi = {
  list: (category?: string): Promise<ApiResult<ConcessionSku[]>> =>
    delay(category ? concessions.filter(c => c.category === category) : concessions)
}

export default {
  cinema: cinemaApi,
  movie: movieApi,
  schedule: scheduleApi,
  seat: seatApi,
  booking: bookingApi,
  member: memberApi,
  concession: concessionApi
}
