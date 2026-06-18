export interface VitalSigns {
  heartRate?: number
  bloodPressureSystolic?: number
  bloodPressureDiastolic?: number
  respiratoryRate?: number
  oxygenSaturation?: number
  temperature?: number
  consciousness?: string
  bloodGlucose?: number
  ecg?: string
}

export interface TreatmentMeasure {
  measureType: string
  measureName: string
  description?: string
  startTime?: string
  operator?: string
}

export interface HospitalPreNotification {
  eventId: number
  eventNo: string
  patientName: string
  patientGender?: string
  patientAge?: number
  chiefComplaint: string
  conditionSeverity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL'
  vitalSigns?: Record<string, any>
  preliminaryDiagnosis?: string
  treatmentMeasures?: TreatmentMeasure[]
  currentLocation: {
    latitude: number
    longitude: number
    address?: string
  }
  etaMinutes: number
  hospitalName: string
}

export interface HospitalAckRequest {
  notificationId: number
  accepted: boolean
  remark?: string
  receivingDoctorId?: number
  receivingDept?: string
}

export interface HospitalAckResponse {
  notificationId: number
  accepted: boolean
  acknowledged: boolean
}

export interface HospitalNotificationItem {
  id: number
  notificationNo: string
  eventId: number
  eventNo: string
  patientName: string
  patientGender?: string
  patientAge?: number
  chiefComplaint: string
  conditionSeverity: string
  vitalSigns?: Record<string, any>
  preliminaryDiagnosis?: string
  status: string
  ackReceived: boolean
  ackAt?: string
  createdAt: string
  etaMinutes: number
}

export const severityText: Record<string, string> = {
  MINOR: '轻伤',
  MODERATE: '中等',
  SEVERE: '重伤',
  CRITICAL: '危重'
}

export const severityColor: Record<string, string> = {
  MINOR: '#22c55e',
  MODERATE: '#f59e0b',
  SEVERE: '#ef4444',
  CRITICAL: '#dc2626'
}

export const vitalSignLabels: Record<string, { label: string; unit?: string; normalRange?: string }> = {
  heartRate: { label: '心率', unit: '次/分', normalRange: '60-100' },
  bloodPressureSystolic: { label: '收缩压', unit: 'mmHg', normalRange: '90-140' },
  bloodPressureDiastolic: { label: '舒张压', unit: 'mmHg', normalRange: '60-90' },
  respiratoryRate: { label: '呼吸频率', unit: '次/分', normalRange: '12-20' },
  oxygenSaturation: { label: '血氧饱和度', unit: '%', normalRange: '≥95' },
  temperature: { label: '体温', unit: '℃', normalRange: '36-37.3' },
  consciousness: { label: '意识状态' },
  bloodGlucose: { label: '血糖', unit: 'mmol/L', normalRange: '3.9-6.1' },
  ecg: { label: '心电图' }
}

export const genderText: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  UNKNOWN: '未知'
}
