import { Quote } from '@/types'

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
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_SHEETS_API_KEY not configured.')
  const range = encodeURIComponent(`${tabName}!A2:T`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
  const res = await fetch(url, { next: { revalidate: 60 } })
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
