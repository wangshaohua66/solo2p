import request from '@/utils/request'
import type { Budget, Expense, Settlement, Contract, Notification } from '@/types'

export const createContract = (data: Partial<Contract>) => {
  return request.post<any, Contract>('/contracts', data)
}

export const getContracts = (params?: { status?: string }) => {
  return request.get<any, Contract[]>('/contracts', { params })
}

export const getContract = (id: number) => {
  return request.get<any, Contract>(`/contracts/${id}`)
}

export const updateContract = (id: number, data: Partial<Contract>) => {
  return request.put<any, Contract>(`/contracts/${id}`, data)
}

export const approveContract = (id: number, data: { Action: string; Comment: string }) => {
  return request.put<any, Contract>(`/contracts/${id}/approve`, data)
}

export const createBudget = (data: Partial<Budget>) => {
  return request.post<any, Budget>('/budgets', data)
}

export const getBudget = (id: number) => {
  return request.get<any, any>(`/budgets/${id}`)
}

export const addExpense = (budgetId: number, data: Partial<Expense>) => {
  return request.post<any, Expense>(`/budgets/${budgetId}/expenses`, data)
}

export const getExpenses = (budgetId: number, params?: { category?: string }) => {
  return request.get<any, Expense[]>(`/budgets/${budgetId}/expenses`, { params })
}

export const generateSettlement = (budgetId: number) => {
  return request.get<any, Settlement>(`/budgets/${budgetId}/settlement`)
}

export const getSettlementPDF = (budgetId: number) => {
  return request.get<any, any>(`/budgets/${budgetId}/settlement/pdf`, {
    responseType: 'blob'
  })
}

export const getNotifications = () => {
  return request.get<any, Notification[]>('/notifications')
}

export const markNotificationRead = (id: number) => {
  return request.put<any, void>(`/notifications/${id}/read`)
}
