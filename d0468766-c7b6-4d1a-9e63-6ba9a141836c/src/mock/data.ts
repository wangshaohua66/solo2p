// 光影院线 — Mock 种子数据
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
  Seat,
  Coupon
} from '@/types'

const cinemaNames = [
  '光影·王府井旗舰店',
  '光影·朝阳大悦城店',
  '光影·西单店',
  '光影·五道口店',
  '光影·国贸店',
  '光影·望京凯德店',
  '光影·荟聚店',
  '光影·合生汇店',
  '光影·龙德广场店',
  '光影·清河万象汇店',
  '光影·丰台永旺店',
  '光影·大兴天街店',
  '光影·通州万达店',
  '光影·昌平国泰店',
  '光影·石景山万达店'
]

const managers = ['陈志远', '林婉清', '赵建国', '周明辉', '吴静怡', '孙立群', '郑海涛', '王雪松', '冯丽华', '许文康', '韩冰', '邓飞', '曹颖', '唐俊', '秦玥']

export const cinemas: Cinema[] = cinemaNames.map((name, i) => ({
  id: `C${String(i + 1).padStart(2, '0')}`,
  name,
  address: ['东城区', '朝阳区', '西城区', '海淀区', '朝阳区', '朝阳区', '大兴区', '朝阳区', '昌平区', '海淀区', '丰台区', '大兴区', '通州区', '昌平区', '石景山区'][i] + name.split('·')[1],
  halls: 8,
  screens: 8,
  manager: managers[i],
  status: i === 9 ? 'maintenance' : 'open',
  todayBoxOffice: Math.round(80000 + Math.random() * 220000),
  todayAudience: Math.round(1200 + Math.random() * 3800)
}))

export const halls: Hall[] = []
cinemas.forEach((c) => {
  const hallTypes: Hall['type'][] = ['IMAX', 'CGS', '杜比', '激光', '激光', '标准', '标准', '标准']
  for (let i = 0; i < 8; i++) {
    const cap = hallTypes[i] === 'IMAX' ? 384 : hallTypes[i] === 'CGS' ? 320 : hallTypes[i] === '杜比' ? 260 : hallTypes[i] === '激光' ? 200 : 150
    halls.push({
      id: `${c.id}-H${i + 1}`,
      cinemaId: c.id,
      cinemaName: c.name,
      name: `${i + 1}号厅`,
      capacity: cap,
      rows: hallTypes[i] === 'IMAX' ? 16 : hallTypes[i] === '标准' ? 10 : 12,
      cols: hallTypes[i] === 'IMAX' ? 24 : hallTypes[i] === '标准' ? 15 : 18,
      type: hallTypes[i]
    })
  }
})

const movieData: Array<[string, number, string, number]> = [
  ['银河孤舟', 142, '科幻/冒险', 9.2],
  ['长安花事录', 128, '剧情/爱情', 8.7],
  ['猎风者', 119, '动作/犯罪', 8.4],
  ['深海回声', 96, '动画/家庭', 9.0],
  ['迷雾之城', 134, '悬疑/惊悚', 8.1],
  ['归途列车', 108, '剧情/温情', 8.6],
  ['星际拓荒', 156, '科幻/惊悚', 9.4],
  ['江湖夜雨', 122, '武侠/动作', 7.9],
  ['小城故事', 98, '剧情/喜剧', 8.3],
  ['破晓行动', 130, '动作/战争', 8.5]
]

export const movies: Movie[] = movieData.map((m, i) => ({
  id: `M${String(i + 1).padStart(2, '0')}`,
  name: m[0] as string,
  poster: '',
  duration: m[1] as number,
  genre: m[2] as string,
  releaseDate: `2026-0${(i % 6) + 1}-${String((i * 7) % 27 + 1).padStart(2, '0')}`,
  rating: m[3] as number,
  boxOffice: Math.round((0.8 + Math.random() * 8) * 10000) * 10000,
  dcpCount: 4 + (i % 6),
  status: i < 6 ? '热映' : i < 8 ? '即将上映' : '点映'
}))

// 排片：为前5家影院生成今日排片
export const schedules: ScheduleItem[] = []
let scheduleSeq = 1
const today = '2026-06-19'
for (let ci = 0; ci < 5; ci++) {
  const c = cinemas[ci]
  for (let hi = 0; hi < 4; hi++) {
    const hall = halls.filter((h) => h.cinemaId === c.id)[hi]
    let cur = 9
    while (cur < 23) {
      const movie = movies[scheduleSeq % movies.length]
      const start = `${String(cur).padStart(2, '0')}:00`
      const endH = cur + Math.ceil(movie.duration / 60)
      const endM = (movie.duration % 60) + 15
      const end = `${String(endH).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
      const sold = Math.floor(hall.capacity * (0.3 + Math.random() * 0.6))
      schedules.push({
        id: `S${String(scheduleSeq).padStart(3, '0')}`,
        movieId: movie.id,
        movieName: movie.name,
        cinemaId: c.id,
        cinemaName: c.name,
        hallId: hall.id,
        hallName: `${c.name.split('·')[1]} ${hall.name}`,
        date: today,
        startTime: start,
        endTime: end,
        price: hall.type === 'IMAX' ? 88 : hall.type === 'CGS' ? 68 : hall.type === '杜比' ? 78 : 45,
        seatsTotal: hall.capacity,
        seatsSold: sold,
        status: cur < new Date().getHours() ? 'finished' : sold / hall.capacity > 0.9 ? 'sold_out' : 'on_sale',
        weight: Math.round((0.5 + Math.random() * 0.5) * 100) / 100
      })
      cur = endH + 1
      scheduleSeq++
    }
  }
}

// DCP 拷贝
export const dcps: DcpCopy[] = movies.slice(0, 8).map((m, i) => {
  const c = cinemas[i % cinemas.length]
  const statuses: DcpCopy['status'][] = ['in_stock', 'in_transit', 'screening', 'returned']
  const st = statuses[i % 4]
  return {
    id: `DCP${String(i + 1).padStart(3, '0')}`,
    movieId: m.id,
    movieName: m.name,
    cinemaId: c.id,
    cinemaName: c.name,
    status: st,
    location: st === 'in_stock' ? `${c.name} 机房` : st === 'in_transit' ? '专线物流中' : st === 'screening' ? `${c.name} 3号厅放映` : `${c.name} 已归还暂存`,
    premiereDate: `2026-06-${String(20 + (i % 8)).padStart(2, '0')}`,
    daysToPremiere: (i % 8) + 1,
    size: `${(80 + i * 12).toFixed(0)} GB`,
    borrowHistory: [
      { id: `B${i}1`, fromCinema: '中央片库', toCinema: c.name, action: '调出', time: '2026-06-15 09:20', operator: '李调度' },
      { id: `B${i}2`, fromCinema: c.name, toCinema: c.name, action: st === 'in_transit' ? '在途' : '签收', time: '2026-06-17 14:05', operator: '王签收' }
    ]
  }
})

// 会员
const memberNames = ['苏晚晴', '顾承泽', '白景行', '沈知意', '陆星河', '夏一然', '傅司年', '叶清辞', '宋怀瑾', '楚慕白', '凌霜', '裴予安', '江浸月', '谢临渊', '颜亦舒']
const levels: Member['level'][] = ['diamond', 'platinum', 'gold', 'silver']
export const members: Member[] = memberNames.map((n, i) => {
  const level = levels[i % 4]
  const coupons: Coupon[] = [
    { id: `CP${i}1`, name: '购票立减20元', type: 'cash', value: 20, expireDate: '2026-07-31', used: false },
    ...(level === 'diamond' || level === 'platinum'
      ? ([{ id: `CP${i}2`, name: '卖品8折券', type: 'discount', value: 8, expireDate: '2026-08-15', used: false }] as Coupon[])
      : [])
  ]
  return {
    id: `MB${String(i + 1).padStart(4, '0')}`,
    name: n,
    phone: `138****${String(1000 + i * 137).slice(-4)}`,
    level,
    points: Math.round(800 + Math.random() * 9200),
    balance: Math.round(50 + Math.random() * 2000),
    coupons,
    birthday: `199${i % 9}-0${(i % 9) + 1}-1${i % 9}`,
    registerDate: `202${i % 5}-0${(i % 6) + 1}-1${i % 9}`,
    totalSpent: Math.round(2000 + Math.random() * 18000),
    homeCinema: cinemas[i % cinemas.length].name
  }
})

// 卖品 SKU
const skuData: Array<[string, string, number, number, number]> = [
  ['大桶爆米花', '爆米花', 30, 8, 12],
  ['中桶爆米花', '爆米花', 22, 5, 9],
  ['可口可乐(大)', '饮料', 18, 6, 8],
  ['雪碧(大)', '饮料', 18, 6, 8],
  ['奶茶', '饮料', 25, 9, 14],
  ['热狗', '小食', 28, 10, 16],
  ['薯条', '小食', 24, 8, 12],
  ['冰淇淋', '甜品', 20, 7, 10],
  ['套餐A(爆米花+可乐)', '套餐', 45, 16, 25],
  ['套餐B(热狗+可乐)', '套餐', 42, 15, 22]
]

export const concessions: ConcessionSku[] = []
let conSeq = 1
cinemas.slice(0, 6).forEach((c) => {
  skuData.forEach((s) => {
    const stock = Math.floor(Math.random() * 120)
    const capacity = 200
    const threshold = s[4]
    const status: ConcessionSku['status'] =
      stock === 0 ? 'out' : stock < threshold ? 'low' : stock > capacity * 0.85 ? 'overstock' : 'healthy'
    concessions.push({
      id: `SKU${String(conSeq).padStart(3, '0')}`,
      cinemaId: c.id,
      cinemaName: c.name,
      name: s[0],
      category: s[1],
      stock,
      unit: s[0].includes('套餐') ? '份' : s[1] === '饮料' ? '杯' : s[1] === '爆米花' ? '桶' : '个',
      costPrice: s[2] - s[3],
      salePrice: s[2],
      threshold,
      capacity,
      todaySales: Math.floor(Math.random() * 80),
      monthSales: Math.floor(Math.random() * 1800),
      status
    })
    conSeq++
  })
})

export const stockDocs: StockDoc[] = [
  { id: 'SD001', type: 'inbound', cinemaName: cinemas[0].name, skuName: '大桶爆米花', quantity: 200, amount: 4400, operator: '赵卖品', time: '2026-06-19 08:30', status: '已入库' },
  { id: 'SD002', type: 'outbound', cinemaName: cinemas[1].name, skuName: '可口可乐(大)', quantity: 50, amount: 900, operator: '钱卖品', time: '2026-06-19 09:15', status: '已审' },
  { id: 'SD003', type: 'check', cinemaName: cinemas[2].name, skuName: '热狗', quantity: -3, amount: 0, operator: '孙卖品', time: '2026-06-19 10:00', status: '待审' },
  { id: 'SD004', type: 'inbound', cinemaName: cinemas[3].name, skuName: '套餐A(爆米花+可乐)', quantity: 100, amount: 2900, operator: '周卖品', time: '2026-06-19 10:45', status: '已入库' },
  { id: 'SD005', type: 'outbound', cinemaName: cinemas[4].name, skuName: '奶茶', quantity: 30, amount: 480, operator: '吴卖品', time: '2026-06-19 11:20', status: '已审' }
]

// 仪表盘
export const dashboardMetrics: DashboardMetrics = {
  todayBoxOffice: cinemas.reduce((s, c) => s + c.todayBoxOffice, 0),
  todayAudience: cinemas.reduce((s, c) => s + c.todayAudience, 0),
  avgPerShow: 0,
  occupancy: 0,
  boxOfficeTrend: ['06-13', '06-14', '06-15', '06-16', '06-17', '06-18', '06-19'].map((d, i) => ({
    date: d,
    value: Math.round(180 + Math.sin(i) * 40 + Math.random() * 30) * 10000
  })),
  movieShare: movies.slice(0, 6).map((m) => ({ name: m.name, value: Math.round(50 + Math.random() * 350) })),
  cinemaRank: cinemas
    .map((c) => ({ name: c.name.split('·')[1], value: c.todayBoxOffice, growth: Math.round((Math.random() - 0.4) * 30) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8),
  hourFlow: ['10', '12', '14', '16', '18', '20', '22'].map((h) => ({ hour: `${h}:00`, value: Math.round(2000 + Math.random() * 6000) }))
}
dashboardMetrics.avgPerShow = Math.round(dashboardMetrics.todayBoxOffice / schedules.length)
dashboardMetrics.occupancy = Math.round((schedules.reduce((s, x) => s + x.seatsSold, 0) / schedules.reduce((s, x) => s + x.seatsTotal, 0)) * 100)

export const alerts: AlertItem[] = [
  { id: 'A1', type: 'dcp', level: 'danger', title: 'DCP首映日预警', desc: '《星际拓荒》首映日剩1天，拷贝仍在途未签收', time: '5分钟前' },
  { id: 'A2', type: 'concession', level: 'warning', title: '卖品低库存', desc: '王府井店 可口可乐(大) 库存仅12杯，低于阈值', time: '18分钟前' },
  { id: 'A3', type: 'schedule', level: 'warning', title: '排片冲突检测', desc: '望京凯德店 2号厅 19:00场次与清洁间隔重叠', time: '32分钟前' },
  { id: 'A4', type: 'device', level: 'danger', title: '设备告警', desc: '清河万象汇店 IMAX厅 放映机灯泡寿命预警', time: '1小时前' },
  { id: 'A5', type: 'concession', level: 'info', title: '卖品积压提醒', desc: '国贸店 冰淇淋 库存超容量85%，建议促销', time: '2小时前' },
  { id: 'A6', type: 'dcp', level: 'warning', title: 'DCP调拨待审', desc: '《猎风者》跨院线借调申请待审批', time: '3小时前' }
]

// 影厅监控
export const monitorHalls: MonitorHall[] = halls.slice(0, 12).map((h, i) => {
  const statuses: MonitorHall['status'][] = ['放映中', '空闲', '清洁', '放映中', '待机', '放映中']
  const st = statuses[i % 6]
  const movie = movies[i % movies.length]
  return {
    id: h.id,
    cinemaName: h.cinemaName.split('·')[1],
    hallName: `${h.cinemaName.split('·')[1]} ${h.name}(${h.type})`,
    status: st,
    movie: st === '放映中' ? movie.name : '—',
    progress: st === '放映中' ? Math.round(Math.random() * 100) : 0,
    temperature: Math.round((20 + Math.random() * 4) * 10) / 10,
    humidity: Math.round((45 + Math.random() * 15) * 10) / 10,
    devices: [
      { name: '放映机', status: st === '故障' ? 'error' : i % 7 === 0 ? 'warning' : 'normal' },
      { name: '音响系统', status: 'normal' },
      { name: '空调', status: 'normal' },
      { name: '灯光', status: 'normal' }
    ],
    audience: st === '放映中' || st === '空闲' ? Math.floor(h.capacity * (0.3 + Math.random() * 0.6)) : 0,
    capacity: h.capacity
  }
})

// 座位图生成
export function generateSeats(hallId: string, rows: number, cols: number, basePrice: number): Seat[] {
  const seats: Seat[] = []
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const isVip = r >= 5 && r <= 8
      const isCouple = r === rows && c % 2 === 0
      const rand = Math.random()
      const status: Seat['status'] = rand < 0.35 ? 'sold' : rand < 0.42 ? 'locked' : 'available'
      seats.push({
        id: `${hallId}-${r}-${c}`,
        row: r,
        col: c,
        area: isVip ? 'VIP区' : '普通区',
        type: isVip ? 'vip' : isCouple ? 'couple' : 'normal',
        status,
        price: isVip ? basePrice + 20 : isCouple ? basePrice * 2 : basePrice
      })
    }
  }
  return seats
}
