// 光影院线 — 领域类型定义

export type UserRole = 'management' | 'cinema_manager' | 'scheduler' | 'cashier' | 'concession_staff'

export interface Cinema {
  id: string
  name: string
  address: string
  halls: number
  screens: number
  manager: string
  status: 'open' | 'maintenance' | 'closed'
  todayBoxOffice: number
  todayAudience: number
  images: string[]
  phone: string
  businessHours: string
}

export interface Hall {
  id: string
  cinemaId: string
  cinemaName: string
  name: string
  capacity: number
  rows: number
  cols: number
  type: 'IMAX' | 'CGS' | '杜比' | '激光' | '标准'
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
  dcpCount: number
  status: '热映' | '即将上映' | '点映' | '下映'
}

export type ScheduleStatus = 'planned' | 'on_sale' | 'sold_out' | 'finished'

export interface ScheduleItem {
  id: string
  movieId: string
  movieName: string
  cinemaId: string
  cinemaName: string
  hallId: string
  hallName: string
  date: string
  startTime: string
  endTime: string
  price: number
  seatsTotal: number
  seatsSold: number
  status: ScheduleStatus
  weight: number
}

export type SeatStatus = 'available' | 'locked' | 'sold' | 'selected'

export interface Seat {
  id: string
  row: number
  col: number
  area: string
  type: 'normal' | 'vip' | 'couple'
  status: SeatStatus
  price: number
}

export type DcpStatus = 'in_stock' | 'in_transit' | 'screening' | 'returned'

export interface BorrowRecord {
  id: string
  fromCinema: string
  toCinema: string
  action: '调出' | '在途' | '签收' | '归还'
  time: string
  operator: string
}

export interface DcpCopy {
  id: string
  movieId: string
  movieName: string
  cinemaId: string
  cinemaName: string
  status: DcpStatus
  location: string
  premiereDate: string
  daysToPremiere: number
  size: string
  borrowHistory: BorrowRecord[]
}

export type MemberLevel = 'silver' | 'gold' | 'platinum' | 'diamond'

export interface Coupon {
  id: string
  name: string
  type: 'discount' | 'cash' | 'exchange'
  value: number
  expireDate: string
  used: boolean
}

export interface Member {
  id: string
  name: string
  phone: string
  level: MemberLevel
  points: number
  balance: number
  coupons: Coupon[]
  birthday: string
  registerDate: string
  totalSpent: number
  homeCinema: string
}

export type SkuStatus = 'healthy' | 'low' | 'out' | 'overstock'

export interface ConcessionSku {
  id: string
  cinemaId: string
  cinemaName: string
  name: string
  category: string
  stock: number
  unit: string
  costPrice: number
  salePrice: number
  threshold: number
  capacity: number
  todaySales: number
  monthSales: number
  status: SkuStatus
}

export type DocType = 'inbound' | 'outbound' | 'check'

export interface StockDoc {
  id: string
  type: DocType
  cinemaName: string
  skuName: string
  quantity: number
  amount: number
  operator: string
  time: string
  status: '待审' | '已审' | '已入库'
}

export interface DashboardMetrics {
  todayBoxOffice: number
  todayAudience: number
  avgPerShow: number
  occupancy: number
  boxOfficeTrend: { date: string; value: number }[]
  movieShare: { name: string; value: number }[]
  cinemaRank: { name: string; value: number; growth: number }[]
  hourFlow: { hour: string; value: number }[]
}

export interface AlertItem {
  id: string
  type: 'dcp' | 'concession' | 'schedule' | 'device'
  level: 'danger' | 'warning' | 'info'
  title: string
  desc: string
  time: string
}

export interface MonitorHall {
  id: string
  cinemaName: string
  hallName: string
  status: '放映中' | '空闲' | '清洁' | '故障' | '待机'
  movie: string
  progress: number
  temperature: number
  humidity: number
  devices: { name: string; status: 'normal' | 'warning' | 'error' }[]
  audience: number
  capacity: number
}
