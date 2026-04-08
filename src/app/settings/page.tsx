import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import SettingsClient from '@/components/ui/SettingsClient'
import { Profile, Settings } from '@/types'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()

  return (
    <div className="app-shell">
      <Sidebar profile={{ ...profile, email: user.email } as Profile} />
      <div className="main-content">
        <div className="topbar"><div style={{ fontSize: 16, fontWeight: 600 }}>Settings</div></div>
        <div className="page-content">
          <SettingsClient settings={settings as Settings} />
        </div>
      </div>
    </div>
  )
}
