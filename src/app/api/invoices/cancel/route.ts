// POST /api/invoices/cancel — Cancel invoice (admin only, logical delete)
// DELETE /api/invoices/bulk — Bulk soft delete (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// ── CANCEL ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { invoiceId } = await req.json()
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })

  const { data: invoice } = await supabase.from('invoices').select('status').eq('id', invoiceId).single()
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (invoice.status === 'cancelled') return NextResponse.json({ error: 'Already cancelled' }, { status: 400 })

  await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', invoiceId)
  await supabase.from('invoice_logs').insert({
    invoice_id: invoiceId,
    from_status: invoice.status,
    to_status: 'cancelled',
    changed_by: user.id,
    note: 'Invoice cancelled by admin',
  })

  // TODO: n8n will stamp "CANCELLED" watermark on the PDF in Drive

  return NextResponse.json({ success: true })
}
