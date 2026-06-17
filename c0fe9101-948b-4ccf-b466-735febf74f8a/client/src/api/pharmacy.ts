import { get, post } from '@/utils/request'
import type { ApiResponse, PaginatedResponse, Medicine, Prescription, StockLog } from '@/types'

export const pharmacyApi = {
  getMedicines: (params?: any) =>
    get<ApiResponse<PaginatedResponse<Medicine>>>('/api/pharmacy/medicines', params),
  getLowStock: (hospitalId?: number) =>
    get<ApiResponse<Medicine[]>>('/api/pharmacy/medicines/low-stock', { hospital_id: hospitalId }),
  createMedicine: (data: any) =>
    post<ApiResponse<Medicine>>('/api/pharmacy/medicines', data),
  updateStock: (id: number, data: { quantity_change: number; change_type: string; remark?: string }) =>
    post<ApiResponse<StockLog>>(`/api/pharmacy/medicines/${id}/stock`, data),
  getPrescriptions: (params?: any) =>
    get<ApiResponse<PaginatedResponse<Prescription>>>('/api/pharmacy/prescriptions', params),
  createPrescription: (data: any) =>
    post<ApiResponse<Prescription>>('/api/pharmacy/prescriptions', data),
  approvePrescription: (id: number, level: 1 | 2 = 1) =>
    post<ApiResponse<Prescription>>(`/api/pharmacy/prescriptions/${id}/approve`, { level }),
  dispensePrescription: (id: number) =>
    post<ApiResponse<Prescription>>(`/api/pharmacy/prescriptions/${id}/dispense`),
  getStockLogs: (params?: any) =>
    get<ApiResponse<PaginatedResponse<StockLog>>>('/api/pharmacy/stock-logs', params)
}
