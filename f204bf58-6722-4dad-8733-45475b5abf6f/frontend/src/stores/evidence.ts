import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { Evidence } from '@/types'
import { evidenceApi } from '@/api/modules'

export const useEvidenceStore = defineStore('evidence', () => {
  const evidences = ref<Evidence[]>([])
  const currentEvidence = ref<Evidence | null>(null)
  const total = ref(0)
  const loading = ref(false)
  const alerts = ref<any[]>([])
  const filters = reactive({
    page: 1,
    page_size: 20,
    search: '',
    case: null as number | null,
    evidence_type: '',
    storage_status: '',
    is_original: null as boolean | null,
    category: ''
  })

  async function fetchEvidences(params?: any) {
    loading.value = true
    try {
      const res = await evidenceApi.list({ ...filters, ...params })
      evidences.value = res.data.results
      total.value = res.data.count
      return res.data
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: number) {
    const res = await evidenceApi.detail(id)
    currentEvidence.value = res.data
    return res.data
  }

  async function create(formData: FormData) {
    const res = await evidenceApi.create(formData)
    await fetchEvidences()
    return res.data
  }

  async function update(id: number, data: any) {
    const res = await evidenceApi.update(id, data)
    const idx = evidences.value.findIndex(e => e.id === id)
    if (idx > -1) evidences.value[idx] = res.data
    return res.data
  }

  async function remove(id: number) {
    await evidenceApi.delete(id)
    evidences.value = evidences.value.filter(e => e.id !== id)
  }

  async function borrow(id: number, data: any) {
    return await evidenceApi.borrow(id, data)
  }

  async function returnEv(id: number, data?: any) {
    return await evidenceApi.return(id, data)
  }

  async function markLost(id: number) {
    return await evidenceApi.markLost(id)
  }

  async function fetchAlerts(params?: any) {
    const res = await evidenceApi.alerts(params)
    alerts.value = res.data
  }

  async function batchUpload(formData: FormData) {
    return await evidenceApi.batchUpload(formData)
  }

  function setFilters(newFilters: Partial<typeof filters>) {
    Object.assign(filters, newFilters)
  }

  return {
    evidences, currentEvidence, total, loading, alerts, filters,
    fetchEvidences, fetchDetail, create, update, remove,
    borrow, returnEv, markLost, fetchAlerts, batchUpload, setFilters
  }
})
