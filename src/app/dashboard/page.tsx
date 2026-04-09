import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import { Profile, InvoiceLog } from '@/types'
import { formatEur } from '@/lib/vat'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/auth/login')
  const fullProfile: Profile = { ...profile, email: user.email }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const yearStart  = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]

  const [
    { count: totalCount },
    { count: draftCount },
    { count: issuedCount },
    { data: monthData },
    { data: recentInvoices },
    { data: recentDrafts },
    { data: recentIssued },
  ] = await Promise.all([
    supabase.from('invoices').select('*', { count: 'exact', head: true }).neq('status', 'cancelled').is('deleted_at', null),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'draft').is('deleted_at', null),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'issued').is('deleted_at', null),
    supabase.from('invoices').select('taxable_amount, invoice_date').gte('invoice_date', monthStart).neq('status', 'cancelled'),
    supabase.from('invoices_log').select('*').limit(5),
    supabase.from('invoices_log').select('*').eq('status', 'draft').limit(5),
    supabase.from('invoices_log').select('*').eq('status', 'issued').limit(5),
  ])

  const monthRevenue = (monthData ?? []).reduce((s, r) => s + (r.taxable_amount ?? 0), 0)

  // Top 5 recipients last 12 months
  const since12m = new Date(); since12m.setFullYear(since12m.getFullYear() - 1)
  const { data: allInvoices } = await supabase.from('invoices')
    .select('recipient_name').gte('invoice_date', since12m.toISOString().split('T')[0])
    .neq('status', 'cancelled').is('deleted_at', null)

  const recipCounts: Record<string, number> = {}
  for (const inv of allInvoices ?? []) {
    recipCounts[inv.recipient_name] = (recipCounts[inv.recipient_name] ?? 0) + 1
  }
  const topRecipients = Object.entries(recipCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Monthly KPI last 6 months
  const { data: yearInvoices } = await supabase.from('invoices')
    .select('invoice_date, taxable_amount').gte('invoice_date', yearStart)
    .neq('status', 'cancelled').is('deleted_at', null)

  const monthlyMap: Record<string, { count: number; revenue: number }> = {}
  for (const inv of yearInvoices ?? []) {
    const m = inv.invoice_date.slice(0, 7)
    if (!monthlyMap[m]) monthlyMap[m] = { count: 0, revenue: 0 }
    monthlyMap[m].count++
    monthlyMap[m].revenue += inv.taxable_amount ?? 0
  }
  const monthlyKpi = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))

  const STATUS_BADGE: Record<string, string> = {
    draft: 'badge-gray', issued: 'badge-amber', sent: 'badge-green', cancelled: 'badge-red'
  }

  const InvoiceRow = ({ inv }: { inv: InvoiceLog }) => (
    <tr>
      <td><span className="inv-number">{inv.invoice_number ?? <span style={{ color: 'var(--gray-400)' }}>Draft</span>}</span></td>
      <td style={{ fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.recipient_name}</td>
      <td style={{ fontWeight: 600 }}>{formatEur(inv.total_amount)}</td>
      <td style={{ color: 'var(--gray-400)' }}>{new Date(inv.invoice_date).toLocaleDateString('fr-FR')}</td>
      <td><span className={`badge ${STATUS_BADGE[inv.status] ?? 'badge-gray'}`}>{inv.status}</span></td>
      <td>
        {inv.drive_file_url && (inv.status === 'issued' || inv.status === 'sent') && (
          <a href={inv.drive_file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>PDF ↗</a>
        )}
      </td>
    </tr>
  )

  const maxRevenue = Math.max(...monthlyKpi.map(m => m.revenue), 1)

  return (
    <div className="app-shell">
      <Sidebar profile={fullProfile} />
      <div className="main-content">
        <div className="topbar">
          <div style={{ fontSize: 16, fontWeight: 600 }}>Dashboard</div>
          {profile.role !== 'user' && (
            <Link href="/invoices/new"><button className="btn btn-teal btn-sm">+ New Invoice</button></Link>
          )}
        </div>
        <div className="page-content">

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total invoices', value: totalCount ?? 0, sub: 'All time (excl. cancelled)' },
              { label: 'This month revenue', value: formatEur(monthRevenue), sub: now.toLocaleString('en', { month: 'long', year: 'numeric' }) },
              { label: 'Drafts pending', value: draftCount ?? 0, sub: 'To be issued', color: (draftCount ?? 0) > 0 ? 'var(--amber)' : undefined },
              { label: 'Issued, unsent', value: issuedCount ?? 0, sub: 'Ready to send', color: (issuedCount ?? 0) > 0 ? 'var(--teal)' : undefined },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: s.color ?? 'var(--gray-800)' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 16, marginBottom: 16 }}>

            {/* Monthly revenue chart */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Revenue this year</div>
              {monthlyKpi.length === 0
                ? <div style={{ color: 'var(--gray-400)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No data yet</div>
                : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                    {monthlyKpi.map(m => (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600 }}>{formatEur(m.revenue).replace('€','').trim()}</div>
                        <div style={{
                          width: '100%', background: 'var(--teal)', borderRadius: '3px 3px 0 0',
                          height: `${Math.max(4, (m.revenue / maxRevenue) * 80)}px`,
                          opacity: .85,
                        }} />
                        <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{m.month.slice(5)}</div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Top recipients */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Top recipients (12 months)</div>
              {topRecipients.length === 0
                ? <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>No data yet</div>
                : topRecipients.map((r, i) => (
                  <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--teal-mid)', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <span className="badge badge-teal">{r.count}</span>
                  </div>
                ))
              }
            </div>

            {/* Quick actions */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Quick actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {profile.role !== 'user' && (
                  <Link href="/invoices/new" style={{ textDecoration: 'none' }}>
                    <button className="btn btn-teal" style={{ justifyContent: 'center', width: '100%' }}>+ Create invoice</button>
                  </Link>
                )}
                <Link href="/invoices" style={{ textDecoration: 'none' }}>
                  <button className="btn btn-outline" style={{ justifyContent: 'center', width: '100%' }}>Browse invoices</button>
                </Link>
                <Link href="/recipients" style={{ textDecoration: 'none' }}>
                  <button className="btn btn-outline" style={{ justifyContent: 'center', width: '100%' }}>Manage recipients</button>
                </Link>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {/* Recent invoices */}
            <div className="card" style={{ gridColumn: '1 / 3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Recent invoices</span>
                <Link href="/invoices" style={{ fontSize: 12, color: 'var(--teal)', textDecoration: 'none' }}>View all →</Link>
              </div>
              <table className="data-table">
                <thead><tr><th>Invoice #</th><th>Recipient</th><th>Total</th><th>Date</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {(recentInvoices as InvoiceLog[] ?? []).length === 0
                    ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '20px 0' }}>No invoices yet</td></tr>
                    : (recentInvoices as InvoiceLog[]).map(inv => <InvoiceRow key={inv.id} inv={inv} />)
                  }
                </tbody>
              </table>
            </div>

            {/* Drafts & Issued panels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>Pending drafts</div>
                {(recentDrafts as InvoiceLog[] ?? []).length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>No drafts</div>
                  : (recentDrafts as InvoiceLog[]).map(inv => (
                    <div key={inv.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{inv.recipient_name}</span>
                      <span style={{ fontWeight: 600, flexShrink: 0 }}>{formatEur(inv.total_amount)}</span>
                    </div>
                  ))
                }
              </div>
              <div className="card">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>Ready to send</div>
                {(recentIssued as InvoiceLog[] ?? []).length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Nothing pending</div>
                  : (recentIssued as InvoiceLog[]).map(inv => (
                    <div key={inv.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="inv-number">{inv.invoice_number}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {inv.drive_file_url && (
                          <a href={inv.drive_file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', fontSize: 11, fontWeight: 500, textDecoration: 'none' }}>PDF ↗</a>
                        )}
                        <span style={{ fontWeight: 600 }}>{formatEur(inv.total_amount)}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
