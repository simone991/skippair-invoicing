// GET /api/quotes?id=Q-2025-001
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { fetchQuoteFromSheets, quoteToDescriptionFields } from '@/lib/sheets'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const quoteId = searchParams.get('id')
  if (!quoteId) return NextResponse.json({ error: 'Quote ID required' }, { status: 400 })

  const { data: settings } = await supabase.from('settings').select('gsheet_id, gsheet_tab').eq('id', 1).single()
  if (!settings?.gsheet_id) return NextResponse.json({ error: 'Google Sheet not configured in Settings' }, { status: 500 })

  try {
    const quote = await fetchQuoteFromSheets(quoteId, settings.gsheet_id, settings.gsheet_tab)
    if (!quote) return NextResponse.json({ error: `Quote "${quoteId}" not found` }, { status: 404 })
    return NextResponse.json({ quote, fields: quoteToDescriptionFields(quote) })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
