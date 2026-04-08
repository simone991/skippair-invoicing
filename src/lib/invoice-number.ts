// ============================================================
// SKIPPAIR INVOICING — Invoice number utilities
// Format: YYMMDD-XXXXX (e.g. 260402-A3KR9)
// Generated server-side via Supabase function generate_invoice_number()
// ============================================================

/**
 * Validates the YYMMDD-XXXXX format.
 */
export function isValidInvoiceNumber(num: string): boolean {
  return /^\d{6}-[A-Z0-9]{5}$/.test(num)
}

/**
 * Formats an invoice number for display.
 * Returns '—' if null (draft state).
 */
export function displayInvoiceNumber(num: string | null): string {
  return num ?? '—'
}
