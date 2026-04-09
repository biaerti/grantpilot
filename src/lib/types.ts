export type ProjectStatus = 'active' | 'completed' | 'suspended'
export type EventStatus = 'draft' | 'planned' | 'accepted' | 'in_progress' | 'completed' | 'settled'
export type EventType = 'training' | 'workshop' | 'conference' | 'consulting' | 'production' | 'podcast' | 'other'
export type ExpenseStatus = 'planned' | 'pending_invoice' | 'invoiced' | 'paid' | 'settled'
export type AccountingRequestStatus = 'pending' | 'invoiced' | 'paid'
export type SettlementPeriodStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type UserRole = 'coordinator' | 'accountant' | 'manager' | 'viewer'
export type BudgetCategory = 'personnel' | 'subcontracting' | 'other' | 'indirect'

export interface Organization {
  id: string
  name: string
  nip?: string
  address?: string
  type: 'own' | 'external'
  created_at: string
}

export interface Project {
  id: string
  project_number: string
  name: string
  short_name?: string
  organization_id?: string
  organization?: Organization
  is_subcontractor: boolean
  start_date: string
  end_date: string
  indirect_cost_rate: number
  total_budget?: number
  grant_amount?: number
  grant_rate?: number
  advance_received: number
  status: ProjectStatus
  notes?: string
  created_at: string
  updated_at: string
  // computed
  tasks?: Task[]
  participants_count?: number
  spent_amount?: number
}

export interface Task {
  id: string
  project_id: string
  number: number
  name: string
  description?: string
  budget_direct: number
  budget_indirect: number
  budget_total: number
  created_at: string
  budget_lines?: BudgetLine[]
  spent_amount?: number
}

export interface BudgetLine {
  id: string
  task_id: string
  project_id: string
  name: string
  unit?: string
  unit_cost?: number
  quantity_planned?: number
  amount_planned?: number
  category: BudgetCategory
  notes?: string
  created_at: string
  spent_amount?: number
}

export interface Participant {
  id: string
  project_id: string
  first_name: string
  last_name: string
  pesel?: string
  no_pesel: boolean
  technical_id?: string
  gender?: string
  age_at_start?: number
  education_level?: string
  nationality: string
  country: string
  voivodeship?: string
  county?: string
  commune?: string
  city?: string
  postal_code?: string
  degurba?: number
  phone?: string
  email?: string
  employment_status?: string
  employment_detail?: string
  support_type?: string
  support_form?: string
  support_start_date?: string
  project_start_date?: string
  project_end_date?: string
  disability: boolean
  foreign_origin: boolean
  third_country_citizen: boolean
  minority: boolean
  homeless: boolean
  situation_at_end?: string
  completed_path?: boolean
  sl_added_by?: string
  sl_added_at?: string
  participation_status?: 'lead' | 'active' | 'completed'
  source: 'manual' | 'import'
  notes?: string
  created_at: string
  updated_at: string
}

export interface Staff {
  id: string
  name: string
  email?: string
  phone?: string
  role?: string
  notes?: string
  created_at: string
}

export interface Event {
  id: string
  project_id: string
  task_id?: string
  budget_line_id?: string
  name: string
  type: EventType
  status: EventStatus
  planned_date?: string
  actual_date?: string
  planned_end_date?: string
  start_time?: string
  end_time?: string
  location?: string
  planned_participants_count: number
  actual_participants_count?: number
  planned_cost: number
  actual_cost?: number
  send_invitations: boolean
  harmonogram_do_urzedu: boolean
  notes?: string
  accepted_at?: string
  accepted_by?: string
  completed_at?: string
  completed_by?: string
  settled_at?: string
  accounting_request_id?: string
  created_at: string
  updated_at: string
  // joined
  project?: Project
  task?: Task
  participants?: EventParticipant[]
  staff?: EventStaff[]
}

export interface EventParticipant {
  id: string
  event_id: string
  participant_id: string
  status: 'planned' | 'confirmed' | 'attended' | 'absent'
  send_invitation: boolean
  invitation_sent_at?: string
  notes?: string
  created_at: string
  participant?: Participant
}

export interface EventStaff {
  id: string
  event_id: string
  staff_id: string
  role?: string
  hours_planned?: number
  hours_actual?: number
  rate?: number
  created_at: string
  staff?: Staff
}

export interface SettlementPeriod {
  id: string
  project_id: string
  number: number
  period_start: string
  period_end: string
  status: SettlementPeriodStatus
  advance_received: boolean
  advance_amount: number
  total_claimed: number
  total_approved?: number
  submitted_at?: string
  approved_at?: string
  notes?: string
  created_at: string
}

export interface Expense {
  id: string
  project_id: string
  task_id?: string
  budget_line_id?: string
  event_id?: string
  period_id?: string
  organization_id?: string
  document_number?: string
  accounting_number?: string
  vendor_name?: string
  vendor_nip?: string
  document_date?: string
  payment_date?: string
  amount: number
  description?: string
  status: ExpenseStatus
  notes?: string
  created_at: string
  organization?: Organization
}

export interface AccountingRequest {
  id: string
  project_id: string
  event_id?: string
  organization_id?: string
  amount: number
  description: string
  details?: Record<string, unknown>
  status: AccountingRequestStatus
  notes_for_accountant?: string
  invoice_number?: string
  invoice_date?: string
  expense_id?: string
  created_by?: string
  resolved_by?: string
  resolved_at?: string
  created_at: string
  // joined
  project?: Project
  event?: Event
  organization?: Organization
}

export interface UserProfile {
  id: string
  full_name?: string
  role: UserRole
  avatar_url?: string
  created_at: string
}

export type DocumentCategory =
  | "deklaracja"
  | "formularz_online"
  | "formularz_papierowy"
  | "rodo"
  | "pretest"
  | "posttest"
  | "certyfikat"
  | "inne"
  | "protokol"
  | "umowa_indywidualna"
  | "umowa_grupowa"

export interface DocumentVariable {
  key: string   // np. "first_name"
  label: string // np. "Imię"
}

export interface DocumentType {
  id: string
  project_id: string
  name: string
  description?: string | null
  required: boolean
  sort_order: number
  category: DocumentCategory
  task_id?: string | null
  budget_line_id?: string | null
  variables: DocumentVariable[]
  created_at: string
}

export interface ParticipantDocument {
  id: string
  participant_id: string
  project_id: string
  document_type_id?: string | null
  document_type?: DocumentType | null
  task_id?: string | null
  budget_line_id?: string | null
  template_id?: string | null
  generated?: boolean
  name: string
  file_url?: string | null
  file_name?: string | null
  file_size?: number | null
  mime_type?: string | null
  notes?: string | null
  uploaded_at: string
  created_at: string
}

export type IndicatorType = 'product' | 'result' | 'soft'
export type IndicatorAutoField =
  | 'participants_total' | 'participants_female' | 'participants_male'
  | 'participants_age_18_29' | 'participants_age_55' | 'participants_rural'
  | 'participants_disabled' | 'participants_homeless' | 'participants_minority'
  | 'participants_unemployed' | 'participants_inactive' | 'participants_long_term_unemployed'
  | 'events_count' | null

export interface ProjectIndicator {
  id: string
  project_id: string
  code?: string | null
  name: string
  type: IndicatorType
  target_value: number
  unit: string
  auto_field?: IndicatorAutoField
  current_value: number
  notes?: string | null
  sort_order: number
  created_at: string
}

// Helper types
export interface ParticipantStats {
  total: number
  female: number
  male: number
  age_18_29: number
  age_55_plus: number
  rural: number
  disabled: number
}

export interface Protocol {
  id: string
  project_id: string
  contract_id?: string | null
  contractor_id?: string | null
  task_id?: string | null
  template_id?: string | null
  month: string                    // 'YYYY-MM'
  total_hours: number
  total_participants: number
  total_amount: number
  event_count: number
  content_summary?: string | null
  event_ids: string[]
  document_url?: string | null
  status: 'draft' | 'generated' | 'sent'
  created_at: string
  // joined
  contract?: { id: string; name: string; contract_number?: string | null } | null
  contractor?: { id: string; name: string } | null
  task?: { id: string; number: number; name: string } | null
}

export interface BudgetSummary {
  planned_direct: number
  planned_indirect: number
  planned_total: number
  spent_direct: number
  spent_indirect: number
  spent_total: number
  remaining: number
  percent_spent: number
}
