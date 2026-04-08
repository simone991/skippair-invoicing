import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import InvoicesClient from '@/components/invoice/InvoicesClient'
import { Profile, InvoiceLog } from '@/types'

export default async function InvoicesPage({ searchParams }: { searchParams: { success?: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/auth/login')
  const { data: invoices } = await supabase.from('invoices_log').select('*')
  return (
    <div className="app-shell">
      <Sidebar profile={{ ...profile, email: user.email } as Profile} />
      <div className="main-content">
        <div className="topbar">
          <div style={{ fontSize: 16, fontWeight: 600 }}>Invoices</div>
          {profile.role !== 'user' && (
            <Link href="/invoices/new"><button className="btn btn-teal btn-sm">+ New Invoice</button></Link>
          )}
        </div>
        <div className="page-content">
          {searchParams.success && (
            <div className="alert alert-success" style={{ marginBottom: 20 }}>
              ✓ Invoice <strong>{searchParams.success}</strong> issued and sent successfully.
            </div>
          )}
          <InvoicesClient invoices={(invoices ?? []) as InvoiceLog[]} userRole={profile.role} />
        </div>
      </div>
    </div>
  )
}
