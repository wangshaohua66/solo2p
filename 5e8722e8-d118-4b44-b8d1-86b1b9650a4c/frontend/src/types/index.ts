export interface Patient {
  id: number
  name: string
  gender: 'male' | 'female'
  age: number
  phone: string
  idCard: string
  address: string
  allergies: string[]
  medicalHistory: string[]
  createdAt: string
}

export interface Appointment {
  id: number
  patientId: number
  patientName: string
  clinicId: number
  clinicName: string
  department: string
  doctorId: number
  doctorName: string
  date: string
  timeSlot: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  type: string
  createdAt: string
}

export interface Doctor {
  id: number
  name: string
  title: string
  department: string
  clinicId: number
  rating: number
  specialty: string[]
  avatar?: string
}

export interface Clinic {
  id: number
  name: string
  address: string
  phone: string
  departments: string[]
}

export interface MedicalRecord {
  id: number
  patientId: number
  patientName: string
  doctorId: number
  doctorName: string
  date: string
  chiefComplaint: string
  presentIllness: string
  pastHistory: string
  diagnosis: string
  treatmentPlan: string
  prescription: PrescriptionItem[]
  images: string[]
}

export interface PrescriptionItem {
  id: number
  name: string
  dosage: string
  frequency: string
  duration: string
}

export interface OrthodonticRecord {
  id: number
  patientId: number
  startDate: string
  bracketType: string
  archwireSequence: string[]
  attachments: string[]
  visits: OrthodonticVisit[]
  progress: number
}

export interface OrthodonticVisit {
  id: number
  date: string
  doctorName: string
  toothMovement: number
  adjustment: string
  notes: string
  nextVisit: string
}

export interface ImplantRecord {
  id: number
  patientId: number
  implantBrand: string
  implantModel: string
  implantSpec: string
  position: string
  boneGraftAmount: number
  stages: ImplantStage[]
  currentStage: number
}

export interface ImplantStage {
  id: number
  name: string
  status: 'pending' | 'in_progress' | 'completed'
  date?: string
  checklist: string[]
  completedItems: string[]
}

export interface Consumable {
  id: number
  name: string
  category: string
  spec: string
  unit: string
  stock: number
  minStock: number
  price: number
  clinicId: number
  clinicName: string
}

export interface ConsumableRecord {
  id: number
  consumableId: number
  type: 'in' | 'out'
  quantity: number
  operator: string
  date: string
  remark: string
}

export interface DashboardStats {
  todayAppointments: number
  todayPatients: number
  monthlyRevenue: number
  totalPatients: number
}
