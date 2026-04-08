import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import { Profile } from '@/types'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status === 'disabled') {
    await supabase.auth.signOut()
    redirect('/auth/login?error=disabled')
  }

  const fullProfile: Profile = {
    ...profile,
    email: user.email,
  }

  return (
    <div className="app-shell">
      <Sidebar profile={fullProfile} />
      <div className="main-content">
        {children}
      </div>
    </div>
  )
}
