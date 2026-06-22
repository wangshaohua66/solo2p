import request from '@/utils/request'

export function getDashboardStats() {
  return request({
    url: '/reports/dashboard',
    method: 'get',
  })
}

export function getAppointmentTrend(params?: any) {
  return request({
    url: '/reports/appointments/trend',
    method: 'get',
    params,
  })
}

export function getAppointmentsByClinic(params?: any) {
  return request({
    url: '/reports/appointments/by-clinic',
    method: 'get',
    params,
  })
}

export function getRevenueByDepartment(params?: any) {
  return request({
    url: '/reports/revenue/by-department',
    method: 'get',
    params,
  })
}

export function getDoctorPerformance(params?: any) {
  return request({
    url: '/reports/doctors/performance',
    method: 'get',
    params,
  })
}

export function getConsumableAnalysis(params?: any) {
  return request({
    url: '/reports/consumables/analysis',
    method: 'get',
    params,
  })
}

export function getPatientAnalysis() {
  return request({
    url: '/reports/patients/analysis',
    method: 'get',
  })
}

export function getEquipmentUtilization(params?: any) {
  return request({
    url: '/reports/utilization/equipment',
    method: 'get',
    params,
  })
}
