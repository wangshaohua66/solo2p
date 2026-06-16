import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import type { Center } from './user'
import type { EquipmentStatus } from '@/types'

export interface Equipment {
  id: number
  name: string
  model: string
  category: string
  centerId: number
  centerName: string
  hourlyRate: number
  status: EquipmentStatus
  specs: Record<string, any>
  currentUser?: string
  nextFreeTime?: string
  createdAt: string
  updatedAt: string
  center?: Center
}

export interface EquipmentFilters {
  category?: string
  centerId?: number
  status?: EquipmentStatus
  keyword?: string
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface EquipmentStats {
  totalEquipment: number
  availableCount: number
  inUseCount: number
  maintenanceCount: number
}

export const useEquipmentStore = defineStore('equipment', () => {
  const equipmentList = ref<Equipment[]>([])
  const equipmentDetail = ref<Equipment | null>(null)
  const loading = ref<boolean>(false)
  const pagination = ref<Pagination>({
    page: 1,
    pageSize: 10,
    total: 0
  })
  const filters = ref<EquipmentFilters>({})

  const availableEquipment = computed(() => {
    return equipmentList.value.filter(eq => eq.status === 'available')
  })

  const equipmentById = computed(() => (id: number) => {
    return equipmentList.value.find(eq => eq.id === id) || null
  })

  const filteredEquipment = computed(() => {
    let result = [...equipmentList.value]
    if (filters.value.category) {
      result = result.filter(eq => eq.category === filters.value.category)
    }
    if (filters.value.centerId) {
      result = result.filter(eq => eq.centerId === filters.value.centerId)
    }
    if (filters.value.status) {
      result = result.filter(eq => eq.status === filters.value.status)
    }
    if (filters.value.keyword) {
      const keyword = filters.value.keyword.toLowerCase()
      result = result.filter(
        eq =>
          eq.name.toLowerCase().includes(keyword) ||
          eq.model.toLowerCase().includes(keyword)
      )
    }
    return result
  })

  const fetchList = async (params?: { page?: number; pageSize?: number } & EquipmentFilters) => {
    loading.value = true
    try {
      const response = await axios.get<PaginatedResult<Equipment>>('/api/equipment', {
        params: {
          page: params?.page ?? pagination.value.page,
          pageSize: params?.pageSize ?? pagination.value.pageSize,
          ...params
        }
      })
      equipmentList.value = response.data.items
      pagination.value = {
        page: response.data.page,
        pageSize: response.data.pageSize,
        total: response.data.total
      }
      if (params) {
        filters.value = {
          category: params.category,
          centerId: params.centerId,
          status: params.status,
          keyword: params.keyword
        }
      }
      return response.data
    } finally {
      loading.value = false
    }
  }

  const fetchDetail = async (id: number) => {
    loading.value = true
    try {
      const response = await axios.get<Equipment>(`/api/equipment/${id}`)
      equipmentDetail.value = response.data
      return response.data
    } finally {
      loading.value = false
    }
  }

  const createEquipment = async (data: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt' | 'centerName' | 'currentUser' | 'nextFreeTime' | 'center'> & { status?: EquipmentStatus }) => {
    loading.value = true
    try {
      const response = await axios.post<Equipment>('/api/equipment', data)
      equipmentList.value.unshift(response.data)
      pagination.value.total += 1
      return response.data
    } finally {
      loading.value = false
    }
  }

  const updateEquipment = async (id: number, data: Partial<Equipment>) => {
    loading.value = true
    try {
      const response = await axios.put<Equipment>(`/api/equipment/${id}`, data)
      const index = equipmentList.value.findIndex(eq => eq.id === id)
      if (index !== -1) {
        equipmentList.value[index] = response.data
      }
      if (equipmentDetail.value?.id === id) {
        equipmentDetail.value = response.data
      }
      return response.data
    } finally {
      loading.value = false
    }
  }

  const updateStatus = async (id: number, status: EquipmentStatus, remark?: string) => {
    loading.value = true
    try {
      const response = await axios.patch<Equipment>(`/api/equipment/${id}/status`, {
        status,
        remark
      })
      const index = equipmentList.value.findIndex(eq => eq.id === id)
      if (index !== -1) {
        equipmentList.value[index].status = status
      }
      if (equipmentDetail.value?.id === id) {
        equipmentDetail.value.status = status
      }
      return response.data
    } finally {
      loading.value = false
    }
  }

  const fetchStats = async () => {
    loading.value = true
    try {
      const response = await axios.get<EquipmentStats>('/api/equipment/stats')
      return response.data
    } finally {
      loading.value = false
    }
  }

  return {
    equipmentList,
    equipmentDetail,
    loading,
    pagination,
    filters,
    availableEquipment,
    equipmentById,
    filteredEquipment,
    fetchList,
    fetchDetail,
    createEquipment,
    updateEquipment,
    updateStatus,
    fetchStats
  }
})
