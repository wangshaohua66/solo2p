import { apiClient } from './client';
import type {
  WorkOrder,
  Customer,
  Part,
  Movement,
  InspectionData,
  PaginatedResponse,
  WorkOrderListFilter,
  User,
  DashboardStats,
  PartUsage,
  Warranty,
  ServiceReportPDF
} from '@/types';

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post<{ token: string; refresh_token: string; user: User }>('/auth/login', {
      username,
      password
    }),
  logout: () => apiClient.post('/auth/logout'),
  me: () => apiClient.get<User>('/auth/me')
};

export const workOrderApi = {
  list: (params: {
    page?: number;
    pageSize?: number;
    filter?: WorkOrderListFilter;
  }) =>
    apiClient.post<PaginatedResponse<WorkOrder>>('/work-orders/list', {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      filter: params.filter ?? {}
    }),

  get: (id: number) => apiClient.get<WorkOrder>(`/work-orders/${id}`),

  create: (data: Partial<WorkOrder> & { customer?: Partial<Customer> }) =>
    apiClient.post<WorkOrder>('/work-orders', data),

  update: (id: number, data: Partial<WorkOrder>) =>
    apiClient.put<WorkOrder>(`/work-orders/${id}`, data),

  delete: (id: number) => apiClient.delete(`/work-orders/${id}`),

  changeStatus: (id: number, status: string, note?: string) =>
    apiClient.post<WorkOrder>(`/work-orders/${id}/status`, { status, note }),

  checkRepeatVisit: (caseSerial: string, customerName: string) =>
    apiClient.post<{ isRepeat: boolean; previousOrders: WorkOrder[] }>(
      '/work-orders/check-repeat',
      { caseSerial, customerName }
    ),

  generateQrToken: (orderNumber: string) =>
    apiClient.post<{ token: string; url: string }>('/work-orders/qr-token', {
      orderNumber
    }),

  uploadImage: (
    id: number,
    type: 'intake' | 'during' | 'after',
    file: File,
    onProgress?: (p: number) => void
  ) => apiClient.upload<{ id: number; url: string }>(`/work-orders/${id}/images/${type}`, file, onProgress),

  removeImage: (id: number, imageId: number) =>
    apiClient.delete(`/work-orders/${id}/images/${imageId}`),

  saveInspection: (id: number, data: InspectionData) =>
    apiClient.post<InspectionData>(`/work-orders/${id}/inspection`, data),

  addPartUsage: (id: number, data: { partId: number; quantity: number; batchNumber?: string }) =>
    apiClient.post<PartUsage>(`/work-orders/${id}/parts`, data),

  removePartUsage: (id: number, usageId: number) =>
    apiClient.delete(`/work-orders/${id}/parts/${usageId}`),

  calculateQuote: (id: number) =>
    apiClient.post<{ laborPrice: number; partsPrice: number; totalPrice: number; items: any[] }>(
      `/work-orders/${id}/calculate-quote`
    ),

  generateReport: (id: number) =>
    apiClient.post<ServiceReportPDF>(`/work-orders/${id}/report`),

  sendReportEmail: (id: number, email?: string) =>
    apiClient.post(`/work-orders/${id}/report/send-email`, { email })
};

export const customerApi = {
  list: (params?: { keyword?: string; page?: number; pageSize?: number }) =>
    apiClient.post<PaginatedResponse<Customer>>('/customers/list', {
      keyword: params?.keyword ?? '',
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 50
    }),

  get: (id: number) => apiClient.get<Customer>(`/customers/${id}`),

  create: (data: Partial<Customer>) => apiClient.post<Customer>('/customers', data),

  update: (id: number, data: Partial<Customer>) =>
    apiClient.put<Customer>(`/customers/${id}`, data),

  getHistory: (id: number) => apiClient.get<WorkOrder[]>(`/customers/${id}/orders`)
};

export const partsApi = {
  list: (params?: {
    keyword?: string;
    categoryId?: number;
    lowStock?: boolean;
    page?: number;
    pageSize?: number;
  }) =>
    apiClient.post<PaginatedResponse<Part>>('/parts/list', {
      keyword: params?.keyword ?? '',
      categoryId: params?.categoryId,
      lowStock: params?.lowStock ?? false,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 50
    }),

  get: (id: number) => apiClient.get<Part>(`/parts/${id}`),

  getByBarcode: (barcode: string) => apiClient.get<Part>(`/parts/barcode/${barcode}`),

  create: (data: Partial<Part>) => apiClient.post<Part>('/parts', data),

  update: (id: number, data: Partial<Part>) => apiClient.put<Part>(`/parts/${id}`, data),

  adjustStock: (id: number, data: { quantity: number; reason: string }) =>
    apiClient.post(`/parts/${id}/stock`, { delta: data.quantity, reason: data.reason }),

  restock: (id: number, data: { quantity: number; supplier?: string; cost?: number }) =>
    apiClient.post(`/parts/${id}/stock`, { delta: data.quantity, reason: '补货：' + (data.supplier ?? '未知供应商') }),

  lowStock: () => apiClient.get<Part[]>('/parts/low-stock'),

  categories: () => apiClient.get<any[]>('/parts/categories')
};

export const movementApi = {
  list: (params?: { keyword?: string; brand?: string; page?: number; pageSize?: number }) =>
    apiClient.post<PaginatedResponse<Movement>>('/movements/list', {
      keyword: params?.keyword ?? '',
      brand: params?.brand,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 50
    }),

  get: (id: number) => apiClient.get<Movement>(`/movements/${id}`),

  getByCode: (code: string) => apiClient.get<Movement>(`/movements/code/${code}`),

  allBrands: () => apiClient.get<string[]>('/movements/brands')
};

export const dashboardApi = {
  stats: () => apiClient.get<DashboardStats>('/dashboard/overview')
};

export const warrantyApi = {
  upcoming: (days?: number) =>
    apiClient.get<Warranty[]>(`/warranty/expiring?withinDays=${days ?? 60}`),
  list: (params?: { customerId?: number; status?: string }) =>
    apiClient.post<PaginatedResponse<Warranty>>('/warranty/expiring?withinDays=' + (params?.customerId ? 365 : 60), params ?? {})
};
