import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get, post, put } from '@/utils/http'
import type { WorkOrder, DashboardStats, PagedResult, PagedQuery, WorkOrderStatus } from '@/types'

export const useAdminStore = defineStore('admin', () => {
  const workOrders = ref<PagedResult<WorkOrder>>({
    items: [],
    totalCount: 0,
    pageIndex: 1,
    pageSize: 20,
    totalPages: 0
  })
  const dashboardStats = ref<DashboardStats | null>(null)
  const loading = ref(false)

  const fetchWorkOrders = async (query: PagedQuery & { status?: WorkOrderStatus; assigneeId?: string }) => {
    loading.value = true
    try {
      const res = await get<PagedResult<WorkOrder>>('/admin/work-orders', { params: query })
      workOrders.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  const createWorkOrder = async (payload: {
    type: 'IllegalParking' | 'Fault' | 'Other'
    title: string
    description: string
    photos: string[]
    location?: string
    plateNumber?: string
  }) => {
    const res = await post<WorkOrder>('/admin/work-orders', payload)
    return res.data
  }

  const assignWorkOrder = async (orderId: string, assigneeId: string) => {
    const res = await put<WorkOrder>(`/admin/work-orders/${orderId}/assign`, { assigneeId })
    const idx = workOrders.value.items.findIndex(w => w.id === orderId)
    if (idx !== -1) {
      workOrders.value.items[idx] = res.data
    }
    return res.data
  }

  const updateWorkOrderStatus = async (orderId: string, status: WorkOrderStatus) => {
    const res = await put<WorkOrder>(`/admin/work-orders/${orderId}/status`, { status })
    const idx = workOrders.value.items.findIndex(w => w.id === orderId)
    if (idx !== -1) {
      workOrders.value.items[idx] = res.data
    }
    return res.data
  }

  const getWorkOrderDetail = async (orderId: string) => {
    const res = await get<WorkOrder>(`/admin/work-orders/${orderId}`)
    return res.data
  }

  const fetchDashboardStats = async (period: 'day' | 'week' | 'month' = 'day') => {
    loading.value = true
    try {
      const res = await get<DashboardStats>('/admin/dashboard/stats', { params: { period } })
      dashboardStats.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  return {
    workOrders,
    dashboardStats,
    loading,
    fetchWorkOrders,
    createWorkOrder,
    assignWorkOrder,
    updateWorkOrderStatus,
    getWorkOrderDetail,
    fetchDashboardStats
  }
})
