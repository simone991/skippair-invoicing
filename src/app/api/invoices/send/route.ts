// POST /api/invoices/send — Send invoice by email, transition issued -> sent

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

    const { invoiceId, emails } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })
    if (!Array.isArray(emails) || emails.length === 0) return NextResponse.json({ error: 'At least one email required' }, { status: 400 })

    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (invoice.status === 'cancelled') return NextResponse.json({ error: 'Cannot send a cancelled invoice' }, { status: 400 })
    if (invoice.status === 'draft') return NextResponse.json({ error: 'Issue the invoice before sending' }, { status: 400 })

    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()
    if (!settings) return NextResponse.json({ error: 'Settings not configured' }, { status: 500 })

    const lang = invoice.language
    const rawSubject = lang === 'fr' ? settings.email_subject_fr : settings.email_subject_en
    const rawBody    = lang === 'fr' ? settings.email_body_fr    : settings.email_body_en
    const replace = (s: string) => s
      .replace(/\{\{invoice_number\}\}/g, invoice.invoice_number ?? '')
      .replace(/\{\{recipient_name\}\}/g, invoice.recipient_name)
      .replace(/\{\{sender_name\}\}/g, settings.issuer_name)
      .replace(/\{\{invoice_date\}\}/g, invoice.invoice_date)
      .replace(/\{\{total_amount\}\}/g, `€${invoice.total_amount.toFixed(2)}`)

    const folderId = invoice.is_test
      ? (settings.gdrive_test_folder_id ?? settings.gdrive_folder_id ?? '')
      : (settings.gdrive_folder_id ?? '')

    const payload: N8nGenerateInvoicePayload = {
      invoiceId, invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date, language: lang, isTest: invoice.is_test,
      recipient: {
        name: invoice.recipient_name, address: invoice.recipient_address,
        country: invoice.recipient_country, vatNumber: invoice.recipient_vat_number,
        email: emails.join(', '), vatZone: invoice.recipient_vat_zone,
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
      sendToEmails: emails,
      emailSubject: replace(rawSubject),
      emailBody: replace(rawBody),
      gdriveFolderId: folderId,
    }

    const n8nResult = await triggerN8nInvoice(payload)
    if (!n8nResult.success) {
      return NextResponse.json({ error: 'Email delivery failed', detail: n8nResult.error }, { status: 207 })
    }

    // Transition to 'sent' only if currently 'issued'
    const newStatus = invoice.status === 'issued' ? 'sent' : invoice.status
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
    await supabase.from('invoice_logs').insert({
      invoice_id: invoiceId,
      from_status: invoice.status,
      to_status: newStatus,
      changed_by: user.id,
      note: `Email sent to: ${emails.join(', ')}`,
    })

    return NextResponse.json({ success: true, status: newStatus })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
