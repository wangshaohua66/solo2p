import request from '@/utils/request'
import type { Product, ProductCommunityStock, ProductCategory, Supplier, PageResult } from '@/types'

export const productApi = {
  getPage: (params: any) => request.get('/product/page', { params }),
  getDetail: (id: number) => request.get(`/product/${id}`),
  getTopSelling: (limit = 50) => request.get('/product/top-selling', { params: { limit } }),
  getBySupplier: (supplierId: number) => request.get(`/product/supplier/${supplierId}`),
  add: (data: Product) => request.post('/product', data),
  batchAdd: (data: Product[]) => request.post('/product/batch', data),
  update: (data: Product) => request.put('/product', data),
  delete: (id: number) => request.delete(`/product/${id}`),
  audit: (id: number, data: { auditStatus: number; auditRemark: string }) => request.put(`/product/${id}/audit`, data),
  updateStatus: (id: number, status: number) => request.put(`/product/${id}/status`, { status })
}

export const categoryApi = {
  getTree: () => request.get('/category/tree'),
  getChildren: (parentId: number) => request.get(`/category/children/${parentId}`),
  getList: () => request.get('/category/list'),
  add: (data: ProductCategory) => request.post('/category', data),
  update: (data: ProductCategory) => request.put('/category', data),
  delete: (id: number) => request.delete(`/category/${id}`)
}

export const stockApi = {
  getByProduct: (productId: number) => request.get(`/stock/product/${productId}`),
  getDetail: (productId: number, communityId: number) => request.get('/stock/detail', { params: { productId, communityId } }),
  allocate: (data: { productId: number; communityId: number; stock: number; price?: number }) => request.post('/stock/allocate', data),
  batchAllocate: (data: ProductCommunityStock[]) => request.post('/stock/batch-allocate', data),
  recommend: (productId: number) => request.get(`/stock/recommend/${productId}`)
}

export const supplierApi = {
  getPage: (params: any) => request.get('/supplier/page', { params }),
  getList: () => request.get('/supplier/list'),
  getDetail: (id: number) => request.get(`/supplier/${id}`),
  add: (data: Supplier) => request.post('/supplier', data),
  batchAdd: (data: Supplier[]) => request.post('/supplier/batch', data),
  update: (data: Supplier) => request.put('/supplier', data),
  delete: (id: number) => request.delete(`/supplier/${id}`)
}
