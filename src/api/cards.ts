import client, { BASE_URL } from './client'

export type RateRow = {
  mode: 'Fast' | 'Slow'
  rangeType: 'range' | 'multiple' | 'fixed'
  min: string
  max: string
  base: string
  value: string
  inputTypes: string[]
  rates: Record<string, string>  // { "All": "5.88", "Code": "5.90", "Physical": "5.85" }
}

export type RateConfig = {
  currency: string
  rows: RateRow[]
}

export type CardCategory = {
  id: number
  name: string
  icon: string | null
  rate: number          // settlement base rate (used in rateConfigs rows)
  displayRate: number   // 外显汇率 — shown on homepage card list
  minAmount: number
  maxAmount: number
  country: string
  defaultMode: string
  currencies: string[]
  inputTypes: string[]
  rateConfigs: RateConfig[]
  subAttr: string[]
  configInfo: string[]
}

// Resolve image URL — replace any server host with the current BASE_URL
// Also rewrites /profile/ → /files/ which is a public endpoint (no auth required)
export function resolveImageUrl(icon: string | null): string | null {
  if (!icon) return null
  let url = icon.replace(/https?:\/\/[^/]+/, BASE_URL)
  if (!url.startsWith('http')) {
    url = `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
  }
  // Rewrite /profile/ to /files/ — public file serving endpoint
  url = url.replace('/profile/', '/files/')
  // Encode spaces and special characters in the filename only
  const lastSlash = url.lastIndexOf('/')
  if (lastSlash !== -1) {
    const base = url.slice(0, lastSlash + 1)
    const filename = url.slice(lastSlash + 1)
    return base + encodeURIComponent(filename).replace(/%2F/g, '/')
  }
  return url
}

// ── Cache ──────────────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000
// Bump this version string to invalidate all cached card data
const CACHE_VERSION = 'v3'
let _cache: Map<string, { data: CardCategory[]; time: number }> = new Map()

export async function fetchCardCategories(forceRefresh = false, country = ''): Promise<CardCategory[]> {
  const key = `${CACHE_VERSION}:${country || 'all'}`
  const now = Date.now()
  const cached = _cache.get(key)
  const isStale = !cached || (now - cached.time > CACHE_TTL)
  if (cached && !isStale && !forceRefresh) return cached.data
  try {
    const params: any = {}
    if (country) params.country = country
    const res = await client.get('/tuka/cardCategory/public', { params })
    const data = (res.data.data as CardCategory[]).map(c => ({
      ...c,
      currencies:  Array.isArray(c.currencies)  ? c.currencies  : [],
      inputTypes:  Array.isArray(c.inputTypes)   ? c.inputTypes  : [],
      rateConfigs: Array.isArray(c.rateConfigs)  ? c.rateConfigs : [],
      subAttr:     Array.isArray(c.subAttr)      ? c.subAttr     : [],
      configInfo:  Array.isArray(c.configInfo)   ? c.configInfo  : [],
    }))
    _cache.set(key, { data, time: now })
    return data
  } catch (err) {
    if (cached) return cached.data
    throw err
  }
}

export function clearCardCache() { _cache.clear() }
