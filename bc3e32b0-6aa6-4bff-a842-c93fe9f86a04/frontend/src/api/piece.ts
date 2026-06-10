import http from './http'
import type {
  PieceArchive,
  PiecePhoto,
  PhotoStage,
  PagedResult,
  PagedQuery
} from '@/types'

export const pieceApi = {
  getPieces(params?: {
    memberId?: string
    status?: string
    glazeRecipeId?: string
    kilnScheduleId?: string
    isForSale?: boolean
  } & PagedQuery): Promise<PagedResult<PieceArchive>> {
    return http.get('/pieces', { params })
  },

  getPiece(id: string): Promise<PieceArchive> {
    return http.get(`/pieces/${id}`)
  },

  createPiece(data: Partial<PieceArchive>): Promise<PieceArchive> {
    return http.post('/pieces', data)
  },

  updatePiece(id: string, data: Partial<PieceArchive>): Promise<PieceArchive> {
    return http.put(`/pieces/${id}`, data)
  },

  deletePiece(id: string): Promise<void> {
    return http.delete(`/pieces/${id}`)
  },

  updateStatus(id: string, status: string): Promise<PieceArchive> {
    return http.patch(`/pieces/${id}/status`, { status })
  },

  uploadPhoto(pieceId: string, stage: PhotoStage, file: File): Promise<PiecePhoto> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('stage', stage)
    return http.post(`/pieces/${pieceId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  deletePhoto(pieceId: string, photoId: string): Promise<void> {
    return http.delete(`/pieces/${pieceId}/photos/${photoId}`)
  },

  setForSale(pieceId: string, price: number): Promise<PieceArchive> {
    return http.post(`/pieces/${pieceId}/for-sale`, { price })
  },

  removeFromSale(pieceId: string): Promise<PieceArchive> {
    return http.post(`/pieces/${pieceId}/remove-sale`)
  }
}
