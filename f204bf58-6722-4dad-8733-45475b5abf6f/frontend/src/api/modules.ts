import service, { ApiResponse, PageResult } from './index'
import type {
  User, SimpleUser, Client, Case, Party, Trial, Evidence,
  Contract, WorkLog, Settlement, Invoice, DocumentTemplate, GeneratedDocument
} from '@/types'

export const authApi = {
  login: (username: string, password: string): Promise<ApiResponse<{ access: string; refresh: string; user: User }>> =>
    service.post('/auth/login/', { username, password }),
  refresh: (refresh: string): Promise<ApiResponse<{ access: string }>> =>
    service.post('/auth/refresh/', { refresh })
}

export const userApi = {
  me: (): Promise<ApiResponse<User>> => service.get('/users/me/'),
  list: (params?: any): Promise<ApiResponse<PageResult<User>>> => service.get('/users/', { params }),
  create: (data: any): Promise<ApiResponse<User>> => service.post('/users/', data),
  update: (id: number, data: any): Promise<ApiResponse<User>> => service.put(`/users/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/users/${id}/`),
  lawyers: (): Promise<ApiResponse<SimpleUser[]>> => service.get('/users/lawyers/'),
  assistants: (): Promise<ApiResponse<SimpleUser[]>> => service.get('/users/assistants/'),
  simpleList: (): Promise<ApiResponse<any[]>> => service.get('/users/simple_list/'),
  changePassword: (id: number, data: { old_password: string; new_password: string; confirm_password: string }) =>
    service.post(`/users/${id}/change_password/`, data)
}

export const caseApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<Case>>> => service.get('/cases/', { params }),
  detail: (id: number): Promise<ApiResponse<Case>> => service.get(`/cases/${id}/`),
  create: (data: any): Promise<ApiResponse<Case>> => service.post('/cases/', data),
  update: (id: number, data: any): Promise<ApiResponse<Case>> => service.put(`/cases/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/cases/${id}/`),
  statistics: (): Promise<ApiResponse<any>> => service.get('/cases/statistics/'),
  warningList: (params?: any): Promise<ApiResponse<any[]>> => service.get('/cases/warning_list/', { params }),
  assignLawyer: (id: number, data: { lead_lawyer?: number; assistant?: number; lawyers?: number[] }) =>
    service.post(`/cases/${id}/assign_lawyer/`, data),
  changeStatus: (id: number, data: { status: string; description?: string }) =>
    service.post(`/cases/${id}/change_status/`, data),
  progressTimeline: (id: number): Promise<ApiResponse<any[]>> => service.get(`/cases/${id}/progress_timeline/`)
}

export const trialApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<Trial>>> => service.get('/cases/trials/', { params }),
  detail: (id: number): Promise<ApiResponse<Trial>> => service.get(`/cases/trials/${id}/`),
  create: (data: any): Promise<ApiResponse<Trial>> => service.post('/cases/trials/', data),
  update: (id: number, data: any): Promise<ApiResponse<Trial>> => service.put(`/cases/trials/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/cases/trials/${id}/`),
  checkConflict: (data: any): Promise<ApiResponse<{ has_conflict: boolean; conflicts: any[]; available_lawyers: any[] }>> =>
    service.post('/cases/trials/check_conflict/', data),
  calendar: (params?: any): Promise<ApiResponse<any[]>> => service.get('/cases/trials/calendar_data/', { params })
}

export const evidenceApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<Evidence>>> => service.get('/cases/evidences/', { params }),
  detail: (id: number): Promise<ApiResponse<Evidence>> => service.get(`/cases/evidences/${id}/`),
  create: (data: FormData): Promise<ApiResponse<Evidence>> => service.post('/cases/evidences/', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id: number, data: any): Promise<ApiResponse<Evidence>> => service.put(`/cases/evidences/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/cases/evidences/${id}/`),
  borrow: (id: number, data: any): Promise<ApiResponse<Evidence>> => service.post(`/cases/evidences/${id}/borrow/`, data),
  return: (id: number, data?: any): Promise<ApiResponse<Evidence>> => service.post(`/cases/evidences/${id}/return_evidence/`, data),
  markLost: (id: number): Promise<ApiResponse<Evidence>> => service.post(`/cases/evidences/${id}/mark_lost/`),
  flowLog: (id: number): Promise<ApiResponse<any[]>> => service.get(`/cases/evidences/${id}/flow_log/`),
  alerts: (params?: any): Promise<ApiResponse<any[]>> => service.get('/cases/evidences/alerts/', { params }),
  batchUpload: (formData: FormData): Promise<ApiResponse<any>> => service.post('/cases/evidences/batch_upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  ocrRecognize: (id: number, data?: { lang?: string }): Promise<ApiResponse<any>> =>
    service.post(`/cases/evidences/${id}/ocr_recognize/`, data || {}),
  addWatermark: (id: number, data?: { text?: string; opacity?: number; position?: string }): Promise<ApiResponse<any>> =>
    service.post(`/cases/evidences/${id}/add_watermark/`, data || {})
}

export const clientApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<Client>>> => service.get('/clients/', { params }),
  detail: (id: number): Promise<ApiResponse<Client>> => service.get(`/clients/${id}/`),
  create: (data: any): Promise<ApiResponse<Client>> => service.post('/clients/', data),
  update: (id: number, data: any): Promise<ApiResponse<Client>> => service.put(`/clients/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/clients/${id}/`),
  simpleList: (): Promise<ApiResponse<any[]>> => service.get('/clients/simple_list/'),
  statistics: (): Promise<ApiResponse<any>> => service.get('/clients/statistics/'),
  enablePortal: (id: number, data: any): Promise<ApiResponse<any>> => service.post(`/clients/${id}/enable_portal/`, data),
  disablePortal: (id: number): Promise<ApiResponse<any>> => service.post(`/clients/${id}/disable_portal/`)
}

export const contractApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<Contract>>> => service.get('/clients/contracts/', { params }),
  detail: (id: number): Promise<ApiResponse<Contract>> => service.get(`/clients/contracts/${id}/`),
  create: (data: any): Promise<ApiResponse<Contract>> => service.post('/clients/contracts/', data),
  update: (id: number, data: any): Promise<ApiResponse<Contract>> => service.put(`/clients/contracts/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/clients/contracts/${id}/`),
  approve: (id: number, data: { approved: boolean; note?: string }): Promise<ApiResponse<any>> =>
    service.post(`/clients/contracts/${id}/approve/`, data),
  recordPayment: (id: number, data: any): Promise<ApiResponse<any>> =>
    service.post(`/clients/contracts/${id}/record_payment/`, data),
  expiringSoon: (params?: { days?: number }): Promise<ApiResponse<Contract[]>> =>
    service.get('/clients/contracts/expiring_soon/', { params })
}

export const workLogApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<WorkLog>>> => service.get('/billing/work-logs/', { params }),
  detail: (id: number): Promise<ApiResponse<WorkLog>> => service.get(`/billing/work-logs/${id}/`),
  create: (data: any): Promise<ApiResponse<WorkLog>> => service.post('/billing/work-logs/', data),
  update: (id: number, data: any): Promise<ApiResponse<WorkLog>> => service.put(`/billing/work-logs/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/billing/work-logs/${id}/`),
  myLogs: (): Promise<ApiResponse<WorkLog[]>> => service.get('/billing/work-logs/my_logs/'),
  summary: (params?: any): Promise<ApiResponse<any>> => service.get('/billing/work-logs/summary/', { params }),
  submit: (id: number): Promise<ApiResponse<any>> => service.post(`/billing/work-logs/${id}/submit/`),
  approve: (id: number, data: any): Promise<ApiResponse<any>> => service.post(`/billing/work-logs/${id}/approve/`, data),
  batchApprove: (data: { ids: number[]; approved: boolean; note?: string }): Promise<ApiResponse<any>> =>
    service.post('/billing/work-logs/batch_approve/', data)
}

export const settlementApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<Settlement>>> => service.get('/billing/settlements/', { params }),
  detail: (id: number): Promise<ApiResponse<Settlement>> => service.get(`/billing/settlements/${id}/`),
  create: (data: any): Promise<ApiResponse<Settlement>> => service.post('/billing/settlements/', data),
  update: (id: number, data: any): Promise<ApiResponse<Settlement>> => service.put(`/billing/settlements/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/billing/settlements/${id}/`),
  statistics: (): Promise<ApiResponse<any>> => service.get('/billing/settlements/statistics/'),
  approve: (id: number, data: any): Promise<ApiResponse<any>> => service.post(`/billing/settlements/${id}/approve/`, data),
  recordPayment: (id: number, data: { amount: number }): Promise<ApiResponse<any>> =>
    service.post(`/billing/settlements/${id}/record_payment/`, data),
  overdueList: (): Promise<ApiResponse<any[]>> => service.get('/billing/settlements/overdue_list/')
}

export const invoiceApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<Invoice>>> => service.get('/billing/invoices/', { params }),
  detail: (id: number): Promise<ApiResponse<Invoice>> => service.get(`/billing/invoices/${id}/`),
  create: (data: any): Promise<ApiResponse<Invoice>> => service.post('/billing/invoices/', data),
  update: (id: number, data: any): Promise<ApiResponse<Invoice>> => service.put(`/billing/invoices/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/billing/invoices/${id}/`),
  statistics: (): Promise<ApiResponse<any>> => service.get('/billing/invoices/statistics/'),
  markSent: (id: number, data?: any): Promise<ApiResponse<any>> => service.post(`/billing/invoices/${id}/mark_sent/`, data),
  voidInvoice: (id: number): Promise<ApiResponse<any>> => service.post(`/billing/invoices/${id}/void_invoice/`)
}

export const templateApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<DocumentTemplate>>> => service.get('/documents/templates/', { params }),
  detail: (id: number): Promise<ApiResponse<DocumentTemplate>> => service.get(`/documents/templates/${id}/`),
  create: (data: any): Promise<ApiResponse<DocumentTemplate>> => service.post('/documents/templates/', data),
  update: (id: number, data: any): Promise<ApiResponse<DocumentTemplate>> => service.put(`/documents/templates/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/documents/templates/${id}/`),
  byCategory: (): Promise<ApiResponse<any[]>> => service.get('/documents/templates/by_category/'),
  generate: (data: { template_id: number; case_id?: number; client_id?: number; doc_title?: string; custom_fields?: any }) =>
    service.post('/documents/templates/generate/', data),
  rate: (id: number, data: { rating?: number }): Promise<ApiResponse<any>> => service.post(`/documents/templates/${id}/rate/`, data)
}

export const docApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<GeneratedDocument>>> => service.get('/documents/generated/', { params }),
  detail: (id: number): Promise<ApiResponse<GeneratedDocument>> => service.get(`/documents/generated/${id}/`),
  create: (data: any): Promise<ApiResponse<GeneratedDocument>> => service.post('/documents/generated/', data),
  update: (id: number, data: any): Promise<ApiResponse<GeneratedDocument>> => service.put(`/documents/generated/${id}/`, data),
  delete: (id: number): Promise<ApiResponse<any>> => service.delete(`/documents/generated/${id}/`),
  newVersion: (id: number, data?: { content?: string; html_content?: string }) =>
    service.post(`/documents/generated/${id}/new_version/`, data),
  review: (id: number, data: { approved: boolean; note?: string }) =>
    service.post(`/documents/generated/${id}/review/`, data),
  shareToClient: (id: number, data?: { email?: string }): Promise<ApiResponse<any>> =>
    service.post(`/documents/generated/${id}/share_to_client/`, data),
  markFinal: (id: number): Promise<ApiResponse<any>> => service.post(`/documents/generated/${id}/mark_final/`)
}

export const notificationApi = {
  list: (params?: any): Promise<ApiResponse<PageResult<any>>> => service.get('/notifications/', { params }),
  detail: (id: number): Promise<ApiResponse<any>> => service.get(`/notifications/${id}/`),
  unread: (): Promise<ApiResponse<{ unread_count: number; recent: any[] }>> => service.get('/notifications/unread/'),
  markRead: (id: number): Promise<ApiResponse<any>> => service.post(`/notifications/${id}/mark_read/`),
  markAllRead: (): Promise<ApiResponse<any>> => service.post('/notifications/mark_all_read/'),
  pushLimitation: (): Promise<ApiResponse<any>> => service.post('/notifications/push_limitation/'),
  testPush: (channels?: string[]): Promise<ApiResponse<any>> =>
    service.post('/notifications/test_push/', { channels: channels || ['in_app'] })
}
