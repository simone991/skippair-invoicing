// ============================================================
// SKIPPAIR INVOICING — Country list with VAT zones
// ============================================================

import { VatZone } from '@/types'

export interface Country {
  code: string
  name: string
  zone: VatZone
  flag: string
}

export const COUNTRIES: Country[] = [
  { code: 'FR', name: 'France',               zone: 'fr',     flag: '🇫🇷' },
  { code: 'AT', name: 'Austria',              zone: 'eu',     flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium',              zone: 'eu',     flag: '🇧🇪' },
  { code: 'BG', name: 'Bulgaria',             zone: 'eu',     flag: '🇧🇬' },
  { code: 'HR', name: 'Croatia',              zone: 'eu',     flag: '🇭🇷' },
  { code: 'CY', name: 'Cyprus',               zone: 'eu',     flag: '🇨🇾' },
  { code: 'CZ', name: 'Czech Republic',       zone: 'eu',     flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark',              zone: 'eu',     flag: '🇩🇰' },
  { code: 'EE', name: 'Estonia',              zone: 'eu',     flag: '🇪🇪' },
  { code: 'FI', name: 'Finland',              zone: 'eu',     flag: '🇫🇮' },
  { code: 'DE', name: 'Germany',              zone: 'eu',     flag: '🇩🇪' },
  { code: 'GR', name: 'Greece',               zone: 'eu',     flag: '🇬🇷' },
  { code: 'HU', name: 'Hungary',              zone: 'eu',     flag: '🇭🇺' },
  { code: 'IE', name: 'Ireland',              zone: 'eu',     flag: '🇮🇪' },
  { code: 'IT', name: 'Italy',                zone: 'eu',     flag: '🇮🇹' },
  { code: 'LV', name: 'Latvia',               zone: 'eu',     flag: '🇱🇻' },
  { code: 'LT', name: 'Lithuania',            zone: 'eu',     flag: '🇱🇹' },
  { code: 'LU', name: 'Luxembourg',           zone: 'eu',     flag: '🇱🇺' },
  { code: 'MT', name: 'Malta',                zone: 'eu',     flag: '🇲🇹' },
  { code: 'NL', name: 'Netherlands',          zone: 'eu',     flag: '🇳🇱' },
  { code: 'PL', name: 'Poland',               zone: 'eu',     flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal',             zone: 'eu',     flag: '🇵🇹' },
  { code: 'RO', name: 'Romania',              zone: 'eu',     flag: '🇷🇴' },
  { code: 'SK', name: 'Slovakia',             zone: 'eu',     flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia',             zone: 'eu',     flag: '🇸🇮' },
  { code: 'ES', name: 'Spain',                zone: 'eu',     flag: '🇪🇸' },
  { code: 'SE', name: 'Sweden',               zone: 'eu',     flag: '🇸🇪' },
  { code: 'AU', name: 'Australia',            zone: 'non-eu', flag: '🇦🇺' },
  { code: 'BR', name: 'Brazil',               zone: 'non-eu', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada',               zone: 'non-eu', flag: '🇨🇦' },
  { code: 'CN', name: 'China',                zone: 'non-eu', flag: '🇨🇳' },
  { code: 'GB', name: 'United Kingdom',       zone: 'non-eu', flag: '🇬🇧' },
  { code: 'IN', name: 'India',                zone: 'non-eu', flag: '🇮🇳' },
  { code: 'IL', name: 'Israel',               zone: 'non-eu', flag: '🇮🇱' },
  { code: 'JP', name: 'Japan',                zone: 'non-eu', flag: '🇯🇵' },
  { code: 'MA', name: 'Morocco',              zone: 'non-eu', flag: '🇲🇦' },
  { code: 'MX', name: 'Mexico',               zone: 'non-eu', flag: '🇲🇽' },
  { code: 'NO', name: 'Norway',               zone: 'non-eu', flag: '🇳🇴' },
  { code: 'SA', name: 'Saudi Arabia',         zone: 'non-eu', flag: '🇸🇦' },
  { code: 'SG', name: 'Singapore',            zone: 'non-eu', flag: '🇸🇬' },
  { code: 'ZA', name: 'South Africa',         zone: 'non-eu', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea',          zone: 'non-eu', flag: '🇰🇷' },
  { code: 'CH', name: 'Switzerland',          zone: 'non-eu', flag: '🇨🇭' },
  { code: 'TN', name: 'Tunisia',              zone: 'non-eu', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey',               zone: 'non-eu', flag: '🇹🇷' },
  { code: 'AE', name: 'United Arab Emirates', zone: 'non-eu', flag: '🇦🇪' },
  { code: 'US', name: 'United States',        zone: 'non-eu', flag: '🇺🇸' },
]

export const COUNTRY_MAP = Object.fromEntries(COUNTRIES.map(c => [c.code, c]))

export function getCountry(code: string): Country | undefined {
  return COUNTRY_MAP[code]
}

export function getVatZone(countryCode: string): VatZone {
  return COUNTRY_MAP[countryCode]?.zone ?? 'non-eu'
}
