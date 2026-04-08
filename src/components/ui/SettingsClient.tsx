'use client'
import { useState } from 'react'
import { Settings } from '@/types'
import { Save, CheckCircle, AlertCircle, FlaskConical } from 'lucide-react'

export default function SettingsClient({ settings: initial }: { settings: Settings }) {
  const [s, setS] = useState<Settings>(initial)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'invoice' | 'source' | 'email' | 'test'>('invoice')

  const set = (k: keyof Settings, v: string) => setS(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    setSaving(true); setResult(null)
    const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
    setSaving(false); setResult(res.ok ? 'success' : 'error')
    setTimeout(() => setResult(null), 3000)
  }

  const sendTest = async () => {
    if (!testEmail) return
    setTestSending(true); setTestMsg('')
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_date: new Date().toISOString().split('T')[0],
        language: 'en', is_test: true, quote_number: 'TEST',
        recipient_name: 'Test Recipient', recipient_address: '1 Test Street', recipient_country: 'France',
        recipient_country_code: 'FR', recipient_email: testEmail, recipient_type: 'company', recipient_vat_zone: 'fr',
        service_name: 'Travel agency commission', service_type: 'Test', taxable_amount: '100',
        start_date: '01.01.2026', end_date: '07.01.2026', starting_port: 'Test Port', landing_port: 'Test Port', nb_travellers: '2', client_total_price: '1.000 EUR',
      }),
    })
    if (res.ok) {
      const data = await res.json()
      // Issue & send
      await fetch('/api/invoices/issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: data.invoice.id }) })
      await fetch('/api/invoices/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: data.invoice.id, emails: [testEmail] }) })
      setTestMsg(`Test invoice sent to ${testEmail}`)
    } else {
      setTestMsg('Failed to send test invoice')
    }
    setTestSending(false)
  }

  const Field = ({ label, req, hint, children }: { label: string; req?: boolean; hint?: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>{label}{req && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{hint}</span>}
    </div>
  )

  const TABS = [
    { key: 'invoice', label: 'Invoice template' },
    { key: 'source', label: 'Quote source' },
    { key: 'email', label: 'Email template' },
    { key: 'test', label: 'Test' },
  ] as const

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div><div style={{ fontSize: 20, fontWeight: 600 }}>Settings</div><div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 3 }}>Admin configuration</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {result === 'success' && <span style={{ fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={14} />Saved</span>}
          {result === 'error' && <span style={{ fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={14} />Failed</span>}
          {activeTab !== 'test' && (
            <button className="btn btn-teal" onClick={save} disabled={saving}>
              {saving ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Saving…</> : <><Save size={14} />Save changes</>}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 20 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              color: activeTab === tab.key ? 'var(--navy)' : 'var(--gray-400)',
              borderBottom: activeTab === tab.key ? '2px solid var(--teal)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoice template tab */}
      {activeTab === 'invoice' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Issuer details</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Company name" req><input className="form-input" value={s.issuer_name} onChange={e => set('issuer_name', e.target.value)} /></Field>
              <Field label="Address" req><input className="form-input" value={s.issuer_address} onChange={e => set('issuer_address', e.target.value)} /></Field>
              <Field label="Phone"><input className="form-input" value={s.issuer_phone} onChange={e => set('issuer_phone', e.target.value)} /></Field>
              <Field label="Email"><input className="form-input" type="email" value={s.issuer_email} onChange={e => set('issuer_email', e.target.value)} /></Field>
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>VAT notes</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="EU recipient — English"><textarea className="form-textarea" style={{ minHeight: 60 }} value={s.vat_note_eu_en} onChange={e => set('vat_note_eu_en', e.target.value)} /></Field>
              <Field label="EU recipient — French"><textarea className="form-textarea" style={{ minHeight: 60 }} value={s.vat_note_eu_fr} onChange={e => set('vat_note_eu_fr', e.target.value)} /></Field>
              <Field label="Non-EU recipient — English"><textarea className="form-textarea" style={{ minHeight: 60 }} value={s.vat_note_non_eu_en} onChange={e => set('vat_note_non_eu_en', e.target.value)} /></Field>
              <Field label="Non-EU recipient — French"><textarea className="form-textarea" style={{ minHeight: 60 }} value={s.vat_note_non_eu_fr} onChange={e => set('vat_note_non_eu_fr', e.target.value)} /></Field>
            </div>
          </div>
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Invoice footer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Footer — English"><textarea className="form-textarea" style={{ minHeight: 80 }} value={s.footer_en} onChange={e => set('footer_en', e.target.value)} /></Field>
              <Field label="Footer — French"><textarea className="form-textarea" style={{ minHeight: 80 }} value={s.footer_fr} onChange={e => set('footer_fr', e.target.value)} /></Field>
            </div>
          </div>
        </div>
      )}

      {/* Quote source tab */}
      {activeTab === 'source' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Google Sheets — Quotations</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Sheet ID" req hint="Found in the Google Sheets URL: /spreadsheets/d/ID/edit">
                <input className="form-input" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} value={s.gsheet_id} onChange={e => set('gsheet_id', e.target.value)} />
              </Field>
              <Field label="Tab name" req><input className="form-input" value={s.gsheet_tab} onChange={e => set('gsheet_tab', e.target.value)} /></Field>
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Google Drive — PDF storage</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Production folder ID" hint="Found in the Drive folder URL: /drive/folders/ID">
                <input className="form-input" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} value={s.gdrive_folder_id ?? ''} onChange={e => set('gdrive_folder_id', e.target.value)} />
              </Field>
              <Field label="Test folder ID" hint="Used for test invoices (TEST watermark)">
                <input className="form-input" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} value={(s as Settings & { gdrive_test_folder_id?: string }).gdrive_test_folder_id ?? ''} onChange={e => set('gdrive_test_folder_id' as keyof Settings, e.target.value)} />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* Email template tab */}
      {activeTab === 'email' && (
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Email template</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Subject — English"><input className="form-input" value={s.email_subject_en} onChange={e => set('email_subject_en', e.target.value)} /></Field>
              <Field label="Body — English"><textarea className="form-textarea" style={{ minHeight: 160 }} value={s.email_body_en} onChange={e => set('email_body_en', e.target.value)} /></Field>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Subject — French"><input className="form-input" value={s.email_subject_fr} onChange={e => set('email_subject_fr', e.target.value)} /></Field>
              <Field label="Body — French"><textarea className="form-textarea" style={{ minHeight: 160 }} value={s.email_body_fr} onChange={e => set('email_body_fr', e.target.value)} /></Field>
            </div>
          </div>
          <div className="alert alert-info" style={{ marginTop: 14, fontSize: 12 }}>
            Placeholders: <code>{'{{invoice_number}}'}</code> <code>{'{{recipient_name}}'}</code> <code>{'{{sender_name}}'}</code> <code>{'{{invoice_date}}'}</code> <code>{'{{total_amount}}'}</code>
          </div>
        </div>
      )}

      {/* Test tab */}
      {activeTab === 'test' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <FlaskConical size={20} style={{ color: 'var(--amber)' }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Send test invoice</div>
          </div>
          <div className="alert alert-warning" style={{ marginBottom: 20, fontSize: 12 }}>
            This generates a sample invoice with a <strong>TEST watermark</strong>, saves it to the test Drive folder, and sends it to the specified address. No record is written to the invoice log.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Send test to email</label>
              <input className="form-input" type="email" placeholder="your@email.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
            </div>
            {testMsg && <div className={`alert ${testMsg.includes('Failed') ? 'alert-error' : 'alert-success'}`}>{testMsg}</div>}
            <button className="btn btn-outline" onClick={sendTest} disabled={testSending || !testEmail} style={{ alignSelf: 'flex-start' }}>
              {testSending ? <><div className="spinner" />Sending…</> : <><FlaskConical size={14} />Send test invoice</>}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
