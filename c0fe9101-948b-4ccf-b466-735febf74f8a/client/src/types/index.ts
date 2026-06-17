export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T = any> {
  total: number
  page: number
  per_page: number
  items: T[]
}

export interface UserInfo {
  id: number
  username: string
  real_name: string
  role: UserRole
  hospital_id: number | null
  hospital_name?: string | null
  department: string | null
  phone: string | null
  email: string | null
  qualification: string | null
  is_active: boolean
  weekly_max_hours: number
}

export type UserRole = 'doctor' | 'lab_tech' | 'pharmacist' | 'nurse' | 'manager' | 'director'

export const ROLE_LABELS: Record<string, string> = {
  doctor: '接诊医生',
  lab_tech: '检验技师',
  pharmacist: '药房管理员',
  nurse: '住院护理',
  manager: '店长',
  director: '集团医疗总监'
}

export interface Hospital {
  id: number
  name: string
  address: string
  phone: string
  type: 'normal' | 'emergency_24h'
  is_active: boolean
  latitude?: number
  longitude?: number
  created_at?: string
}

export interface Owner {
  id: number
  name: string
  phone: string
  id_card?: string
  address?: string
  wechat?: string
  remark?: string
}

export interface Pet {
  id: number
  owner_id: number
  owner_name?: string
  owner_phone?: string
  name: string
  species: '犬' | '猫' | '其他'
  breed?: string
  gender?: 'male' | 'female' | 'unknown'
  birth_date?: string
  weight?: number
  color?: string
  microchip_id?: string
  is_neutered: boolean
  allergy_history?: string
  remark?: string
}

export type VisitType = 'outpatient' | 'emergency' | 'referral' | 'revisit'
export const VISIT_TYPE_LABELS: Record<string, string> = {
  outpatient: '门诊',
  emergency: '急诊',
  referral: '转诊',
  revisit: '复诊'
}

export type RecordStatus = 'in_progress' | 'completed' | 'referred'

export interface MedicalRecord {
  id: number
  pet_id: number
  pet_name?: string
  owner_id?: number
  owner_name?: string
  owner_phone?: string
  hospital_id: number
  hospital_name?: string
  doctor_id?: number
  doctor_name?: string
  department?: string
  visit_type: VisitType
  referral_from_id?: number
  chief_complaint?: string
  present_illness?: string
  past_history?: string
  physical_exam?: string
  temperature?: number
  heart_rate?: number
  respiratory_rate?: number
  diagnosis?: string
  treatment_plan?: string
  status: RecordStatus
  visit_date?: string
  created_at?: string
  prescriptions?: Prescription[]
  lab_results?: LabResult[]
  attachments?: RecordAttachment[]
}

export interface RecordAttachment {
  id: number
  medical_record_id: number
  file_name: string
  file_path: string
  file_type: string
  file_size?: number
  uploaded_by?: number
}

export type CageType = 'standard' | 'emergency' | 'ICU' | 'isolation'
export type CageSize = 'small' | 'medium' | 'large'
export type CageStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance'

export const CAGE_STATUS_COLORS: Record<string, string> = {
  available: '#67C23A',
  occupied: '#F56C6C',
  reserved: '#E6A23C',
  cleaning: '#909399',
  maintenance: '#C0C4CC'
}

export const CAGE_STATUS_LABELS: Record<string, string> = {
  available: '空闲',
  occupied: '占用',
  reserved: '预约',
  cleaning: '清洁',
  maintenance: '维护'
}

export interface Cage {
  id: number
  hospital_id: number
  zone?: string
  code: string
  type: CageType
  size: CageSize
  status: CageStatus
  remark?: string
  current_hospitalization?: Hospitalization
}

export type HospStatus = 'reserved' | 'admitted' | 'discharged' | 'cancelled'
export const HOSP_STATUS_LABELS: Record<string, string> = {
  reserved: '已预约',
  admitted: '住院中',
  discharged: '已出院',
  cancelled: '已取消'
}

export interface Hospitalization {
  id: number
  pet_id: number
  pet_name?: string
  pet_species?: string
  medical_record_id?: number
  cage_id: number
  cage_code?: string
  hospital_id: number
  hospital_name?: string
  admitting_doctor_id?: number
  admitting_doctor_name?: string
  status: HospStatus
  admission_reason?: string
  admission_date?: string
  expected_discharge_date?: string
  actual_discharge_date?: string
  discharge_summary?: string
  daily_notes?: string
  is_emergency: boolean
  created_at?: string
}

export interface Medicine {
  id: number
  name: string
  generic_name?: string
  spec?: string
  manufacturer?: string
  batch_number?: string
  category: string
  is_controlled: boolean
  is_prescription: boolean
  unit: string
  stock_quantity: number
  safety_stock: number
  unit_price: number
  expiry_date?: string
  storage_condition?: string
  is_active: boolean
  is_low_stock: boolean
}

export type PrescStatus = 'pending' | 'first_approved' | 'second_approved' | 'dispensed' | 'cancelled'
export const PRESC_STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  first_approved: '一审通过',
  second_approved: '二审通过',
  dispensed: '已发药',
  cancelled: '已取消'
}

export interface Prescription {
  id: number
  medical_record_id: number
  hospital_id: number
  prescribed_by_id?: number
  prescribed_by_name?: string
  first_approver_id?: number
  first_approver_name?: string
  second_approver_id?: number
  second_approver_name?: string
  has_controlled: boolean
  status: PrescStatus
  dispense_date?: string
  dispensed_by_id?: number
  dispensed_by_name?: string
  total_amount: number
  remark?: string
  created_at?: string
  items?: PrescriptionItem[]
}

export interface PrescriptionItem {
  id: number
  prescription_id: number
  medicine_id: number
  medicine_name?: string
  medicine_spec?: string
  is_controlled?: boolean
  dosage?: string
  quantity: number
  unit_price: number
  subtotal: number
  remark?: string
}

export interface LabTest {
  id: number
  code: string
  name: string
  category?: string
  subcategory?: string
  unit?: string
  reference_min?: number
  reference_max?: number
  reference_text?: string
  price?: number
  is_active: boolean
  need_attachment: boolean
}

export type LabStatus = 'pending' | 'in_progress' | 'completed' | 'reviewed'
export const LAB_STATUS_LABELS: Record<string, string> = {
  pending: '待检验',
  in_progress: '检验中',
  completed: '已完成',
  reviewed: '已审核'
}

export interface LabResult {
  id: number
  medical_record_id: number
  hospital_id: number
  hospital_name?: string
  technician_id?: number
  technician_name?: string
  requesting_doctor_id?: number
  requesting_doctor_name?: string
  category?: string
  status: LabStatus
  overall_conclusion?: string
  submitted_at?: string
  reviewed_at?: string
  reviewed_by_id?: number
  attachment_path?: string
  priority: 'normal' | 'urgent' | 'emergency'
  created_at?: string
  items?: LabResultItem[]
  has_abnormal?: boolean
}

export interface LabResultItem {
  id: number
  lab_result_id: number
  lab_test_id: number
  test_code?: string
  test_name?: string
  category?: string
  subcategory?: string
  unit?: string
  reference_min?: number
  reference_max?: number
  reference_text?: string
  result_value?: number
  result_text?: string
  is_abnormal: boolean
  abnormal_type?: 'high' | 'low'
  remark?: string
}

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'day_off' | 'on_call' | 'emergency'
export const SHIFT_TYPE_LABELS: Record<string, string> = {
  morning: '早班',
  afternoon: '午班',
  night: '夜班',
  day_off: '休息',
  on_call: '待命',
  emergency: '急诊'
}
export const SHIFT_TYPE_COLORS: Record<string, string> = {
  morning: '#409EFF',
  afternoon: '#67C23A',
  night: '#909399',
  day_off: '#E4E7ED',
  on_call: '#E6A23C',
  emergency: '#F56C6C'
}

export type ScheduleStatus = 'draft' | 'confirmed' | 'swapped' | 'cancelled'

export interface Schedule {
  id: number
  user_id: number
  user_name?: string
  user_role?: UserRole
  hospital_id: number
  shift_date: string
  shift_type: ShiftType
  start_time?: string
  end_time?: string
  department?: string
  is_emergency_duty: boolean
  status: ScheduleStatus
  swap_with_id?: number
  swap_with_name?: string
  remark?: string
}

export type NotifType = 'lab_result' | 'prescription' | 'schedule' | 'emergency' | 'system'
export const NOTIF_TYPE_LABELS: Record<string, string> = {
  lab_result: '检验通知',
  prescription: '处方通知',
  schedule: '排班通知',
  emergency: '急诊通知',
  system: '系统通知'
}

export interface Notification {
  id: number
  user_id: number
  type: NotifType
  title: string
  content?: string
  related_type?: string
  related_id?: number
  is_read: boolean
  read_at?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at?: string
}

export type StockChangeType = 'purchase' | 'dispense' | 'return' | 'adjust' | 'expiry'
export const STOCK_CHANGE_LABELS: Record<string, string> = {
  purchase: '入库',
  dispense: '发药',
  return: '退药',
  adjust: '调整',
  expiry: '过期报废'
}

export interface StockLog {
  id: number
  medicine_id: number
  medicine_name?: string
  hospital_id?: number
  change_type: StockChangeType
  quantity_change: number
  balance_after: number
  related_type?: string
  related_id?: number
  operator_id?: number
  operator_name?: string
  remark?: string
  created_at?: string
}

export interface BoardSummaryMetric {
  visits: number
  unique_pets: number
  revisits: number
  revisit_rate: number
  revenue: number
  prescriptions: number
  lab_tests: number
  abnormal_lab_rate: number
}

export interface BoardSummaryDiff {
  visits_diff: number | null
  visits_pct: number | null
  unique_pets_diff: number | null
  unique_pets_pct: number | null
  revisits_diff: number | null
  revisits_pct: number | null
  revisit_rate_diff: number | null
  revisit_rate_pct: number | null
  revenue_diff: number | null
  revenue_pct: number | null
  prescriptions_diff: number | null
  prescriptions_pct: number | null
  lab_tests_diff: number | null
  lab_tests_pct: number | null
  abnormal_lab_rate_diff: number | null
  abnormal_lab_rate_pct: number | null
}

export interface BoardSummary {
  current: BoardSummaryMetric
  yoy_previous: BoardSummaryMetric
  mom_previous: BoardSummaryMetric
  yoy_diff: BoardSummaryDiff
  mom_diff: BoardSummaryDiff
  realtime: {
    total_cages: number
    occupied_cages: number
    cage_occupancy: number
    active_hospitalizations: number
    doctors_on_duty: number
  }
  date_range: {
    start: string
    end: string
    yoy_start: string
    yoy_end: string
    mom_start: string
    mom_end: string
  }
}

export interface DailyTrendPoint {
  date: string
  visits: number
  revenue: number
  emergency: number
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

export type OptionType = {
  label: string
  value: string | number | boolean
  disabled?: boolean
}
