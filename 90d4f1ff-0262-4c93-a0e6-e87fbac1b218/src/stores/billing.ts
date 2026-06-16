import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, post, put } from '@/utils/http'
import type {
  PaymentOrder,
  BillingCalculation,
  BillingRule,
  PagedResult,
  PagedQuery,
  PaymentMethod,
  OrderStatus
} from '@/types'

export const useBillingStore = defineStore('billing', () => {
  const orders = ref<PagedResult<PaymentOrder>>({
    items: [],
    totalCount: 0,
    pageIndex: 1,
    pageSize: 20,
    totalPages: 0
  })
  const rules = ref<BillingRule[]>([])
  const currentCalculation = ref<BillingCalculation | null>(null)
  const loading = ref(false)

  const paidAmount = computed(() =>
    orders.value.items
      .filter(o => o.status === 'Paid')
      .reduce((sum, o) => sum + o.amount, 0)
  )

  const pendingAmount = computed(() =>
    orders.value.items
      .filter(o => o.status === 'Pending')
      .reduce((sum, o) => sum + o.amount, 0)
  )

  const calculateParkingFee = async (payload: {
    recordId?: string
    entryTime: string
    exitTime: string
    plateNumber: string
    memberLevel?: number
  }) => {
    loading.value = true
    try {
      const res = await post<BillingCalculation>('/billing/calculate/parking', payload)
      currentCalculation.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  const calculateChargingFee = async (payload: {
    kwh: number
    startTime: string
    endTime?: string
    memberLevel?: number
  }) => {
    loading.value = true
    try {
      const res = await post<BillingCalculation>('/billing/calculate/charging', payload)
      currentCalculation.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  const createPaymentOrder = async (payload: {
    type: 'Parking' | 'Charging' | 'Reservation'
    relatedId: string
    amount: number
    description?: string
  }) => {
    const res = await post<PaymentOrder>('/billing/orders', payload)
    return res.data
  }

  const payOrder = async (orderId: string, method: PaymentMethod) => {
    const res = await post<{ payUrl?: string; qrCode?: string }>(
      `/billing/orders/${orderId}/pay`,
      { method }
    )
    return res.data
  }

  const refundOrder = async (payload: {
    orderId: string
    refundAmount?: number
    reason?: string
    fullRefund: boolean
  }) => {
    const res = await post(`/billing/orders/${payload.orderId}/refund`, payload)
    return res.data
  }

  const fetchOrders = async (query: PagedQuery & { status?: OrderStatus; type?: string }) => {
    loading.value = true
    try {
      const res = await get<PagedResult<PaymentOrder>>('/billing/orders', { params: query })
      orders.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  const getOrderDetail = async (orderId: string) => {
    const res = await get<PaymentOrder>(`/billing/orders/${orderId}`)
    return res.data
  }

  const fetchRules = async () => {
    loading.value = true
    try {
      const res = await get<BillingRule[]>('/billing/rules')
      rules.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  const createRule = async (rule: Partial<BillingRule>) => {
    const res = await post<BillingRule>('/billing/rules', rule)
    rules.value.push(res.data)
    return res.data
  }

  const updateRule = async (ruleId: string, rule: Partial<BillingRule>) => {
    const res = await put<BillingRule>(`/billing/rules/${ruleId}`, rule)
    const idx = rules.value.findIndex(r => r.id === ruleId)
    if (idx !== -1) {
      rules.value[idx] = res.data
    }
    return res.data
  }

  const toggleRule = async (ruleId: string, isEnabled: boolean) => {
    await put(`/billing/rules/${ruleId}/toggle`, { isEnabled })
    const rule = rules.value.find(r => r.id === ruleId)
    if (rule) {
      rule.isEnabled = isEnabled
    }
  }

  const generateInvoice = async (orderId: string) => {
    const res = await post<{ invoiceUrl: string; invoiceNo: string }>(
      `/billing/orders/${orderId}/invoice`
    )
    return res.data
  }

  return {
    orders,
    rules,
    currentCalculation,
    loading,
    paidAmount,
    pendingAmount,
    calculateParkingFee,
    calculateChargingFee,
    createPaymentOrder,
    payOrder,
    refundOrder,
    fetchOrders,
    getOrderDetail,
    fetchRules,
    createRule,
    updateRule,
    toggleRule,
    generateInvoice
  }
})
