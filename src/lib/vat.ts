import { VatZone, RecipientType, InvoiceAmounts, InvoiceLanguage, Settings } from '@/types'

export const VAT_RATE_FR = 20

export function computeVatRate(zone: VatZone, _type: RecipientType): number {
  return zone === 'fr' ? VAT_RATE_FR : 0
}

export function getVatNote(
  zone: VatZone,
  _type: RecipientType,
  language: InvoiceLanguage,
  settings: Pick<Settings, 'vat_note_eu_en' | 'vat_note_eu_fr' | 'vat_note_non_eu_en' | 'vat_note_non_eu_fr'>
): string {
  if (zone === 'fr') return ''
  if (zone === 'eu') return language === 'fr' ? settings.vat_note_eu_fr : settings.vat_note_eu_en
  return language === 'fr' ? settings.vat_note_non_eu_fr : settings.vat_note_non_eu_en
}

export function computeAmounts(
  taxable: number,
  zone: VatZone,
  type: RecipientType,
  language: InvoiceLanguage,
  settings: Pick<Settings, 'vat_note_eu_en' | 'vat_note_eu_fr' | 'vat_note_non_eu_en' | 'vat_note_non_eu_fr'>
): InvoiceAmounts {
  const vatRate = computeVatRate(zone, type)
  const vatAmount = Math.round(taxable * vatRate) / 100
  const total = taxable + vatAmount
  const vatNote = getVatNote(zone, type, language, settings)
  return {
    taxable,
    vatRate,
    vatAmount: Math.round(vatAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
    vatNote,
  }
}

export function isVatRequired(zone: VatZone, type: RecipientType): boolean {
  return zone === 'eu' && type === 'company'
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(amount)
}

export function vatLabel(rate: number, language: InvoiceLanguage): string {
  return language === 'fr' ? `TVA (${rate}%)` : `VAT (${rate}%)`
}

/**
 * Warn if country/VAT number are inconsistent with VAT rules.
 */
export function getVatWarning(
  zone: VatZone,
  type: RecipientType,
  vatNumber: string | null,
  countryCode: string
): string | null {
  if (zone === 'eu' && type === 'company' && !vatNumber) {
    return `EU company in ${countryCode} — VAT number required for reverse charge.`
  }
  if (vatNumber && !vatNumber.startsWith(countryCode)) {
    return `VAT number prefix doesn't match country code ${countryCode}.`
  }
  return null
}
