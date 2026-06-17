import axios, { AxiosError, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import type {
  LoginRequest,
  LoginResponse,
  User,
  Equipment,
  EquipmentStats,
  EquipmentCreateRequest,
  EquipmentUpdateRequest,
  Booking,
  BookingCreateRequest,
  BookingSeriesRequest,
  ConflictCheckResponse,
  WaitlistRequest,
  Billing,
  Maintenance,
  MaintenanceCreateRequest,
  MaintenanceUpdateRequest,
  DashboardStats,
  Notification,
  UnreadCount,
  AuditLog,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  FieldDiff,
  BillingFilter,
  AuditLogFilter
} from '@/types'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      window.location.href = '/login'
      ElMessage.error('登录已过期，请重新登录')
    } else if (error.response?.status === 403) {
      ElMessage.error('权限不足')
    } else if (error.response?.status === 404) {
      ElMessage.error('请求的资源不存在')
    } else if (error.response?.status === 500) {
      ElMessage.error('服务器错误')
    } else if (error.response?.status === 400) {
      const data = error.response.data as any
      ElMessage.error(data?.message || data?.error || '请求参数错误')
    } else if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时')
    } else if (!error.response) {
      ElMessage.error('网络错误，请检查网络连接')
    }
    return Promise.reject(error)
  }
)

const handleError = (error: unknown): never => {
  if (error instanceof AxiosError) {
    throw error
  }
  ElMessage.error('未知错误')
  throw new Error('Unknown error')
}

export const extractData = <T>(response: AxiosResponse<ApiResponse<T>>): T => {
  if (response.data.code !== undefined && response.data.code !== 200) {
    ElMessage.error(response.data.message || '请求失败')
    throw new Error(response.data.message || 'Request failed')
  }
  return response.data.data
}

export const auth = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    try {
      const response = await request.post<LoginResponse>('/auth/login', data)
      return response.data
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  logout: async (): Promise<{ message: string }> => {
    try {
      const response = await request.post<{ message: string }>('/auth/logout')
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      return response.data
    } catch (error) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      handleError(error)
      throw error
    }
  },

  getCurrentUser: async (): Promise<User> => {
    try {
      const response = await request.get<User>('/auth/me')
      return response.data
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  refreshToken: async (token: string): Promise<{ token: string }> => {
    try {
      const response = await request.post<{ token: string }>('/auth/refresh', { token })
      return response.data
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

export const equipment = {
  getList: async (params?: {
    centerId?: string
    category?: string
    status?: string
    page?: number
    pageSize?: number
  }): Promise<PaginatedResponse<Equipment>> => {
    try {
      const response = await request.get<ApiResponse<PaginatedResponse<Equipment>>>('/equipment', { params })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getDetail: async (id: number): Promise<Equipment & { currentUser?: string; nextFreeTime?: string }> => {
    try {
      const response = await request.get<ApiResponse<Equipment & { currentUser?: string; nextFreeTime?: string }>>(`/equipment/${id}`)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  create: async (data: EquipmentCreateRequest): Promise<Equipment> => {
    try {
      const response = await request.post<ApiResponse<Equipment>>('/equipment', data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  update: async (id: number, data: EquipmentUpdateRequest): Promise<Equipment> => {
    try {
      const response = await request.put<ApiResponse<Equipment>>(`/equipment/${id}`, data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  updateStatus: async (id: number, data: { status: string; remark?: string }): Promise<Equipment> => {
    try {
      const response = await request.patch<ApiResponse<Equipment>>(`/equipment/${id}/status`, data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getStats: async (id: number, params?: { startTime?: string; endTime?: string }): Promise<EquipmentStats[]> => {
    try {
      const response = await request.get<ApiResponse<EquipmentStats[]>>(`/equipment/${id}/stats`, { params })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

export const booking = {
  getList: async (params?: {
    equipmentId?: number
    userId?: number
    startTime?: string
    endTime?: string
    status?: string
    page?: number
    pageSize?: number
  }): Promise<PaginatedResponse<Booking>> => {
    try {
      const response = await request.get<ApiResponse<PaginatedResponse<Booking>>>('/bookings', { params })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  create: async (data: BookingCreateRequest): Promise<Booking> => {
    try {
      const response = await request.post<ApiResponse<Booking>>('/bookings', data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  createSeries: async (data: BookingSeriesRequest): Promise<Booking[]> => {
    try {
      const response = await request.post<ApiResponse<Booking[]>>('/bookings/series', data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  cancel: async (id: number, reason?: string): Promise<{ message: string }> => {
    try {
      const response = await request.post<ApiResponse<{ message: string }>>(`/bookings/${id}/cancel`, { reason })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  checkConflict: async (params: {
    equipmentId: number
    startTime: string
    endTime: string
  }): Promise<ConflictCheckResponse> => {
    try {
      const response = await request.get<ApiResponse<ConflictCheckResponse>>('/bookings/conflict', { params })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  addWaitlist: async (data: WaitlistRequest): Promise<{ position: number; equipmentId: number; userId: number }> => {
    try {
      const response = await request.post<ApiResponse<{ position: number; equipmentId: number; userId: number }>>('/bookings/waitlist', data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

export const billing = {
  getList: async (params?: BillingFilter & PaginationParams): Promise<PaginatedResponse<Billing>> => {
    try {
      const response = await request.get<ApiResponse<PaginatedResponse<Billing>>>('/billing', { params })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getDetail: async (id: number): Promise<Billing> => {
    try {
      const response = await request.get<ApiResponse<Billing>>(`/billing/${id}`)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  exportReport: async (data: { year: number; month: number }): Promise<Blob> => {
    try {
      const response = await request.post('/billing/export', data, {
        responseType: 'blob'
      })
      return response.data
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getBudget: async (): Promise<{ userId: number; budget: number }> => {
    try {
      const response = await request.get<ApiResponse<{ userId: number; budget: number }>>('/billing/budget')
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  updateBudget: async (data: { userId: number; amount: number; remark?: string }): Promise<{ userId: number; newBudget: number; amount: number }> => {
    try {
      const response = await request.post<ApiResponse<{ userId: number; newBudget: number; amount: number }>>('/billing/budget', data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

export const maintenance = {
  getList: async (params?: {
    equipmentId?: number
    startTime?: string
    endTime?: string
    status?: string
    page?: number
    pageSize?: number
  }): Promise<PaginatedResponse<Maintenance>> => {
    try {
      const response = await request.get<ApiResponse<PaginatedResponse<Maintenance>>>('/maintenance', { params })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  create: async (data: MaintenanceCreateRequest): Promise<Maintenance> => {
    try {
      const response = await request.post<ApiResponse<Maintenance>>('/maintenance', data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  update: async (id: number, data: MaintenanceUpdateRequest): Promise<Maintenance> => {
    try {
      const response = await request.put<ApiResponse<Maintenance>>(`/maintenance/${id}`, data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  complete: async (id: number, remark?: string): Promise<Maintenance> => {
    try {
      const response = await request.post<ApiResponse<Maintenance>>(`/maintenance/${id}/complete`, { remark })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  cancel: async (id: number): Promise<{ message: string }> => {
    try {
      const response = await request.delete<ApiResponse<{ message: string }>>(`/maintenance/${id}`)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

export const stats = {
  getDashboard: async (): Promise<DashboardStats> => {
    try {
      const response = await request.get<ApiResponse<{ series: Array<{ value: number; name: string; unit?: string }> }>>('/stats/dashboard')
      const data = extractData(response)
      const series = data.series
      return {
        totalEquipment: series.find(s => s.name === '设备总数')?.value || 0,
        todayBookings: series.find(s => s.name === '今日预约')?.value || 0,
        monthlyUtilization: series.find(s => s.name === '本月利用率')?.value || 0,
        pendingCount: series.find(s => s.name === '待处理')?.value || 0
      }
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getUtilization: async (params?: {
    dimension?: string
    timeDimension?: string
    startDate?: string
    endDate?: string
    centerId?: string
    category?: string
  }): Promise<{ xAxis: string[]; series: Array<{ name: string; type: string; data: number[]; yAxisIndex?: number }> }> => {
    try {
      const response = await request.get<ApiResponse<{ xAxis: { data: string[] }; series: Array<{ name: string; type: string; data: number[]; yAxisIndex?: number }> }>>('/stats/utilization', { params })
      const data = extractData(response)
      return {
        xAxis: data.xAxis.data,
        series: data.series
      }
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getPeakValley: async (params?: { startDate?: string; endDate?: string }): Promise<{ xAxis: number[]; series: Array<{ name: string; type: string; data: number[] }> }> => {
    try {
      const response = await request.get<ApiResponse<{ xAxis: { data: number[] }; series: Array<{ name: string; type: string; data: number[] }> }>>('/stats/peak-valley', { params })
      const data = extractData(response)
      return {
        xAxis: data.xAxis.data,
        series: data.series
      }
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getTrend: async (params?: { days?: number }): Promise<{ xAxis: string[]; series: Array<{ name: string; type: string; data: number[]; yAxisIndex?: number }> }> => {
    try {
      const response = await request.get<ApiResponse<{ xAxis: { data: string[] }; series: Array<{ name: string; type: string; data: number[]; yAxisIndex?: number }> }>>('/stats/trend', { params })
      const data = extractData(response)
      return {
        xAxis: data.xAxis.data,
        series: data.series
      }
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getRanking: async (params?: { limit?: number; startDate?: string; endDate?: string }): Promise<{ xAxis: string[]; series: Array<{ name: string; type: string; data: number[] }> }> => {
    try {
      const response = await request.get<ApiResponse<{ yAxis: { data: string[] }; series: Array<{ name: string; type: string; data: number[] }> }>>('/stats/ranking', { params })
      const data = extractData(response)
      return {
        xAxis: data.yAxis.data,
        series: data.series
      }
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getCenterStats: async (params?: { startDate?: string; endDate?: string }): Promise<{ xAxis: string[]; series: Array<{ name: string; type: string; data: number[]; yAxisIndex?: number }> }> => {
    try {
      const response = await request.get<ApiResponse<{ xAxis: { data: string[] }; series: Array<{ name: string; type: string; data: number[]; yAxisIndex?: number }> }>>('/stats/center', { params })
      const data = extractData(response)
      return {
        xAxis: data.xAxis.data,
        series: data.series
      }
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

export const notification = {
  getList: async (params?: { isRead?: boolean } & PaginationParams): Promise<PaginatedResponse<Notification>> => {
    try {
      const response = await request.get<ApiResponse<PaginatedResponse<Notification>>>('/notification', { params })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getUnreadCount: async (): Promise<UnreadCount> => {
    try {
      const response = await request.get<ApiResponse<UnreadCount>>('/notification/unread-count')
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  markAsRead: async (id: number): Promise<{ message: string }> => {
    try {
      const response = await request.patch<ApiResponse<{ message: string }>>(`/notification/${id}/read`)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  markAllAsRead: async (): Promise<{ message: string }> => {
    try {
      const response = await request.patch<ApiResponse<{ message: string }>>('/notification/read-all')
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

export const audit = {
  getLogs: async (params?: AuditLogFilter & PaginationParams): Promise<PaginatedResponse<AuditLog>> => {
    try {
      const response = await request.get<ApiResponse<PaginatedResponse<AuditLog>>>('/audit/logs', { params })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getLogDetail: async (id: number): Promise<AuditLog & { fieldDiffs: FieldDiff[] }> => {
    try {
      const response = await request.get<ApiResponse<AuditLog & { fieldDiffs: FieldDiff[] }>>(`/audit/logs/${id}`)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

export const user = {
  getList: async (params?: PaginationParams & { centerId?: number; roleId?: number; keyword?: string }): Promise<PaginatedResponse<User>> => {
    try {
      const response = await request.get<ApiResponse<PaginatedResponse<User>>>('/user', { params })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getDetail: async (id: number): Promise<User> => {
    try {
      const response = await request.get<ApiResponse<User>>(`/user/${id}`)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  create: async (data: Partial<User> & { password: string; roleId: number; centerId: number }): Promise<User> => {
    try {
      const response = await request.post<ApiResponse<User>>('/user', data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  update: async (id: number, data: Partial<User>): Promise<User> => {
    try {
      const response = await request.put<ApiResponse<User>>(`/user/${id}`, data)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  delete: async (id: number): Promise<void> => {
    try {
      await request.delete<ApiResponse<void>>(`/user/${id}`)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  assignRole: async (id: number, roleId: number): Promise<User> => {
    try {
      const response = await request.patch<ApiResponse<User>>(`/user/${id}/role`, { roleId })
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getByCenter: async (centerId: number): Promise<User[]> => {
    try {
      const response = await request.get<ApiResponse<User[]>>(`/user/center/${centerId}`)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  getByRole: async (roleId: number): Promise<User[]> => {
    try {
      const response = await request.get<ApiResponse<User[]>>(`/user/role/${roleId}`)
      return extractData(response)
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

export default request
