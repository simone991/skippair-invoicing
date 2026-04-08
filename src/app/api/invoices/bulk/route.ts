import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })

  // Soft delete + set to cancelled
  await supabase.from('invoices').update({ status: 'cancelled', deleted_at: new Date().toISOString() }).in('id', ids)

  for (const id of ids) {
    await supabase.from('invoice_logs').insert({
      invoice_id: id, from_status: null, to_status: 'cancelled',
      changed_by: user.id, note: 'Bulk cancelled/deleted by admin',
    })
  }

  return NextResponse.json({ deleted: ids.length })
}
