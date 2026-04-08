import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import RecipientsClient from '@/components/recipient/RecipientsClient'
import { Profile, Recipient } from '@/types'

export default async function RecipientsPage({ searchParams }: { searchParams: { new?: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/auth/login')
  const { data: recipients } = await supabase.from('recipients').select('*').order('name')
  return (
    <div className="app-shell">
      <Sidebar profile={{ ...profile, email: user.email } as Profile} />
      <div className="main-content">
        <div className="topbar"><div style={{ fontSize: 16, fontWeight: 600 }}>Recipients</div></div>
        <div className="page-content">
          <RecipientsClient recipients={(recipients ?? []) as Recipient[]} userRole={profile.role} openNewOnLoad={searchParams.new === '1'} />
        </div>
      </div>
    </div>
  )
}
