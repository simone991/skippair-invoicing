import { N8nGenerateInvoicePayload } from '@/types'

export interface N8nInvoiceResult {
  success: boolean
  driveFileId?: string
  driveFileUrl?: string
  error?: string
}

export async function triggerN8nInvoice(payload: N8nGenerateInvoicePayload): Promise<N8nInvoiceResult> {
  const url = process.env.N8N_WEBHOOK_URL
  if (!url) throw new Error('N8N_WEBHOOK_URL not configured.')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.N8N_WEBHOOK_SECRET) headers['X-Webhook-Secret'] = process.env.N8N_WEBHOOK_SECRET
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
    if (!res.ok) return { success: false, error: `n8n returned ${res.status}: ${await res.text()}` }
    const data = await res.json()
    return { success: true, driveFileId: data.driveFileId ?? data.drive_file_id, driveFileUrl: data.driveFileUrl ?? data.drive_file_url }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
