import request from '@/utils/request'
import type { TaxCalcItem, TaxCalcResult } from '@/types'

export function calculateTax(items: TaxCalcItem[], policyVersion?: string) {
  return request.post<TaxCalcResult[]>('/tax/calculate', { items, policyVersion })
}

export function getRefundRate(hsCode: string) {
  return request.get<{ rate: number; policyNo: string; effectiveDate: string }>(
    `/tax/refund-rate/${hsCode}`
  )
}

export function getPolicyVersions() {
  return request.get<{ version: string; effectiveDate: string; description: string }[]>('/tax/policies')
}

export function comparePolicies(hsCode: string, version1: string, version2: string) {
  return request.get(`/tax/compare/${hsCode}`, { params: { version1, version2 } })
}

export function getRefundTrend(hsCode: string, months = 12) {
  return request.get<{ month: string; rate: number; amount: number }[]>(
    `/tax/trend/${hsCode}`,
    { params: { months } }
  )
}
