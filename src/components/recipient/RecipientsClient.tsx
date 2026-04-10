'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Recipient, RecipientFormData, VatZone, RecipientType } from '@/types'
import { COUNTRIES, getVatZone } from '@/lib/countries'
import { isVatRequired } from '@/lib/vat'
import { validateRecipientForm } from '@/lib/validation'
import { Search, Plus, Upload, X, AlertCircle, CheckCircle } from 'lucide-react'
import Papa from 'papaparse'

interface Props { recipients: Recipient[]; userRole: string; openNewOnLoad?: boolean }

const EMPTY: RecipientFormData = { name: '', type: 'company', address: '', country_code: '', country_name: '', vat_zone: 'non-eu', vat_number: '', email: '' }

export default function RecipientsClient({ recipients: initial, userRole, openNewOnLoad }: Props) {
  const [recipients, setRecipients] = useState(initial)
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(openNewOnLoad ?? false)
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState<RecipientFormData>(EMPTY)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [dupWarning, setDupWarning] = useState<{ id: string; name: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: Array<{ row: number; reason: string }> } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [countrySearch, setCountrySearch] = useState('')
  const [countryOpen, setCountryOpen] = useState(false)
  const canWrite = userRole === 'manager' || userRole === 'admin'
  const canAdmin = userRole === 'admin'

  useEffect(() => { if (openNewOnLoad) setShowAdd(true) }, [openNewOnLoad])

  const filtered = useMemo(() => recipients.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !(r.vat_number ?? '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterCountry && r.country_code !== filterCountry) return false
    return true
  }), [recipients, search, filterCountry])

  const uniqueCountries = [...new Set(recipients.map(r => r.country_code))].sort()
  const setF = (k: keyof RecipientFormData, v: string) => setForm(f => ({ ...f, [k]: v }))
  const handleCountry = (code: string) => {
    const c = COUNTRIES.find(c => c.code === code)
    setForm(f => ({ ...f, country_code: code, country_name: c?.name ?? '', vat_zone: getVatZone(code) }))
  }
  const vatReq = isVatRequired(form.vat_zone as VatZone, form.type as RecipientType)

  const openEdit = (rec: Recipient) => {
    setForm({ name: rec.name, type: rec.type, address: rec.address, country_code: rec.country_code, country_name: rec.country_name, vat_zone: rec.vat_zone, vat_number: rec.vat_number ?? '', email: rec.email })
    setCountrySearch(rec.country_name)
    setEditingId(rec.id); setFormErrors([]); setDupWarning(null); setShowAdd(true)
  }

  const closeAdd = () => { setShowAdd(false); setForm(EMPTY); setCountrySearch(''); setFormErrors([]); setDupWarning(null); setEditingId(null) }

  const saveRecipient = async (overwrite = false) => {
    const v = validateRecipientForm(form)
    if (!v.valid) { setFormErrors(v.errors.map(e => e.message)); return }
    setFormErrors([]); setSaving(true)
    try {
      const url = editingId ? '/api/recipients' : '/api/recipients'
      const method = editingId ? 'PATCH' : 'POST'
      const body = editingId ? { ...form, id: editingId, _overwrite: overwrite } : { ...form, _overwrite: overwrite }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (res.status === 409 && data.error === 'duplicate_vat') { setDupWarning(data.existing); return }
      if (!res.ok) { setFormErrors([data.error ?? 'Save failed']); return }
      const rec = data.recipient
      setRecipients(prev => editingId ? prev.map(r => r.id === editingId ? rec : r) : [...prev, rec].sort((a, b) => a.name.localeCompare(b.name)))
      closeAdd()
    } finally { setSaving(false) }
  }

  const toggleDisable = async (rec: Recipient) => {
    const res = await fetch('/api/recipients', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rec.id, disabled: !rec.disabled }) })
    if (res.ok) setRecipients(prev => prev.map(r => r.id === rec.id ? { ...r, disabled: !r.disabled } : r))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    Papa.parse<Record<string, string>>(file, { header: true, skipEmptyLines: true, complete: r => { setCsvRows(r.data); setImportResult(null) } })
  }

  const handleImport = async () => {
    if (!csvRows.length) return; setImporting(true)
    const res = await fetch('/api/recipients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _batch: true, rows: csvRows }) })
    const data = await res.json(); setImporting(false)
    if (!res.ok) return
    setImportResult(data.result)
    const fresh = await fetch('/api/recipients'); const fd = await fresh.json()
    setRecipients(fd.recipients ?? [])
  }

  const VAT_ZONE_LABEL: Record<string, string> = { fr: '🇫🇷 France', eu: '🇪🇺 EU', 'non-eu': '🌍 Non-EU' }
  const VAT_ZONE_BADGE: Record<string, string> = { fr: 'badge-red', eu: 'badge-amber', 'non-eu': 'badge-navy' }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div><div style={{ fontSize: 20, fontWeight: 600 }}>Recipients</div><div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 3 }}>Invoice recipient registry</div></div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)}><Upload size={13} /> Import CSV</button>
            <button className="btn btn-teal btn-sm" onClick={() => { setForm(EMPTY); setEditingId(null); setShowAdd(true) }}><Plus size={13} /> New recipient</button>
          </div>
        )}
      </div>
      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search name or VAT…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 160 }} value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
            <option value="">All countries</option>
            {uniqueCountries.map(c => { const co = COUNTRIES.find(x => x.code === c); return <option key={c} value={c}>{co?.flag} {co?.name ?? c}</option> })}
          </select>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>{filtered.length} recipients</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Name</th><th>Address</th><th>Country</th><th>VAT Zone</th><th>VAT #</th><th>Email</th><th>Type</th><th>Status</th>
              {canWrite && <th>Actions</th>}
            </tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '40px 0' }}>No recipients found.</td></tr>
                : filtered.map(rec => (
                  <tr key={rec.id} style={{ opacity: rec.disabled ? .5 : 1 }}>
                    <td style={{ fontWeight: 500 }}>{rec.name}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-600)' }}>{rec.address}</td>
                    <td>{COUNTRIES.find(c => c.code === rec.country_code)?.flag} {rec.country_name}</td>
                    <td><span className={`badge ${VAT_ZONE_BADGE[rec.vat_zone]}`}>{VAT_ZONE_LABEL[rec.vat_zone]}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{rec.vat_number ?? '—'}</td>
                    <td style={{ color: 'var(--teal)', fontSize: 12 }}>{rec.email}</td>
                    <td><span className={`badge ${rec.type === 'private' ? 'badge-teal' : 'badge-navy'}`}>{rec.type}</span></td>
                    <td><span className={`badge ${rec.disabled ? 'badge-red' : 'badge-green'}`}>{rec.disabled ? 'Disabled' : 'Active'}</span></td>
                    {canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(rec)}>Edit</button>
                          {canAdmin && (
                            <button className={`btn btn-sm ${rec.disabled ? 'btn-teal' : 'btn-outline'}`} onClick={() => toggleDisable(rec)}>
                              {rec.disabled ? 'Enable' : 'Disable'}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) closeAdd() }}>
          <div className="modal">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{editingId ? 'Edit recipient' : 'New recipient'}</span>
              <button className="btn btn-ghost btn-sm" onClick={closeAdd}><X size={16} /></button>
            </div>
            <div style={{ padding: 24 }}>
              {formErrors.length > 0 && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={14} style={{ flexShrink: 0 }} /><ul style={{ paddingLeft: 16 }}>{formErrors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
              <div style={{ display: 'grid', gap: 14 }}>
                {[
                  { label: 'Name / Company', key: 'name', req: true, placeholder: 'Navi-Gate GmbH' },
                  { label: 'Address', key: 'address', req: true, placeholder: 'Street, City, Postal code' },
                  { label: 'Email', key: 'email', req: false, placeholder: 'contact@company.com', type: 'email' },
                ].map(f => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>{f.label} {f.req && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                    <input className="form-input" type={f.type ?? 'text'} placeholder={f.placeholder} value={(form as unknown as Record<string, string>)[f.key]} onChange={e => setF(f.key as keyof RecipientFormData, e.target.value)} />
                  </div>
                ))}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Type <span style={{ color: 'var(--red)' }}>*</span></label>
                  <select className="form-select" value={form.type} onChange={e => setF('type', e.target.value as RecipientType)}>
                    <option value="company">Company</option><option value="private">Private individual</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Country <span style={{ color: 'var(--red)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      placeholder="Type to search country…"
                      autoComplete="off"
                      value={countrySearch}
                      onChange={e => { setCountrySearch(e.target.value); setCountryOpen(true) }}
                      onFocus={() => setCountryOpen(true)}
                      onBlur={() => setTimeout(() => setCountryOpen(false), 150)}
                    />
                    {countryOpen && (() => {
                      const q = countrySearch.trim().toLowerCase()
                      const matches = COUNTRIES.filter(c => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
                      return (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 200, overflowY: 'auto' }}>
                          {matches.length === 0
                            ? <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--gray-400)' }}>No country found</div>
                            : matches.map(c => (
                              <div key={c.code}
                                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, background: c.code === form.country_code ? 'var(--teal-light)' : 'white', display: 'flex', alignItems: 'center', gap: 6 }}
                                onMouseDown={() => { handleCountry(c.code); setCountrySearch(c.name); setCountryOpen(false) }}
                              >
                                <span>{c.flag}</span><span>{c.name}</span><span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gray-400)' }}>{c.code}</span>
                              </div>
                            ))
                          }
                        </div>
                      )
                    })()}
                  </div>
                  {form.country_code && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Code: {form.country_code} · Zone: {form.vat_zone}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>VAT Number {vatReq && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  <input className="form-input" style={{ fontFamily: 'var(--font-mono)' }} value={form.vat_number} onChange={e => setF('vat_number', e.target.value.toUpperCase())} placeholder={form.country_code ? `${form.country_code}12345678` : 'e.g. DE123456789'} />
                  <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{vatReq ? 'Required for EU companies' : 'Optional'}</span>
                </div>
                {dupWarning && (
                  <div className="alert alert-warning">
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <div>VAT already exists: <strong>{dupWarning.name}</strong>.
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setDupWarning(null)}>Cancel</button>
                        <button className="btn btn-danger btn-sm" onClick={() => saveRecipient(true)}>Overwrite</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'flex-end', gap: 8, position: 'sticky', bottom: 0, background: 'white' }}>
              <button className="btn btn-outline" onClick={closeAdd} disabled={saving}>Cancel</button>
              <button className="btn btn-teal" onClick={() => saveRecipient(false)} disabled={saving}>
                {saving ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Saving…</> : <><CheckCircle size={13} />{editingId ? 'Save' : 'Add recipient'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV import modal */}
      {showImport && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setShowImport(false); setCsvRows([]); setImportResult(null) } }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Import from CSV</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowImport(false); setCsvRows([]); setImportResult(null) }}><X size={16} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12 }}>
                Required columns: <code>name, type, address, country_code, vat_number, email</code>
              </div>
              {!importResult ? (
                <>
                  <div style={{ border: '2px dashed var(--gray-200)', borderRadius: 'var(--radius)', padding: 32, textAlign: 'center', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
                    <Upload size={24} style={{ color: 'var(--gray-400)', margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 12 }}>Click to choose a CSV file</div>
                    <button className="btn btn-outline btn-sm" type="button">Choose file</button>
                    <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
                  </div>
                  {csvRows.length > 0 && <div className="alert alert-success" style={{ marginTop: 12 }}><CheckCircle size={14} style={{ flexShrink: 0 }} /><strong>{csvRows.length} rows</strong> ready to import.</div>}
                </>
              ) : (
                <>
                  <div className="alert alert-success" style={{ marginBottom: 12 }}><CheckCircle size={14} style={{ flexShrink: 0 }} /><strong>{importResult.imported} imported</strong>, {importResult.skipped} skipped.</div>
                  {importResult.errors.length > 0 && (
                    <div className="alert alert-warning">
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.8 }}>
                        {importResult.errors.map((e, i) => <div key={i}>{e.reason}</div>)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => { setShowImport(false); setCsvRows([]); setImportResult(null) }}>{importResult ? 'Close' : 'Cancel'}</button>
              {!importResult && <button className="btn btn-teal" onClick={handleImport} disabled={!csvRows.length || importing}>
                {importing ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Importing…</> : `Import ${csvRows.length} rows`}
              </button>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
