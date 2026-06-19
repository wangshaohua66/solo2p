export interface User {
  id: number
  username: string
  first_name: string
  last_name: string
  full_name?: string
  email: string
  phone: string
  role: 'admin' | 'partner' | 'lawyer' | 'assistant' | 'client'
  role_display?: string
  id_card?: string
  license_no?: string
  department?: string
  position?: string
  hourly_rate: number
  avatar?: string
  status: boolean
  is_active: boolean
  date_joined: string
}

export interface SimpleUser {
  id: number
  username: string
  full_name: string
  role: string
  position?: string
  hourly_rate?: number
  avatar?: string
}

export interface Client {
  id: number
  client_no: string
  client_name: string
  client_type: 'individual' | 'company' | 'government' | 'organization'
  client_type_display?: string
  vip_level: 'normal' | 'silver' | 'gold' | 'platinum' | 'diamond'
  vip_level_display?: string
  id_type?: string
  id_no?: string
  is_company: boolean
  legal_representative?: string
  phone: string
  email: string
  address?: string
  contact_person?: string
  account_manager?: SimpleUser
  total_case_count: number
  total_fee_amount: number
  unpaid_amount: number
  portal_enabled: boolean
  is_active: boolean
  created_at: string
}

export interface Case {
  id: number
  case_no: string
  case_name: string
  case_type: 'civil' | 'criminal' | 'administrative' | 'non_litigation'
  case_type_display: string
  case_subtype?: string
  cause: string
  status: CaseStatus
  status_display: string
  billing_type: 'hourly' | 'fixed' | 'contingency'
  billing_type_display: string
  amount: number
  fee_agreed: number
  accept_date: string
  limit_date?: string
  filing_date?: string
  close_date?: string
  lead_lawyer?: number
  lead_lawyer_info?: SimpleUser
  assistant?: number
  assistant_info?: SimpleUser
  lawyers?: number[]
  lawyers_info?: SimpleUser[]
  client_info?: {
    id: number
    client_no: string
    client_name: string
    phone?: string
    email?: string
  }
  risk_level: 'low' | 'medium' | 'high'
  risk_level_display: string
  priority: 'normal' | 'urgent' | 'critical'
  priority_display: string
  limit_warning_level?: 'expired' | 'critical' | 'urgent' | 'warning' | 'notice' | 'normal'
  days_left?: number
  conflict_checked: boolean
  trial_count?: number
  evidence_count?: number
  court?: string
  judge?: string
  case_summary?: string
  claim?: string
  defense?: string
  parties?: Party[]
  progress_logs?: CaseProgress[]
  trials?: Trial[]
  evidences?: Evidence[]
  created_at: string
  updated_at: string
}

export type CaseStatus = 'consulting' | 'conflict_check' | 'filing' | 'assigned' | 'handling' | 'trial' | 'execution' | 'closing' | 'closed' | 'suspended'

export interface Party {
  id: number
  case?: number
  party_type: string
  party_type_display: string
  name: string
  is_company: boolean
  id_type: string
  id_no: string
  legal_representative?: string
  phone?: string
  email?: string
  address?: string
  is_represented: boolean
}

export interface CaseProgress {
  id: number
  case: number
  from_status: string
  to_status: string
  to_status_display: string
  operator: number
  operator_info?: SimpleUser
  operation_type: 'update' | 'approve' | 'reject' | 'comment'
  operation_type_display: string
  description: string
  created_at: string
}

export interface Trial {
  id: number
  case: number
  case_info?: { id: number; case_no: string; case_name: string }
  trial_no?: string
  trial_type: string
  trial_type_display: string
  trial_round: number
  start_time: string
  end_time?: string
  duration: number
  location: string
  courtroom?: string
  judge?: string
  presiding_lawyer: number
  presiding_lawyer_info?: SimpleUser
  attending_lawyers?: number[]
  attending_lawyers_info?: SimpleUser[]
  result: 'pending' | 'ongoing' | 'completed' | 'postponed' | 'cancelled'
  result_display: string
  judgment_result?: string
  notes?: string
  has_conflict: boolean
  conflict_info?: any
  created_at: string
}

export interface Evidence {
  id: number
  case: number
  evidence_no: string
  evidence_name: string
  evidence_type: string
  evidence_type_display: string
  category?: string
  is_original: boolean
  description?: string
  prove_content?: string
  file?: string
  file_url?: string
  thumbnail_url?: string
  file_name?: string
  file_size?: number
  storage_status: 'in_store' | 'borrowed' | 'returned' | 'lost' | 'destroyed'
  storage_status_display: string
  storage_location?: string
  borrower?: number
  borrower_info?: SimpleUser
  borrowed_at?: string
  expected_return_at?: string
  returned_at?: string
  uploaded_by?: number
  uploaded_by_info?: SimpleUser
  version: number
  ocr_content?: string
  flow_logs?: EvidenceFlow[]
  alerts?: EvidenceAlert[]
  created_at: string
}

export interface EvidenceFlow {
  id: number
  evidence: number
  action: string
  action_display: string
  operator: number
  operator_info?: SimpleUser
  from_person?: number
  to_person?: number
  remark?: string
  created_at: string
}

export interface EvidenceAlert {
  id: number
  evidence: number
  alert_type: string
  level: 'info' | 'warning' | 'danger' | 'critical'
  message: string
  is_read: boolean
  created_at: string
}

export interface Contract {
  id: number
  contract_no: string
  contract_name: string
  contract_type: string
  contract_type_display: string
  status: string
  status_display: string
  client: number
  client_info?: { id: number; client_no: string; client_name: string; phone?: string }
  case?: number
  case_info?: { id: number; case_no: string; case_name: string }
  payment_type: string
  total_amount: number
  paid_amount: number
  unpaid_amount: number
  effective_date: string
  expire_date: string
  approval_status: string
  payment_plans?: PaymentPlan[]
  created_at: string
}

export interface PaymentPlan {
  id: number
  contract: number
  installment_no: number
  due_date: string
  amount: number
  actual_date?: string
  actual_amount: number
  status: string
  status_display: string
}

export interface WorkLog {
  id: number
  work_date: string
  start_time: string
  end_time: string
  duration: number
  work_type: string
  work_type_display: string
  work_content: string
  case: number
  case_info?: { id: number; case_no: string; case_name: string }
  client: number
  client_info?: { id: number; client_no: string; client_name: string }
  worker: number
  worker_info?: SimpleUser
  participants?: number[]
  participants_info?: SimpleUser[]
  billable_status: string
  hourly_rate: number
  billable_amount: number
  actual_amount: number
  travel_expense?: number
  approval_status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'adjusted'
  approval_status_display: string
  billed: boolean
  created_at: string
}

export interface Settlement {
  id: number
  settlement_no: string
  client: number
  client_info?: { id: number; client_no: string; client_name: string; phone?: string }
  case?: number
  case_info?: { id: number; case_no: string; case_name: string }
  period_start: string
  period_end: string
  total_hours: number
  service_fee: number
  travel_expenses: number
  other_expenses: number
  subtotal: number
  discount_amount: number
  settlement_amount: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  unpaid_amount: number
  due_date: string
  status: string
  status_display: string
  approval_status: string
  created_at: string
}

export interface Invoice {
  id: number
  invoice_no: string
  invoice_type: string
  issue_date: string
  client: number
  client_info?: { id: number; client_no: string; client_name: string }
  buyer_name: string
  items: any[]
  subtotal: number
  tax_amount: number
  total_amount: number
  status: string
  status_display: string
  created_at: string
}

export interface DocumentTemplate {
  id: number
  template_code: string
  template_name: string
  category: string
  category_display: string
  case_type: string
  description?: string
  content?: string
  file_type: string
  version: string
  use_count: number
  rating: number
  tags?: string[]
  created_at: string
}

export interface GeneratedDocument {
  id: number
  template?: number
  template_info?: { id: number; template_code: string; template_name: string }
  doc_title: string
  doc_type: string
  case?: number
  case_info?: { id: number; case_no: string; case_name: string }
  client?: number
  content: string
  html_content?: string
  status: string
  status_display: string
  version: number
  shared_to_client: boolean
  file_url?: string
  created_by?: number
  created_by_info?: SimpleUser
  created_at: string
}
