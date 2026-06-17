import api from './index'

export const settlementApi = {
  getSettlements: (params?: { month?: string; status?: string }) => {
    return api.get('/settlements', { params })
  },

  getSettlement: (id: string) => {
    return api.get(`/settlements/${id}`)
  },

  generateMonthlySettlement: (month: string) => {
    return api.post('/settlements/generate', { month })
  },

  confirmByVenue: (id: string) => {
    return api.post(`/settlements/${id}/confirm-venue`)
  },

  confirmByOrganizer: (id: string) => {
    return api.post(`/settlements/${id}/confirm-organizer`)
  },

  exportSettlement: (id: string) => {
    return api.get(`/settlements/${id}/export`, {
      responseType: 'blob'
    })
  },

  getSalesStats: (params?: {
    startDate?: string
    endDate?: string
    performanceId?: string
  }) => {
    return api.get('/settlements/sales-stats', { params })
  },

  getChannelComparison: (params?: { startDate?: string; endDate?: string }) => {
    return api.get('/settlements/channel-comparison', { params })
  }
}
