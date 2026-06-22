import request from '@/utils/request'

export function getAppointments(params?: any) {
  return request({
    url: '/appointments',
    method: 'get',
    params,
  })
}

export function getAppointment(id: number) {
  return request({
    url: `/appointments/${id}`,
    method: 'get',
  })
}

export function createAppointment(data: any) {
  return request({
    url: '/appointments',
    method: 'post',
    data,
  })
}

export function updateAppointment(id: number, data: any) {
  return request({
    url: `/appointments/${id}`,
    method: 'put',
    data,
  })
}

export function cancelAppointment(id: number) {
  return request({
    url: `/appointments/${id}/cancel`,
    method: 'post',
  })
}

export function getAvailableSlots(params: any) {
  return request({
    url: '/appointments/available',
    method: 'get',
    params,
  })
}

export function getDoctors(params?: any) {
  return request({
    url: '/appointments/doctors',
    method: 'get',
    params,
  })
}

export function getClinics() {
  return request({
    url: '/appointments/clinics',
    method: 'get',
  })
}
