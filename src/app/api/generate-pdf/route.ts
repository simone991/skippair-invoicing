import { NextRequest, NextResponse } from 'next/server'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import fs from 'fs'
import path from 'path'

const TEMPLATE_PATH = path.join(process.cwd(), 'public', 'templates', 'invoice-template.docx')

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-webhook-secret')
    if (process.env.N8N_WEBHOOK_SECRET && secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const variables = typeof body.variables === 'string' ? JSON.parse(body.variables) : body.variables ?? body

    if (!fs.existsSync(TEMPLATE_PATH)) {
      return NextResponse.json({ error: 'Template not found. Upload invoice-template.docx to /public/templates/' }, { status: 500 })
    }

    const templateBuffer = fs.readFileSync(TEMPLATE_PATH)
    const zip = new PizZip(templateBuffer)
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, errorLogging: false })
    doc.render(variables)
    const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' })
    const pdfBuffer = await convertToPdfCloudConvert(docxBuffer)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${variables.PDF_FILENAME ?? 'invoice.pdf'}"`,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

async function convertToPdfCloudConvert(docxBuffer: Buffer): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY
  if (!apiKey) throw new Error('CLOUDCONVERT_API_KEY not set')

  const jobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tasks: {
        'upload-docx': { operation: 'import/upload' },
        'convert-pdf': { operation: 'convert', input: 'upload-docx', output_format: 'pdf', engine: 'libreoffice' },
        'export-pdf':  { operation: 'export/url', input: 'convert-pdf' },
      },
    }),
  })
  const job = await jobRes.json()
  const uploadTask = job.data.tasks.find((t: { name: string }) => t.name === 'upload-docx')

  const form = new FormData()
  Object.entries(uploadTask.result.form.parameters as Record<string, string>).forEach(([k, v]) => form.append(k, v))
  form.append('file', new Blob([new Uint8Array(docxBuffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'invoice.docx')
  await fetch(uploadTask.result.form.url, { method: 'POST', body: form })

  let pdfUrl: string | null = null
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const statusRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${job.data.id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    const status = await statusRes.json()
    const exportTask = status.data.tasks.find((t: { name: string; status: string; result?: { files?: Array<{ url: string }> } }) => t.name === 'export-pdf')
    if (exportTask?.status === 'finished') { pdfUrl = exportTask.result.files[0].url; break }
    if (status.data.status === 'error') throw new Error('CloudConvert conversion failed')
  }
  if (!pdfUrl) throw new Error('PDF conversion timed out')

  const pdfRes = await fetch(pdfUrl)
  return Buffer.from(await pdfRes.arrayBuffer())
}
