import request from '@/utils/request'

export function getPatients(params?: any) {
  return request({
    url: '/patients',
    method: 'get',
    params,
  })
}

export function getPatient(id: number) {
  return request({
    url: `/patients/${id}`,
    method: 'get',
  })
}

export function createPatient(data: any) {
  return request({
    url: '/patients',
    method: 'post',
    data,
  })
}

export function updatePatient(id: number, data: any) {
  return request({
    url: `/patients/${id}`,
    method: 'put',
    data,
  })
}

export function deletePatient(id: number) {
  return request({
    url: `/patients/${id}`,
    method: 'delete',
  })
}

export function getPatientRecords(patientId: number) {
  return request({
    url: `/patients/${patientId}/records`,
    method: 'get',
  })
}

export function getPatientAppointments(patientId: number) {
  return request({
    url: `/patients/${patientId}/appointments`,
    method: 'get',
  })
}
