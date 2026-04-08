'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { computeAmounts, formatEur, vatLabel } from '@/lib/vat'
import { validateInvoiceForm } from '@/lib/validation'
import { COUNTRIES, getVatZone } from '@/lib/countries'
import {
  Recipient, InvoiceFormData, InvoiceLanguage,
  RecipientType, VatZone, Settings, ValidationError
} from '@/types'
import { Search, RefreshCw, Eye, Save, X, AlertCircle, CheckCircle, Info } from 'lucide-react'
import InvoicePreviewModal from '@/components/invoice/InvoicePreviewModal'

interface NewInvoiceFormProps {
  settings: Settings
  userRole: 'user' | 'manager' | 'admin'
}

const EMPTY_FORM: InvoiceFormData = {
  invoice_date: new Date().toISOString().split('T')[0],
  language: 'en',
  quote_number: '',
  recipient_id: '',
  recipient_name: '',
  recipient_address: '',
  recipient_country: '',
  recipient_country_code: '',
  recipient_vat_number: '',
  recipient_email: '',
  recipient_type: 'company',
  recipient_vat_zone: 'non-eu',
  service_name: 'Travel agency commission',
  service_type: '',
  boat_model: '',
  boat_year: '',
  start_date: '',
  end_date: '',
  starting_port: '',
  landing_port: '',
  nb_travellers: '',
  client_total_price: '',
  taxable_amount: '',
  send_to_email: '',
}

export default function NewInvoiceForm({ settings, userRole }: NewInvoiceFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<InvoiceFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<ValidationError[]>([])

  // Recipient search
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientResults, setRecipientResults] = useState<Recipient[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null)
  const [searchingRecipients, setSearchingRecipients] = useState(false)

  // Quote fetch
  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [quoteFetched, setQuoteFetched] = useState(false)
  const [quoteError, setQuoteError] = useState('')

  // Preview
  const [showPreview, setShowPreview] = useState(false)

  // Save
  const [saving, setSaving] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [saveError, setSaveError] = useState('')

  const supabase = createClient()

  // ── Field updater ──────────────────────────────────────────

  const set = (field: keyof InvoiceFormData, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => e.filter(err => err.field !== field))
  }

  // ── Recipient search ───────────────────────────────────────

  const searchRecipients = useCallback(async (query: string) => {
    setRecipientSearch(query)
    if (query.length < 1) { setRecipientResults([]); return }
    setSearchingRecipients(true)
    const { data } = await supabase
      .from('recipients')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(6)
    setRecipientResults(data ?? [])
    setSearchingRecipients(false)
  }, [supabase])

  const selectRecipient = (rec: Recipient) => {
    setSelectedRecipient(rec)
    setRecipientSearch(rec.name)
    setRecipientResults([])
    setForm(f => ({
      ...f,
      recipient_id:           rec.id,
      recipient_name:         rec.name,
      recipient_address:      rec.address,
      recipient_country:      rec.country_name,
      recipient_country_code: rec.country_code,
      recipient_vat_number:   rec.vat_number ?? '',
      recipient_email:        rec.email,
      recipient_type:         rec.type,
      recipient_vat_zone:     rec.vat_zone,
      send_to_email:          rec.email,
    }))
  }

  const clearRecipient = () => {
    setSelectedRecipient(null)
    setRecipientSearch('')
    setForm(f => ({
      ...f,
      recipient_id: '', recipient_name: '', recipient_address: '',
      recipient_country: '', recipient_country_code: '', recipient_vat_number: '',
      recipient_email: '', recipient_vat_zone: 'non-eu', send_to_email: '',
    }))
  }

  // ── Quote fetch ────────────────────────────────────────────

  const fetchQuote = async () => {
    if (!form.quote_number.trim()) return
    setFetchingQuote(true)
    setQuoteError('')
    setQuoteFetched(false)
    try {
      const res = await fetch(`/api/quotes?id=${encodeURIComponent(form.quote_number.trim())}`)
      const data = await res.json()
      if (!res.ok) { setQuoteError(data.error); return }
      const f = data.fields
      setForm(prev => ({
        ...prev,
        service_type:       f.service_type ?? '',
        boat_model:         f.boat_model ?? '',
        boat_year:          f.boat_year ?? '',
        start_date:         f.start_date ?? '',
        end_date:           f.end_date ?? '',
        starting_port:      f.starting_port ?? '',
        landing_port:       f.landing_port ?? '',
        nb_travellers:      f.nb_travellers?.toString() ?? '',
        client_total_price: f.client_total_price ?? '',
      }))
      setQuoteFetched(true)
    } finally {
      setFetchingQuote(false)
    }
  }

  // ── Computed amounts ───────────────────────────────────────

  const taxable = parseFloat(form.taxable_amount) || 0
  const amounts = taxable > 0 && form.recipient_vat_zone
    ? computeAmounts(taxable, form.recipient_vat_zone, form.recipient_type, form.language, settings)
    : null

  // ── Validation & submit ────────────────────────────────────

  const handleSave = async () => {
    const result = validateInvoiceForm(form)
    if (!result.valid) { setErrors(result.errors); return }
    setErrors([])
    setShowSaveConfirm(true)
  }

  const confirmSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok && res.status !== 207) {
        setSaveError(data.error ?? 'Failed to issue invoice')
        return
      }
      setShowSaveConfirm(false)
      router.push(`/invoices?success=${data.invoiceNumber}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Field error helper ─────────────────────────────────────

  const fieldError = (f: string) => errors.find(e => e.field === f)?.message

  // ── VAT zone label ─────────────────────────────────────────

  const vatZoneLabel = () => {
    if (!form.recipient_vat_zone || !form.recipient_name) return null
    const labels: Record<VatZone, string> = {
      fr:     '🇫🇷 France — 20% VAT',
      eu:     '🇪🇺 EU company — Reverse charge (0%)',
      'non-eu': '🌍 Non-EU — 0% VAT',
    }
    const colors: Record<VatZone, string> = {
      fr: 'badge-red', eu: 'badge-amber', 'non-eu': 'badge-navy'
    }
    return (
      <span className={`badge ${colors[form.recipient_vat_zone]}`}>
        {labels[form.recipient_vat_zone]}
      </span>
    )
  }

  // ── Country flag ───────────────────────────────────────────

  const countryFlag = COUNTRIES.find(c => c.code === form.recipient_country_code)?.flag ?? ''

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Validation summary */}
          {errors.length > 0 && (
            <div className="alert alert-error">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Please fix the following errors:</strong>
                <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                  {errors.map((e, i) => <li key={i}>{e.message}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* Invoice details */}
          <div className="card">
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--gray-600)',
              textTransform: 'uppercase', letterSpacing: '.8px',
              marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--gray-100)',
            }}>
              Invoice details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>
                  Date <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  className={`form-input ${fieldError('invoice_date') ? 'error' : ''}`}
                  type="date"
                  value={form.invoice_date}
                  onChange={e => set('invoice_date', e.target.value)}
                />
                {fieldError('invoice_date') && <span style={{ fontSize: 11, color: 'var(--red)' }}>{fieldError('invoice_date')}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>
                  Language <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <select
                  className="form-select"
                  value={form.language}
                  onChange={e => set('language', e.target.value as InvoiceLanguage)}
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>
                  Quote number
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Q-2025-001"
                    value={form.quote_number}
                    onChange={e => { set('quote_number', e.target.value); setQuoteFetched(false); setQuoteError('') }}
                    onKeyDown={e => e.key === 'Enter' && fetchQuote()}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={fetchQuote}
                    disabled={fetchingQuote || !form.quote_number.trim()}
                    style={{ flexShrink: 0 }}
                  >
                    {fetchingQuote
                      ? <div className="spinner" style={{ width: 12, height: 12 }} />
                      : <RefreshCw size={13} />}
                  </button>
                </div>
                {quoteError && <span style={{ fontSize: 11, color: 'var(--red)' }}>{quoteError}</span>}
              </div>
            </div>
          </div>

          {/* Service description */}
          <div className="card">
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 14,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--gray-600)',
                textTransform: 'uppercase', letterSpacing: '.8px',
              }}>
                Service description
              </div>
              {quoteFetched && (
                <span className="badge badge-amber">
                  <CheckCircle size={10} style={{ marginRight: 4 }} />
                  Auto-filled from quote
                </span>
              )}
            </div>

            {!quoteFetched && !form.service_type && (
              <div className="alert alert-info" style={{ marginBottom: 14 }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                Enter a quote number above and click the refresh button to auto-fill.
              </div>
            )}

            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>
                  Service name <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  className={`form-input ${fieldError('service_name') ? 'error' : ''}`}
                  type="text"
                  value={form.service_name}
                  onChange={e => set('service_name', e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Type</label>
                  <input className="form-input" type="text" value={form.service_type} onChange={e => set('service_type', e.target.value)} placeholder="Boat rental" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Boat model</label>
                  <input className="form-input" type="text" value={form.boat_model} onChange={e => set('boat_model', e.target.value)} placeholder="BALI Catspace" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Start date</label>
                  <input className="form-input" type="text" value={form.start_date} onChange={e => set('start_date', e.target.value)} placeholder="23.08.2025 17:00" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>End date</label>
                  <input className="form-input" type="text" value={form.end_date} onChange={e => set('end_date', e.target.value)} placeholder="30.08.2025 09:00" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Starting port</label>
                  <input className="form-input" type="text" value={form.starting_port} onChange={e => set('starting_port', e.target.value)} placeholder="Port Grimaud" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Landing port</label>
                  <input className="form-input" type="text" value={form.landing_port} onChange={e => set('landing_port', e.target.value)} placeholder="Port Grimaud" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Travellers</label>
                  <input className="form-input" type="number" min="1" value={form.nb_travellers} onChange={e => set('nb_travellers', e.target.value)} placeholder="8" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Client total price</label>
                  <input className="form-input" type="text" value={form.client_total_price} onChange={e => set('client_total_price', e.target.value)} placeholder="3.000 EUR" />
                </div>
              </div>
            </div>
          </div>

          {/* Amounts */}
          <div className="card">
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--gray-600)',
              textTransform: 'uppercase', letterSpacing: '.8px',
              marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--gray-100)',
            }}>
              Amounts
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>
                  Taxable amount (€) <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  className={`form-input ${fieldError('taxable_amount') ? 'error' : ''}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="450.00"
                  value={form.taxable_amount}
                  onChange={e => set('taxable_amount', e.target.value)}
                />
                {fieldError('taxable_amount') && <span style={{ fontSize: 11, color: 'var(--red)' }}>{fieldError('taxable_amount')}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>VAT rate</label>
                <input
                  className="form-input"
                  type="text"
                  readOnly
                  value={amounts ? `${amounts.vatRate}%` : selectedRecipient ? '—' : 'Select a recipient first'}
                  style={{ background: 'var(--gray-50)', color: 'var(--gray-600)' }}
                />
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                  {form.recipient_vat_zone === 'fr' && 'French recipient — 20% VAT applies'}
                  {form.recipient_vat_zone === 'eu' && 'EU recipient — reverse charge, 0% VAT'}
                  {form.recipient_vat_zone === 'non-eu' && 'Non-EU recipient — 0% VAT (art. 259-1 CGI)'}
                </span>
              </div>
            </div>

            {amounts && (
              <>
                <div style={{
                  marginTop: 14, padding: 14,
                  background: 'var(--gray-50)', borderRadius: 'var(--radius)',
                  fontSize: 13,
                }}>
                  {[
                    { label: 'Taxable amount', value: formatEur(amounts.taxable) },
                    { label: vatLabel(amounts.vatRate, form.language), value: formatEur(amounts.vatAmount) },
                  ].map(row => (
                    <div key={row.label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '4px 0', color: 'var(--gray-600)',
                    }}>
                      <span>{row.label}</span><span>{row.value}</span>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '8px 0', marginTop: 6,
                    borderTop: '1px solid var(--gray-200)',
                    fontWeight: 600, fontSize: 14,
                  }}>
                    <span>Total</span><span style={{ color: 'var(--navy)' }}>{formatEur(amounts.total)}</span>
                  </div>
                </div>

                {amounts.vatNote && (
                  <div className="alert alert-info" style={{ marginTop: 12, fontSize: 12 }}>
                    <Info size={13} style={{ flexShrink: 0 }} />
                    <em>{amounts.vatNote}</em>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Recipient */}
          <div className="card">
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 14,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--gray-600)',
                textTransform: 'uppercase', letterSpacing: '.8px',
              }}>
                Recipient
              </div>
              {(userRole === 'manager' || userRole === 'admin') && (
                <a href="/recipients?new=1" style={{ fontSize: 12, color: 'var(--teal)', textDecoration: 'none' }}>
                  + New
                </a>
              )}
            </div>

            {!selectedRecipient ? (
              <>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={13} style={{
                    position: 'absolute', left: 10, top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--gray-400)',
                  }} />
                  <input
                    className={`form-input ${fieldError('recipient') ? 'error' : ''}`}
                    style={{ paddingLeft: 32 }}
                    type="text"
                    placeholder="Search by name…"
                    value={recipientSearch}
                    onChange={e => searchRecipients(e.target.value)}
                  />
                </div>
                {fieldError('recipient') && (
                  <span style={{ fontSize: 11, color: 'var(--red)', display: 'block', marginBottom: 8 }}>
                    {fieldError('recipient')}
                  </span>
                )}

                {recipientResults.length > 0 && (
                  <div style={{
                    border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)',
                    overflow: 'hidden', marginBottom: 8,
                  }}>
                    {recipientResults.map(rec => (
                      <div
                        key={rec.id}
                        onClick={() => selectRecipient(rec)}
                        style={{
                          padding: '10px 12px', cursor: 'pointer',
                          borderBottom: '1px solid var(--gray-100)',
                          transition: 'background .1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{rec.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                          {COUNTRIES.find(c => c.code === rec.country_code)?.flag} {rec.country_name}
                          {rec.vat_number ? ` · ${rec.vat_number}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchingRecipients && (
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', padding: 8 }}>
                    Searching…
                  </div>
                )}
              </>
            ) : (
              <div style={{
                background: 'var(--gray-50)', borderRadius: 'var(--radius)',
                padding: 14, fontSize: 12, position: 'relative',
              }}>
                <button
                  onClick={clearRecipient}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    border: 'none', background: 'none',
                    cursor: 'pointer', color: 'var(--gray-400)', fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  <X size={14} />
                </button>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', marginBottom: 8 }}>
                  {countryFlag} {selectedRecipient.name}
                </div>
                <div style={{ color: 'var(--gray-600)', lineHeight: 1.8 }}>
                  <div>{selectedRecipient.address}</div>
                  <div>{selectedRecipient.country_name}</div>
                  {selectedRecipient.vat_number && <div>VAT: {selectedRecipient.vat_number}</div>}
                  <div style={{ color: 'var(--teal)' }}>{selectedRecipient.email}</div>
                </div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--gray-200)' }}>
                  {vatZoneLabel()}
                </div>
              </div>
            )}
          </div>

          {/* Send to email override */}
          {selectedRecipient && (
            <div className="card">
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--gray-600)',
                textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 14,
              }}>
                Email delivery
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>
                  Send invoice to
                </label>
                <input
                  className="form-input"
                  type="email"
                  value={form.send_to_email}
                  onChange={e => set('send_to_email', e.target.value)}
                />
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Pre-filled from recipient. Editable.</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn btn-outline"
              style={{ justifyContent: 'center', width: '100%' }}
              onClick={() => setShowPreview(true)}
              disabled={!form.recipient_name || !form.taxable_amount}
            >
              <Eye size={14} /> Preview invoice
            </button>
            <button
              className="btn btn-teal"
              style={{ justifyContent: 'center', width: '100%' }}
              onClick={handleSave}
            >
              <Save size={14} /> Save & Send
            </button>
          </div>
        </div>
      </div>

      {/* ── Invoice Preview Modal ── */}
      {showPreview && (
        <InvoicePreviewModal
          form={form}
          amounts={amounts}
          settings={settings}
          onClose={() => setShowPreview(false)}
          onSave={() => { setShowPreview(false); handleSave() }}
        />
      )}

      {/* ── Save Confirm Modal ── */}
      {showSaveConfirm && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowSaveConfirm(false) }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--gray-200)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Confirm invoice issuance</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSaveConfirm(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="alert alert-info" style={{ marginBottom: 20 }}>
                The invoice will be saved, a PDF will be generated, saved to Google Drive, and emailed to the recipient.
              </div>
              <div style={{
                background: 'var(--gray-50)', borderRadius: 'var(--radius)',
                padding: 16, fontSize: 13, marginBottom: 16,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Recipient', form.recipient_name],
                    ['Email', form.send_to_email || form.recipient_email],
                    ['Taxable', amounts ? formatEur(amounts.taxable) : '—'],
                    ['Total', amounts ? formatEur(amounts.total) : '—'],
                    ['Language', form.language === 'fr' ? 'Français' : 'English'],
                    ['Date', form.invoice_date],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{label}</div>
                      <div style={{ fontWeight: 500 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 4, fontWeight: 600 }}>
                Actions:
              </div>
              {['Generate PDF from template', 'Save to Google Drive', 'Send email to recipient', 'Log to invoice registry'].map(action => (
                <div key={action} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--gray-600)', marginBottom: 4 }}>
                  <CheckCircle size={12} style={{ color: 'var(--teal)', flexShrink: 0 }} /> {action}
                </div>
              ))}
              {saveError && (
                <div className="alert alert-error" style={{ marginTop: 14 }}>
                  <AlertCircle size={14} /> {saveError}
                </div>
              )}
            </div>
            <div style={{
              padding: '16px 24px', borderTop: '1px solid var(--gray-200)',
              display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button className="btn btn-outline" onClick={() => setShowSaveConfirm(false)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-teal" onClick={confirmSave} disabled={saving}>
                {saving ? <><div className="spinner" /> Issuing…</> : <><Save size={14} /> Confirm & Issue</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
