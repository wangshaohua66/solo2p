import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { WorkLog, Settlement, Invoice } from '@/types'
import { workLogApi, settlementApi, invoiceApi } from '@/api/modules'

export const useBillingStore = defineStore('billing', () => {
  const workLogs = ref<WorkLog[]>([])
  const settlements = ref<Settlement[]>([])
  const invoices = ref<Invoice[]>([])
  const logsTotal = ref(0)
  const settlementsTotal = ref(0)
  const invoicesTotal = ref(0)
  const loading = ref(false)
  const workLogSummary = ref<any>({})
  const settlementStats = ref<any>({})
  const invoiceStats = ref<any>({})

  const logFilters = reactive({
    page: 1,
    page_size: 20,
    search: '',
    worker: null as number | null,
    case: null as number | null,
    client: null as number | null,
    work_type: '',
    approval_status: '',
    start_date: '',
    end_date: '',
    billed: null as boolean | null
  })

  async function fetchWorkLogs(params?: any) {
    loading.value = true
    try {
      const res = await workLogApi.list({ ...logFilters, ...params })
      workLogs.value = res.data.results
      logsTotal.value = res.data.count
      return res.data
    } finally {
      loading.value = false
    }
  }

  async function fetchLogSummary(params?: any) {
    const res = await workLogApi.summary(params)
    workLogSummary.value = res.data
    return res.data
  }

  async function createWorkLog(data: any) {
    const res = await workLogApi.create(data)
    workLogs.value.unshift(res.data)
    return res.data
  }

  async function updateWorkLog(id: number, data: any) {
    const res = await workLogApi.update(id, data)
    const idx = workLogs.value.findIndex(w => w.id === id)
    if (idx > -1) workLogs.value[idx] = res.data
    return res.data
  }

  async function deleteWorkLog(id: number) {
    await workLogApi.delete(id)
    workLogs.value = workLogs.value.filter(w => w.id !== id)
  }

  async function submitWorkLog(id: number) {
    return await workLogApi.submit(id)
  }

  async function approveWorkLog(id: number, data: any) {
    return await workLogApi.approve(id, data)
  }

  async function fetchSettlements(params?: any) {
    loading.value = true
    try {
      const res = await settlementApi.list(params)
      settlements.value = res.data.results
      settlementsTotal.value = res.data.count
      return res.data
    } finally {
      loading.value = false
    }
  }

  async function createSettlement(data: any) {
    const res = await settlementApi.create(data)
    settlements.value.unshift(res.data)
    return res.data
  }

  async function approveSettlement(id: number, data: any) {
    return await settlementApi.approve(id, data)
  }

  async function recordSettlementPayment(id: number, amount: number) {
    return await settlementApi.recordPayment(id, { amount })
  }

  async function fetchSettlementStats() {
    const res = await settlementApi.statistics()
    settlementStats.value = res.data
    return res.data
  }

  async function fetchInvoices(params?: any) {
    loading.value = true
    try {
      const res = await invoiceApi.list(params)
      invoices.value = res.data.results
      invoicesTotal.value = res.data.count
      return res.data
    } finally {
      loading.value = false
    }
  }

  async function createInvoice(data: any) {
    const res = await invoiceApi.create(data)
    invoices.value.unshift(res.data)
    return res.data
  }

  async function fetchInvoiceStats() {
    const res = await invoiceApi.statistics()
    invoiceStats.value = res.data
    return res.data
  }

  function setLogFilters(newFilters: Partial<typeof logFilters>) {
    Object.assign(logFilters, newFilters)
  }

  return {
    workLogs, settlements, invoices,
    logsTotal, settlementsTotal, invoicesTotal,
    loading, workLogSummary, settlementStats, invoiceStats, logFilters,
    fetchWorkLogs, fetchLogSummary, createWorkLog, updateWorkLog, deleteWorkLog,
    submitWorkLog, approveWorkLog,
    fetchSettlements, createSettlement, approveSettlement, recordSettlementPayment, fetchSettlementStats,
    fetchInvoices, createInvoice, fetchInvoiceStats,
    setLogFilters
  }
})
