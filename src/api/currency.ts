import client from './client'
import { BASE_URL } from './client'

export type Currency = {
  id: number
  name: string       // e.g. 'US', 'UK', 'AU'
  nameCn: string
  symbol: string     // e.g. '$', '£', '€'
  logoUrl: string | null
  sortOrder: number
}

let _cache: Currency[] | null = null
let _cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

/** Get cached currencies synchronously — returns null if not yet fetched */
export function getCachedCurrencies(): Currency[] | null {
  return _cache
}

export async function fetchCurrencies(force = false): Promise<Currency[]> {
  const now = Date.now()
  if (_cache && !force && now - _cacheTime < CACHE_TTL) return _cache
  try {
    const res = await client.get('/tuka/currency/public')
    _cache = (res.data?.data || []) as Currency[]
    _cacheTime = now
    return _cache
  } catch {
    return _cache || []
  }
}

/**
 * Resolve a currency logo URL — replaces localhost with the real BASE_URL,
 * and rewrites /profile/ → /files/ so the mobile app bypasses the RefererFilter.
 */
export function resolveCurrencyLogo(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null
  return logoUrl
    .replace(/https?:\/\/localhost:\d+/, BASE_URL)
    .replace(/https?:\/\/127\.0\.0\.1:\d+/, BASE_URL)
    .replace('/profile/', '/files/')  // /files/ endpoint has no Referer check
}

/**
 * Build a map of currency name → resolved logo URL for quick lookup.
 */
export function buildCurrencyLogoMap(currencies: Currency[]): Record<string, string | null> {
  const map: Record<string, string | null> = {}
  for (const c of currencies) {
    map[c.name] = resolveCurrencyLogo(c.logoUrl)
  }
  return map
}
