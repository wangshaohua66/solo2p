import { get, post, put } from '@/utils/request'
import { uploadFile } from '@/utils/request'
import type {
  ApiResponse, PaginatedResponse, Pet, Owner, MedicalRecord, RecordAttachment
} from '@/types'

export const medicalApi = {
  searchPets: (params: { keyword?: string; hospital_id?: number; page?: number; per_page?: number }) =>
    get<ApiResponse<PaginatedResponse<Pet>>>('/api/medical/pets/search', params),
  createPet: (data: any) => post<ApiResponse<Pet>>('/api/medical/pets', data),
  createOwner: (data: any) => post<ApiResponse<Owner>>('/api/medical/owners', data),
  getPetHistory: (petId: number) =>
    get<ApiResponse<{ pet: Pet; owner: Owner; total_visits: number; hospitals_visited: number; timeline: any[]; allergies: string; records: MedicalRecord[] }>>(
      `/api/medical/pets/${petId}/history`
    ),
  getPetRecords: (petId: number, params?: { page?: number; per_page?: number; details?: boolean }) =>
    get<ApiResponse<PaginatedResponse<MedicalRecord>>>(`/api/medical/pets/${petId}/records`, params),
  searchRecords: (params: any) =>
    get<ApiResponse<PaginatedResponse<MedicalRecord>>>('/api/medical/records', params),
  createRecord: (data: any) => post<ApiResponse<MedicalRecord>>('/api/medical/records', data),
  getRecord: (recordId: number) =>
    get<ApiResponse<MedicalRecord>>(`/api/medical/records/${recordId}`),
  updateRecord: (recordId: number, data: any) =>
    put<ApiResponse<MedicalRecord>>(`/api/medical/records/${recordId}`, data),
  createReferral: (recordId: number, data: { target_hospital_id: number; target_doctor_id?: number }) =>
    post<ApiResponse<MedicalRecord>>(`/api/medical/records/${recordId}/referral`, data),
  uploadAttachment: (recordId: number, file: File, file_type = 'other') => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('file_type', file_type)
    return uploadFile<ApiResponse<RecordAttachment>>(`/api/medical/records/${recordId}/attachments`, fd)
  }
}
