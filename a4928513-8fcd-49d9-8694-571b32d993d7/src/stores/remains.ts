import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Remains, RemainsStatus } from '@/types/remains'
import { mockRemainsList, getRemainsById, getRemainsByCode } from '@/mock/remains'

export const useRemainsStore = defineStore('remains', () => {
  const list = ref<Remains[]>([...mockRemainsList])
  const loading = ref(false)
  const currentRemains = ref<Remains | null>(null)
  const searchKeyword = ref('')
  const filterStatus = ref<RemainsStatus | ''>('')
  const filterFuneralHome = ref('')
  const currentPage = ref(1)
  const pageSize = ref(12)

  const filteredList = computed(() => {
    let result = list.value
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.includes(kw) ||
          r.code.toLowerCase().includes(kw) ||
          r.id.toLowerCase().includes(kw) ||
          r.family.name.includes(kw) ||
          r.family.phone.includes(kw)
      )
    }
    if (filterStatus.value) {
      result = result.filter((r) => r.currentStatus === filterStatus.value)
    }
    if (filterFuneralHome.value) {
      result = result.filter((r) => r.funeralHomeId === filterFuneralHome.value)
    }
    return result
  })

  const pagedList = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return filteredList.value.slice(start, start + pageSize.value)
  })

  const total = computed(() => filteredList.value.length)
  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

  const stats = computed(() => {
    const s = { total: list.value.length, pending: 0, today: 0, cremated: 0, completed: 0 }
    const today = new Date().toISOString().slice(0, 10)
    list.value.forEach((r) => {
      if (r.currentStatus.startsWith('pending') || r.currentStatus.startsWith('picking')) s.pending++
      if (r.currentStatus === 'cremated' || r.currentStatus === 'ash_stored' || r.currentStatus === 'buried') s.cremated++
      if (r.currentStatus === 'completed') s.completed++
      if (r.createTime.startsWith(today)) s.today++
    })
    return s
  })

  function fetchDetail(id: string) {
    loading.value = true
    return new Promise<Remains | null>((resolve) => {
      setTimeout(() => {
        currentRemains.value = getRemainsById(id) || null
        loading.value = false
        resolve(currentRemains.value)
      }, 100)
    })
  }

  function findByCode(code: string) {
    return getRemainsByCode(code)
  }

  function updateStatus(id: string, status: RemainsStatus, operatorName: string, remark?: string) {
    const item = list.value.find((r) => r.id === id)
    if (item) {
      item.currentStatus = status
      item.statusHistory.push({
        status,
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        operatorId: 'CURRENT',
        operatorName,
        remark
      })
    }
  }

  function resetFilters() {
    searchKeyword.value = ''
    filterStatus.value = ''
    filterFuneralHome.value = ''
    currentPage.value = 1
  }

  return {
    list,
    loading,
    currentRemains,
    searchKeyword,
    filterStatus,
    filterFuneralHome,
    currentPage,
    pageSize,
    filteredList,
    pagedList,
    total,
    totalPages,
    stats,
    fetchDetail,
    findByCode,
    updateStatus,
    resetFilters
  }
})
