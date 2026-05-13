import client from './client'
import { swrFetch, cacheInvalidate, TTL } from '../util/cache'

export type Coupon = {
  id: number
  code: string
  title: string
  description: string | null
  discountType: 'fixed' | 'percent'
  discountValue: number
  minOrderAmount: number
  endDate: string | null   // 'YYYY-MM-DD'
  color: string
  expired: boolean
}

function mapCoupon(d: any): Coupon {
  return {
    id:             d.id,
    code:           d.code,
    title:          d.title,
    description:    d.description || null,
    discountType:   d.discountType,
    discountValue:  d.discountValue,
    minOrderAmount: d.minOrderAmount || 0,
    endDate:        d.endDate || null,
    color:          d.color || '#00C2B4',
    expired:        d.expired || false,
  }
}

// All public coupons filtered by country (for CouponPicker at checkout)
export async function fetchAllCoupons(country?: string, onFresh?: (c: Coupon[]) => void): Promise<Coupon[]> {
  const key = `coupons:${country || 'default'}`
  return swrFetch(key, TTL.userInfo, async () => {
    try {
      const params: any = {}
      if (country) params.country = country
      const res = await client.get('/tuka/coupon/public', { params })
      return (res.data?.data || []).map(mapCoupon)
    } catch { return [] }
  }, onFresh)
}

// Single coupon by code
export async function fetchCoupon(code: string): Promise<Coupon | null> {
  try {
    const res = await client.get(`/tuka/coupon/public/${code}`)
    const d = res.data?.data
    return d ? mapCoupon(d) : null
  } catch { return null }
}

// User's claimed coupons (for CouponScreen + SellCard picker)
export async function fetchMyCoupons(): Promise<Coupon[]> {
  try {
    const res = await client.get('/tuka/coupon/my')
    return (res.data?.data || []).map(mapCoupon)
  } catch { return [] }
}

// Claim a coupon — invalidate cache so next fetch is fresh
export async function claimCoupon(code: string): Promise<{ creditAmount: number; code: string }> {
  const res = await client.post('/tuka/coupon/claim', { code })
  cacheInvalidate('coupons:default')
  return res.data?.data
}
