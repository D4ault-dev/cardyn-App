import client from './client'

export type CycleInfo = {
  id: number
  name: string
  startDate: string
  endDate: string
  isActive?: boolean
}

export type LeaderboardEntry = {
  rank: number
  userId: number
  displayName: string
  totalPoints: number
  totalSales?: number
  tradeCount?: number
  phone?: string
  rewardAmount: number | null
  rewardLabel: string | null
  avatar: string | null
}

export type InvitationEntry = {
  rank: number
  userId: number
  displayName: string
  totalInvites: number
  phone?: string
  avatar: string | null
}

export type LeaderboardResponse = {
  cycle: CycleInfo | null
  leaderboard: LeaderboardEntry[]
  rewards: any[]
}

export type MyRankResponse = {
  rank: number | null
  totalPoints: number
  cycleEndsAt: string | null
}

export async function fetchLeaderboard(cycleId?: number): Promise<LeaderboardResponse> {
  const params = cycleId ? { cycleId } : {}
  const res = await client.get('/tuka/leaderboard/current', { params })
  const d = res.data?.data || res.data || {}
  return {
    cycle:       d.cycle       || null,
    leaderboard: d.leaderboard || [],
    rewards:     d.rewards     || [],
  }
}

export async function fetchMyRank(): Promise<MyRankResponse> {
  const res = await client.get('/tuka/leaderboard/my-rank')
  const d = res.data?.data || res.data || {}
  return {
    rank:        d.rank        ?? null,
    totalPoints: d.totalPoints || 0,
    cycleEndsAt: d.cycleEndsAt || null,
  }
}

export async function fetchInvitationLeaderboard(): Promise<InvitationEntry[]> {
  const res = await client.get('/tuka/leaderboard/invitation')
  return res.data?.data || []
}

export async function fetchCycles(): Promise<CycleInfo[]> {
  const res = await client.get('/tuka/leaderboard/cycles')
  return res.data?.data || []
}
