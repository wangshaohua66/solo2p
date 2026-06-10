import http from './http'
import type {
  SalesItem,
  CustomOrder,
  Material,
  MaterialTransaction,
  MaterialAlert,
  PagedResult,
  PagedQuery,
  Notification
} from '@/types'

export const salesApi = {
  getSalesItems(params?: {
    status?: string
    pieceId?: string
  } & PagedQuery): Promise<PagedResult<SalesItem>> {
    return http.get('/sales/items', { params })
  },

  getSalesItem(id: string): Promise<SalesItem> {
    return http.get(`/sales/items/${id}`)
  },

  listPieceForSale(pieceId: string, price: number): Promise<SalesItem> {
    return http.post('/sales/items', { pieceId, price })
  },

  updateSalesItem(id: string, data: Partial<SalesItem>): Promise<SalesItem> {
    return http.put(`/sales/items/${id}`, data)
  },

  markAsSold(id: string, buyerName: string, buyerContact: string): Promise<SalesItem> {
    return http.post(`/sales/items/${id}/sold`, { buyerName, buyerContact })
  },

  removeFromListing(id: string): Promise<void> {
    return http.delete(`/sales/items/${id}`)
  },

  getCustomOrders(params?: { status?: string } & PagedQuery): Promise<PagedResult<CustomOrder>> {
    return http.get('/sales/custom-orders', { params })
  },

  getCustomOrder(id: string): Promise<CustomOrder> {
    return http.get(`/sales/custom-orders/${id}`)
  },

  createCustomOrder(data: Partial<CustomOrder>): Promise<CustomOrder> {
    return http.post('/sales/custom-orders', data)
  },

  updateCustomOrder(id: string, data: Partial<CustomOrder>): Promise<CustomOrder> {
    return http.put(`/sales/custom-orders/${id}`, data)
  },

  submitQuote(id: string, amount: number): Promise<CustomOrder> {
    return http.post(`/sales/custom-orders/${id}/quote`, { amount })
  },

  acceptOrder(id: string): Promise<CustomOrder> {
    return http.post(`/sales/custom-orders/${id}/accept`)
  },

  completeOrder(id: string): Promise<CustomOrder> {
    return http.post(`/sales/custom-orders/${id}/complete`)
  },

  cancelOrder(id: string): Promise<CustomOrder> {
    return http.post(`/sales/custom-orders/${id}/cancel`)
  },

  getRevenueSummary(startDate: string, endDate: string): Promise<any> {
    return http.get('/sales/revenue-summary', { params: { startDate, endDate } })
  }
}

export const inventoryApi = {
  getMaterials(params?: {
    category?: string
    lowStock?: boolean
  } & PagedQuery): Promise<PagedResult<Material>> {
    return http.get('/inventory/materials', { params })
  },

  getMaterial(id: string): Promise<Material> {
    return http.get(`/inventory/materials/${id}`)
  },

  createMaterial(data: Partial<Material>): Promise<Material> {
    return http.post('/inventory/materials', data)
  },

  updateMaterial(id: string, data: Partial<Material>): Promise<Material> {
    return http.put(`/inventory/materials/${id}`, data)
  },

  deleteMaterial(id: string): Promise<void> {
    return http.delete(`/inventory/materials/${id}`)
  },

  getTransactions(materialId?: string, params?: PagedQuery): Promise<PagedResult<MaterialTransaction>> {
    return http.get('/inventory/transactions', { params: { materialId, ...params } })
  },

  addStock(materialId: string, quantity: number, unitPrice: number, notes?: string): Promise<MaterialTransaction> {
    return http.post(`/inventory/materials/${materialId}/add-stock`, {
      quantity,
      unitPrice,
      notes
    })
  },

  useStock(materialId: string, quantity: number, referenceId?: string, notes?: string): Promise<MaterialTransaction> {
    return http.post(`/inventory/materials/${materialId}/use-stock`, {
      quantity,
      referenceId,
      notes
    })
  },

  getAlerts(isRead?: boolean): Promise<MaterialAlert[]> {
    return http.get('/inventory/alerts', { params: { isRead } })
  },

  markAlertAsRead(id: string): Promise<void> {
    return http.post(`/inventory/alerts/${id}/read`)
  },

  markAllAlertsAsRead(): Promise<void> {
    return http.post('/inventory/alerts/read-all')
  },

  generatePurchaseSuggestion(): Promise<{ materialId: string; materialName: string; suggestedQuantity: number; estimatedCost: number }[]> {
    return http.get('/inventory/purchase-suggestions')
  }
}

export const notificationApi = {
  getNotifications(params?: {
    type?: string
    isRead?: boolean
  } & PagedQuery): Promise<PagedResult<Notification>> {
    return http.get('/notifications', { params })
  },

  markAsRead(id: string): Promise<void> {
    return http.post(`/notifications/${id}/read`)
  },

  markAllAsRead(): Promise<void> {
    return http.post('/notifications/read-all')
  },

  getUnreadCount(): Promise<{ count: number }> {
    return http.get('/notifications/unread-count')
  },

  deleteNotification(id: string): Promise<void> {
    return http.delete(`/notifications/${id}`)
  }
}

export const uploadApi = {
  uploadImage(file: File, category: string = 'general'): Promise<{
    id: string
    url: string
    thumbnailUrl: string
    fileName: string
  }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', category)
    return http.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  uploadChunk(file: File, chunkIndex: number, totalChunks: number, uploadId: string): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('chunkIndex', String(chunkIndex))
    formData.append('totalChunks', String(totalChunks))
    formData.append('uploadId', uploadId)
    return http.post('/upload/chunk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  initChunkUpload(fileName: string, fileSize: number): Promise<{ uploadId: string }> {
    return http.post('/upload/chunk/init', { fileName, fileSize })
  },

  completeChunkUpload(uploadId: string): Promise<{
    id: string
    url: string
    thumbnailUrl: string
  }> {
    return http.post(`/upload/chunk/complete/${uploadId}`)
  }
}
