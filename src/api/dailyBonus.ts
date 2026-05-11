import client from './client'

export type StreakDay = {
  day: number        // 1–7
  points: number     // pts awarded that day
  claimed: boolean
}

export type StreakInfo = {
  currentStreak: number
  weekPtsEarned: number
  weekCap: number
  todayPoints: number
  todayClaimed: boolean
  days: StreakDay[]  // Mon–Sun of current week
}

export type BonusTransaction = {
  id: number
  title: string
  subtitle: string   // formatted date
  amount: number     // positive = earned, negative = used
  type: 'earned' | 'used'
}

export type BonusHistory = {
  totalCoins: number
  earnedNgn: number
  transactions: BonusTransaction[]
}

/**
 * GET /tuka/user/streak
 * Returns current streak, 7-day calendar, today's points, todayClaimed flag.
 */
export async function fetchStreakInfo(): Promise<StreakInfo> {
  const res = await client.get('/tuka/user/streak')
  const d = res.data?.data || {}
  return {
    currentStreak: d.currentStreak  || 0,
    weekPtsEarned: d.weekPtsEarned  || 0,
    weekCap:       d.weekCap        || 10,
    todayPoints:   d.todayPoints    || 2,
    todayClaimed:  d.todayClaimed   ?? false,
    days:          d.days           || buildDefaultDays(d.currentStreak || 0),
  }
}

/**
 * GET /tuka/user/bonus-history?filter=all|earned|used
 */
export async function fetchBonusHistory(filter: 'all' | 'earned' | 'used' = 'all'): Promise<BonusHistory> {
  const res = await client.get('/tuka/user/bonus-history', { params: { filter } })
  const d = res.data?.data || {}
  return {
    totalCoins:   d.totalCoins   || 0,
    earnedNgn:    d.earnedNgn    || 0,
    transactions: d.transactions || [],
  }
}

/**
 * PUT /tuka/user/updateLogin — the real check-in endpoint.
 *
 * The backend awards streak points (+2/day, max 10/week) inside updateLogin.
 * Returns { pointsAwarded: number } — 0 if already claimed today (idempotent).
 *
 * We also pass the push token here so the backend can send daily reminders.
 * Passing an empty pushToken clears it (opt-out of notifications).
 */
export async function postCheckIn(pushToken?: string): Promise<{ pointsAwarded: number }> {
  const body: Record<string, string> = {}
  if (pushToken !== undefined) body.pushToken = pushToken
  const res = await client.put('/tuka/user/updateLogin', body)
  const pts = res.data?.data?.pointsAwarded ?? 0
  return { pointsAwarded: pts }
}

// Build a default 7-day week view from streak count when backend doesn't return days[]
function buildDefaultDays(streak: number): StreakDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day:     i + 1,
    points:  i === 6 ? 50 : 2,
    claimed: i < streak,
  }))
}
