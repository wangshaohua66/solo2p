import { dayjs } from '@/utils/date'

export interface DashboardStats {
  today: {
    remainsCount: number
    pickupMissions: number
    bookings: number
    cremations: number
    revenue: number
  }
  pendingTasks: { id: string; type: string; content: string; priority: 'high' | 'medium' | 'low'; createTime: string }[]
  recentActivities: { id: string; operator: string; action: string; target: string; time: string }[]
  alerts: { id: string; level: 'error' | 'warning' | 'info'; message: string; time: string }[]
}

export const mockDashboardStats: DashboardStats = {
  today: {
    remainsCount: 28,
    pickupMissions: 15,
    bookings: 9,
    cremations: 22,
    revenue: 1286500
  },
  pendingTasks: [
    { id: 'T1', type: '接运任务', content: '浦东新区某某路888号紧急接运任务未派车', priority: 'high', createTime: dayjs().subtract(5, 'minute').format('YYYY-MM-DD HH:mm') },
    { id: 'T2', type: '告别预约', content: '追思厅1号 14:00 预约待确认', priority: 'medium', createTime: dayjs().subtract(20, 'minute').format('YYYY-MM-DD HH:mm') },
    { id: 'T3', type: '费用结算', content: '王某某家属费用待结算(3850元)', priority: 'medium', createTime: dayjs().subtract(45, 'minute').format('YYYY-MM-DD HH:mm') },
    { id: 'T4', type: '火化安排', content: '2号火化炉维护后未重启检查', priority: 'low', createTime: dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm') },
    { id: 'T5', type: '状态确认', content: '李某某遗体冷藏超时(>72h)未更新', priority: 'high', createTime: dayjs().subtract(3, 'hour').format('YYYY-MM-DD HH:mm') }
  ],
  recentActivities: [
    { id: 'A1', operator: '殡仪员张三', action: '登记遗体档案', target: '赵某某', time: dayjs().subtract(8, 'minute').format('YYYY-MM-DD HH:mm') },
    { id: 'A2', operator: '调度员A', action: '分配车辆', target: '沪A-8888领-陈建国', time: dayjs().subtract(15, 'minute').format('YYYY-MM-DD HH:mm') },
    { id: 'A3', operator: '礼仪师王建国', action: '确认告别预约', target: '追思厅1号 10:00-11:30', time: dayjs().subtract(32, 'minute').format('YYYY-MM-DD HH:mm') },
    { id: 'A4', operator: '火化工钱七', action: '完成火化', target: '李某某(火化炉3号)', time: dayjs().subtract(55, 'minute').format('YYYY-MM-DD HH:mm') },
    { id: 'A5', operator: '墓园管理员', action: '销售墓位', target: '永宁区05-08号 128800元', time: dayjs().subtract(1.5, 'hour').format('YYYY-MM-DD HH:mm') },
    { id: 'A6', operator: '财务李四', action: '开具电子发票', target: '账单INV20260001', time: dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm') }
  ],
  alerts: [
    { id: 'AL1', level: 'warning', message: '清明祭扫高峰临近，建议提前开放预约系统', time: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm') },
    { id: 'AL2', level: 'error', message: '车辆沪C-9999领GPS信号丢失超过10分钟', time: dayjs().subtract(12, 'minute').format('YYYY-MM-DD HH:mm') },
    { id: 'AL3', level: 'info', message: '本月遗体处理量较上月增长12.5%', time: dayjs().subtract(3, 'hour').format('YYYY-MM-DD HH:mm') },
    { id: 'AL4', level: 'warning', message: 'P1停车场使用率已达85%，建议引导至P4', time: dayjs().subtract(25, 'minute').format('YYYY-MM-DD HH:mm') }
  ]
}

export function generateMonthlyTrend() {
  const months = []
  const now = dayjs()
  for (let i = 11; i >= 0; i--) {
    const d = now.subtract(i, 'month')
    months.push({
      month: d.format('YYYY年M月'),
      remains: 900 + Math.floor(Math.random() * 400),
      cremations: 850 + Math.floor(Math.random() * 350),
      bookings: 400 + Math.floor(Math.random() * 200),
      revenue: 8 + Math.random() * 6
    })
  }
  return months
}

export function generateServiceCategory() {
  return [
    { name: '接运服务', value: 1285000 },
    { name: '冷藏服务', value: 680000 },
    { name: '整容服务', value: 1560000 },
    { name: '告别服务', value: 2340000 },
    { name: '火化服务', value: 980000 },
    { name: '骨灰安葬', value: 1250000 },
    { name: '墓位销售', value: 8600000 },
    { name: '其他服务', value: 420000 }
  ]
}

export function generateFuneralHomeStats() {
  return [
    { name: '第一殡仪馆', remains: 4250, cremations: 4080, satisfaction: 96.8, revenue: 5280 },
    { name: '第二殡仪馆', remains: 3820, cremations: 3650, satisfaction: 95.2, revenue: 4620 },
    { name: '第三殡仪馆', remains: 3930, cremations: 3780, satisfaction: 97.1, revenue: 4890 }
  ]
}

export function generateCemeterySales() {
  const quarters = ['2025Q1', '2025Q2', '2025Q3', '2025Q4', '2026Q1']
  return quarters.map((q) => ({
    quarter: q,
    standard: 80 + Math.floor(Math.random() * 60),
    double: 60 + Math.floor(Math.random() * 50),
    premium: 20 + Math.floor(Math.random() * 25),
    family: 5 + Math.floor(Math.random() * 10),
    ashesWall: 150 + Math.floor(Math.random() * 80)
  }))
}
