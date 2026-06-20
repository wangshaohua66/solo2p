import type { Cinema, Movie, ScheduleItem, BookingOrder, MemberInfo, CouponItem, ConcessionSku, Seat } from '@/types'

export const cinemas: Cinema[] = [
  {
    id: 'C01',
    name: '光影·王府井旗舰店',
    address: '东城区王府井大街88号APM购物中心6层',
    phone: '010-88000000',
    businessHours: '10:00 - 24:00',
    distance: '0.8km',
    minPrice: 39,
    rating: 4.9,
    halls: 8,
    screens: 8,
    status: 'open',
    images: [],
    tags: ['IMAX', '杜比全景声', '4D', '停车优惠']
  },
  {
    id: 'C02',
    name: '光影·朝阳大悦城店',
    address: '朝阳区朝阳北路101号朝阳大悦城9层',
    phone: '010-88000137',
    businessHours: '10:00 - 24:00',
    distance: '3.2km',
    minPrice: 35,
    rating: 4.8,
    halls: 8,
    screens: 8,
    status: 'open',
    images: [],
    tags: ['CGS中国巨幕', '杜比影院', '儿童厅']
  },
  {
    id: 'C03',
    name: '光影·国贸店',
    address: '朝阳区建国门外大街1号国贸商城3层',
    phone: '010-88000548',
    businessHours: '10:00 - 24:00',
    distance: '2.5km',
    minPrice: 45,
    rating: 4.9,
    halls: 8,
    screens: 8,
    status: 'open',
    images: [],
    tags: ['IMAX Laser', 'VIP厅', '商务厅']
  },
  {
    id: 'C04',
    name: '光影·西单店',
    address: '西城区西单北大街120号西单大悦城10层',
    phone: '010-88000274',
    businessHours: '10:00 - 24:00',
    distance: '4.1km',
    minPrice: 38,
    rating: 4.7,
    halls: 8,
    screens: 8,
    status: 'open',
    images: [],
    tags: ['激光厅', '情侣座', '4K']
  },
  {
    id: 'C05',
    name: '光影·五道口店',
    address: '海淀区成府路28号华联购物中心4层',
    phone: '010-88000411',
    businessHours: '10:00 - 24:00',
    distance: '11.5km',
    minPrice: 32,
    rating: 4.6,
    halls: 8,
    screens: 8,
    status: 'open',
    images: [],
    tags: ['学生优惠', '杜比音效', '深夜场']
  }
]

export const movies: Movie[] = [
  {
    id: 'M01',
    name: '银河孤舟',
    poster: 'https://picsum.photos/id/1/300/420',
    duration: 142,
    genre: '科幻/冒险',
    releaseDate: '2026-06-12',
    rating: 9.2,
    boxOffice: 890000000,
    status: '热映',
    wantSee: 245000,
    description: '2157年，地球资源枯竭，人类启动"方舟计划"。宇航员陈屿独自驾驶星舰"孤舟号"穿越虫洞，寻找人类新家园。在一颗被黑色星云包围的星球上，他发现了消失三年的"先驱号"残骸，以及一段关于人类文明命运的惊天秘密...',
    directors: ['李安航'],
    actors: ['黄渤', '周迅', '易烊千玺', '段奕宏']
  },
  {
    id: 'M02',
    name: '长安花事录',
    poster: 'https://picsum.photos/id/1039/300/420',
    duration: 128,
    genre: '剧情/爱情',
    releaseDate: '2026-06-05',
    rating: 8.7,
    boxOffice: 520000000,
    status: '热映',
    wantSee: 128000,
    description: '唐开元年间，长安城花魁苏婉卿与落榜书生顾长卿相遇于曲江畔。一株千年牡丹树下，两人许下跨越门第之别的誓言。然而安史之乱的铁骑踏碎了盛世繁花，乱世之中的爱情该何去何从...',
    directors: ['陈可昕'],
    actors: ['刘亦菲', '朱一龙', '倪妮', '黄轩']
  },
  {
    id: 'M03',
    name: '猎风者',
    poster: 'https://picsum.photos/id/1043/300/420',
    duration: 119,
    genre: '动作/犯罪',
    releaseDate: '2026-06-19',
    rating: 8.4,
    boxOffice: 210000000,
    status: '热映',
    wantSee: 186000,
    description: '东南亚某国边境，退役特种兵秦川卧底七年，终于接近贩毒集团核心。然而一次意外让他的身份暴露，在逃亡与追缉的较量中，他发现集团背后隐藏着更大的国际犯罪网络...',
    directors: ['林超鹏'],
    actors: ['张译', '吴京', '于和伟', '殷桃']
  },
  {
    id: 'M04',
    name: '深海回声',
    poster: 'https://picsum.photos/id/1038/300/420',
    duration: 96,
    genre: '动画/家庭',
    releaseDate: '2026-06-01',
    rating: 9.0,
    boxOffice: 460000000,
    status: '热映',
    wantSee: 98000,
    description: '小鲸鱼阿布在一次海底地震中与妈妈走散，在老海龟爷爷和发光水母叮叮的帮助下，它踏上了穿越深海峡谷的寻亲之旅。旅途中它遇到了迷路的小海豚萌萌，两个小伙伴一起面对深海的未知挑战...',
    directors: ['田晓鸣'],
    actors: ['山新', '季冠霖', '张杰', '宝木中阳']
  },
  {
    id: 'M05',
    name: '迷雾之城',
    poster: 'https://picsum.photos/id/1015/300/420',
    duration: 134,
    genre: '悬疑/惊悚',
    releaseDate: '2026-06-12',
    rating: 8.1,
    boxOffice: 175000000,
    status: '热映',
    wantSee: 156000,
    description: '雾都重庆，退休老刑警赵启明在调查一起普通失踪案时，意外发现线索指向20年前的一桩悬案。随着调查深入，他发现自己身边的每一个人都藏着不为人知的秘密...',
    directors: ['曹保明'],
    actors: ['廖凡', '桂纶镁', '王景春', '谭卓']
  },
  {
    id: 'M06',
    name: '星际拓荒',
    poster: 'https://picsum.photos/id/1019/300/420',
    duration: 156,
    genre: '科幻/惊悚',
    releaseDate: '2026-06-26',
    rating: 9.4,
    boxOffice: 0,
    status: '即将上映',
    wantSee: 580000,
    description: '人类第一批火星殖民者抵达红色星球第18个月，基地通讯突然中断。救援队登陆后发现基地完好但空无一人，只留下满地的不明符号和一句"不要相信光"的血字...',
    directors: ['邓尼·维伦纽夫'],
    actors: ['马修·麦康纳', '安妮·海瑟薇', '张震', '蒂尔达·斯文顿']
  }
]

export function generateSchedules(cinemaId: string, movieId?: string): ScheduleItem[] {
  const result: ScheduleItem[] = []
  const today = '2026-06-19'
  const hallTypeMap: Record<string, { type: string; lang: string; ver: string; priceBase: number }> = {
    '1号厅': { type: 'IMAX', lang: '原版', ver: '3D', priceBase: 88 },
    '2号厅': { type: 'CGS中国巨幕', lang: '国语', ver: '3D', priceBase: 68 },
    '3号厅': { type: '杜比影院', lang: '原版', ver: '2D', priceBase: 78 },
    '4号厅': { type: '激光厅', lang: '国语', ver: '2D', priceBase: 45 },
    '5号厅': { type: '标准厅', lang: '国语', ver: '2D', priceBase: 39 }
  }
  const moviesToShow = movieId ? movies.filter(m => m.id === movieId) : movies.filter(m => m.status === '热映')
  const cinema = cinemas.find(c => c.id === cinemaId) || cinemas[0]
  let sid = 1

  Object.entries(hallTypeMap).forEach(([hallName, meta]) => {
    let cur = 9
    let midx = 0
    while (cur < 23) {
      const m = moviesToShow[midx % moviesToShow.length]
      midx++
      const startTime = `${String(cur).padStart(2, '0')}:00`
      const endH = cur + Math.ceil(m.duration / 60)
      const endM = (m.duration % 60) + 15
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
      const sold = Math.floor(0.3 + Math.random() * 0.6)
      const cap = 180
      result.push({
        id: `S${cinemaId}-${sid++}`,
        movieId: m.id,
        movieName: m.name,
        cinemaId,
        cinemaName: cinema.name,
        hallId: `${cinemaId}-${hallName}`,
        hallName,
        hallType: meta.type,
        date: today,
        startTime,
        endTime,
        price: meta.priceBase,
        seatsTotal: cap,
        seatsSold: Math.floor(cap * sold),
        status: cur < new Date().getHours() ? 'finished' : sold > 0.9 ? 'sold_out' : 'on_sale',
        language: meta.lang,
        version: meta.ver
      })
      cur = endH + (endM >= 60 ? 1 : 0)
    }
  })

  return result
}

export function generateSeats(rows: number, cols: number): Seat[] {
  const seats: Seat[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isAisle = c === 5 || c === cols - 6
      if (isAisle) continue
      const rand = Math.random()
      let status: Seat['status'] = 'available'
      if (rand < 0.32) status = 'sold'
      else if (rand < 0.38) status = 'locked'
      const rowLabel = String.fromCharCode(65 + r)
      const type: Seat['type'] = (r === 0 || r === rows - 1) ? 'vip' : 'normal'
      const price = type === 'vip' ? 58 : 39
      seats.push({
        id: `${rowLabel}-${c + 1}`,
        row: r,
        col: c,
        rowLabel,
        colLabel: c + 1,
        status,
        price,
        type
      })
    }
  }
  return seats
}

export const orders: BookingOrder[] = [
  {
    id: 'O2026061900001',
    orderNo: 'GY202606190001',
    scheduleId: 'S001',
    movieName: '银河孤舟',
    cinemaName: '光影·王府井旗舰店',
    hallName: '1号厅',
    showTime: '2026-06-19 19:30',
    seats: [{ seatId: 'F-8', rowLabel: 'F', colLabel: 8 }, { seatId: 'F-9', rowLabel: 'F', colLabel: 9 }],
    totalAmount: 176,
    paidAmount: 176,
    pointsUsed: 0,
    status: 'paid',
    qrCode: 'GY-O-2026061900001-F8F9',
    createdAt: '2026-06-19 15:42:11',
    paidAt: '2026-06-19 15:42:38'
  },
  {
    id: 'O2026061800023',
    orderNo: 'GY202606180023',
    scheduleId: 'S002',
    movieName: '深海回声',
    cinemaName: '光影·王府井旗舰店',
    hallName: '3号厅',
    showTime: '2026-06-18 14:10',
    seats: [{ seatId: 'C-5', rowLabel: 'C', colLabel: 5 }, { seatId: 'C-6', rowLabel: 'C', colLabel: 6 }, { seatId: 'C-7', rowLabel: 'C', colLabel: 7 }],
    totalAmount: 135,
    paidAmount: 135,
    pointsUsed: 0,
    status: 'paid',
    qrCode: 'GY-O-2026061800023-C5C6C7',
    createdAt: '2026-06-18 10:15:20',
    paidAt: '2026-06-18 10:15:48'
  },
  {
    id: 'O2026061900002',
    orderNo: 'GY202606190002',
    scheduleId: 'S003',
    movieName: '猎风者',
    cinemaName: '光影·国贸店',
    hallName: '2号厅',
    showTime: '2026-06-19 21:00',
    seats: [{ seatId: 'D-12', rowLabel: 'D', colLabel: 12 }, { seatId: 'D-13', rowLabel: 'D', colLabel: 13 }],
    totalAmount: 136,
    paidAmount: 0,
    pointsUsed: 0,
    status: 'pending',
    qrCode: '',
    createdAt: '2026-06-19 16:30:05'
  }
]

export const currentMember: MemberInfo = {
  id: 'U001',
  name: '王小明',
  phone: '138****8888',
  avatar: 'https://picsum.photos/id/64/200/200',
  level: 'gold',
  levelName: '黄金会员',
  points: 35680,
  totalSpent: 12880,
  totalVisits: 156,
  coupons: 5,
  birthday: '1995-08-12',
  joinDate: '2024-03-15'
}

export const coupons: CouponItem[] = [
  { id: 'CP01', name: '2D通兑券', type: 'cash', value: 40, threshold: 0, validFrom: '2026-06-01', validTo: '2026-07-31', used: false, description: '可兑换任意2D场次电影票一张' },
  { id: 'CP02', name: 'IMAX特惠券', type: 'discount', value: 0.7, threshold: 80, validFrom: '2026-06-10', validTo: '2026-06-30', used: false, description: 'IMAX场次7折，单笔满80元可用' },
  { id: 'CP03', name: '爆米花套餐券', type: 'combo', value: 20, threshold: 30, validFrom: '2026-06-01', validTo: '2026-08-31', used: false, description: '任意爆米花+可乐套餐立减20元' },
  { id: 'CP04', name: '新用户立减券', type: 'cash', value: 15, threshold: 50, validFrom: '2026-05-01', validTo: '2026-05-31', used: true, description: '首单立减15元' }
]

export const concessions: ConcessionSku[] = [
  { id: 'K01', name: '中杯可乐', category: '饮品', price: 12, originalPrice: 15, image: '', stock: 999, description: '473ml 冰镇可乐' },
  { id: 'K02', name: '大桶爆米花', category: '爆米花', price: 28, originalPrice: 35, image: '', stock: 999, description: '180oz 焦糖味爆米花' },
  { id: 'K03', name: '双人观影套餐', category: '套餐', price: 68, originalPrice: 88, image: '', stock: 500, description: '2杯中可乐 + 1大桶爆米花 + 2份小食', combo: [{ id: 'K01', quantity: 2 }, { id: 'K02', quantity: 1 }] },
  { id: 'K04', name: '美式热狗', category: '零食', price: 18, originalPrice: 22, image: '', stock: 200, description: '经典美式热狗 + 番茄酱' }
]
