# Skippair Invoicing — Setup Guide

## Stack
- **Frontend + API**: Next.js 14 (App Router) on Vercel
- **Database + Auth**: Supabase (PostgreSQL + Row Level Security)
- **PDF Generation**: n8n workflow + CloudConvert
- **Storage**: Google Drive (via n8n)
- **Email**: Gmail (via n8n)
- **Quote data**: Google Sheets API

---

## 1. Supabase Setup

### 1.1 Create project
1. Go to https://supabase.com → New project
2. Name: `skippair-invoicing`, choose region closest to France (eu-west-1)
3. Note your **Project URL** and **anon key** (Settings > API)

### 1.2 Run the schema
1. Supabase Dashboard → SQL Editor
2. Paste and run the contents of `supabase/schema.sql`
3. Verify tables: `profiles`, `recipients`, `invoices`, `settings`, `invoice_counters`

### 1.3 Create the first admin user
```sql
-- Run in Supabase SQL Editor after creating via Auth > Users
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@skippair.com');
```

Or use the Supabase Dashboard: Authentication > Users > Create user, then update role.

---

## 2. Google Sheets API

### 2.1 Enable Sheets API
1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable "Google Sheets API"
4. Create an **API Key** (Credentials > Create Credentials > API Key)
5. Restrict it to "Google Sheets API" only

### 2.2 Share the quotations sheet
- Make sure the sheet `1afwOazHto9IFQMmlZHK96cgONwJUGzCI1xotLBeyDJE` is:
  - Either **public** (Anyone with the link can view), OR
  - Shared with the Google service account email

### 2.3 Set env var
```
GOOGLE_SHEETS_API_KEY=AIza...
```

---

## 3. n8n Workflow Setup

### 3.1 Import the workflow
1. Open your n8n instance: https://simone-sailsquare.app.n8n.cloud
2. Workflows > Import from File
3. Select `n8n/generate-invoice-workflow.json`

### 3.2 Configure credentials
Create these credentials in n8n:
- **Google Drive OAuth2**: connect with the Skippair Google account
- **Gmail OAuth2**: connect with `contact@skippair.com`

### 3.3 Set up invoice DOCX template
1. Upload `CMSEA_Invoice_-_template.docx` to Google Drive
2. Open it as a Google Doc (it'll be converted automatically)
3. In the Google Doc, replace all static text with `{VARIABLE_NAME}` placeholders:
   ```
   {RECIPIENT_NAME}        → recipient name
   {RECIPIENT_ADDRESS}     → address
   {RECIPIENT_COUNTRY}     → country
   {RECIPIENT_VAT}         → VAT number line
   {ISSUER_NAME}           → CMSea SAS - Skippair
   {ISSUER_ADDRESS}        → address
   {ISSUER_PHONE}          → phone
   {ISSUER_EMAIL}          → email
   {INVOICE_TITLE}         → INVOICE / FACTURE
   {INVOICE_NUMBER}        → INV-2026-001
   {INVOICE_DATE}          → date
   {SERVICE_LABEL}         → Service label
   {SERVICE_VALUE}         → Travel agency commission
   {TYPE_LABEL}            → Type
   {TYPE_VALUE}            → Boat rental
   {BOAT_LABEL}            → Boat
   {BOAT_VALUE}            → BALI Catspace 2007
   {DATES_LABEL}           → Start / End dates
   {DATES_VALUE}           → 23.08.2025 17:00 → 30.08.2025 09:00
   {PORTS_LABEL}           → Starting / Landing Port
   {PORTS_VALUE}           → Port Grimaud / Port Grimaud
   {TRAVELLERS_LABEL}      → Nb. of travellers
   {TRAVELLERS_VALUE}      → 8
   {PRICE_LABEL}           → Client's total amount
   {PRICE_VALUE}           → 3.000 EUR
   {TAXABLE_LABEL}         → Taxable amount
   {TAXABLE_VALUE}         → €450.00
   {VAT_LABEL}             → VAT (0%)
   {VAT_VALUE}             → €0.00
   {TOTAL_LABEL}           → Total (VAT incl.)
   {TOTAL_VALUE}           → €450.00
   {VAT_NOTE}              → art. 259-1 du CGI...
   {FOOTER_TEXT}           → footer content
   ```
4. Note the **Google Doc ID** from the URL and update the "Fetch DOCX template" node in n8n

### 3.4 Configure Google Drive folder
1. Create a folder in Google Drive: "Skippair Invoices"
2. Note the folder ID from the URL (the part after `/folders/`)
3. Set it in Settings > Google Drive Folder ID in the app

### 3.5 Activate and get webhook URL
1. Activate the workflow (toggle at top right)
2. Copy the **Production webhook URL**
3. Set as `N8N_WEBHOOK_URL` in Vercel env vars

---

## 4. CloudConvert (PDF conversion)

1. Sign up at https://cloudconvert.com
2. API Keys > Create API Key (scope: "tasks")
3. Set as `CLOUDCONVERT_API_KEY` in Vercel env vars
4. Free tier: 25 conversions/day. Paid plans from ~$10/month.

---

## 5. Vercel Deployment

### 5.1 Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit — Skippair Invoicing"
git remote add origin https://github.com/YOUR_ORG/skippair-invoicing.git
git push -u origin main
```

### 5.2 Deploy on Vercel
1. https://vercel.com → New Project → Import from GitHub
2. Framework: Next.js (auto-detected)
3. Add all environment variables (from `.env.example`)

### 5.3 Required environment variables in Vercel
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_SHEETS_API_KEY
N8N_WEBHOOK_URL
N8N_WEBHOOK_SECRET
CLOUDCONVERT_API_KEY
NEXT_PUBLIC_APP_URL     ← set to your Vercel URL
```

### 5.4 Add invoice template
After deployment, upload `CMSEA_Invoice_-_template.docx` to:
- Vercel: upload via dashboard or include in `public/templates/` in the repo
- Or keep it in Google Drive and fetch dynamically (see `generate-pdf/route.ts`)

---

## 6. First Login

1. Create admin user via Supabase Dashboard (Auth > Users)
2. Set their role to `admin` via SQL
3. Log in at `https://your-app.vercel.app/auth/login`
4. Go to Settings and configure:
   - Google Drive folder ID
   - VAT notes text (both EN and FR)
   - Footer text
   - Email templates

---

## 7. User Roles Summary

| Feature                    | user | manager | admin |
|---------------------------|------|---------|-------|
| View invoice list          | ✓    | ✓       | ✓     |
| Create new invoice         |      | ✓       | ✓     |
| Add recipients             |      | ✓       | ✓     |
| Delete invoices            |      |         | ✓     |
| Delete recipients          |      |         | ✓     |
| Manage users               |      |         | ✓     |
| Edit settings              |      |         | ✓     |
| Edit issuer details        |      |         | ✓     |

---

## 8. CSV Import Format

For bulk recipient import, use this CSV format:

```csv
name,type,address,country_code,vat_number,email
Navi-Gate GmbH,company,"Seestrasse 851, 8706 Meilen",CH,,navi@example.com
Oceanic SRL,company,"12 rue du Port, Paris",FR,FR12345678901,oceanic@example.com
Marco Rossi,private,"Via Roma 5, Milano",IT,,marco@example.com
```

- `type`: `company` or `private`
- `country_code`: ISO 3166-1 alpha-2 (2 letters)
- `vat_number`: required for EU companies, empty otherwise
- Duplicate VAT numbers are automatically skipped with a report

---

## 9. Architecture Diagram

```
Browser (Next.js)
    │
    ├── /auth/login        → Supabase Auth
    ├── /dashboard         → Supabase DB (invoices_log view)
    ├── /invoices          → Supabase DB (invoices table)
    ├── /invoices/new      → Form → POST /api/invoices
    │                                   │
    │                                   ├── Supabase (save invoice)
    │                                   ├── n8n webhook ──────────────┐
    │                                   └── Return invoice number     │
    ├── /recipients        → Supabase DB (recipients table)          │
    ├── /users             → Supabase Auth + profiles table          │
    └── /settings          → Supabase DB (settings table)            │
                                                                      │
n8n Workflow ◄─────────────────────────────────────────────────────┘
    │
    ├── Prepare variables
    ├── POST /api/generate-pdf (Next.js)
    │       └── docxtemplater fills template
    │       └── CloudConvert → PDF
    ├── Upload PDF → Google Drive
    ├── Send email → Gmail (contact@skippair.com)
    └── Return { driveFileId, driveFileUrl } → Next.js
            └── Update invoice record in Supabase
```

---

## 10. Local Development

```bash
# Clone and install
git clone https://github.com/YOUR_ORG/skippair-invoicing.git
cd skippair-invoicing
npm install

# Set up env
cp .env.example .env.local
# Edit .env.local with your values

# Run dev server
npm run dev
# → http://localhost:3000
```

For n8n webhooks in local dev, use [ngrok](https://ngrok.com):
```bash
ngrok http 3000
# Use the ngrok URL as NEXT_PUBLIC_APP_URL in .env.local
```
