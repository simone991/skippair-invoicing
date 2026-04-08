import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import NewInvoiceWizard from '@/components/invoice/NewInvoiceWizard'
import { Profile, Settings } from '@/types'

export default async function NewInvoicePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role === 'user') redirect('/dashboard')
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (!settings) redirect('/settings')

  return (
    <div className="app-shell">
      <Sidebar profile={{ ...profile, email: user.email } as Profile} />
      <div className="main-content">
        <div className="topbar">
          <div style={{ fontSize: 16, fontWeight: 600 }}>New Invoice</div>
        </div>
        <div className="page-content">
          <NewInvoiceWizard settings={settings as Settings} userRole={profile.role} />
        </div>
      </div>
    </div>
  )
}
