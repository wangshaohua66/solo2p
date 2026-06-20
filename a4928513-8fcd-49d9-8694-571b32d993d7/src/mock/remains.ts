import { RemainsStatus, type Remains } from '@/types/remains'
import { dayjs } from '@/utils/date'

const funeralHomes = [
  { id: 'fh1', name: '第一殡仪馆' },
  { id: 'fh2', name: '第二殡仪馆' },
  { id: 'fh3', name: '第三殡仪馆' }
]

const causesOfDeath = ['疾病身故', '意外身故', '自然死亡', '交通事故', '其他']
const relations = ['配偶', '子女', '父母', '兄弟姐妹', '其他亲属']
const locations = [
  { building: '冷藏楼A', room: '冷藏间1', shelfNo: 'A-01' },
  { building: '冷藏楼A', room: '冷藏间2', shelfNo: 'A-05' },
  { building: '冷藏楼B', room: '冷藏间3', shelfNo: 'B-12' },
  { building: '整容楼', room: '整容室1' },
  { building: '礼仪楼', room: '告别厅准备区' }
]

const names = ['张伟', '李桂英', '王建国', '陈秀兰', '刘志强', '赵美玲', '孙德胜', '周丽华', '吴明辉', '郑玉兰']

function randomInArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomStatus(): RemainsStatus {
  const statuses = Object.values(RemainsStatus)
  return statuses[Math.floor(Math.random() * statuses.length)]
}

function generateId(index: number): string {
  return `R${dayjs().format('YYYYMMDD')}${String(index).padStart(4, '0')}`
}

function generateCode(index: number): string {
  return `YT${dayjs().format('YYYYMMDD')}${String(index).padStart(3, '0')}`
}

export function generateMockRemains(count = 36): Remains[] {
  const result: Remains[] = []
  for (let i = 1; i <= count; i++) {
    const fh = randomInArray(funeralHomes)
    const status = randomStatus()
    const name = names[i % names.length]
    const createTime = dayjs().subtract(Math.floor(Math.random() * 10), 'day')
    const deathTime = createTime.subtract(Math.random() * 24, 'hour')
    const statusHistory = generateStatusHistory(status, createTime)

    result.push({
      id: generateId(i),
      code: generateCode(i),
      name,
      gender: Math.random() > 0.5 ? 'male' : 'female',
      age: 50 + Math.floor(Math.random() * 45),
      idNumber: `3101${String(Math.floor(Math.random() * 1000000000000)).padStart(14, '0')}`,
      causeOfDeath: randomInArray(causesOfDeath),
      deathTime: deathTime.format('YYYY-MM-DD HH:mm'),
      pickupAddress: `上海市${randomInArray(['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '浦东新区'])}某某路${Math.floor(Math.random() * 999)}号`,
      funeralHomeId: fh.id,
      funeralHomeName: fh.name,
      arriveTime: status !== RemainsStatus.PENDING_PICKUP && status !== RemainsStatus.PICKING_UP
        ? createTime.add(1 + Math.random() * 6, 'hour').format('YYYY-MM-DD HH:mm')
        : undefined,
      currentStatus: status,
      family: {
        name: randomInArray(names),
        relation: randomInArray(relations),
        phone: `139${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`
      },
      services: [],
      statusHistory,
      createTime: createTime.format('YYYY-MM-DD HH:mm'),
      operatorId: `OP${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
      location: status !== RemainsStatus.PENDING_PICKUP && status !== RemainsStatus.PICKING_UP
        ? randomInArray(locations)
        : undefined,
      cremationNo: status === RemainsStatus.CREMATED || status === RemainsStatus.ASH_STORED || status === RemainsStatus.BURIED
        ? `HH${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
        : undefined,
      urnNo: status === RemainsStatus.ASH_STORED || status === RemainsStatus.BURIED
        ? `GH${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`
        : undefined
    })
  }
  return result.sort((a, b) => dayjs(b.createTime).valueOf() - dayjs(a.createTime).valueOf())
}

function generateStatusHistory(currentStatus: RemainsStatus, baseTime: dayjs.Dayjs) {
  const flow = [
    RemainsStatus.PENDING_PICKUP,
    RemainsStatus.PICKING_UP,
    RemainsStatus.ARRIVED,
    RemainsStatus.REFRIGERATING,
    RemainsStatus.COSMETIC,
    RemainsStatus.READY_FOR_FAREWELL,
    RemainsStatus.IN_FAREWELL,
    RemainsStatus.READY_FOR_CREMATION,
    RemainsStatus.CREMATING,
    RemainsStatus.CREMATED
  ]
  const operators = ['殡仪员张三', '殡仪员李四', '防腐师王五', '礼仪师赵六', '火化工钱七']
  const idx = flow.indexOf(currentStatus)
  const count = idx === -1 ? flow.length : idx + 1
  const history = []
  let time = baseTime
  for (let i = 0; i < count; i++) {
    history.push({
      status: flow[i],
      time: time.format('YYYY-MM-DD HH:mm'),
      operatorId: `OP${String(i + 1).padStart(3, '0')}`,
      operatorName: operators[i % operators.length]
    })
    time = time.add(1 + Math.random() * 12, 'hour')
  }
  if (currentStatus === RemainsStatus.ASH_STORED) {
    history.push({
      status: RemainsStatus.ASH_STORED,
      time: time.format('YYYY-MM-DD HH:mm'),
      operatorId: 'OP006',
      operatorName: '火化工孙八'
    })
  }
  if (currentStatus === RemainsStatus.BURIED) {
    history.push({
      status: RemainsStatus.BURIED,
      time: time.format('YYYY-MM-DD HH:mm'),
      operatorId: 'OP007',
      operatorName: '墓园管理员周九'
    })
  }
  return history
}

export const mockRemainsList: Remains[] = generateMockRemains(36)

export function getRemainsById(id: string): Remains | undefined {
  return mockRemainsList.find((r) => r.id === id)
}

export function getRemainsByCode(code: string): Remains | undefined {
  return mockRemainsList.find((r) => r.code === code)
}
