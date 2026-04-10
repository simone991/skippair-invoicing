'use client'
import { InvoiceFormData, InvoiceAmounts, Settings } from '@/types'
import { formatEur, vatLabel } from '@/lib/vat'
import { X, Download, Save } from 'lucide-react'

const I18N = {
  en: { invoice: 'INVOICE', billTo: 'Billed to', from: 'From', description: 'Description', amount: 'Amount', taxable: 'Taxable amount', total: 'Total (VAT incl.)', service: 'Service', type: 'Offer type', boat: 'Boat', dates: 'Start / End dates', ports: 'Starting / Landing Port', travellers: 'Nb. of travellers', price: "Client's total amount" },
  fr: { invoice: 'FACTURE', billTo: 'Facturé à', from: 'Émetteur', description: 'Description', amount: 'Montant', taxable: 'Montant HT', total: 'Total (TVA incluse)', service: 'Prestation', type: "Type d'offre", boat: 'Bateau', dates: 'Dates début / fin', ports: 'Port départ / arrivée', travellers: 'Nb. de voyageurs', price: 'Montant total client' },
}

interface Props { form: InvoiceFormData; amounts: InvoiceAmounts | null; settings: Settings; onClose: () => void; onSave: () => void }


function getCountryName(code: string, lang: string): string {
  if (!code) return ''
  try {
    const names = new Intl.DisplayNames([lang === 'fr' ? 'fr' : 'en'], { type: 'region' })
    return names.of(code.toUpperCase()) ?? code
  } catch { return code }
}

function formatClientTotal(val: string, lang: string): string {
  if (!val) return ''
  const n = parseFloat(val.replace(/\s/g, '').replace(',', '.'))
  if (isNaN(n)) return val
  return lang === 'fr'
    ? `${n.toLocaleString('fr-FR')} EUR`
    : `${n.toLocaleString('en-GB')} EUR`
}

export default function InvoicePreviewModal({ form, amounts, settings, onClose, onSave }: Props) {
  const lang = form.language; const t = I18N[lang]
  const footer = lang === 'fr' ? settings.footer_fr : settings.footer_en
  const boatFull = [form.boat_model, form.boat_year ? `(${form.boat_year})` : ''].filter(Boolean).join(' ')
  const descRows = [
    { label: t.service, value: form.service_name }, { label: t.type, value: form.service_type },
    { label: t.boat, value: boatFull },
    { label: t.dates, value: [form.start_date, form.end_date].filter(Boolean).join(' → ') },
    { label: t.ports, value: [form.starting_port, form.landing_port].filter(Boolean).join(' / ') },
    { label: t.travellers, value: form.nb_travellers }, { label: t.price, value: form.client_total_price ? formatClientTotal(form.client_total_price, lang) : '' },
  ].filter(r => r.value)

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-lg">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Preview — {lang === 'fr' ? 'Français' : 'English'}{form.is_test && <span className="badge badge-amber" style={{ marginLeft: 8 }}>TEST</span>}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }} onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ padding: '32px 40px' }}>
          <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 40, fontSize: 12, maxWidth: 680, margin: '0 auto' }}>
            {form.is_test && (
              <div style={{ textAlign: 'center', background: '#FEF7EC', border: '2px dashed #F5A623', borderRadius: 8, padding: '8px 16px', marginBottom: 20, fontSize: 14, fontWeight: 700, color: '#B87B0A', letterSpacing: 3 }}>TEST</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
              <div style={{ background: 'var(--teal)', color: 'white', padding: '8px 14px', borderRadius: 6, fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>SKIPPAIR</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', letterSpacing: 2 }}>{t.invoice}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>[number assigned on issue]</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{form.invoice_date}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--gray-400)', marginBottom: 6 }}>{t.billTo}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{form.recipient_name || '—'}</div>
                <div style={{ color: 'var(--gray-600)', lineHeight: 1.8, marginTop: 2 }}>
                  <div>{form.recipient_address}</div><div>{getCountryName(form.recipient_country_code, lang) || form.recipient_country}</div>
                  {form.recipient_vat_number && <div>VAT: {form.recipient_vat_number}</div>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--gray-400)', marginBottom: 6 }}>{t.from}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{settings.issuer_name}</div>
                <div style={{ color: 'var(--gray-600)', lineHeight: 1.8, marginTop: 2 }}>
                  <div>{settings.issuer_address}</div><div>{settings.issuer_phone}</div><div>{settings.issuer_email}</div>
                </div>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <thead><tr>
                <th style={{ background: 'var(--navy)', color: 'white', padding: '10px 14px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', width: '75%' }}>{t.description}</th>
                <th style={{ background: 'var(--navy)', color: 'white', padding: '10px 14px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>{t.amount}</th>
              </tr></thead>
              <tbody><tr>
                <td style={{ padding: '14px 14px', borderBottom: '1px solid var(--gray-100)', lineHeight: 1.9 }}>
                  {descRows.map(row => <div key={row.label}><em>{row.label}</em>: {row.value}</div>)}
                </td>
                <td style={{ padding: '14px 14px', borderBottom: '1px solid var(--gray-100)', verticalAlign: 'top', textAlign: 'right' }}></td>
              </tr></tbody>
            </table>
            {amounts && (
              <div style={{ marginLeft: 'auto', width: 280 }}>
                {[{ label: t.taxable, value: formatEur(amounts.taxable) }, { label: vatLabel(amounts.vatRate, lang), value: formatEur(amounts.vatAmount) }].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: 'var(--gray-600)', borderBottom: '1px solid var(--gray-100)' }}>
                    <span>{row.label}</span><span>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--navy)', borderRadius: 'var(--radius)', color: 'white', fontSize: 13, fontWeight: 600, marginTop: 8 }}>
                  <span>{t.total}</span><span>{formatEur(amounts.total)}</span>
                </div>
              </div>
            )}
            {amounts?.vatNote && <div style={{ marginTop: 16, fontSize: 10, color: 'var(--gray-400)', fontStyle: 'italic' }}>{amounts.vatNote}</div>}
            {footer && <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--gray-200)', fontSize: 10, color: 'var(--gray-400)', textAlign: 'center', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{footer}</div>}
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'flex-end', gap: 8, position: 'sticky', bottom: 0, background: 'white' }}>
          <button className="btn btn-outline" onClick={onClose}><X size={14} /> Close</button>
          <button className="btn btn-teal" onClick={onSave}><Save size={14} /> Continue</button>
        </div>
      </div>
    </div>
  )
}
