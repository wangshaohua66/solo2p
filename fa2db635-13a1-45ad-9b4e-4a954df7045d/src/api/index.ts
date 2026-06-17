import { handlers } from '@/mock/handlers'
import type {
  Wedding,
  ScheduleTask,
  Contract,
  FollowTask,
  Quote,
  ConflictResult,
  Package,
  Addon,
  FinanceDetail,
  SupplierOrder,
  User,
  WeddingStage,
  TaskStatus,
  ContractClause,
} from '@/types'

function unwrap<T>(p: Promise<{ code: number; message: string; data: T }>): Promise<T> {
  return p.then((r) => r.data)
}

export const authApi = {
  login: (body: { username: string; password: string; role: string }) =>
    unwrap<{ token: string; user: User }>(handlers.auth.login(body)),
  supplierLogin: (body: { phone: string; code: string }) =>
    unwrap<{ token: string; supplier: any }>(handlers.auth.supplierLogin(body)),
}

export const scheduleApi = {
  list: (params: { resourceType?: string; storeId?: number; from?: string; to?: string }) =>
    unwrap<ScheduleTask[]>(handlers.schedule.list(params)),
  check: (body: { resourceType: 'STAFF' | 'VENUE' | 'PROP'; resourceId: number; storeId: number; start: string; end: string }) =>
    unwrap<ConflictResult>(handlers.schedule.check(body)),
  move: (taskId: number, body: { start: string; end: string }) =>
    unwrap<ScheduleTask>(handlers.schedule.move(taskId, body)),
  remove: (taskId: number) => unwrap<{ id: number }>(handlers.schedule.remove(taskId)),
}

export const weddingApi = {
  list: (params: { stage?: string; storeId?: number; date?: string; keyword?: string }) =>
    unwrap<Wedding[]>(handlers.weddings.list(params)),
  detail: (id: number) => unwrap<Wedding>(handlers.weddings.detail(id)),
  create: (body: Partial<Wedding> & { resources?: { type: string; id: number }[] }) =>
    unwrap<Wedding>(handlers.weddings.create(body)),
  updateStage: (id: number, stage: WeddingStage) => unwrap<Wedding>(handlers.weddings.updateStage(id, stage)),
}

export const packageApi = {
  list: () => unwrap<Package[]>(handlers.packages.list()),
  save: (pkg: any) => unwrap<any>(handlers.packages.save(pkg)),
}

export const addonApi = {
  list: () => unwrap<Addon[]>(handlers.addons.list()),
}

export const pricingApi = {
  calc: (body: { packageId: number; guests: number; serviceIds: number[]; addons: { addonId: number; qty: number }[]; storeId: number }) =>
    unwrap<Quote>(handlers.pricing.calc(body)),
}

export const contractApi = {
  list: (params: { status?: string }) => unwrap<Contract[]>(handlers.contracts.list(params)),
  detail: (id: number) => unwrap<Contract>(handlers.contracts.detail(id)),
  draft: (body: { weddingId: number; packageId: number }) => unwrap<Contract>(handlers.contracts.draft(body)),
  update: (id: number, body: { clauses: ContractClause[]; amount?: number }) =>
    unwrap<Contract>(handlers.contracts.update(id, body)),
  sign: (id: number, body: { signature: string }) => unwrap<Contract>(handlers.contracts.sign(id, body)),
  void: (id: number) => unwrap<Contract>(handlers.contracts.void(id)),
}

export const followupApi = {
  detail: (weddingId: number) =>
    unwrap<{ wedding: Wedding | undefined; countdown: number; tasks: FollowTask[] }>(handlers.followup.detail(weddingId)),
  list: () => unwrap<FollowTask[]>(handlers.followup.list()),
  updateTask: (taskId: number, status: TaskStatus) => unwrap<FollowTask>(handlers.followup.updateTask(taskId, status)),
}

export const financeApi = {
  wedding: (weddingId: number) => unwrap<FinanceDetail>(handlers.finance.wedding(weddingId)),
  monthly: (storeId?: number) => unwrap<any[]>(handlers.finance.monthly(storeId)),
  overdue: () => unwrap<any[]>(handlers.finance.overdue()),
}

export const reportApi = {
  revenue: (params: { storeId?: number }) => unwrap<{ date: string; amount: number }[]>(handlers.reports.revenue(params)),
  funnel: () => unwrap<{ stage: string; count: number }[]>(handlers.reports.funnel()),
  satisfaction: () => unwrap<{ dimension: string; score: number }[]>(handlers.reports.satisfaction()),
  summary: () =>
    unwrap<{ revenue: number; cost: number; profit: number; weddings: number; signed: number; conflictAlerts: number; overdueReceivable: number }>(
      handlers.reports.summary(),
    ),
}

export const portalApi = {
  schedule: (supplierId: number) => unwrap<ScheduleTask[]>(handlers.portal.schedule(supplierId)),
  orders: (supplierId: number) => unwrap<SupplierOrder[]>(handlers.portal.orders(supplierId)),
  confirmOrder: (id: number) => unwrap<SupplierOrder>(handlers.portal.confirmOrder(id)),
  submitVoucher: (id: number, body: { fileUrl: string }) =>
    unwrap<SupplierOrder>(handlers.portal.submitVoucher(id, body)),
}

export const settingsApi = {
  list: () => unwrap<any>(handlers.settings.list()),
  saveStore: (store: any) => unwrap<any>(handlers.settings.saveStore(store)),
}
