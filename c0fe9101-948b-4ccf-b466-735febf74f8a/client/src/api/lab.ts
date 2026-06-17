import { get, post, uploadFile } from '@/utils/request'
import type { ApiResponse, PaginatedResponse, LabTest, LabResult } from '@/types'

export const labApi = {
  getTests: (params?: { category?: string; subcategory?: string; keyword?: string; is_active?: boolean }) =>
    get<ApiResponse<LabTest[]>>('/api/lab/tests', params),
  createTest: (data: any) => post<ApiResponse<LabTest>>('/api/lab/tests', data),
  searchResults: (params: any) =>
    get<ApiResponse<PaginatedResponse<LabResult>>>('/api/lab/results', params),
  createResult: (data: any) =>
    post<ApiResponse<LabResult>>('/api/lab/results', data),
  getResult: (id: number) =>
    get<ApiResponse<LabResult>>(`/api/lab/results/${id}`),
  submitResult: (id: number, data: { items: any[]; overall_conclusion?: string; attachment_path?: string }) =>
    post<ApiResponse<LabResult>>(`/api/lab/results/${id}/submit`, data),
  reviewResult: (id: number) =>
    post<ApiResponse<LabResult>>(`/api/lab/results/${id}/review`),
  uploadAttachment: (id: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return uploadFile<ApiResponse<{ path: string; name: string }>>(`/api/lab/results/${id}/attachment`, fd)
  },
  getTestTrend: (petId: number, labTestId: number, limit = 20) =>
    get<ApiResponse<{ test: LabTest; trend: any[]; count: number }>>(
      `/api/lab/trend/${petId}/${labTestId}`, { limit }
    )
}
