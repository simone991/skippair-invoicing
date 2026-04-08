-- ============================================================
-- SKIPPAIR INVOICING — Supabase Schema
-- ============================================================
-- Run this in the Supabase SQL editor (project > SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('user', 'manager', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'disabled');
CREATE TYPE recipient_type AS ENUM ('company', 'private');
CREATE TYPE vat_zone AS ENUM ('fr', 'eu', 'non-eu');
CREATE TYPE invoice_language AS ENUM ('en', 'fr');
CREATE TYPE invoice_status AS ENUM ('issued', 'sent', 'error');

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'user',
  status          user_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RECIPIENTS
-- ============================================================

CREATE TABLE public.recipients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  type            recipient_type NOT NULL DEFAULT 'company',
  address         TEXT NOT NULL,
  country_code    CHAR(2) NOT NULL,         -- ISO 3166-1 alpha-2
  country_name    TEXT NOT NULL,
  vat_zone        vat_zone NOT NULL,
  vat_number      TEXT,                     -- required only for EU companies
  email           TEXT NOT NULL,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT recipients_vat_eu_company CHECK (
    -- VAT is mandatory for EU companies (zone='eu'), optional otherwise
    NOT (vat_zone = 'eu' AND type = 'company' AND (vat_number IS NULL OR vat_number = ''))
  ),
  CONSTRAINT recipients_vat_unique UNIQUE NULLS NOT DISTINCT (vat_number)
);

CREATE INDEX idx_recipients_name ON public.recipients USING GIN (to_tsvector('simple', name));
CREATE INDEX idx_recipients_country ON public.recipients(country_code);
CREATE INDEX idx_recipients_vat ON public.recipients(vat_number);

CREATE TRIGGER recipients_updated_at
  BEFORE UPDATE ON public.recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- INVOICE COUNTER (sequential per year)
-- ============================================================

CREATE TABLE public.invoice_counters (
  year            INT PRIMARY KEY,
  last_number     INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_year INT)
RETURNS TEXT AS $$
DECLARE
  v_num INT;
BEGIN
  INSERT INTO public.invoice_counters (year, last_number)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = invoice_counters.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN 'INV-' || p_year::TEXT || '-' || LPAD(v_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE public.invoices (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number        TEXT NOT NULL UNIQUE,
  invoice_date          DATE NOT NULL,
  language              invoice_language NOT NULL DEFAULT 'en',
  status                invoice_status NOT NULL DEFAULT 'issued',

  -- Recipient snapshot (stored at time of invoice creation)
  recipient_id          UUID REFERENCES public.recipients(id),
  recipient_name        TEXT NOT NULL,
  recipient_address     TEXT NOT NULL,
  recipient_country     TEXT NOT NULL,
  recipient_country_code CHAR(2) NOT NULL,
  recipient_vat_number  TEXT,
  recipient_email       TEXT NOT NULL,
  recipient_type        recipient_type NOT NULL,
  recipient_vat_zone    vat_zone NOT NULL,

  -- Quote reference
  quote_number          TEXT,

  -- Service description (from GSheet)
  service_name          TEXT NOT NULL DEFAULT 'Travel agency commission',
  service_type          TEXT,
  boat_model            TEXT,
  boat_year             TEXT,
  start_date            TEXT,
  end_date              TEXT,
  starting_port         TEXT,
  landing_port          TEXT,
  nb_travellers         INT,
  client_total_price    TEXT,

  -- Amounts (in EUR)
  taxable_amount        NUMERIC(10,2) NOT NULL,
  vat_rate              NUMERIC(5,2) NOT NULL DEFAULT 0,   -- e.g. 20.00
  vat_amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(10,2) NOT NULL,

  -- VAT text note (from settings at time of creation)
  vat_note              TEXT,

  -- Google Drive
  drive_file_id         TEXT,
  drive_file_url        TEXT,

  -- Issuer snapshot (from settings at time of creation)
  issuer_name           TEXT NOT NULL DEFAULT 'CMSea SAS - Skippair',
  issuer_address        TEXT NOT NULL DEFAULT '35 rue de l''Héronnière 44000 NANTES',
  issuer_phone          TEXT,
  issuer_email          TEXT,
  footer_text           TEXT,

  -- Metadata
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ            -- soft delete
);

CREATE INDEX idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX idx_invoices_recipient ON public.invoices(recipient_id);
CREATE INDEX idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX idx_invoices_created_by ON public.invoices(created_by);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- SETTINGS (single-row config table)
-- ============================================================

CREATE TABLE public.settings (
  id                        INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton
  -- Issuer
  issuer_name               TEXT NOT NULL DEFAULT 'CMSea SAS - Skippair',
  issuer_address            TEXT NOT NULL DEFAULT '35 rue de l''Héronnière 44000 NANTES',
  issuer_phone              TEXT NOT NULL DEFAULT 'Tel: +33 01 76 38 00 67',
  issuer_email              TEXT NOT NULL DEFAULT 'contact@skippair.com',
  -- Google Sheets
  gsheet_id                 TEXT NOT NULL DEFAULT '1afwOazHto9IFQMmlZHK96cgONwJUGzCI1xotLBeyDJE',
  gsheet_tab                TEXT NOT NULL DEFAULT 'Quotes',
  -- Google Drive
  gdrive_folder_id          TEXT,
  -- VAT notes
  vat_note_eu_en            TEXT NOT NULL DEFAULT 'VAT exempt — Intra-community supply. Reverse charge applies (art. 44 of Directive 2006/112/EC).',
  vat_note_eu_fr            TEXT NOT NULL DEFAULT 'Exonération TVA — Prestation intracommunautaire. Autoliquidation applicable (art. 44 de la Directive 2006/112/CE).',
  vat_note_non_eu_en        TEXT NOT NULL DEFAULT 'VAT not applicable — art. 259-1 du CGI (export of services outside EU).',
  vat_note_non_eu_fr        TEXT NOT NULL DEFAULT 'TVA non applicable — art. 259-1 du CGI (prestation de services hors UE).',
  -- Invoice footer
  footer_en                 TEXT NOT NULL DEFAULT 'CMSea SAS — Skippair · SIRET: XXXXXXXX · RCS Nantes · Capital: 1.000€' || E'\n' || 'IBAN: FR76 XXXX XXXX XXXX XXXX XXXX XXX · BIC: XXXXXXXX',
  footer_fr                 TEXT NOT NULL DEFAULT 'CMSea SAS — Skippair · SIRET: XXXXXXXX · RCS Nantes · Capital: 1.000€' || E'\n' || 'IBAN: FR76 XXXX XXXX XXXX XXXX XXXX XXX · BIC: XXXXXXXX',
  -- Email template
  email_subject_en          TEXT NOT NULL DEFAULT 'Invoice {{invoice_number}} — Skippair',
  email_subject_fr          TEXT NOT NULL DEFAULT 'Facture {{invoice_number}} — Skippair',
  email_body_en             TEXT NOT NULL DEFAULT 'Dear {{recipient_name}},' || E'\n\n' || 'Please find attached invoice {{invoice_number}} for the services provided by {{sender_name}}.' || E'\n\n' || 'Do not hesitate to contact us for any questions.' || E'\n\n' || 'Best regards,' || E'\n' || 'The Skippair Team',
  email_body_fr             TEXT NOT NULL DEFAULT 'Madame, Monsieur {{recipient_name}},' || E'\n\n' || 'Veuillez trouver ci-joint la facture {{invoice_number}} pour les services fournis par {{sender_name}}.' || E'\n\n' || 'N''hésitez pas à nous contacter pour toute question.' || E'\n\n' || 'Cordialement,' || E'\n' || 'L''équipe Skippair',
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings   ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- PROFILES
CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.current_user_role() = 'admin');

-- RECIPIENTS: all authenticated users can read; manager+ can write
CREATE POLICY "recipients_read" ON public.recipients
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "recipients_write" ON public.recipients
  FOR INSERT WITH CHECK (public.current_user_role() IN ('manager', 'admin'));

CREATE POLICY "recipients_update" ON public.recipients
  FOR UPDATE USING (public.current_user_role() IN ('manager', 'admin'));

CREATE POLICY "recipients_delete" ON public.recipients
  FOR DELETE USING (public.current_user_role() = 'admin');

-- INVOICES: all authenticated can read; manager+ can insert; admin can delete
CREATE POLICY "invoices_read" ON public.invoices
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT WITH CHECK (public.current_user_role() IN ('manager', 'admin'));

CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE USING (public.current_user_role() IN ('manager', 'admin'));

CREATE POLICY "invoices_delete" ON public.invoices
  FOR DELETE USING (public.current_user_role() = 'admin');

-- SETTINGS: all can read; only admin can write
CREATE POLICY "settings_read" ON public.settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "settings_write" ON public.settings
  FOR ALL USING (public.current_user_role() = 'admin');

-- ============================================================
-- VIEWS
-- ============================================================

-- Invoice log view (for the list screen)
CREATE OR REPLACE VIEW public.invoices_log AS
SELECT
  i.id,
  i.invoice_number,
  i.invoice_date,
  i.language,
  i.status,
  i.recipient_name,
  i.recipient_country,
  i.recipient_country_code,
  i.recipient_email,
  i.recipient_vat_zone,
  i.quote_number,
  i.taxable_amount,
  i.vat_rate,
  i.vat_amount,
  i.total_amount,
  i.drive_file_url,
  i.created_at,
  p.full_name AS created_by_name
FROM public.invoices i
LEFT JOIN public.profiles p ON p.id = i.created_by
WHERE i.deleted_at IS NULL
ORDER BY i.invoice_date DESC, i.invoice_number DESC;

-- ============================================================
-- SEED: EU country list (stored as static data in app, not DB)
-- The app embeds the EU country list in code (see lib/countries.ts)
-- ============================================================
