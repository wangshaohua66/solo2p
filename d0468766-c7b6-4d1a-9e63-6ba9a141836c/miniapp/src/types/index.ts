export interface Cinema {
  id: string
  name: string
  address: string
  phone: string
  businessHours: string
  distance: string
  minPrice: number
  rating: number
  halls: number
  screens: number
  status: 'open' | 'maintenance' | 'closed'
  images: string[]
  tags: string[]
}

export interface Movie {
  id: string
  name: string
  poster: string
  duration: number
  genre: string
  releaseDate: string
  rating: number
  boxOffice: number
  status: '热映' | '即将上映' | '点映' | '下映'
  wantSee: number
  description: string
  directors: string[]
  actors: string[]
}

export interface ScheduleItem {
  id: string
  movieId: string
  movieName: string
  cinemaId: string
  cinemaName: string
  hallId: string
  hallName: string
  hallType: string
  date: string
  startTime: string
  endTime: string
  price: number
  seatsTotal: number
  seatsSold: number
  status: 'planned' | 'on_sale' | 'sold_out' | 'finished'
  language: string
  version: string
}

export interface Seat {
  id: string
  row: number
  col: number
  rowLabel: string
  colLabel: number
  status: 'available' | 'selected' | 'locked' | 'sold' | 'reserved'
  price: number
  type: 'normal' | 'couple' | 'vip'
  lockedBy?: string
  lockedUntil?: number
}

export interface BookingOrder {
  id: string
  orderNo: string
  scheduleId: string
  movieName: string
  cinemaName: string
  hallName: string
  showTime: string
  seats: { seatId: string; rowLabel: string; colLabel: number }[]
  totalAmount: number
  paidAmount: number
  pointsUsed: number
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  qrCode: string
  createdAt: string
  paidAt?: string
}

export interface MemberInfo {
  id: string
  name: string
  phone: string
  avatar: string
  level: string
  levelName: string
  points: number
  totalSpent: number
  totalVisits: number
  coupons: number
  birthday?: string
  joinDate: string
}

export interface CouponItem {
  id: string
  name: string
  type: 'discount' | 'cash' | 'combo'
  value: number
  threshold: number
  validFrom: string
  validTo: string
  used: boolean
  description: string
}

export interface ConcessionSku {
  id: string
  name: string
  category: string
  price: number
  originalPrice: number
  image: string
  stock: number
  description: string
  combo?: { id: string; quantity: number }[]
}

export interface ApiResult<T> {
  success: boolean
  data?: T
  message?: string
  code?: number
}
