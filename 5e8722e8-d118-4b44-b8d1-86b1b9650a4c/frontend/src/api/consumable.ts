import request from '@/utils/request'

export function getConsumables(params?: any) {
  return request({
    url: '/consumables',
    method: 'get',
    params,
  })
}

export function getConsumable(id: number) {
  return request({
    url: `/consumables/${id}`,
    method: 'get',
  })
}

export function createConsumable(data: any) {
  return request({
    url: '/consumables',
    method: 'post',
    data,
  })
}

export function updateConsumable(id: number, data: any) {
  return request({
    url: `/consumables/${id}`,
    method: 'put',
    data,
  })
}

export function stockIn(data: any) {
  return request({
    url: '/consumables/stock-in',
    method: 'post',
    data,
  })
}

export function stockOut(data: any) {
  return request({
    url: '/consumables/stock-out',
    method: 'post',
    data,
  })
}

export function getConsumableRecords(params?: any) {
  return request({
    url: '/consumables/records',
    method: 'get',
    params,
  })
}

export function getLowStockConsumables(params?: any) {
  return request({
    url: '/consumables/low-stock',
    method: 'get',
    params,
  })
}

export function getPurchaseRequests(params?: any) {
  return request({
    url: '/consumables/purchase-requests',
    method: 'get',
    params,
  })
}

export function approvePurchaseRequest(id: number) {
  return request({
    url: `/consumables/purchase-requests/${id}/approve`,
    method: 'post',
  })
}

export function getConsumableCategories() {
  return request({
    url: '/consumables/categories',
    method: 'get',
  })
}
