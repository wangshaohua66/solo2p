import request from '@/utils/request'
import type { Order, OrderItem, DeliveryTask, DeliveryDetail, Settlement, SettlementItem } from '@/types'

export const orderApi = {
  getPage: (params: any) => request.get('/order/page', { params }),
  getDetail: (id: number) => request.get(`/order/${id}`),
  getItems: (id: number) => request.get(`/order/${id}/items`),
  getPendingDelivery: (communityId?: number) => request.get('/order/pending-delivery', { params: { communityId } }),
  create: (data: any) => request.post('/order/create', data),
  pay: (id: number) => request.put(`/order/${id}/pay`),
  cancel: (id: number, reason?: string) => request.put(`/order/${id}/cancel`, null, { params: { reason } }),
  refund: (id: number, reason: string) => request.put(`/order/${id}/refund`, null, { params: { reason } }),
  updateStatus: (id: number, status: number) => request.put(`/order/${id}/status`, null, { params: { status } }),
  updateDeliveryStatus: (id: number, deliveryStatus: number) => request.put(`/order/${id}/delivery-status`, null, { params: { deliveryStatus } })
}

export const deliveryApi = {
  getPage: (params: any) => request.get('/delivery/page', { params }),
  getToday: () => request.get('/delivery/today'),
  getDetail: (id: number) => request.get(`/delivery/${id}`),
  getDetails: (id: number) => request.get(`/delivery/${id}/details`),
  getRoute: (id: number) => request.get(`/delivery/${id}/route`),
  getStatistics: () => request.get('/delivery/statistics'),
  generate: (data: { orderIds: number[]; vehicleNo?: string; driverName?: string; driverPhone?: string }) => request.post('/delivery/generate', data),
  start: (id: number) => request.put(`/delivery/${id}/start`),
  arrive: (detailId: number) => request.put(`/delivery/detail/${detailId}/arrive`),
  confirm: (detailId: number) => request.put(`/delivery/detail/${detailId}/confirm`),
  complete: (id: number) => request.put(`/delivery/${id}/complete`),
  reportException: (id: number, remark: string) => request.put(`/delivery/${id}/exception`, null, { params: { remark } }),
  reorder: (detailIds: number[]) => request.put('/delivery/reorder', detailIds)
}

export const settlementApi = {
  getPage: (params: any) => request.get('/settlement/page', { params }),
  getStatistics: () => request.get('/settlement/statistics'),
  getDetail: (id: number) => request.get(`/settlement/${id}`),
  getItems: (id: number) => request.get(`/settlement/${id}/items`),
  generateSupplier: (data: { supplierId: number; startDate: string; endDate: string }) => request.post('/settlement/supplier', data),
  generateLeader: (data: { leaderId: number; startDate: string; endDate: string }) => request.post('/settlement/leader', data),
  execute: (id: number) => request.put(`/settlement/${id}/execute`),
  adjust: (id: number, newAmount: number, remark: string) => request.put(`/settlement/${id}/adjust`, null, { params: { newAmount, remark } })
}
