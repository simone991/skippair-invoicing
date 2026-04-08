// ============================================================
// SKIPPAIR INVOICING — TypeScript Types (v2)
// ============================================================

export type UserRole = 'user' | 'manager' | 'admin'
export type UserStatus = 'active' | 'disabled'
export type RecipientType = 'company' | 'private'
export type VatZone = 'fr' | 'eu' | 'non-eu'
export type InvoiceLanguage = 'en' | 'fr'
export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'cancelled'

export const INVOICE_STATUS_ORDER: InvoiceStatus[] = ['draft', 'issued', 'sent', 'cancelled']

export function canTransitionTo(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === 'cancelled') return false
  const fromIdx = INVOICE_STATUS_ORDER.indexOf(from)
  const toIdx = INVOICE_STATUS_ORDER.indexOf(to)
  return toIdx > fromIdx
}

// ── Auth / Users ─────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
  email?: string
}

// ── Recipients ───────────────────────────────────────────────

export interface Recipient {
  id: string
  name: string
  type: RecipientType
  address: string
  country_code: string
  country_name: string
  vat_zone: VatZone
  vat_number: string | null
  email: string
  disabled: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  invoice_count?: number // for top-10 frequent
}

export interface RecipientFormData {
  name: string
  type: RecipientType
  address: string
  country_code: string
  country_name: string
  vat_zone: VatZone
  vat_number: string
  email: string
}

// ── Quotes (from Google Sheets) ──────────────────────────────

export interface Quote {
  quoteId: string
  quoteDate: string
  title: string
  start: string
  end: string
  startingPort: string
  landingPort: string
  travellers: number
  offerType: string
  model: string
  boatType: string
  length: string
  year: string
  price: string
  globalPrice: string
  orgName: string
  contactEmail: string
  contactLabel: string
}

// ── Invoices ─────────────────────────────────────────────────

export interface Invoice {
  id: string
  invoice_number: string | null  // null until "issued"
  invoice_date: string
  language: InvoiceLanguage
  status: InvoiceStatus
  is_test: boolean

  recipient_id: string | null
  recipient_name: string
  recipient_address: string
  recipient_country: string
  recipient_country_code: string
  recipient_vat_number: string | null
  recipient_email: string
  recipient_type: RecipientType
  recipient_vat_zone: VatZone

  quote_number: string | null
  service_name: string
  service_type: string | null
  boat_model: string | null
  boat_year: string | null
  start_date: string | null
  end_date: string | null
  starting_port: string | null
  landing_port: string | null
  nb_travellers: number | null
  client_total_price: string | null

  taxable_amount: number
  vat_rate: number
  vat_amount: number
  total_amount: number
  vat_note: string | null

  drive_file_id: string | null
  drive_file_url: string | null

  issuer_name: string
  issuer_address: string
  issuer_phone: string | null
  issuer_email: string | null
  footer_text: string | null

  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface InvoiceLog {
  id: string
  invoice_number: string | null
  invoice_date: string
  language: InvoiceLanguage
  status: InvoiceStatus
  is_test: boolean
  recipient_id: string | null
  recipient_name: string
  recipient_country: string
  recipient_country_code: string
  recipient_email: string
  recipient_vat_zone: VatZone
  quote_number: string | null
  taxable_amount: number
  vat_rate: number
  vat_amount: number
  total_amount: number
  drive_file_url: string | null
  created_at: string
  updated_at: string
  created_by_name: string | null
  ever_sent: boolean
}

export interface InvoiceStatusLog {
  id: string
  invoice_id: string
  from_status: InvoiceStatus | null
  to_status: InvoiceStatus
  changed_by: string | null
  note: string | null
  created_at: string
  changed_by_name?: string
}

export interface InvoiceFormData {
  invoice_date: string
  language: InvoiceLanguage
  quote_number: string
  is_test: boolean

  recipient_id: string
  recipient_name: string
  recipient_address: string
  recipient_country: string
  recipient_country_code: string
  recipient_vat_number: string
  recipient_email: string
  recipient_type: RecipientType
  recipient_vat_zone: VatZone

  service_name: string
  service_type: string
  boat_model: string
  boat_year: string
  start_date: string
  end_date: string
  starting_port: string
  landing_port: string
  nb_travellers: string
  client_total_price: string

  taxable_amount: string
  send_to_email: string
}

export interface InvoiceAmounts {
  taxable: number
  vatRate: number
  vatAmount: number
  total: number
  vatNote: string
}

// ── Settings ─────────────────────────────────────────────────

export interface Settings {
  id: 1
  issuer_name: string
  issuer_address: string
  issuer_phone: string
  issuer_email: string
  gsheet_id: string
  gsheet_tab: string
  gdrive_folder_id: string | null
  gdrive_test_folder_id: string | null
  vat_note_eu_en: string
  vat_note_eu_fr: string
  vat_note_non_eu_en: string
  vat_note_non_eu_fr: string
  footer_en: string
  footer_fr: string
  email_subject_en: string
  email_subject_fr: string
  email_body_en: string
  email_body_fr: string
  updated_at: string
}

// ── Filters ──────────────────────────────────────────────────

export interface InvoiceFilters {
  search: string
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
  status: InvoiceStatus | ''
}

export type CsvPeriodPreset =
  | 'current_month'
  | 'current_year'
  | 'last_month'
  | 'last_3_months'
  | 'last_year'
  | 'custom'

export interface CsvExportParams {
  preset: CsvPeriodPreset
  dateFrom: string
  dateTo: string
}

// ── n8n Payloads ─────────────────────────────────────────────

export interface N8nGenerateInvoicePayload {
  invoiceId: string
  invoiceNumber: string | null
  invoiceDate: string
  language: InvoiceLanguage
  isTest: boolean
  isCancelled?: boolean
  recipient: {
    name: string
    address: string
    country: string
    vatNumber: string | null
    email: string
    vatZone: VatZone
  }
  issuer: {
    name: string
    address: string
    phone: string
    email: string
  }
  description: {
    serviceName: string
    serviceType: string | null
    boatModel: string | null
    boatYear: string | null
    startDate: string | null
    endDate: string | null
    startingPort: string | null
    landingPort: string | null
    nbTravellers: number | null
    clientTotalPrice: string | null
  }
  amounts: {
    taxable: number
    vatRate: number
    vatAmount: number
    total: number
    vatNote: string | null
  }
  footerText: string
  sendToEmails: string[]
  emailSubject: string
  emailBody: string
  gdriveFolderId: string
}

// ── Validation ───────────────────────────────────────────────

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// ── CSV Import ───────────────────────────────────────────────

export interface CsvImportResult {
  imported: number
  skipped: number
  errors: Array<{ row: number; reason: string; data?: string }>
}

// ── Dashboard ────────────────────────────────────────────────

export interface DashboardStats {
  totalInvoices: number
  monthCount: number
  monthRevenue: number
  draftCount: number
  issuedCount: number
  errorCount: number
  monthlyKpi: Array<{ month: string; count: number; revenue: number }>
  topRecipients: Array<{ name: string; count: number }>
  recentDrafts: InvoiceLog[]
  recentIssued: InvoiceLog[]
  recentInvoices: InvoiceLog[]
}
