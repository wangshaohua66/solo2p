import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { Case } from '@/types'
import { caseApi } from '@/api/modules'

export const useCaseStore = defineStore('case', () => {
  const cases = ref<Case[]>([])
  const currentCase = ref<Case | null>(null)
  const total = ref(0)
  const loading = ref(false)
  const filters = reactive({
    page: 1,
    page_size: 20,
    search: '',
    status: '',
    case_type: '',
    lead_lawyer: null as number | null,
    priority: '',
    client: null as number | null,
    billing_type: '',
    risk_level: ''
  })
  const warningList = ref<any[]>([])
  const statistics = ref<any>({})

  async function fetchCases(params?: any) {
    loading.value = true
    try {
      const res = await caseApi.list({ ...filters, ...params })
      cases.value = res.data.results
      total.value = res.data.count
      return res.data
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: number) {
    loading.value = true
    try {
      const res = await caseApi.detail(id)
      currentCase.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  async function createCase(data: any) {
    const res = await caseApi.create(data)
    await fetchCases()
    return res.data
  }

  async function updateCase(id: number, data: any) {
    const res = await caseApi.update(id, data)
    if (currentCase.value?.id === id) {
      currentCase.value = res.data
    }
    const idx = cases.value.findIndex(c => c.id === id)
    if (idx > -1) cases.value[idx] = res.data
    return res.data
  }

  async function deleteCase(id: number) {
    await caseApi.delete(id)
    cases.value = cases.value.filter(c => c.id !== id)
    if (currentCase.value?.id === id) currentCase.value = null
  }

  async function fetchWarnings() {
    const res = await caseApi.warningList()
    warningList.value = res.data
  }

  async function fetchStatistics() {
    const res = await caseApi.statistics()
    statistics.value = res.data
  }

  function setFilters(newFilters: Partial<typeof filters>) {
    Object.assign(filters, newFilters)
  }

  function resetFilters() {
    Object.assign(filters, {
      page: 1, page_size: 20, search: '', status: '', case_type: '',
      lead_lawyer: null, priority: '', client: null, billing_type: '', risk_level: ''
    })
  }

  return {
    cases, currentCase, total, loading, filters, warningList, statistics,
    fetchCases, fetchDetail, createCase, updateCase, deleteCase,
    fetchWarnings, fetchStatistics, setFilters, resetFilters
  }
})
