import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

async function deleteDriveFile(driveFileId: string): Promise<void> {
  const url = process.env.N8N_DELETE_DRIVE_WEBHOOK_URL
  if (!url || !driveFileId) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driveFileId }),
    })
  } catch {
    // Fire-and-forget: log failure but don't block the delete operation
    console.error(`Failed to delete Drive file ${driveFileId}`)
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })

  // Fetch drive_file_id for issued/sent invoices before deleting, so we can remove PDFs from Drive
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, status, drive_file_id')
    .in('id', ids)

  // Soft delete + set to cancelled
  await supabase.from('invoices').update({ status: 'cancelled', deleted_at: new Date().toISOString() }).in('id', ids)

  for (const inv of invoices ?? []) {
    await supabase.from('invoice_logs').insert({
      invoice_id: inv.id, from_status: inv.status, to_status: 'cancelled',
      changed_by: user.id, note: 'Bulk deleted by admin',
    })
    // Delete PDF from Drive if the invoice had been issued
    if (inv.drive_file_id) {
      await deleteDriveFile(inv.drive_file_id)
    }
  }

  return NextResponse.json({ deleted: ids.length })
}
