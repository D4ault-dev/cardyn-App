/**
 * Lightweight in-memory cache for API responses.
 * Eliminates redundant network calls on Nigerian 3G (200-400ms RTT).
 *
 * Strategy:
 * - Stale-while-revalidate: return cached data instantly, refresh in background
 * - TTL-based expiry: data older than TTL triggers a background refresh
 * - Cache is cleared on logout
 */

type CacheEntry<T> = {
  data: T
  fetchedAt: number
}

const store = new Map<string, CacheEntry<any>>()

// Default TTLs (ms)
export const TTL = {
  wallet:    30_000,   // 30s — balance changes after trades/withdrawals
  banks:     120_000,  // 2min — bank list rarely changes
  cards:     60_000,   // 1min — rates can change
  orders:    20_000,   // 20s — order status updates frequently
  userInfo:  60_000,   // 1min — profile info
  countries: 300_000,  // 5min — very stable
}

export function cacheGet<T>(key: string, ttl: number): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > ttl) return null  // expired
  return entry.data as T
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, fetchedAt: Date.now() })
}

export function cacheInvalidate(key: string): void {
  store.delete(key)
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

export function cacheClear(): void {
  store.clear()
}

/**
 * Stale-while-revalidate fetch.
 * Returns cached data immediately if available (even if stale),
 * then fetches fresh data in the background and calls onFresh when done.
 *
 * Usage:
 *   const data = await swrFetch('wallet:NG', TTL.wallet, fetchWalletInfo, fresh => setWallet(fresh))
 */
export async function swrFetch<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
  onFresh?: (data: T) => void,
): Promise<T> {
  const cached = store.get(key)
  const now = Date.now()

  if (cached) {
    const age = now - cached.fetchedAt
    if (age < ttl) {
      // Fresh cache — return immediately, no background fetch needed
      return cached.data as T
    }
    // Stale cache — return immediately AND revalidate in background
    fetcher().then(fresh => {
      cacheSet(key, fresh)
      onFresh?.(fresh)
    }).catch(() => {})
    return cached.data as T
  }

  // No cache — must fetch and wait
  const data = await fetcher()
  cacheSet(key, data)
  return data
}
