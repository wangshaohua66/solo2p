import request from '@/utils/request'

export function getMedicalRecords(params?: any) {
  return request({
    url: '/medical/records',
    method: 'get',
    params,
  })
}

export function getMedicalRecord(id: number) {
  return request({
    url: `/medical/records/${id}`,
    method: 'get',
  })
}

export function createMedicalRecord(data: any) {
  return request({
    url: '/medical/records',
    method: 'post',
    data,
  })
}

export function updateMedicalRecord(id: number, data: any) {
  return request({
    url: `/medical/records/${id}`,
    method: 'put',
    data,
  })
}

export function uploadImage(formData: FormData) {
  return request({
    url: '/medical/images/upload',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export function getOrthodonticRecords(params?: any) {
  return request({
    url: '/medical/orthodontic',
    method: 'get',
    params,
  })
}

export function createOrthodonticRecord(data: any) {
  return request({
    url: '/medical/orthodontic',
    method: 'post',
    data,
  })
}

export function getOrthodonticVisits(recordId: number) {
  return request({
    url: `/medical/orthodontic/${recordId}/visits`,
    method: 'get',
  })
}

export function addOrthodonticVisit(recordId: number, data: any) {
  return request({
    url: `/medical/orthodontic/${recordId}/visits`,
    method: 'post',
    data,
  })
}

export function getImplantRecords(params?: any) {
  return request({
    url: '/medical/implant',
    method: 'get',
    params,
  })
}

export function createImplantRecord(data: any) {
  return request({
    url: '/medical/implant',
    method: 'post',
    data,
  })
}

export function getImplantStages(recordId: number) {
  return request({
    url: `/medical/implant/${recordId}/stages`,
    method: 'get',
  })
}

export function completeImplantStage(stageId: number) {
  return request({
    url: `/medical/implant/stages/${stageId}/complete`,
    method: 'post',
  })
}

export function getTreatmentPlans(params?: any) {
  return request({
    url: '/medical/treatment-plans',
    method: 'get',
    params,
  })
}

export function getRecheckPlans(params?: any) {
  return request({
    url: '/medical/recheck-plans',
    method: 'get',
    params,
  })
}

export function confirmRecheck(planId: number) {
  return request({
    url: `/medical/recheck-plans/${planId}/confirm`,
    method: 'post',
  })
}
