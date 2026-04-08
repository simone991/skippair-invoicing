// POST /api/invoices — Create draft invoice
// GET  /api/invoices — List invoices with filters

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateInvoiceForm } from '@/lib/validation'
import { computeAmounts } from '@/lib/vat'
import { InvoiceFormData } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!profile || profile.role === 'user') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body: InvoiceFormData = await req.json()
    const validation = validateInvoiceForm(body)
    if (!validation.valid) return NextResponse.json({ error: 'Validation failed', errors: validation.errors }, { status: 400 })

    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()
    if (!settings) return NextResponse.json({ error: 'Settings not configured' }, { status: 500 })

    const taxable = parseFloat(body.taxable_amount)
    const amounts = computeAmounts(taxable, body.recipient_vat_zone, body.recipient_type, body.language, settings)

    const { data: invoice, error: insertErr } = await supabase
      .from('invoices')
      .insert({
        invoice_date:           body.invoice_date,
        language:               body.language,
        status:                 'draft',
        is_test:                body.is_test ?? false,
        recipient_id:           body.recipient_id || null,
        recipient_name:         body.recipient_name,
        recipient_address:      body.recipient_address,
        recipient_country:      body.recipient_country,
        recipient_country_code: body.recipient_country_code,
        recipient_vat_number:   body.recipient_vat_number || null,
        recipient_email:        body.recipient_email,
        recipient_type:         body.recipient_type,
        recipient_vat_zone:     body.recipient_vat_zone,
        quote_number:           body.quote_number || null,
        service_name:           body.service_name,
        service_type:           body.service_type || null,
        boat_model:             body.boat_model || null,
        boat_year:              body.boat_year || null,
        start_date:             body.start_date || null,
        end_date:               body.end_date || null,
        starting_port:          body.starting_port || null,
        landing_port:           body.landing_port || null,
        nb_travellers:          body.nb_travellers ? parseInt(body.nb_travellers) : null,
        client_total_price:     body.client_total_price || null,
        taxable_amount:         amounts.taxable,
        vat_rate:               amounts.vatRate,
        vat_amount:             amounts.vatAmount,
        total_amount:           amounts.total,
        vat_note:               amounts.vatNote || null,
        issuer_name:            settings.issuer_name,
        issuer_address:         settings.issuer_address,
        issuer_phone:           settings.issuer_phone,
        issuer_email:           settings.issuer_email,
        footer_text:            body.language === 'fr' ? settings.footer_fr : settings.footer_en,
        created_by:             user.id,
      })
      .select()
      .single()

    if (insertErr || !invoice) return NextResponse.json({ error: 'Failed to save', detail: insertErr }, { status: 500 })

    // Log status change: null -> draft
    await supabase.from('invoice_logs').insert({
      invoice_id:  invoice.id,
      from_status: null,
      to_status:   'draft',
      changed_by:  user.id,
      note:        'Invoice created',
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo') ?? ''
  const amountMin = searchParams.get('amountMin') ?? ''
  const amountMax = searchParams.get('amountMax') ?? ''
  const status   = searchParams.get('status') ?? ''

  let query = supabase.from('invoices_log').select('*')
  if (search) query = query.or(`recipient_name.ilike.%${search}%,invoice_number.ilike.%${search}%`)
  if (dateFrom) query = query.gte('invoice_date', dateFrom)
  if (dateTo)   query = query.lte('invoice_date', dateTo)
  if (amountMin) query = query.gte('total_amount', parseFloat(amountMin))
  if (amountMax) query = query.lte('total_amount', parseFloat(amountMax))
  if (status)   query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data })
}
