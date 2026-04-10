import { InvoiceFormData, RecipientFormData, ValidationResult, ValidationError } from '@/types'
import { isVatRequired } from './vat'
import { VatZone, RecipientType } from '@/types'

export function validateInvoiceForm(data: InvoiceFormData): ValidationResult {
  const errors: ValidationError[] = []
  if (!data.invoice_date) errors.push({ field: 'invoice_date', message: 'Date is required.' })
  if (!data.language) errors.push({ field: 'language', message: 'Language is required.' })
  if (!data.recipient_name) errors.push({ field: 'recipient', message: 'A recipient must be selected.' })
  const taxable = parseFloat(data.taxable_amount)
  if (!data.taxable_amount || isNaN(taxable) || taxable <= 0) {
    errors.push({ field: 'taxable_amount', message: 'Taxable amount must be a positive number.' })
  }
  if (!data.service_name) errors.push({ field: 'service_name', message: 'Service name is required.' })
  // If no quote number, description fields are required
  if (!data.quote_number) {
    if (!data.service_type)     errors.push({ field: 'service_type',    message: 'Type is required when no quote number.' })
    if (!data.start_date)       errors.push({ field: 'start_date',      message: 'Start date is required when no quote number.' })
    if (!data.end_date)         errors.push({ field: 'end_date',        message: 'End date is required when no quote number.' })
    if (!data.starting_port)    errors.push({ field: 'starting_port',   message: 'Starting port is required when no quote number.' })
    if (!data.landing_port)     errors.push({ field: 'landing_port',    message: 'Landing port is required when no quote number.' })
    if (!data.nb_travellers)    errors.push({ field: 'nb_travellers',   message: 'Number of travellers is required when no quote number.' })
    if (!data.client_total_price) errors.push({ field: 'client_total_price', message: 'Client total price is required when no quote number.' })
  }
  return { valid: errors.length === 0, errors }
}

export function validateRecipientForm(data: RecipientFormData): ValidationResult {
  const errors: ValidationError[] = []
  if (!data.name?.trim())    errors.push({ field: 'name',    message: 'Name is required.' })
  if (!data.type)            errors.push({ field: 'type',    message: 'Type is required.' })
  if (!data.address?.trim()) errors.push({ field: 'address', message: 'Address is required.' })
  if (!data.country_code)    errors.push({ field: 'country_code', message: 'Country is required.' })
  if (data.email?.trim() && !isValidEmail(data.email)) errors.push({ field: 'email', message: 'Invalid email address.' })
  if (isVatRequired(data.vat_zone as VatZone, data.type as RecipientType)) {
    if (!data.vat_number?.trim()) errors.push({ field: 'vat_number', message: 'VAT number required for EU companies.' })
  }
  return { valid: errors.length === 0, errors }
}

export interface CsvRow { name?: string; type?: string; address?: string; country_code?: string; vat_number?: string; email?: string }

export function validateCsvRow(row: CsvRow, rowIndex: number, existingVats: Set<string>): { valid: boolean; error?: string } {
  if (!row.name?.trim())   return { valid: false, error: `Row ${rowIndex}: missing name` }
  if (!['company', 'private'].includes(row.type ?? '')) return { valid: false, error: `Row ${rowIndex}: type must be "company" or "private"` }
  if (!row.address?.trim()) return { valid: false, error: `Row ${rowIndex}: missing address` }
  if (!row.country_code || row.country_code.length !== 2) return { valid: false, error: `Row ${rowIndex}: invalid country code "${row.country_code}"` }
  if (row.email?.trim() && !isValidEmail(row.email)) return { valid: false, error: `Row ${rowIndex}: invalid email "${row.email}"` }
  if (row.vat_number && existingVats.has(row.vat_number.toUpperCase())) return { valid: false, error: `Row ${rowIndex}: duplicate VAT ${row.vat_number}` }
  return { valid: true }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidVatNumber(vat: string, countryCode: string): boolean {
  const clean = vat.trim().toUpperCase().replace(/\s/g, '')
  return clean.startsWith(countryCode) && clean.length >= 8
}
