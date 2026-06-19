import request from '@/utils/request'

export interface BatchImportError {
  row: number
  positionName: string
  reason: string
}

export interface BatchImportResult {
  total: number
  successCount: number
  failedCount: number
  errors: BatchImportError[]
}

export const batchImportJobs = (file: File): Promise<BatchImportResult> => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/position/batch-import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000
  })
}
