'use client'
import { useState, useMemo } from 'react'
import { InvoiceLog, InvoiceFilters, InvoiceStatus, CsvPeriodPreset } from '@/types'
import { formatEur } from '@/lib/vat'
import { downloadCsv, invoicesToCsv, getPresetDateRange, PRESET_LABELS } from '@/lib/csv-export'
import { Search, Download, Trash2, X, FileDown, Ban } from 'lucide-react'

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: 'badge-gray', issued: 'badge-amber', sent: 'badge-green', cancelled: 'badge-red'
}
const VAT_FLAG: Record<string, string> = { fr: '🇫🇷', eu: '🇪🇺', 'non-eu': '🌍' }
const LANG_BADGE: Record<string, string> = { en: 'badge-navy', fr: 'badge-teal' }

export default function InvoicesClient({ invoices, userRole }: { invoices: InvoiceLog[]; userRole: string }) {
  const [filters, setFilters] = useState<InvoiceFilters>({ search: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', status: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvPreset, setCsvPreset] = useState<CsvPeriodPreset>('current_month')
  const [csvFrom, setCsvFrom] = useState('')
  const [csvTo, setCsvTo] = useState('')
  const [acting, setActing] = useState(false)

  const setF = (k: keyof InvoiceFilters, v: string) => setFilters(f => ({ ...f, [k]: v }))

  const filtered = useMemo(() => invoices.filter(inv => {
    const s = filters.search.toLowerCase()
    if (s && !inv.recipient_name.toLowerCase().includes(s) && !(inv.invoice_number ?? '').toLowerCase().includes(s)) return false
    if (filters.dateFrom && inv.invoice_date < filters.dateFrom) return false
    if (filters.dateTo && inv.invoice_date > filters.dateTo) return false
    if (filters.amountMin && inv.total_amount < parseFloat(filters.amountMin)) return false
    if (filters.amountMax && inv.total_amount > parseFloat(filters.amountMax)) return false
    if (filters.status && inv.status !== filters.status) return false
    return true
  }), [invoices, filters])

  const hasFilters = Object.values(filters).some(v => v !== '')
  const toggleAll = (c: boolean) => setSelected(c ? new Set(filtered.map(i => i.id)) : new Set())
  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleCancel = async () => {
    setActing(true)
    await fetch('/api/invoices/bulk', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selected) }) })
    setActing(false); setShowCancelConfirm(false); setSelected(new Set())
    window.location.reload()
  }

  const handleDownload = () => {
    const sel = filtered.filter(i => selected.has(i.id))
    sel.forEach(inv => { if (inv.drive_file_url) window.open(inv.drive_file_url, '_blank') })
  }

  const exportCsv = async () => {
    const range = csvPreset !== 'custom' ? getPresetDateRange(csvPreset) : { from: csvFrom, to: csvTo }
    const params = new URLSearchParams({ preset: csvPreset, dateFrom: range.from, dateTo: range.to })
    const res = await fetch(`/api/export-csv?${params}`)
    const text = await res.text()
    downloadCsv(text, `skippair-invoices-${range.from}-${range.to}.csv`)
    setShowCsvModal(false)
  }

  return (
    <>
      <div className="card">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search recipient or invoice number…" value={filters.search} onChange={e => setF('search', e.target.value)} />
          </div>
          <input className="form-input" type="date" style={{ width: 140 }} value={filters.dateFrom} onChange={e => setF('dateFrom', e.target.value)} title="From" />
          <input className="form-input" type="date" style={{ width: 140 }} value={filters.dateTo} onChange={e => setF('dateTo', e.target.value)} title="To" />
          <input className="form-input" type="number" placeholder="Min €" style={{ width: 80 }} value={filters.amountMin} onChange={e => setF('amountMin', e.target.value)} />
          <input className="form-input" type="number" placeholder="Max €" style={{ width: 80 }} value={filters.amountMax} onChange={e => setF('amountMax', e.target.value)} />
          <select className="form-select" style={{ width: 130 }} value={filters.status} onChange={e => setF('status', e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="sent">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="btn btn-outline btn-sm" onClick={() => setShowCsvModal(true)} title="Export CSV">
            <FileDown size={13} /> Export CSV
          </button>
          {hasFilters && <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ search: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', status: '' })}><X size={13} /> Clear</button>}
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--gray-100)', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{selected.size} selected</span>
            <button className="btn btn-outline btn-sm" onClick={handleDownload}><Download size={13} /> Download from Drive</button>
            {userRole === 'admin' && (
              <button className="btn btn-danger btn-sm" onClick={() => setShowCancelConfirm(true)}><Ban size={13} /> Cancel selected</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}><X size={13} /></button>
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>
          {filtered.length} invoices{hasFilters && ` (filtered from ${invoices.length})`}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th style={{ width: 36 }}><input type="checkbox" style={{ width: 16, height: 16, accentColor: 'var(--teal)', cursor: 'pointer' }} checked={selected.size === filtered.length && filtered.length > 0} onChange={e => toggleAll(e.target.checked)} /></th>
              <th>Invoice #</th><th>Date</th><th>Recipient</th><th>Country</th>
              <th>Taxable</th><th>VAT</th><th>Total</th><th>Lang</th><th>Status</th><th>Drive</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '40px 0' }}>No invoices found.</td></tr>
              ) : filtered.map(inv => (
                <tr key={inv.id} style={{ background: selected.has(inv.id) ? 'var(--teal-light)' : inv.status === 'cancelled' ? 'var(--red-light)' : inv.is_test ? 'var(--amber-light)' : undefined }}>
                  <td><input type="checkbox" style={{ width: 16, height: 16, accentColor: 'var(--teal)', cursor: 'pointer' }} checked={selected.has(inv.id)} onChange={() => toggleOne(inv.id)} /></td>
                  <td>
                    {inv.invoice_number
                      ? <span className="inv-number">{inv.invoice_number}</span>
                      : <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>draft</span>
                    }
                    {inv.is_test && <span className="badge badge-amber" style={{ marginLeft: 4, fontSize: 9 }}>TEST</span>}
                  </td>
                  <td style={{ color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>{new Date(inv.invoice_date).toLocaleDateString('fr-FR')}</td>
                  <td style={{ fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.recipient_name}</td>
                  <td>{VAT_FLAG[inv.recipient_vat_zone]} {inv.recipient_country_code}</td>
                  <td>{formatEur(inv.taxable_amount)}</td>
                  <td style={{ color: 'var(--gray-400)' }}>{inv.vat_rate > 0 ? `${inv.vat_rate}%` : '0%'}</td>
                  <td style={{ fontWeight: 600 }}>{formatEur(inv.total_amount)}</td>
                  <td><span className={`badge ${LANG_BADGE[inv.language] ?? 'badge-navy'}`}>{inv.language.toUpperCase()}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[inv.status]}`}>{inv.status}</span></td>
                  <td>
                    {inv.drive_file_url && (
                      <a href={inv.drive_file_url} target="_blank" rel="noopener noreferrer">
                        <button className="btn btn-ghost btn-sm" title="Open in Drive"><Download size={12} /></button>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel confirm */}
      {showCancelConfirm && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowCancelConfirm(false) }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Cancel invoices</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCancelConfirm(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="alert alert-error">
                Cancel <strong>{selected.size} invoice{selected.size > 1 ? 's' : ''}</strong>? Status will be set to "Cancelled". This cannot be undone.
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowCancelConfirm(false)} disabled={acting}>Cancel</button>
              <button className="btn btn-danger" onClick={handleCancel} disabled={acting}>
                {acting ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: 'white' }} />Processing…</> : <><Ban size={13} /> Confirm cancel</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Export modal */}
      {showCsvModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowCsvModal(false) }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Export invoices to CSV</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCsvModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Period</label>
                  <select className="form-select" value={csvPreset} onChange={e => setCsvPreset(e.target.value as CsvPeriodPreset)}>
                    {Object.entries(PRESET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {csvPreset === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>From</label>
                      <input className="form-input" type="date" value={csvFrom} onChange={e => setCsvFrom(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>To</label>
                      <input className="form-input" type="date" value={csvTo} onChange={e => setCsvTo(e.target.value)} />
                    </div>
                  </div>
                )}
                <div className="alert alert-info" style={{ fontSize: 12 }}>
                  Exports invoices with status: issued, sent, cancelled.
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowCsvModal(false)}>Cancel</button>
              <button className="btn btn-teal" onClick={exportCsv}><FileDown size={13} /> Download CSV</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
