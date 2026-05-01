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

export async function fetchBonusHistory(filter: 'all' | 'earned' | 'used' = 'all'): Promise<BonusHistory> {
  const res = await client.get('/tuka/user/bonus-history', { params: { filter } })
  const d = res.data?.data || {}
  return {
    totalCoins:   d.totalCoins   || 0,
    earnedNgn:    d.earnedNgn    || 0,
    transactions: d.transactions || [],
  }
}

// Build a default 7-day week view from streak count when backend doesn't return days[]
function buildDefaultDays(streak: number): StreakDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day:     i + 1,
    points:  i === 6 ? 50 : (i + 1) * 2,   // Day 7 bonus
    claimed: i < streak,
  }))
}
