// ============================================================
// SKIPPAIR INVOICING — CSV Export
// ============================================================

import { InvoiceLog, CsvPeriodPreset, CsvExportParams } from '@/types'

/**
 * Get date range for a preset period.
 */
export function getPresetDateRange(preset: CsvPeriodPreset): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-indexed

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  switch (preset) {
    case 'current_month':
      return {
        from: fmt(new Date(y, m, 1)),
        to: fmt(new Date(y, m + 1, 0)),
      }
    case 'current_year':
      return {
        from: fmt(new Date(y, 0, 1)),
        to: fmt(new Date(y, 11, 31)),
      }
    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      return {
        from: fmt(new Date(ly, lm, 1)),
        to: fmt(new Date(ly, lm + 1, 0)),
      }
    }
    case 'last_3_months':
      return {
        from: fmt(new Date(y, m - 3, 1)),
        to: fmt(new Date(y, m + 1, 0)),
      }
    case 'last_year':
      return {
        from: fmt(new Date(y - 1, 0, 1)),
        to: fmt(new Date(y - 1, 11, 31)),
      }
    default:
      return { from: '', to: '' }
  }
}

export const PRESET_LABELS: Record<CsvPeriodPreset, string> = {
  current_month:  'Current month',
  current_year:   'Current year',
  last_month:     'Last month',
  last_3_months:  'Last 3 months',
  last_year:      'Last year',
  custom:         'Custom range',
}

/**
 * Convert invoice log rows to CSV string.
 */
export function invoicesToCsv(invoices: InvoiceLog[]): string {
  const headers = [
    'Invoice number',
    'Date',
    'Recipient',
    'Quote ID',
    'Taxable (€)',
    'VAT rate (%)',
    'VAT (€)',
    'Total (€)',
    'Status',
    'Drive URL',
    'Issued by',
    'Ever sent',
  ]

  const escape = (v: string | number | boolean | null | undefined) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const rows = invoices.map(inv => [
    escape(inv.invoice_number ?? ''),
    escape(inv.invoice_date),
    escape(inv.recipient_name),
    escape(inv.quote_number ?? ''),
    escape(inv.taxable_amount),
    escape(inv.vat_rate),
    escape(inv.vat_amount),
    escape(inv.total_amount),
    escape(inv.status),
    escape(inv.drive_file_url ?? ''),
    escape(inv.created_by_name ?? ''),
    escape(inv.ever_sent ? 'Yes' : 'No'),
  ].join(','))

  return [headers.join(','), ...rows].join('\n')
}

/**
 * Trigger a CSV download in the browser.
 */
export function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
