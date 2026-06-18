import http, { downloadBlob } from '@/utils/http'
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
  Notification,
} from '@/types'

export const authApi = {
  login: (body: { username: string; password: string; role: string }) =>
    http.post<unknown, { token: string; user: User }>('/auth/login', body),
  supplierLogin: (body: { phone: string; code: string }) =>
    http.post<unknown, { token: string; supplier: any }>('/auth/supplier/login', body),
}

export const scheduleApi = {
  list: (params: { resourceType?: string; storeId?: number; from?: string; to?: string }) =>
    http.get<unknown, ScheduleTask[]>('/schedule', { params }),
  check: (body: { resourceType: 'STAFF' | 'VENUE' | 'PROP'; resourceId: number; storeId: number; start: string; end: string }) =>
    http.post<unknown, ConflictResult>('/schedule/check', body),
  move: (taskId: number, body: { start: string; end: string }) =>
    http.put<unknown, ScheduleTask>(`/schedule/${taskId}`, body),
  remove: (taskId: number) => http.delete<unknown, { id: number }>(`/schedule/${taskId}`),
}

export const weddingApi = {
  list: (params: { stage?: string; storeId?: number; date?: string; keyword?: string }) =>
    http.get<unknown, Wedding[]>('/weddings', { params }),
  detail: (id: number) => http.get<unknown, Wedding>(`/weddings/${id}`),
  create: (body: Partial<Wedding> & { resources?: { type: string; id: number }[] }) =>
    http.post<unknown, Wedding>('/weddings', body),
  updateStage: (id: number, stage: WeddingStage) =>
    http.put<unknown, Wedding>(`/weddings/${id}/stage`, null, { params: { stage } }),
}

export const packageApi = {
  list: () => http.get<unknown, Package[]>('/packages'),
  save: (pkg: any) => http.post<unknown, any>('/packages', pkg),
}

export const addonApi = {
  list: () => http.get<unknown, Addon[]>('/addons'),
}

export const pricingApi = {
  calc: (body: { packageId: number; guests: number; serviceIds: number[]; addons: { addonId: number; qty: number }[]; storeId: number }) =>
    http.post<unknown, Quote>('/pricing/calc', body),
}

export const contractApi = {
  list: (params: { status?: string }) => http.get<unknown, Contract[]>('/contracts', { params }),
  detail: (id: number) => http.get<unknown, Contract>(`/contracts/${id}`),
  draft: (body: { weddingId: number; packageId: number }) => http.post<unknown, Contract>('/contracts/draft', body),
  update: (id: number, body: { clauses: ContractClause[]; amount?: number }) =>
    http.put<unknown, Contract>(`/contracts/${id}`, body),
  sign: (id: number, body: { signature: string }) => http.post<unknown, Contract>(`/contracts/${id}/sign`, body),
  void: (id: number) => http.post<unknown, Contract>(`/contracts/${id}/void`),
  querySignStatus: (id: number, flowId: string) =>
    http.get<unknown, { flowId: string; signUrl: string; status: string; message: string }>(`/contracts/${id}/sign-status`, { params: { flowId } }),
  downloadSignedFile: (id: number, flowId: string) =>
    http.get<unknown, string>(`/contracts/${id}/signed-file`, { params: { flowId } }),
}

export const followupApi = {
  detail: (weddingId: number) =>
    http.get<unknown, { wedding: Wedding | undefined; countdown: number; tasks: FollowTask[] }>(`/followup/${weddingId}`),
  list: () => http.get<unknown, FollowTask[]>('/followup/tasks'),
  updateTask: (taskId: number, status: TaskStatus) =>
    http.put<unknown, FollowTask>(`/followup/tasks/${taskId}`, { status }),
}

export const financeApi = {
  wedding: (weddingId: number) => http.get<unknown, FinanceDetail>(`/finance/wedding/${weddingId}`),
  monthly: (storeId?: number) => http.get<unknown, any[]>('/finance/monthly', { params: { storeId } }),
  overdue: () => http.get<unknown, any[]>('/finance/overdue'),
}

export const reportApi = {
  revenue: (params: { storeId?: number }) => http.get<unknown, { date: string; amount: number }[]>('/reports/revenue', { params }),
  funnel: () => http.get<unknown, { stage: string; count: number }[]>('/reports/funnel'),
  satisfaction: () => http.get<unknown, { dimension: string; score: number }[]>('/reports/satisfaction'),
  summary: () =>
    http.get<unknown, { revenue: number; cost: number; profit: number; weddings: number; signed: number; conflictAlerts: number; overdueReceivable: number }>('/reports/summary'),
}

export const portalApi = {
  schedule: (supplierId: number) => http.get<unknown, ScheduleTask[]>(`/portal/schedule/${supplierId}`),
  orders: (supplierId: number) => http.get<unknown, SupplierOrder[]>(`/portal/orders/${supplierId}`),
  confirmOrder: (id: number) => http.post<unknown, SupplierOrder>(`/portal/orders/${id}/confirm`),
  submitVoucher: (id: number, body: { fileUrl: string }) =>
    http.post<unknown, SupplierOrder>(`/portal/orders/${id}/voucher`, body),
}

export const settingsApi = {
  list: () => http.get<unknown, any>('/settings'),
  saveStore: (store: any) => http.post<unknown, any>('/settings/store', store),
}

export const exportApi = {
  financeExcel: (storeId?: number) => downloadBlob(`/export/finance?${storeId ? 'storeId=' + storeId : ''}`, '财务汇总.xlsx'),
  weddingsExcel: (storeId?: number, stage?: string) => {
    const params = new URLSearchParams()
    if (storeId) params.set('storeId', String(storeId))
    if (stage) params.set('stage', stage)
    const qs = params.toString()
    return downloadBlob(`/export/weddings${qs ? '?' + qs : ''}`, '婚礼列表.xlsx')
  },
  reportExcel: (storeId?: number) => downloadBlob(`/export/report?${storeId ? 'storeId=' + storeId : ''}`, '经营报表.xlsx'),
  contractPdf: (id: number) => downloadBlob(`/export/contract/${id}`, `合同-${id}.pdf`),
}

export const notificationApi = {
  list: () => http.get<unknown, Notification[]>('/notifications'),
  unreadCount: () => http.get<unknown, { count: number }>('/notifications/unread-count'),
  markRead: (id: number) => http.put<unknown, void>(`/notifications/${id}/read`),
  markAllRead: () => http.put<unknown, void>('/notifications/read-all'),
  sseUrl: () => {
    const token = localStorage.getItem('ws_token')
    return `/api/notifications/sse${token ? '?token=' + encodeURIComponent(token) : ''}`
  },
}
