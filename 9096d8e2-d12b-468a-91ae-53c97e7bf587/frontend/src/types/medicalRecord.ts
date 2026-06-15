export interface VitalSign {
  type: string
  value: number
  unit: string
  measuredAt: string
}

export interface Treatment {
  type: string
  description: string
  startTime?: string
  endTime?: string
  notes?: string
}

export interface Medication {
  name: string
  dosage: string
  route: string
  administeredAt: string
  administeredBy?: string
}

export interface MedicalRecordCreateRequest {
  dispatchEventId: number
  patientName: string
  gender: string
  age: number
  patientPhone?: string
  idCard?: string
  bloodType?: string
  allergies?: string
  chiefComplaint: string
  historyOfPresentIllness?: string
  pastMedicalHistory?: string
  preliminaryDiagnosis: string
  vitalSigns: VitalSign[]
  treatments: Treatment[]
  medications: Medication[]
  disposition?: string
  handoverTo?: string
  handoverNotes?: string
}

export interface MedicalRecordUpdateRequest {
  patientName?: string
  gender?: string
  age?: number
  patientPhone?: string
  idCard?: string
  bloodType?: string
  allergies?: string
  chiefComplaint?: string
  historyOfPresentIllness?: string
  pastMedicalHistory?: string
  preliminaryDiagnosis?: string
  vitalSigns?: VitalSign[]
  treatments?: Treatment[]
  medications?: Medication[]
  disposition?: string
  handoverTo?: string
  handoverNotes?: string
}

export interface MedicalRecordSummary {
  id: number
  recordNo: string
  patientName: string
  gender: string
  age: number
  preliminaryDiagnosis: string
  isLocked: boolean
  createdAt: string
  createdBy?: string
  eventNo?: string
}

export interface MedicalRecordDetail {
  id: number
  recordNo: string
  patientName: string
  gender: string
  age: number
  patientPhone?: string
  idCard?: string
  bloodType?: string
  allergies?: string
  chiefComplaint: string
  historyOfPresentIllness?: string
  pastMedicalHistory?: string
  preliminaryDiagnosis: string
  isLocked: boolean
  lockedAt?: string
  lockedBy?: string
  createdAt: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
  vitalSigns: VitalSign[]
  treatments: Treatment[]
  medications: Medication[]
  disposition?: string
  handoverTo?: string
  handoverNotes?: string
  dispatchEventId: number
  eventNo?: string
  incidentAddress?: string
}
