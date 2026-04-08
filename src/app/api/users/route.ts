import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase'
import { UserRole } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  let query = supabase.from('profiles').select('*')
  if (search) query = query.ilike('full_name', `%${search}%`)
  const { data: profiles, error } = await query.order('full_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()
  const { data: authUsers } = await admin.auth.admin.listUsers()
  const emailMap = Object.fromEntries((authUsers?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? '']))
  const enriched = (profiles ?? []).map(p => ({ ...p, email: emailMap[p.id] ?? '' }))
  return NextResponse.json({ users: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { full_name, email, password, role } = await req.json()
  if (!full_name || !email || !password || !role) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  if (!['user', 'manager', 'admin'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const admin = createAdminClient()
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name, role },
  })
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })
  await supabase.from('profiles').update({ full_name, role }).eq('id', newUser.user!.id)
  return NextResponse.json({ user: newUser.user }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id, role, status } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, string> = {}
  if (role) updates.role = role as UserRole
  if (status) updates.status = status
  await supabase.from('profiles').update(updates).eq('id', id)

  if (status === 'disabled') {
    const admin = createAdminClient()
    await admin.auth.admin.updateUserById(id, { ban_duration: '876600h' })
  } else if (status === 'active') {
    const admin = createAdminClient()
    await admin.auth.admin.updateUserById(id, { ban_duration: 'none' })
  }
  return NextResponse.json({ updated: true })
}
