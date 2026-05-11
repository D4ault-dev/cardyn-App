import client from './client'

export type Country = {
  id: number
  name: string
  todayRate: number
  rateMode: 'multiply' | 'divide'
  registerBonus: number
  withdrawFee: number
  currencyName: string
  currencySymbol: string
  flag: string           // emoji flag e.g. '🇳🇬'
  phonePrefix: string
}

let _cache: Country[] | null = null
let _cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function fetchCountries(force = false): Promise<Country[]> {
  const now = Date.now()
  if (_cache && !force && now - _cacheTime < CACHE_TTL) return _cache
  try {
    const res = await client.get('/tuka/country/public')
    _cache = res.data.data as Country[]
    _cacheTime = now
    return _cache
  } catch {
    return _cache || []
  }
}

export async function fetchCountryByName(name: string): Promise<Country | null> {
  const list = await fetchCountries()
  return list.find(c => c.name === name) || null
}

export function clearCountryCache() {
  _cache = null
  _cacheTime = 0
}
