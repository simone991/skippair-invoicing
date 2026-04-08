// GET /api/export-csv — Export invoices as CSV

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { invoicesToCsv, getPresetDateRange } from '@/lib/csv-export'
import { CsvPeriodPreset, InvoiceLog } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const preset  = (searchParams.get('preset') ?? 'custom') as CsvPeriodPreset
  let dateFrom  = searchParams.get('dateFrom') ?? ''
  let dateTo    = searchParams.get('dateTo') ?? ''

  if (preset !== 'custom') {
    const range = getPresetDateRange(preset)
    dateFrom = range.from
    dateTo   = range.to
  }

  let query = supabase
    .from('invoices_log')
    .select('*')
    .in('status', ['issued', 'sent', 'cancelled'])

  if (dateFrom) query = query.gte('invoice_date', dateFrom)
  if (dateTo)   query = query.lte('invoice_date', dateTo)

  const { data, error } = await query.order('invoice_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const csv = invoicesToCsv((data ?? []) as InvoiceLog[])
  const filename = `skippair-invoices-${dateFrom ?? 'all'}-${dateTo ?? 'all'}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
