// POST /api/invoices/issue — Transition draft -> issued
// Assigns invoice number, generates PDF, saves to Drive

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { triggerN8nInvoice } from '@/lib/n8n'
import { N8nGenerateInvoicePayload } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    if (!profile || profile.role === 'user') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { invoiceId } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })

    // Load invoice
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (invoice.status !== 'draft') return NextResponse.json({ error: `Cannot issue invoice in status "${invoice.status}"` }, { status: 400 })

    // Generate unique invoice number via DB function
    const { data: numberData } = await supabase.rpc('generate_invoice_number', { p_date: invoice.invoice_date })
    const invoiceNumber: string = numberData

    // Load settings
    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()
    if (!settings) return NextResponse.json({ error: 'Settings not configured' }, { status: 500 })

    // Update invoice to issued with number
    await supabase.from('invoices').update({ status: 'issued', invoice_number: invoiceNumber }).eq('id', invoiceId)

    // Log transition
    await supabase.from('invoice_logs').insert({
      invoice_id: invoiceId, from_status: 'draft', to_status: 'issued',
      changed_by: user.id, note: `Invoice number assigned: ${invoiceNumber}`,
    })

    // Build n8n payload for PDF generation + Drive upload (no email yet)
    const lang = invoice.language
    const folderId = invoice.is_test
      ? (settings.gdrive_test_folder_id ?? settings.gdrive_folder_id ?? '')
      : (settings.gdrive_folder_id ?? '')

    const payload: N8nGenerateInvoicePayload = {
      invoiceId, invoiceNumber, invoiceDate: invoice.invoice_date,
      language: lang, isTest: invoice.is_test,
      recipient: {
        name: invoice.recipient_name, address: invoice.recipient_address,
        country: invoice.recipient_country, vatNumber: invoice.recipient_vat_number,
        email: invoice.recipient_email, vatZone: invoice.recipient_vat_zone,
      },
      issuer: {
        name: settings.issuer_name, address: settings.issuer_address,
        phone: settings.issuer_phone, email: settings.issuer_email,
      },
      description: {
        serviceName: invoice.service_name, serviceType: invoice.service_type,
        boatModel: invoice.boat_model, boatYear: invoice.boat_year,
        startDate: invoice.start_date, endDate: invoice.end_date,
        startingPort: invoice.starting_port, landingPort: invoice.landing_port,
        nbTravellers: invoice.nb_travellers, clientTotalPrice: invoice.client_total_price,
      },
      amounts: {
        taxable: invoice.taxable_amount, vatRate: invoice.vat_rate,
        vatAmount: invoice.vat_amount, total: invoice.total_amount,
        vatNote: invoice.vat_note,
      },
      footerText: invoice.footer_text ?? '',
      sendToEmails: [],  // empty — email sent separately
      emailSubject: '', emailBody: '',
      gdriveFolderId: folderId,
    }

    const n8nResult = await triggerN8nInvoice(payload)

    if (n8nResult.success && n8nResult.driveFileId) {
      await supabase.from('invoices').update({
        drive_file_id: n8nResult.driveFileId,
        drive_file_url: n8nResult.driveFileUrl,
      }).eq('id', invoiceId)
    }

    const { data: updated } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
    return NextResponse.json({ invoice: updated, invoiceNumber })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
