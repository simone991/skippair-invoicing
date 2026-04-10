'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { computeAmounts, formatEur, vatLabel, getVatWarning } from '@/lib/vat'
import { validateInvoiceForm } from '@/lib/validation'
import { COUNTRIES, getVatZone } from '@/lib/countries'
import {
  Recipient, InvoiceFormData, InvoiceLanguage,
  RecipientType, VatZone, Settings, ValidationError, Invoice
} from '@/types'
import { Search, RefreshCw, Eye, CheckCircle, AlertCircle, Send, X, Info, Plus } from 'lucide-react'
import InvoicePreviewModal from '@/components/invoice/InvoicePreviewModal'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

// ── Service types — add new invoice types here ────────────────────────────────────────────
const SERVICE_TYPES = [
  { key: 'agency_commission', en: 'Broker fees', fr: "Frais d'agence" },
  // Add more types here, e.g.:
  // { key: 'boat_rental', en: 'Boat rental', fr: 'Location de bateau' },
] as const
type ServiceKey = typeof SERVICE_TYPES[number]['key'] | ''

const STEP_LABELS = ['Quote / Data', 'Recipient', 'VAT Check', 'Preview', 'Save Draft', 'Issue', 'Send']

interface Props { settings: Settings; userRole: 'manager' | 'admin' }

const EMPTY_FORM: InvoiceFormData = {
  invoice_date: new Date().toISOString().split('T')[0],
  language: 'en', quote_number: '', is_test: false,
  recipient_id: '', recipient_name: '', recipient_address: '',
  recipient_country: '', recipient_country_code: '',
  recipient_vat_number: '', recipient_email: '',
  recipient_type: 'company', recipient_vat_zone: 'non-eu',
  service_name: 'Travel agency commission',
  service_type: '', boat_model: '', boat_year: '',
  start_date: '', end_date: '', starting_port: '', landing_port: '',
  nb_travellers: '', client_total_price: '', taxable_amount: '', send_to_email: '',
}

export default function NewInvoiceWizard({ settings, userRole }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<InvoiceFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<ValidationError[]>([])

  // Recipient search
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientResults, setRecipientResults] = useState<Recipient[]>([])
  const [topRecipients, setTopRecipients] = useState<Recipient[]>([])
  const [topLoaded, setTopLoaded] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null)

  // Quote fetch
  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [quoteFetched, setQuoteFetched] = useState(false)
  const [quoteError, setQuoteError] = useState('')

  // Saved invoice
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Send emails
  const [emailList, setEmailList] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  const [serviceKey, setServiceKey] = useState<ServiceKey>('')
  const [showPreview, setShowPreview] = useState(false)
  const supabase = createClient()

  // Restore wizard state if returning from /recipients
  useState(() => {
    if (typeof window === 'undefined') return
    const saved = sessionStorage.getItem('invoiceWizardState')
    if (saved) {
      try {
        const { form: f, step: s, serviceKey: sk } = JSON.parse(saved)
        setForm(f); setStep(s as Step)
        if (sk) setServiceKey(sk as ServiceKey)
      } catch { /* ignore */ }
      sessionStorage.removeItem('invoiceWizardState')
    }
  })

  const setF = (k: keyof InvoiceFormData, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  // ── Quote fetch ─────────────────────────────────────────────
  const fetchQuote = async (forceLang?: string) => {
    if (!form.quote_number.trim()) return
    setFetchingQuote(true); setQuoteError(''); setQuoteFetched(false)
    try {
      const lang = forceLang ?? form.language
      const res = await fetch(`/api/quotes?id=${encodeURIComponent(form.quote_number.trim())}&lang=${lang}`)
      const data = await res.json()
      if (!res.ok) { setQuoteError(data.error); return }
      const f = data.fields
      setForm(prev => ({
        ...prev,
        service_type: f.service_type ?? '', boat_model: f.boat_model ?? '',
        boat_year: f.boat_year ?? '', start_date: f.start_date ?? '',
        end_date: f.end_date ?? '', starting_port: f.starting_port ?? '',
        landing_port: f.landing_port ?? '', nb_travellers: f.nb_travellers?.toString() ?? '',
        client_total_price: f.client_total_price ?? '',
      }))
      setQuoteFetched(true)
    } finally { setFetchingQuote(false) }
  }

  // ── Recipient search ────────────────────────────────────────
  const loadTopRecipients = useCallback(async () => {
    if (topLoaded) return
    const { data } = await supabase.from('recipients').select('*').eq('disabled', false).limit(10)
    // sort by invoice_count if available, else by name
    setTopRecipients(data ?? [])
    setTopLoaded(true)
  }, [topLoaded, supabase])

  const searchRecipients = useCallback(async (q: string) => {
    setRecipientSearch(q)
    if (q.length < 1) { setRecipientResults([]); return }
    const { data } = await supabase.from('recipients').select('*').ilike('name', `%${q}%`).eq('disabled', false).limit(8)
    setRecipientResults(data ?? [])
  }, [supabase])

  const selectRecipient = (rec: Recipient) => {
    setSelectedRecipient(rec)
    setRecipientSearch(rec.name)
    setRecipientResults([])
    setForm(f => ({
      ...f,
      recipient_id: rec.id, recipient_name: rec.name,
      recipient_address: rec.address, recipient_country: rec.country_name,
      recipient_country_code: rec.country_code, recipient_vat_number: rec.vat_number ?? '',
      recipient_email: rec.email, recipient_type: rec.type, recipient_vat_zone: rec.vat_zone,
    }))
    setEmailList(rec.email ? [rec.email] : [])
  }

  // ── Amounts ─────────────────────────────────────────────────
  const taxable = parseFloat(form.taxable_amount) || 0
  const amounts = taxable > 0 && form.recipient_vat_zone
    ? computeAmounts(taxable, form.recipient_vat_zone as VatZone, form.recipient_type as RecipientType, form.language, settings)
    : null

  const vatWarning = form.recipient_name && form.recipient_vat_zone
    ? getVatWarning(form.recipient_vat_zone as VatZone, form.recipient_type as RecipientType, form.recipient_vat_number || null, form.recipient_country_code)
    : null

  // ── Save draft ──────────────────────────────────────────────
  const saveDraft = async () => {
    const result = validateInvoiceForm(form)
    if (!result.valid) { setErrors(result.errors); return }
    setErrors([])
    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setErrors([{ field: 'general', message: data.error ?? 'Save failed' }]); return }
      setSavedInvoice(data.invoice)
      setStep(6)
    } finally { setSaving(false) }
  }

  // ── Issue invoice ───────────────────────────────────────────
  const issueInvoice = async () => {
    if (!savedInvoice) return
    setIssuing(true)
    try {
      const res = await fetch('/api/invoices/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: savedInvoice.id }),
      })
      const data = await res.json()
      if (!res.ok) { setErrors([{ field: 'issue', message: data.error ?? 'Issue failed' }]); return }
      setSavedInvoice(data.invoice)
      setStep(7)
    } finally { setIssuing(false) }
  }

  // ── Send invoice ────────────────────────────────────────────
  const addEmail = () => {
    const e = newEmail.trim().toLowerCase()
    if (e && !emailList.includes(e)) { setEmailList(prev => [...prev, e]) }
    setNewEmail('')
  }

  const sendInvoice = async () => {
    if (!savedInvoice || emailList.length === 0) return
    setSending(true); setSendError('')
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: savedInvoice.id, emails: emailList }),
      })
      const data = await res.json()
      if (!res.ok) { setSendError(data.error ?? 'Send failed'); return }
      router.push(`/invoices?success=${savedInvoice.invoice_number}`)
    } finally { setSending(false) }
  }

  const fieldError = (f: string) => errors.find(e => e.field === f)?.message

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      {/* Step indicator */}
      <div className="steps" style={{ marginBottom: 28 }}>
        {STEP_LABELS.map((label, i) => {
          const s = (i + 1) as Step
          const isDone = step > s
          const isActive = step === s
          return (
            <div key={s} className="step" style={{ flex: 1 }}>
              {i > 0 && <div className={`step-line ${isDone ? 'done' : ''}`} />}
              <div className={`step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="step-num">{isDone ? '✓' : s}</div>
                <span className="step-label" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── STEP 1: Quote / Service data ── */}
      {step === 1 && (
        <div style={{ maxWidth: 700 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--gray-100)' }}>Invoice details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Date <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="form-input" type="date" value={form.invoice_date} onChange={e => setF('invoice_date', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Language <span style={{ color: 'var(--red)' }}>*</span></label>
                <select className="form-select" value={form.language} onChange={e => {
                  const newLang = e.target.value as InvoiceLanguage
                  setF('language', newLang)
                  if (serviceKey) {
                    const found = SERVICE_TYPES.find(s => s.key === serviceKey)
                    if (found) setF('service_name', newLang === 'fr' ? found.fr : found.en)
                  }
                  if (quoteFetched && form.quote_number.trim()) fetchQuote(newLang)
                }}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Quote number</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-input" type="text" placeholder="Q-2025-001" value={form.quote_number}
                    onChange={e => { setF('quote_number', e.target.value); setQuoteFetched(false); setQuoteError('') }}
                    onKeyDown={e => e.key === 'Enter' && fetchQuote()} />
                  <button className="btn btn-outline btn-sm" onClick={fetchQuote} disabled={fetchingQuote || !form.quote_number.trim()} style={{ flexShrink: 0 }}>
                    {fetchingQuote ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <RefreshCw size={13} />}
                  </button>
                </div>
                {quoteError && <span style={{ fontSize: 11, color: 'var(--red)' }}>{quoteError}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_test} onChange={e => setF('is_test', e.target.checked)} />
                Test invoice (PDF will include "TEST" watermark, saved to test folder)
              </label>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '.8px' }}>Service description</div>
              {quoteFetched && <span className="badge badge-teal"><CheckCircle size={10} style={{ marginRight: 4 }} />Auto-filled from quote</span>}
            </div>
            {!quoteFetched && (
              <div className="alert alert-info" style={{ marginBottom: 14, fontSize: 12 }}>
                <Info size={13} style={{ flexShrink: 0 }} />
                Enter a quote number to auto-fill. Without a quote, all description fields are required.
              </div>
            )}
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Invoice type <span style={{ color: 'var(--red)' }}>*</span></label>
                <select className="form-select" value={serviceKey} onChange={e => {
                  const key = e.target.value as ServiceKey
                  setServiceKey(key)
                  const found = SERVICE_TYPES.find(s => s.key === key)
                  if (found) setF('service_name', form.language === 'fr' ? found.fr : found.en)
                }}>
                  <option value="">— Select invoice type —</option>
                  {SERVICE_TYPES.map(s => (
                    <option key={s.key} value={s.key}>{form.language === 'fr' ? s.fr : s.en}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Offer type {!form.quote_number && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  <input className={`form-input ${fieldError('service_type') ? 'error' : ''}`} value={form.service_type} onChange={e => setF('service_type', e.target.value)} placeholder="Boat rental" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Boat model</label>
                  <input className="form-input" value={form.boat_model} onChange={e => setF('boat_model', e.target.value)} placeholder="BALI Catspace 2007" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Start date {!form.quote_number && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  <input className={`form-input ${fieldError('start_date') ? 'error' : ''}`} value={form.start_date} onChange={e => setF('start_date', e.target.value)} placeholder="23.08.2025 17:00" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>End date {!form.quote_number && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  <input className={`form-input ${fieldError('end_date') ? 'error' : ''}`} value={form.end_date} onChange={e => setF('end_date', e.target.value)} placeholder="30.08.2025 09:00" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Starting port {!form.quote_number && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  <input className={`form-input ${fieldError('starting_port') ? 'error' : ''}`} value={form.starting_port} onChange={e => setF('starting_port', e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Landing port {!form.quote_number && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  <input className={`form-input ${fieldError('landing_port') ? 'error' : ''}`} value={form.landing_port} onChange={e => setF('landing_port', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Travellers {!form.quote_number && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  <input className={`form-input ${fieldError('nb_travellers') ? 'error' : ''}`} type="number" value={form.nb_travellers} onChange={e => setF('nb_travellers', e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Client total {!form.quote_number && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  <input className={`form-input ${fieldError('client_total_price') ? 'error' : ''}`} type="text" inputMode="decimal" value={form.client_total_price} onChange={e => setF('client_total_price', e.target.value)} placeholder="3000" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Taxable amount (€) <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className={`form-input ${fieldError('taxable_amount') ? 'error' : ''}`} type="text" inputMode="decimal" value={form.taxable_amount} onChange={e => setF('taxable_amount', e.target.value)} placeholder="450.00" style={{ maxWidth: 200 }} />
                {fieldError('taxable_amount') && <span style={{ fontSize: 11, color: 'var(--red)' }}>{fieldError('taxable_amount')}</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-teal" onClick={() => setStep(2)} disabled={!serviceKey || !form.taxable_amount}>
              Next: Recipient →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Recipient ── */}
      {step === 2 && (
        <div style={{ maxWidth: 600 }}>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 14 }}>Select recipient</div>

            <div style={{ position: 'relative', marginBottom: 12 }} onClick={loadTopRecipients}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input className="form-input" style={{ paddingLeft: 32 }} type="text" placeholder="Type to search…"
                value={recipientSearch} onChange={e => searchRecipients(e.target.value)} />
            </div>

            {recipientResults.length > 0 && (
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 12 }}>
                {recipientResults.map(rec => (
                  <div key={rec.id} onClick={() => selectRecipient(rec)}
                    style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{rec.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                      {COUNTRIES.find(c => c.code === rec.country_code)?.flag} {rec.country_name}
                      {rec.vat_number ? ` · ${rec.vat_number}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!recipientSearch && topRecipients.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 8, fontWeight: 600 }}>Frequent recipients</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {topRecipients.map(rec => (
                    <button key={rec.id} className="btn btn-outline btn-sm" onClick={() => selectRecipient(rec)}>
                      {rec.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedRecipient && (
              <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 14, fontSize: 12, position: 'relative' }}>
                <button onClick={() => { setSelectedRecipient(null); setRecipientSearch('') }}
                  style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                  <X size={14} />
                </button>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', marginBottom: 6 }}>
                  {COUNTRIES.find(c => c.code === selectedRecipient.country_code)?.flag} {selectedRecipient.name}
                </div>
                <div style={{ color: 'var(--gray-600)', lineHeight: 1.8 }}>
                  <div>{selectedRecipient.address}</div>
                  <div>{selectedRecipient.country_name}</div>
                  {selectedRecipient.vat_number && <div>VAT: {selectedRecipient.vat_number}</div>}
                  <div style={{ color: 'var(--teal)' }}>{selectedRecipient.email}</div>
                </div>
              </div>
            )}

            {(userRole === 'manager' || userRole === 'admin') && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--gray-100)' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--teal)', padding: 0, fontSize: 12 }}
                  onClick={() => {
                    sessionStorage.setItem('invoiceWizardState', JSON.stringify({ form, step, serviceKey }))
                    router.push('/recipients?new=1&returnTo=/invoices/new')
                  }}
                >
                  <Plus size={12} /> Add new recipient
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-teal" onClick={() => setStep(3)} disabled={!selectedRecipient}>
              Next: VAT Check →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: VAT Check ── */}
      {step === 3 && (
        <div style={{ maxWidth: 600 }}>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>VAT calculation</div>
            <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 12 }}>
                Recipient: <strong>{form.recipient_name}</strong> · {form.recipient_country} ·{' '}
                <span className={`badge ${form.recipient_vat_zone === 'fr' ? 'badge-red' : form.recipient_vat_zone === 'eu' ? 'badge-amber' : 'badge-navy'}`}>
                  {form.recipient_vat_zone === 'fr' ? '🇫🇷 France 20%' : form.recipient_vat_zone === 'eu' ? '🇪🇺 EU reverse charge' : '🌍 Non-EU 0%'}
                </span>
              </div>
              {amounts && (
                <>
                  {[
                    { label: 'Taxable amount', value: formatEur(amounts.taxable) },
                    { label: vatLabel(amounts.vatRate, form.language), value: formatEur(amounts.vatAmount) },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: 'var(--gray-600)', borderBottom: '1px solid var(--gray-200)' }}>
                      <span>{row.label}</span><span>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 15, fontWeight: 700 }}>
                    <span>Total</span><span style={{ color: 'var(--navy)' }}>{formatEur(amounts.total)}</span>
                  </div>
                  {amounts.vatNote && (
                    <div style={{ marginTop: 12, padding: '10px 12px', background: '#EEF5FF', borderRadius: 'var(--radius)', fontSize: 12, color: '#1A4A8A', fontStyle: 'italic' }}>
                      {amounts.vatNote}
                    </div>
                  )}
                </>
              )}
            </div>

            {vatWarning && (
              <div className="alert alert-warning">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {vatWarning}
              </div>
            )}
            {!vatWarning && (
              <div className="alert alert-success">
                <CheckCircle size={14} style={{ flexShrink: 0 }} />
                VAT configuration looks correct.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-outline" onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn-teal" onClick={() => setStep(4)}>Next: Preview →</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Preview ── */}
      {step === 4 && (
        <div style={{ maxWidth: 600 }}>
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <Eye size={32} style={{ color: 'var(--teal)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Review before saving</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 20 }}>
              Check the invoice preview before saving as draft.
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => setShowPreview(true)} style={{ margin: '0 auto' }}>
              <Eye size={15} /> Open full preview
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-outline" onClick={() => setStep(3)}>← Back</button>
            <button className="btn btn-teal" onClick={() => setStep(5)}>Next: Save Draft →</button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Save Draft ── */}
      {step === 5 && (
        <div style={{ maxWidth: 560 }}>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Save as draft</div>
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              The invoice will be saved with status <strong>Draft</strong>. No PDF is generated yet and no number is assigned.
            </div>
            {errors.map((e, i) => (
              <div key={i} className="alert alert-error" style={{ marginBottom: 8 }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />{e.message}
              </div>
            ))}
            <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 14, fontSize: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Recipient', form.recipient_name],
                  ['Date', form.invoice_date],
                  ['Total', amounts ? formatEur(amounts.total) : '—'],
                  ['Language', form.language === 'fr' ? 'Français' : 'English'],
                  ['Is test', form.is_test ? 'Yes' : 'No'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{label}</div>
                    <div style={{ fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-outline" onClick={() => setStep(4)}>← Back</button>
            <button className="btn btn-teal" onClick={saveDraft} disabled={saving}>
              {saving ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Saving…</> : '✓ Save draft'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 6: Issue ── */}
      {step === 6 && savedInvoice && (
        <div style={{ maxWidth: 560 }}>
          <div className="card">
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              <CheckCircle size={14} style={{ flexShrink: 0 }} />
              Draft saved. Now issue the invoice to assign a number and generate the PDF.
            </div>
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              Issuing will: assign a unique number (format YYMMDD-XXXXX), generate a PDF and save it to Google Drive.
            </div>
            {errors.filter(e => e.field === 'issue').map((e, i) => (
              <div key={i} className="alert alert-error" style={{ marginBottom: 8 }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />{e.message}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-outline" onClick={() => router.push('/invoices')}>Save & exit</button>
            <button className="btn btn-teal" onClick={issueInvoice} disabled={issuing}>
              {issuing ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Issuing…</> : '⚡ Issue invoice'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 7: Send ── */}
      {step === 7 && savedInvoice && (
        <div style={{ maxWidth: 560 }}>
          <div className="card">
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              <CheckCircle size={14} style={{ flexShrink: 0 }} />
              Invoice <strong>{savedInvoice.invoice_number}</strong> issued and PDF saved to Drive.
            </div>
            {!savedInvoice.recipient_email ? (
              <div className="alert alert-warning">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <div>
                  This recipient has no email address — the invoice cannot be sent via the app.
                  {savedInvoice.drive_file_url && (
                    <div style={{ marginTop: 8 }}>
                      <a href={savedInvoice.drive_file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', fontWeight: 500 }}>Open PDF in Drive ↗</a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Send via email</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input className="form-input" type="email" placeholder="Add email address" value={newEmail}
                    onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEmail()} />
                  <button className="btn btn-outline btn-sm" onClick={addEmail} style={{ flexShrink: 0 }}>
                    <Plus size={13} /> Add
                  </button>
                </div>
                {emailList.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {emailList.map(em => (
                      <span key={em} className="badge badge-navy" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {em}
                        <button onClick={() => setEmailList(prev => prev.filter(e => e !== em))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {sendError && <div className="alert alert-error" style={{ marginBottom: 12 }}><AlertCircle size={14} />{sendError}</div>}
              </>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button className="btn btn-outline" onClick={() => router.push(`/invoices?success=${savedInvoice.invoice_number}`)}>
              {savedInvoice.recipient_email ? 'Skip sending' : 'Done'}
            </button>
            {savedInvoice.recipient_email && (
              <button className="btn btn-teal" onClick={sendInvoice} disabled={sending || emailList.length === 0}>
                {sending ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Sending…</> : <><Send size={14} />Send invoice</>}
              </button>
            )}
          </div>
        </div>
      )}

      {showPreview && (
        <InvoicePreviewModal
          form={form} amounts={amounts} settings={settings}
          onClose={() => setShowPreview(false)}
          onSave={() => setShowPreview(false)}
        />
      )}
    </>
  )
}
