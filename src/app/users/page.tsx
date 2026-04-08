import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import UsersClient from '@/components/user/UsersClient'
import { Profile } from '@/types'

export default async function UsersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const { data: profiles } = await supabase.from('profiles').select('*').order('full_name')
  const admin = createAdminClient()
  const { data: authUsers } = await admin.auth.admin.listUsers()
  const emailMap: Record<string, string> = Object.fromEntries(
    (authUsers?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? ''])
  )
  const enriched: Profile[] = (profiles ?? []).map(p => ({ ...p, email: emailMap[p.id] ?? '' }))

  return (
    <div className="app-shell">
      <Sidebar profile={{ ...profile, email: user.email } as Profile} />
      <div className="main-content">
        <div className="topbar"><div style={{ fontSize: 16, fontWeight: 600 }}>User Management</div></div>
        <div className="page-content">
          <UsersClient users={enriched} currentUserId={user.id} />
        </div>
      </div>
    </div>
  )
}
