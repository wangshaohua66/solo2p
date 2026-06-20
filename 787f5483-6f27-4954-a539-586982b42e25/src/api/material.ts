import { get, post, put, del, upload } from '@/utils/request'
import type { Material, PageResult } from '@/types'

export function getMaterialList(params: {
  page: number
  pageSize: number
  type?: Material['type']
  keyword?: string
  tags?: string[]
  startTime?: string
  endTime?: string
}) {
  return get<PageResult<Material>>('/materials', { params })
}

export function getMaterialDetail(id: number) {
  return get<Material>(`/materials/${id}`)
}

export function uploadMaterial(
  file: File,
  onProgress?: (percent: number) => void,
  params?: { tags?: string[]; description?: string }
) {
  return upload<Material>('/materials/upload', file, onProgress, { params })
}

export function updateMaterial(id: number, data: Partial<Material>) {
  return put<Material>(`/materials/${id}`, data)
}

export function deleteMaterial(id: number) {
  return del(`/materials/${id}`)
}

export function checkDuplicate(fileHash: string) {
  return get<{ duplicate: boolean; material?: Material }>('/materials/check-duplicate', {
    params: { fileHash }
  })
}

export function downloadMaterial(id: number, range?: { start: number; end: number }) {
  return get(`/materials/${id}/download`, {
    params: range,
    responseType: 'blob'
  })
}

export function clipMaterial(id: number, params: { startTime: number; endTime: number; format: string }) {
  return post(`/materials/${id}/clip`, params, { responseType: 'blob' })
}

export function getMaterialPreviewUrl(id: number): string {
  return `${import.meta.env.VITE_API_BASE_URL || '/api'}/materials/${id}/preview`
}
