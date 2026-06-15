import { get, post, patch, put } from './request'
import type {
  MedicalRecordCreateRequest,
  MedicalRecordUpdateRequest,
  MedicalRecordSummary,
  MedicalRecordDetail,
  PageResponse
} from '@/types/medicalRecord'

export function createMedicalRecord(request: MedicalRecordCreateRequest): Promise<MedicalRecordDetail> {
  return post<MedicalRecordDetail>('/medical-records', request)
}

export function updateMedicalRecord(
  recordId: number,
  request: MedicalRecordUpdateRequest
): Promise<MedicalRecordDetail> {
  return patch<MedicalRecordDetail>(`/medical-records/${recordId}`, request)
}

export function lockMedicalRecord(recordId: number): Promise<MedicalRecordDetail> {
  return post<MedicalRecordDetail>(`/medical-records/${recordId}/lock`)
}

export function getMedicalRecord(recordId: number): Promise<MedicalRecordDetail> {
  return get<MedicalRecordDetail>(`/medical-records/${recordId}`)
}

export function getMedicalRecordsByEvent(eventId: number): Promise<MedicalRecordDetail[]> {
  return get<MedicalRecordDetail[]>(`/medical-records/event/${eventId}`)
}

export function getMedicalRecordList(
  page = 0,
  size = 20,
  filters?: {
    patientName?: string
    startDate?: string
    endDate?: string
    isLocked?: boolean
    diagnosis?: string
  }
): Promise<PageResponse<MedicalRecordSummary>> {
  return get<PageResponse<MedicalRecordSummary>>('/medical-records', {
    params: { page, size, ...filters }
  })
}

export function getMedicalRecordsForReview(
  page = 0,
  size = 20
): Promise<PageResponse<MedicalRecordSummary>> {
  return get<PageResponse<MedicalRecordSummary>>('/medical-records/pending-review', {
    params: { page, size }
  })
}

export function validateMedicalRecord(recordId: number): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  return get<{ valid: boolean; errors: string[]; warnings: string[] }>(
    `/medical-records/${recordId}/validate`
  )
}
