// /api/recipients — CRUD + batch CSV import
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateRecipientForm, validateCsvRow } from '@/lib/validation'
import { getVatZone } from '@/lib/countries'
import { RecipientFormData } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search  = searchParams.get('search') ?? ''
  const country = searchParams.get('country') ?? ''
  const topN    = searchParams.get('top') ? parseInt(searchParams.get('top')!) : null

  if (topN) {
    // Return top N recipients by invoice count in last 12 months
    const since = new Date()
    since.setFullYear(since.getFullYear() - 1)
    const { data } = await supabase
      .from('invoices')
      .select('recipient_id, recipient_name')
      .gte('invoice_date', since.toISOString().split('T')[0])
      .not('recipient_id', 'is', null)
    const counts: Record<string, { name: string; count: number }> = {}
    for (const row of data ?? []) {
      if (!row.recipient_id) continue
      if (!counts[row.recipient_id]) counts[row.recipient_id] = { name: row.recipient_name, count: 0 }
      counts[row.recipient_id].count++
    }
    const top = Object.entries(counts)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
    return NextResponse.json({ recipients: top })
  }

  let query = supabase.from('recipients').select('*').eq('disabled', false)
  if (search)  query = query.or(`name.ilike.%${search}%,vat_number.ilike.%${search}%`)
  if (country) query = query.eq('country_code', country)
  const { data, error } = await query.order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recipients: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role === 'user') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  if (body._batch && Array.isArray(body.rows)) {
    const { data: existingVats } = await supabase.from('recipients').select('vat_number').not('vat_number', 'is', null)
    const vatSet = new Set((existingVats ?? []).map((r: { vat_number: string }) => r.vat_number.toUpperCase()))
    const toInsert: RecipientFormData[] = []
    const errors: Array<{ row: number; reason: string }> = []
    let skipped = 0

    body.rows.forEach((row: Record<string, string>, i: number) => {
      // Normalize keys: trim whitespace and lowercase (handles headers like "Name", " name ", etc.)
      const r: Record<string, string> = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), typeof v === 'string' ? v : ''])
      )
      const check = validateCsvRow(r, i + 2, vatSet)
      if (!check.valid) { skipped++; errors.push({ row: i + 2, reason: check.error! }); return }
      const vat = r.vat_number?.toUpperCase() || null
      if (vat) vatSet.add(vat)
      toInsert.push({
        name: r.name!.trim(), type: (r.type as 'company' | 'private') ?? 'company',
        address: r.address!.trim(), country_code: r.country_code!.toUpperCase(),
        country_name: r.country_name?.trim() ?? r.country_code!.toUpperCase(),
        vat_zone: getVatZone(r.country_code!.toUpperCase()),
        vat_number: vat ?? '', email: r.email?.trim().toLowerCase() ?? '',
      })
    })

    if (toInsert.length > 0) {
      await supabase.from('recipients').insert(toInsert.map(r => ({ ...r, created_by: user.id })))
    }
    return NextResponse.json({ result: { imported: toInsert.length, skipped, errors } })
  }

  const { _overwrite, ...formFields } = body
  const overwrite = _overwrite === true
  const formData: RecipientFormData = { ...formFields, vat_zone: getVatZone(body.country_code) }
  const validation = validateRecipientForm(formData)
  if (!validation.valid) return NextResponse.json({ error: 'Validation failed', errors: validation.errors }, { status: 400 })

  if (formData.vat_number) {
    const { data: existing } = await supabase.from('recipients').select('id, name').eq('vat_number', formData.vat_number.toUpperCase()).maybeSingle()
    if (existing && !overwrite) return NextResponse.json({ error: 'duplicate_vat', existing: { id: existing.id, name: existing.name } }, { status: 409 })
    if (existing && overwrite) {
      const { data, error } = await supabase.from('recipients').update({ ...formData, vat_number: formData.vat_number.toUpperCase() }).eq('id', existing.id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ recipient: data, overwritten: true })
    }
  }

  const { data, error } = await supabase.from('recipients').insert({ ...formData, vat_number: formData.vat_number?.toUpperCase() || null, created_by: user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recipient: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role === 'user') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, disabled, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Admin-only: disable/enable recipient
  if (disabled !== undefined && profile.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const updates: Record<string, unknown> = {}
  if (disabled !== undefined) updates.disabled = disabled
  if (rest.name) updates.name = rest.name
  if (rest.address) updates.address = rest.address
  if (rest.email) updates.email = rest.email
  if (rest.vat_number !== undefined) updates.vat_number = rest.vat_number?.toUpperCase() || null

  const { data, error } = await supabase.from('recipients').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recipient: data })
}
