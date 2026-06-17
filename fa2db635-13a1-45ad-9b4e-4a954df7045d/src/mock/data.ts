import type {
  Store,
  Staff,
  Venue,
  Prop,
  Wedding,
  Package,
  Addon,
  ScheduleTask,
  Contract,
  FollowTask,
  TimelineEvent,
  FinanceDetail,
  MonthlyStat,
  OverdueItem,
  RevenuePoint,
  FunnelData,
  ScoreData,
  SupplierOrder,
} from '@/types'

const today = new Date()
const iso = (d: Date) => d.toISOString().slice(0, 10)
const future = (days: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  return iso(d)
}
const past = (days: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() - days)
  return iso(d)
}

export const seedStores: Store[] = [
  { id: 1, name: '锦时·外滩旗舰馆', discountCoefficient: 1.0 },
  { id: 2, name: '锦时·静安艺术馆', discountCoefficient: 0.95 },
  { id: 3, name: '锦时·徐汇花园馆', discountCoefficient: 0.92 },
  { id: 4, name: '锦时·浦东云际馆', discountCoefficient: 0.98 },
  { id: 5, name: '锦时·长宁雅集馆', discountCoefficient: 0.9 },
  { id: 6, name: '锦时·虹桥水晶馆', discountCoefficient: 0.96 },
  { id: 7, name: '锦时·闵行花园馆', discountCoefficient: 0.88 },
  { id: 8, name: '锦时·黄浦江景馆', discountCoefficient: 1.05 },
]

const roleNames: Record<string, string> = {
  PLANNER: '策划师',
  HOST: '主持人',
  MAKEUP: '化妆师',
  PHOTO: '摄影师',
  FLORIST: '花艺师',
}

const firstNames = ['林', '陈', '王', '李', '赵', '周', '吴', '郑', '沈', '顾', '苏', '叶', '韩', '江', '秦']
const givenNames = ['婉清', '子谦', '若曦', '景行', '安然', '明轩', '雨桐', '逸尘', '念慈', '修远', '清欢', '北辰']

function buildStaff(): Staff[] {
  const list: Staff[] = []
  let id = 1
  for (const store of seedStores) {
    const roles: Array<keyof typeof roleNames> = ['PLANNER', 'PLANNER', 'HOST', 'MAKEUP', 'PHOTO', 'PHOTO', 'FLORIST']
    for (const role of roles) {
      const name = firstNames[id % firstNames.length] + givenNames[(id * 3) % givenNames.length]
      list.push({
        id: id++,
        storeId: store.id,
        name,
        role,
        phone: '138' + String(10000000 + id * 137).slice(0, 8),
      })
    }
  }
  return list
}

export const seedStaff: Staff[] = buildStaff()

export const seedVenues: Venue[] = [
  { id: 1, storeId: 1, name: '玫瑰大厅', capacity: 30 },
  { id: 2, storeId: 1, name: '水晶小礼堂', capacity: 12 },
  { id: 3, storeId: 2, name: '艺术穹顶厅', capacity: 25 },
  { id: 4, storeId: 3, name: '花园草坪', capacity: 40 },
  { id: 5, storeId: 4, name: '云际宴会厅', capacity: 35 },
  { id: 6, storeId: 8, name: '江景全景厅', capacity: 28 },
]

export const seedProps: Prop[] = [
  { id: 1, storeId: 1, name: '香槟塔·经典款', stock: 6 },
  { id: 2, storeId: 1, name: '花拱门·玫瑰', stock: 4 },
  { id: 3, storeId: 1, name: '追光灯组', stock: 8 },
  { id: 4, storeId: 2, name: '水晶吊帘', stock: 3 },
  { id: 5, storeId: 4, name: '云际舞美套件', stock: 5 },
  { id: 6, storeId: 8, name: '江景烟花许可位', stock: 2 },
]

export const seedPackages: Package[] = [
  {
    id: 1,
    name: '繁花·尊享典藏',
    basePrice: 68800,
    description: '六大服务核心团队 + 花艺主题定制 + 双机位影像',
    items: [
      { id: 11, name: '首席策划师全程', type: 'SERVICE', cost: 6000, price: 9800, included: true },
      { id: 12, name: '金牌主持人', type: 'SERVICE', cost: 3500, price: 6800, included: true },
      { id: 13, name: '化妆造型（含试妆3次）', type: 'SERVICE', cost: 2800, price: 5200, included: true },
      { id: 14, name: '双机位摄影摄像', type: 'SERVICE', cost: 4500, price: 8800, included: true },
      { id: 15, name: '主花艺主题定制', type: 'SERVICE', cost: 5200, price: 11000, included: true },
      { id: 16, name: '现场督导团队', type: 'SERVICE', cost: 2000, price: 3800, included: true },
      { id: 17, name: '鲜花布景材料', type: 'COST', cost: 8000, price: 0, included: true },
      { id: 18, name: '灯光音响租赁', type: 'COST', cost: 6000, price: 0, included: true },
      { id: 19, name: '加印相册精装', type: 'SERVICE', cost: 800, price: 1800, included: false },
      { id: 20, name: '无人机航拍', type: 'SERVICE', cost: 1500, price: 3200, included: false },
    ],
  },
  {
    id: 2,
    name: '锦时·雅致臻选',
    basePrice: 38800,
    description: '五人核心团队 + 标准花艺 + 单机位影像',
    items: [
      { id: 21, name: '资深策划师', type: 'SERVICE', cost: 4000, price: 6800, included: true },
      { id: 22, name: '专业主持人', type: 'SERVICE', cost: 2200, price: 4200, included: true },
      { id: 23, name: '化妆造型', type: 'SERVICE', cost: 1800, price: 3600, included: true },
      { id: 24, name: '单机位摄影摄像', type: 'SERVICE', cost: 2800, price: 5200, included: true },
      { id: 25, name: '标准花艺布置', type: 'SERVICE', cost: 3200, price: 6800, included: true },
      { id: 26, name: '现场督导', type: 'SERVICE', cost: 1200, price: 2200, included: true },
      { id: 27, name: '基础布景材料', type: 'COST', cost: 4500, price: 0, included: true },
      { id: 28, name: '灯光基础', type: 'COST', cost: 3000, price: 0, included: true },
      { id: 29, name: '加配副机位', type: 'SERVICE', cost: 1800, price: 3800, included: false },
    ],
  },
  {
    id: 3,
    name: '晨光·轻奢简雅',
    basePrice: 19800,
    description: '小型婚礼优选 · 四人团队 + 轻花艺',
    items: [
      { id: 31, name: '策划师', type: 'SERVICE', cost: 2500, price: 4200, included: true },
      { id: 32, name: '主持人', type: 'SERVICE', cost: 1500, price: 2800, included: true },
      { id: 33, name: '化妆造型', type: 'SERVICE', cost: 1200, price: 2400, included: true },
      { id: 34, name: '摄影摄像', type: 'SERVICE', cost: 2000, price: 3800, included: true },
      { id: 35, name: '轻花艺布置', type: 'SERVICE', cost: 1800, price: 3600, included: true },
      { id: 36, name: '基础材料', type: 'COST', cost: 2500, price: 0, included: true },
      { id: 37, name: '主持人升级金牌', type: 'SERVICE', cost: 800, price: 1500, included: false },
    ],
  },
]

export const seedAddons: Addon[] = [
  { id: 1, name: '额外追光位', cost: 300, price: 800, unit: '个' },
  { id: 2, name: '迎宾甜品台', cost: 600, price: 1500, unit: '桌' },
  { id: 3, name: '婚礼跟拍相册', cost: 400, price: 1200, unit: '本' },
  { id: 4, name: '现场弦乐四重奏', cost: 2200, price: 4800, unit: '组' },
  { id: 5, name: '冷焰火特效', cost: 800, price: 1800, unit: '组' },
  { id: 6, name: '签到互动屏', cost: 500, price: 1200, unit: '台' },
]

const couples = [
  ['顾清欢', '沈逸尘'],
  ['林若曦', '叶北辰'],
  ['陈安然', '王景行'],
  ['苏念慈', '周修远'],
  ['赵雨桐', '韩明轩'],
  ['江婉清', '秦子谦'],
  ['叶念安', '李慕白'],
  ['郑书瑶', '吴衍之'],
]

const stages: Array<Wedding['stage']> = ['CONSULT', 'DESIGN', 'CONTRACT', 'PREPARE', 'ONSITE', 'DELIVERY']

function buildWeddings(): Wedding[] {
  const list: Wedding[] = []
  const planners = seedStaff.filter((s) => s.role === 'PLANNER')
  let id = 1
  const offsets = [-120, -90, -60, -30, -14, -7, -3, 3, 7, 14, 21, 30, 45, 60, 75, 90, 105, 120, 150, 180]
  offsets.forEach((off, idx) => {
    const store = seedStores[idx % seedStores.length]
    const planner = planners[idx % planners.length]
    const couple = couples[idx % couples.length]
    const pkg = seedPackages[idx % seedPackages.length]
    const guests = 8 + ((idx * 3) % 22)
    const stageIdx = off < 0 ? Math.min(5, Math.floor((180 - off) / 36)) : 0
    const stage = off < 0 ? stages[Math.min(5, stageIdx)] : stages[0]
    list.push({
      id: id++,
      coupleName: couple[0] + ' & ' + couple[1],
      brideName: couple[0],
      groomName: couple[1],
      phone: '139' + String(20000000 + idx * 731).slice(0, 8),
      weddingDate: future(off),
      guests,
      stage,
      storeId: store.id,
      storeName: store.name,
      plannerId: planner.id,
      plannerName: planner.name,
      packageId: pkg.id,
      packageName: pkg.name,
      quoteTotal: pkg.basePrice + guests * 320,
      createdAt: past(120 - (idx % 30)),
      progress: stage === 'DELIVERY' ? 100 : stage === 'ONSITE' ? 85 : stage === 'PREPARE' ? 65 : stage === 'CONTRACT' ? 45 : stage === 'DESIGN' ? 25 : 10,
    })
  })
  return list
}

export const seedWeddings: Wedding[] = buildWeddings()

function buildScheduleTasks(): ScheduleTask[] {
  const tasks: ScheduleTask[] = []
  let id = 1
  seedWeddings.forEach((w) => {
    const date = w.weddingDate
    const staff = seedStaff.filter((s) => s.storeId === w.storeId).slice(0, 5)
    staff.forEach((s) => {
      tasks.push({
        id: id++,
        resourceType: 'STAFF',
        resourceId: s.id,
        resourceName: s.name,
        weddingId: w.id,
        coupleName: w.coupleName,
        startTime: `${date}T08:00:00`,
        endTime: `${date}T20:00:00`,
        status: 'BOOKED',
      })
    })
    const venue = seedVenues.find((v) => v.storeId === w.storeId)
    if (venue) {
      tasks.push({
        id: id++,
        resourceType: 'VENUE',
        resourceId: venue.id,
        resourceName: venue.name,
        weddingId: w.id,
        coupleName: w.coupleName,
        startTime: `${date}T07:00:00`,
        endTime: `${date}T22:00:00`,
        status: 'BOOKED',
      })
    }
    const prop = seedProps.find((p) => p.storeId === w.storeId)
    if (prop) {
      tasks.push({
        id: id++,
        resourceType: 'PROP',
        resourceId: prop.id,
        resourceName: prop.name,
        weddingId: w.id,
        coupleName: w.coupleName,
        startTime: `${date}T06:00:00`,
        endTime: `${date}T21:00:00`,
        status: 'BOOKED',
      })
    }
  })
  return tasks
}

export const seedScheduleTasks: ScheduleTask[] = buildScheduleTasks()

const contractTemplates = [
  { title: '一、服务内容', body: '乙方按甲方所选「套餐名称」提供婚礼策划及现场服务，具体服务项以报价单附件为准。' },
  { title: '二、服务费用', body: '本项目服务总费用为「金额」元（大写：人民币），含策划、人员、花艺、影像及基础材料。' },
  { title: '三、付款方式', body: '签订本合同时支付定金 30%，婚礼前 30 日支付尾款 70%；逾期视为自动放弃档期。' },
  { title: '四、档期约定', body: '甲方确认婚期后，乙方锁定人员、场地与道具档期；如需变更婚期，须提前 15 日书面告知。' },
  { title: '五、违约责任', body: '任一方违约，违约方应向守约方支付合同总额 20% 的违约金；不可抗力情形除外。' },
  { title: '六、附加协议', body: '双方就个性化需求可另行签订附加协议，附加协议与本合同具有同等效力。' },
]

export const seedContracts: Contract[] = seedWeddings
  .filter((w) => ['CONTRACT', 'PREPARE', 'ONSITE', 'DELIVERY'].includes(w.stage))
  .map((w, i) => ({
    id: i + 1,
    weddingId: w.id,
    coupleName: w.coupleName,
    packageName: w.packageName ?? '',
    amount: w.quoteTotal ?? 0,
    status: w.stage === 'CONTRACT' ? 'PENDING' : 'SIGNED',
    clauses: contractTemplates.map((c, ci) => ({
      id: `c${ci}`,
      title: c.title,
      body: c.body.replace('套餐名称', w.packageName ?? '').replace('金额', String(w.quoteTotal ?? 0)),
      isAddon: ci === 5,
    })),
    signature: w.stage !== 'CONTRACT' ? 'data:image/png;base64,signature' : undefined,
    signedAt: w.stage !== 'CONTRACT' ? past(60 - i * 5) : undefined,
    createdAt: past(80 - i * 5),
  }))

export const seedFollowTasks: FollowTask[] = []
{
  let tid = 1
  seedWeddings.forEach((w) => {
    const templates = [
      { title: '新人初访咨询', daysBefore: 90, owner: '策划师' },
      { title: '选婚纱礼服', daysBefore: 60, owner: '策划师' },
      { title: '试妆定妆', daysBefore: 30, owner: '化妆师' },
      { title: '方案终稿确认', daysBefore: 21, owner: '策划师' },
      { title: '场地彩排', daysBefore: 3, owner: '督导' },
      { title: '婚礼当日执行', daysBefore: 0, owner: '全员' },
    ]
    const daysLeft = Math.round((new Date(w.weddingDate).getTime() - today.getTime()) / 86400000)
    templates.forEach((t) => {
      const due = (() => {
        const d = new Date(w.weddingDate)
        d.setDate(d.getDate() - t.daysBefore)
        return iso(d)
      })()
      const status = daysLeft > t.daysBefore ? 'TODO' : daysLeft > t.daysBefore - 7 ? 'DOING' : 'DONE'
      seedFollowTasks.push({
        id: tid++,
        weddingId: w.id,
        title: t.title,
        daysBefore: t.daysBefore,
        status,
        owner: t.owner,
        dueDate: due,
      })
    })
  })
}

export const seedTimeline: TimelineEvent[] = seedWeddings.slice(0, 8).flatMap((w, wi) => [
  { id: wi * 3 + 1, weddingId: w.id, time: past(80), title: '创建婚礼项目', desc: `${w.coupleName} 预约咨询`, actor: w.plannerName ?? '策划师' },
  { id: wi * 3 + 2, weddingId: w.id, time: past(60), title: '方案设计完成', desc: '主视觉与流程方案已上传', actor: w.plannerName ?? '策划师' },
  { id: wi * 3 + 3, weddingId: w.id, time: past(40), title: '合同已签署', desc: '电子签名完成，进入筹备', actor: '运营' },
])

export const seedFinance: FinanceDetail[] = seedWeddings.map((w, i) => {
  const income = w.quoteTotal ?? 0
  const received = ['PREPARE', 'ONSITE', 'DELIVERY'].includes(w.stage) ? Math.round(income * 0.7) : Math.round(income * 0.3)
  const cost = Math.round(income * 0.62)
  const paid = Math.round(cost * 0.5)
  return {
    weddingId: w.id,
    coupleName: w.coupleName,
    income,
    received,
    cost,
    paid,
    profit: income - cost,
    suppliers: [
      { name: '花艺·林师傅', amount: Math.round(income * 0.12), settled: i % 3 === 0 },
      { name: '影像·苏工作室', amount: Math.round(income * 0.1), settled: i % 4 === 0 },
      { name: '场地·锦时', amount: Math.round(income * 0.15), settled: i % 2 === 0 },
      { name: '主持·赵老师', amount: Math.round(income * 0.05), settled: i % 5 === 0 },
    ],
  }
})

export const seedMonthly: MonthlyStat[] = (() => {
  const arr: MonthlyStat[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today)
    d.setMonth(d.getMonth() - i)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const weddings = 80 + Math.round(Math.random() * 60)
    const revenue = weddings * (45000 + Math.round(Math.random() * 30000))
    const cost = Math.round(revenue * (0.58 + Math.random() * 0.06))
    arr.push({ month, revenue, cost, profit: revenue - cost, weddings })
  }
  return arr
})()

export const seedOverdue: OverdueItem[] = [
  { id: 1, type: 'RECEIVABLE', party: '陈安然 & 王景行', amount: 48000, days: 12 },
  { id: 2, type: 'RECEIVABLE', party: '赵雨桐 & 韩明轩', amount: 32000, days: 5 },
  { id: 3, type: 'PAYABLE', party: '花艺·林师傅', amount: 9600, days: 8 },
  { id: 4, type: 'PAYABLE', party: '影像·苏工作室', amount: 7800, days: 3 },
]

export const seedRevenue: RevenuePoint[] = (() => {
  const arr: RevenuePoint[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    arr.push({ date: iso(d), amount: 80000 + Math.round(Math.random() * 120000) })
  }
  return arr
})()

export const seedFunnel: FunnelData[] = [
  { stage: '咨询', count: 860 },
  { stage: '方案设计', count: 540 },
  { stage: '合同签订', count: 380 },
  { stage: '筹备执行', count: 360 },
  { stage: '现场完成', count: 352 },
]

export const seedScores: ScoreData[] = [
  { dimension: '策划专业', score: 4.7 },
  { dimension: '现场执行', score: 4.8 },
  { dimension: '人员配合', score: 4.5 },
  { dimension: '性价比', score: 4.3 },
  { dimension: '售后跟进', score: 4.6 },
]

export const seedSupplierOrders: SupplierOrder[] = seedWeddings.slice(0, 12).map((w, i) => ({
  id: i + 1,
  coupleName: w.coupleName,
  weddingDate: w.weddingDate,
  role: (['MAKEUP', 'PHOTO', 'HOST', 'FLORIST'] as const)[i % 4],
  service: (['化妆造型', '摄影摄像', '婚礼主持', '花艺布置'] as const)[i % 4],
  amount: [5200, 8800, 6800, 11000][i % 4],
  status: i % 3 === 0 ? 'PENDING' : i % 3 === 1 ? 'CONFIRMED' : 'DONE',
}))
