import client from './client'
import { swrFetch, cacheSet, cacheGet, cacheInvalidate, TTL } from '../util/cache'

export type WalletInfo = {
  balance: number
  totalSales: number
  totalWithdrawn: number
  registerBonus: number
  totalEarned: number
  level: number
  exp: number
  realName: string
  phone: string
  inviteCode: string
}

export type Transaction = {
  id: number
  amount: number
  type: string
  orderNo: string
  createTime: string
  rewardSource?: string
}

// ── Fetch authenticated user's wallet ──────────────────────────────────────
export async function fetchWalletInfo(country?: string, onFresh?: (w: WalletInfo) => void): Promise<WalletInfo> {
  const key = `wallet:${country || 'default'}`
  return swrFetch(key, TTL.wallet, async () => {
    try {
      const params: any = {}
      if (country) params.country = country
      const res = await client.get('/tuka/wallet/my', { params })
      const d = res.data?.data || res.data || {}
      return {
        balance:        d.balance        || 0,
        totalSales:     d.totalSales     || 0,
        totalWithdrawn: d.totalWithdrawn || 0,
        registerBonus:  d.registerBonus  || 0,
        totalEarned:    d.totalEarned    || 0,
        level:          d.level          || 1,
        exp:            d.exp            || 0,
        realName:       d.realName       || '',
        phone:          d.phone          || '',
        inviteCode:     d.inviteCode     || '',
      }
    } catch {
      return {
        balance: 0, totalSales: 0, totalWithdrawn: 0,
        registerBonus: 0, totalEarned: 0,
        level: 1, exp: 0, realName: '', phone: '', inviteCode: '',
      }
    }
  }, onFresh)
}

// ── Fetch authenticated user's transaction history ─────────────────────────
export async function fetchTransactions(params?: {
  pageNum?: number
  pageSize?: number
  type?: string
  category?: string
}, onFresh?: (r: { list: Transaction[]; total: number }) => void): Promise<{ list: Transaction[]; total: number }> {
  const key = `transactions:${params?.category || 'all'}:${params?.pageSize || 50}`
  return swrFetch(key, TTL.orders, async () => {
    try {
      const res = await client.get('/tuka/wallet/transactions', {
        params: { pageNum: 1, pageSize: 50, ...params },
      })
      return { list: res.data.rows || [], total: res.data.total || 0 }
    } catch {
      return { list: [], total: 0 }
    }
  }, onFresh)
}

export type BankAccount = {
  id: number
  bankName: string
  accountNumber: string
  accountName: string
  isDefault: boolean
}

export type Withdrawal = {
  id: number
  withdrawNo: string
  bankName: string
  accountName: string
  accountNo: string
  amount: number
  fee: number
  status: string
  remark: string
  createTime: string
}

export async function fetchBankAccounts(): Promise<BankAccount[]> {
  const key = 'banks:list'
  return swrFetch(key, TTL.banks, async () => {
    try {
      const res = await client.get('/tuka/bank/account/list')
      return res.data?.data || []
    } catch { return [] }
  })
}

export async function addBankAccount(data: {
  bankName: string
  accountNumber: string
  accountName: string
  isDefault?: boolean
}): Promise<void> {
  await client.post('/tuka/bank/add', data)
  cacheInvalidate('banks:list')  // invalidate so next fetch is fresh
}

export async function deleteBankAccount(id: number): Promise<void> {
  await client.delete(`/tuka/bank/${id}`)
  cacheInvalidate('banks:list')  // invalidate so next fetch is fresh
}

export async function submitWithdrawal(data: {
  amount: number
  bankName: string
  accountName: string
  accountNo: string
  country?: string
}): Promise<string> {
  const res = await client.post('/tuka/withdrawal/submit', data)
  return res.data?.data || ''
}

export async function fetchMyWithdrawals(country?: string, onFresh?: (w: Withdrawal[]) => void): Promise<Withdrawal[]> {
  const key = `withdrawals:${country || 'default'}`
  return swrFetch(key, TTL.orders, async () => {
    try {
      const params: any = { pageNum: 1, pageSize: 50 }
      if (country) params.country = country
      const res = await client.get('/tuka/withdrawal/my', { params })
      return res.data.rows || []
    } catch { return [] }
  }, onFresh)
}

export type NigerianBank = { name: string; code: string; logoUrl?: string }

export async function fetchNigerianBanks(): Promise<NigerianBank[]> {
  const key = 'nigerian:banks'
  return swrFetch(key, TTL.banks, async () => {
    try {
      const res = await client.get('/tuka/bank/banks')
      return res.data?.data || []
    } catch { return [] }
  })
}

export async function resolveAccountName(
  accountNumber: string,
  bankCode: string
): Promise<string | null> {
  try {
    const res = await client.get('/tuka/bank/resolve', {
      params: { accountNumber, bankCode },
    })
    return res.data?.data?.accountName || null
  } catch { return null }
}
