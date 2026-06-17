import { loadDB, saveDB, nextId, asResourceList, type DB } from './db'
import type {
  ApiResponse,
  ScheduleTask,
  Wedding,
  Contract,
  FollowTask,
  Quote,
  ConflictResult,
  SupplierOrder,
  Resource,
  WeddingStage,
  ContractStatus,
  TaskStatus,
} from '@/types'
import { calcQuote } from '@/utils/pricing'
import { checkConflict } from '@/utils/schedule'

function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, message: 'success', data }
}

function delay<T>(data: T, ms = 220): Promise<ApiResponse<T>> {
  return new Promise((resolve) => setTimeout(() => resolve(ok(data)), ms))
}

function db(): DB {
  return loadDB()
}
function commit(d: DB): DB {
  saveDB(d)
  return d
}

export const handlers = {
  auth: {
    login: async (body: { username: string; password: string; role: string }) => {
      const d = db()
      const user = {
        id: 1,
        name: body.username || '林婉清',
        role: body.role,
        storeId: body.role === 'ADMIN' ? undefined : 1,
        avatar: '',
      }
      return delay({ token: 'mock-jwt-' + Date.now(), user })
    },
    supplierLogin: async (body: { phone: string; code: string }) => {
      const d = db()
      const staff = d.staff.find((s) => s.phone === body.phone) || d.staff[0]
      return delay({
        token: 'mock-supplier-' + Date.now(),
        supplier: { id: staff.id, name: staff.name, role: staff.role, phone: staff.phone, storeId: staff.storeId },
      })
    },
  },

  schedule: {
    list: async (params: { resourceType?: string; storeId?: number; from?: string; to?: string }) => {
      const d = db()
      let tasks = d.scheduleTasks
      if (params.resourceType) tasks = tasks.filter((t) => t.resourceType === params.resourceType)
      if (params.storeId) {
        const ids = new Set<number>()
        ;['staff', 'venues', 'props'].forEach(() => {})
        const staffIds = d.staff.filter((s) => s.storeId === params.storeId).map((s) => s.id)
        const venueIds = d.venues.filter((v) => v.storeId === params.storeId).map((v) => v.id)
        const propIds = d.props.filter((p) => p.storeId === params.storeId).map((p) => p.id)
        tasks = tasks.filter(
          (t) =>
            (t.resourceType === 'STAFF' && staffIds.includes(t.resourceId)) ||
            (t.resourceType === 'VENUE' && venueIds.includes(t.resourceId)) ||
            (t.resourceType === 'PROP' && propIds.includes(t.resourceId)),
        )
      }
      if (params.from) tasks = tasks.filter((t) => t.endTime >= params.from!)
      if (params.to) tasks = tasks.filter((t) => t.startTime <= params.to!)
      return delay(tasks)
    },
    check: async (body: { resourceType: 'STAFF' | 'VENUE' | 'PROP'; resourceId: number; storeId: number; start: string; end: string }) => {
      const d = db()
      const result: ConflictResult = checkConflict(
        d.scheduleTasks,
        asResourceList(d) as Resource[],
        body.resourceType,
        body.resourceId,
        body.storeId,
        body.start,
        body.end,
      )
      return delay(result, 80)
    },
    move: async (taskId: number, body: { start: string; end: string }) => {
      const d = db()
      const task = d.scheduleTasks.find((t) => t.id === taskId)
      if (task) {
        task.startTime = body.start
        task.endTime = body.end
        commit(d)
      }
      return delay(task!)
    },
    remove: async (taskId: number) => {
      const d = db()
      d.scheduleTasks = d.scheduleTasks.filter((t) => t.id !== taskId)
      commit(d)
      return delay({ id: taskId })
    },
  },

  weddings: {
    list: async (params: { stage?: string; storeId?: number; date?: string; keyword?: string }) => {
      const d = db()
      let list = d.weddings
      if (params.stage) list = list.filter((w) => w.stage === params.stage)
      if (params.storeId) list = list.filter((w) => w.storeId === params.storeId)
      if (params.date) list = list.filter((w) => w.weddingDate === params.date)
      if (params.keyword) list = list.filter((w) => w.coupleName.includes(params.keyword!))
      return delay(list)
    },
    detail: async (id: number) => {
      const d = db()
      const w = d.weddings.find((x) => x.id === id)
      return delay(w!)
    },
    create: async (body: Partial<Wedding> & { resources?: { type: string; id: number }[] }) => {
      const d = db()
      const id = nextId(d, 'weddings')
      const store = d.stores.find((s) => s.id === body.storeId)
      const pkg = d.packages.find((p) => p.id === body.packageId)
      const planner = d.staff.find((s) => s.id === body.plannerId)
      const wedding: Wedding = {
        id,
        coupleName: body.coupleName || '新人',
        brideName: body.brideName,
        groomName: body.groomName,
        phone: body.phone || '',
        weddingDate: body.weddingDate || '',
        guests: body.guests || 10,
        stage: 'CONSULT',
        storeId: body.storeId || 1,
        storeName: store?.name,
        plannerId: body.plannerId || 0,
        plannerName: planner?.name,
        packageId: body.packageId || 1,
        packageName: pkg?.name,
        quoteTotal: body.quoteTotal,
        createdAt: new Date().toISOString(),
        progress: 10,
      }
      d.weddings.unshift(wedding)
      if (body.resources) {
        body.resources.forEach((r) => {
          const res =
            r.type === 'STAFF' ? d.staff.find((s) => s.id === r.id) : r.type === 'VENUE' ? d.venues.find((v) => v.id === r.id) : d.props.find((p) => p.id === r.id)
          if (res) {
            d.scheduleTasks.push({
              id: nextId(d, 'scheduleTasks'),
              resourceType: r.type as 'STAFF' | 'VENUE' | 'PROP',
              resourceId: res.id,
              resourceName: (res as { name: string }).name,
              weddingId: id,
              coupleName: wedding.coupleName,
              startTime: `${wedding.weddingDate}T08:00:00`,
              endTime: `${wedding.weddingDate}T20:00:00`,
              status: 'BOOKED',
            })
          }
        })
      }
      commit(d)
      return delay(wedding, 400)
    },
    updateStage: async (id: number, stage: WeddingStage) => {
      const d = db()
      const w = d.weddings.find((x) => x.id === id)
      if (w) {
        w.stage = stage
        w.progress = stage === 'DELIVERY' ? 100 : stage === 'ONSITE' ? 85 : stage === 'PREPARE' ? 65 : stage === 'CONTRACT' ? 45 : stage === 'DESIGN' ? 25 : 10
        commit(d)
      }
      return delay(w!)
    },
  },

  packages: {
    list: async () => {
      const d = db()
      return delay(d.packages)
    },
    save: async (pkg: { id?: number; name: string; basePrice: number; description: string; items: any[] }) => {
      const d = db()
      if (pkg.id) {
        const target = d.packages.find((p) => p.id === pkg.id)
        if (target) {
          Object.assign(target, pkg)
        }
      } else {
        d.packages.push({ ...pkg, id: nextId(d, 'packages') } as any)
      }
      commit(d)
      return delay(pkg)
    },
  },

  addons: {
    list: async () => {
      const d = db()
      return delay(d.addons)
    },
  },

  pricing: {
    calc: async (body: { packageId: number; guests: number; serviceIds: number[]; addons: { addonId: number; qty: number }[]; storeId: number }) => {
      const d = db()
      const pkg = d.packages.find((p) => p.id === body.packageId)
      if (!pkg) return delay(null as unknown as Quote)
      const store = d.stores.find((s) => s.id === body.storeId)
      const coef = store?.discountCoefficient ?? 1
      const addons = body.addons
        .map((a) => {
          const addon = d.addons.find((x) => x.id === a.addonId)
          return addon ? { addon, qty: a.qty } : null
        })
        .filter(Boolean) as { addon: any; qty: number }[]
      const quote = calcQuote({ pkg, guests: body.guests, serviceIds: body.serviceIds, addons, discountCoefficient: coef })
      return delay(quote, 60)
    },
  },

  contracts: {
    list: async (params: { status?: string }) => {
      const d = db()
      let list = d.contracts
      if (params.status) list = list.filter((c) => c.status === params.status)
      return delay(list)
    },
    detail: async (id: number) => {
      const d = db()
      const c = d.contracts.find((x) => x.id === id)
      return delay(c!)
    },
    draft: async (body: { weddingId: number; packageId: number }) => {
      const d = db()
      const w = d.weddings.find((x) => x.id === body.weddingId)
      const pkg = d.packages.find((p) => p.id === body.packageId)
      if (!w || !pkg) return delay(null as unknown as Contract)
      const id = nextId(d, 'contracts')
      const contract: Contract = {
        id,
        weddingId: w.id,
        coupleName: w.coupleName,
        packageName: pkg.name,
        amount: w.quoteTotal ?? pkg.basePrice,
        status: 'DRAFT',
        clauses: [
          { id: 'c0', title: '一、服务内容', body: `乙方按甲方所选「${pkg.name}」提供婚礼策划及现场服务。` },
          { id: 'c1', title: '二、服务费用', body: `本项目服务总费用为 ${w.quoteTotal ?? pkg.basePrice} 元。` },
          { id: 'c2', title: '三、付款方式', body: '签订本合同时支付定金 30%，婚礼前 30 日支付尾款 70%。' },
          { id: 'c3', title: '四、档期约定', body: '甲方确认婚期后，乙方锁定人员、场地与道具档期。' },
          { id: 'c4', title: '五、违约责任', body: '违约方支付合同总额 20% 违约金；不可抗力除外。' },
        ],
        createdAt: new Date().toISOString(),
      }
      d.contracts.unshift(contract)
      commit(d)
      return delay(contract)
    },
    update: async (id: number, body: { clauses: Contract['clauses']; amount?: number }) => {
      const d = db()
      const c = d.contracts.find((x) => x.id === id)
      if (c) {
        c.clauses = body.clauses
        if (body.amount) c.amount = body.amount
        if (c.status === 'DRAFT') c.status = 'PENDING'
        commit(d)
      }
      return delay(c!)
    },
    sign: async (id: number, body: { signature: string }) => {
      const d = db()
      const c = d.contracts.find((x) => x.id === id)
      if (c) {
        c.signature = body.signature
        c.status = 'SIGNED' as ContractStatus
        c.signedAt = new Date().toISOString()
        commit(d)
      }
      return delay(c!, 400)
    },
    void: async (id: number) => {
      const d = db()
      const c = d.contracts.find((x) => x.id === id)
      if (c) {
        c.status = 'VOID'
        commit(d)
      }
      return delay(c!)
    },
  },

  followup: {
    detail: async (weddingId: number) => {
      const d = db()
      const w = d.weddings.find((x) => x.id === weddingId)
      const tasks = d.followTasks.filter((t) => t.weddingId === weddingId)
      return delay({
        wedding: w,
        countdown: w ? Math.ceil((new Date(w.weddingDate).getTime() - Date.now()) / 86400000) : 0,
        tasks,
      })
    },
    list: async () => {
      const d = db()
      return delay(d.followTasks)
    },
    updateTask: async (taskId: number, status: TaskStatus) => {
      const d = db()
      const t = d.followTasks.find((x) => x.id === taskId)
      if (t) {
        t.status = status
        commit(d)
      }
      return delay(t!)
    },
  },

  finance: {
    wedding: async (weddingId: number) => {
      const d = db()
      const f = d.finance.find((x) => x.weddingId === weddingId)
      return delay(f!)
    },
    monthly: async (storeId?: number) => {
      const d = db()
      return delay(d.finance.map((f) => ({ month: f.coupleName, revenue: f.income, cost: f.cost, profit: f.profit, weddings: 1 })))
    },
    overdue: async () => {
      const d = db()
      return delay(d.scheduleTasks.filter(() => false))
    },
  },

  reports: {
    revenue: async (params: { storeId?: number }) => {
      const d = db()
      return delay(d.weddings.map((w) => ({ date: w.weddingDate, amount: w.quoteTotal ?? 0 })))
    },
    funnel: async () => {
      const d = db()
      const stages: WeddingStage[] = ['CONSULT', 'DESIGN', 'CONTRACT', 'PREPARE', 'ONSITE', 'DELIVERY']
      const labels = ['咨询', '方案设计', '合同签订', '筹备执行', '现场督导', '后期交付']
      return delay(
        labels.map((stage, i) => ({
          stage,
          count: d.weddings.filter((w) => stages.indexOf(w.stage) >= i).length,
        })),
      )
    },
    satisfaction: async () => {
      return delay([
        { dimension: '策划专业', score: 4.7 },
        { dimension: '现场执行', score: 4.8 },
        { dimension: '人员配合', score: 4.5 },
        { dimension: '性价比', score: 4.3 },
        { dimension: '售后跟进', score: 4.6 },
      ])
    },
    summary: async () => {
      const d = db()
      const revenue = d.weddings.reduce((s, w) => s + (w.quoteTotal ?? 0), 0)
      const cost = d.finance.reduce((s, f) => s + f.cost, 0)
      return delay({
        revenue,
        cost,
        profit: revenue - cost,
        weddings: d.weddings.length,
        signed: d.contracts.filter((c) => c.status === 'SIGNED').length,
        conflictAlerts: 2,
        overdueReceivable: 80000,
      })
    },
  },

  portal: {
    schedule: async (supplierId: number) => {
      const d = db()
      return delay(d.scheduleTasks.filter((t) => t.resourceType === 'STAFF' && t.resourceId === supplierId))
    },
    orders: async (supplierId: number) => {
      const d = db()
      return delay(d.supplierOrders)
    },
    confirmOrder: async (id: number) => {
      const d = db()
      const o = d.supplierOrders.find((x) => x.id === id)
      if (o) {
        o.status = 'CONFIRMED'
        commit(d)
      }
      return delay(o!)
    },
    submitVoucher: async (id: number, body: { fileUrl: string }) => {
      const d = db()
      const o = d.supplierOrders.find((x) => x.id === id)
      if (o) {
        o.voucherUrl = body.fileUrl
        o.status = 'DONE'
        commit(d)
      }
      return delay(o!)
    },
  },

  settings: {
    list: async () => {
      const d = db()
      return delay({
        stores: d.stores,
        staff: d.staff,
        venues: d.venues,
        props: d.props,
        addons: d.addons,
      })
    },
    saveStore: async (store: any) => {
      const d = db()
      if (store.id) {
        const t = d.stores.find((s) => s.id === store.id)
        if (t) Object.assign(t, store)
      } else {
        d.stores.push({ ...store, id: nextId(d, 'stores') })
      }
      commit(d)
      return delay(store)
    },
  },
}

export type Handlers = typeof handlers
