import { createSign } from 'crypto'
import { Quote } from '@/types'

async function getGoogleAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!email || !rawKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_KEY not configured.')
  const key = rawKey.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url')

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(key, 'base64url')
  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok) throw new Error(`Google token error: ${tokenData.error_description ?? tokenData.error}`)
  return tokenData.access_token as string
}

function rowToQuote(row: string[]): Quote {
  const get = (i: number) => row[i] ?? ''
  return {
    quoteId: get(0), quoteDate: get(1), title: get(4),
    start: get(5), end: get(6), startingPort: get(7), landingPort: get(8),
    travellers: parseInt(get(9)) || 0, offerType: get(10),
    model: get(11), boatType: get(12), length: get(13), year: get(14),
    price: get(15), globalPrice: get(16), orgName: get(17),
    contactEmail: get(18), contactLabel: get(19),
  }
}

export async function fetchQuoteFromSheets(quoteId: string, sheetId: string, tabName: string): Promise<Quote | null> {
  const accessToken = await getGoogleAccessToken()
  const range = encodeURIComponent(`${tabName}!A2:T`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 60 },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Sheets API error: ${err.error?.message ?? res.statusText}`)
  }
  const data = await res.json()
  const rows: string[][] = data.values ?? []
  const found = rows.find(row => row[0]?.trim() === quoteId.trim())
  return found ? rowToQuote(found) : null
}

export function quoteToDescriptionFields(quote: Quote) {
  return {
    service_type: quote.offerType || quote.boatType,
    boat_model:   [quote.model, quote.boatType].filter(Boolean).join(' · '),
    boat_year:    quote.year,
    start_date:   quote.start,
    end_date:     quote.end,
    starting_port: quote.startingPort,
    landing_port:  quote.landingPort,
    nb_travellers: quote.travellers,
    client_total_price: quote.globalPrice
      ? `${Number(quote.globalPrice).toLocaleString('fr-FR')} EUR`
      : quote.price ? `${Number(quote.price).toLocaleString('fr-FR')} EUR` : '',
  }
}
