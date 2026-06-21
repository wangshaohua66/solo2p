import request from '@/utils/request'
import type { Declaration, DeclarationFilter, Pagination } from '@/types'

export interface DeclarationListResponse {
  list: Declaration[]
  total: number
}

export function getDeclarationList(
  filter: DeclarationFilter,
  pagination: Pagination
) {
  return request.get<DeclarationListResponse>('/declarations', {
    params: {
      ...filter,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
  })
}

export function getDeclaration(id: string) {
  return request.get<Declaration>(`/declarations/${id}`)
}

export function createDeclaration(data: Partial<Declaration>) {
  return request.post<Declaration>('/declarations', data)
}

export function updateDeclaration(id: string, data: Partial<Declaration>) {
  return request.put<Declaration>(`/declarations/${id}`, data)
}

export function deleteDeclaration(id: string) {
  return request.delete(`/declarations/${id}`)
}

export function submitDeclaration(id: string) {
  return request.post<Declaration>(`/declarations/${id}/submit`)
}

export function batchSubmitDeclarations(ids: string[]) {
  return request.post<Declaration[]>('/declarations/batch-submit', { ids })
}

export function withdrawDeclaration(id: string, reason: string) {
  return request.post<Declaration>(`/declarations/${id}/withdraw`, { reason })
}

export function reviewDeclaration(id: string, approved: boolean, comment?: string) {
  return request.post<Declaration>(`/declarations/${id}/review`, { approved, comment })
}
