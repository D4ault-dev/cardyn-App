import client from './client'

export type Coupon = {
  id: number
  code: string
  title: string
  description: string | null
  discountType: 'fixed' | 'percent'
  discountValue: number
  minOrderAmount: number
  color: string
  expired: boolean
}

export async function fetchAllCoupons(): Promise<Coupon[]> {
  try {
    const res = await client.get('/tuka/coupon/public')
    const list: any[] = res.data?.data || []
    return list.map(d => ({
      id:            d.id,
      code:          d.code,
      title:         d.title,
      description:   d.description || null,
      discountType:  d.discountType,
      discountValue: d.discountValue,
      minOrderAmount:d.minOrderAmount || 0,
      color:         d.color || '#1A7A5E',
      expired:       false,
    }))
  } catch {
    return []
  }
}

export async function fetchCoupon(code: string): Promise<Coupon | null> {
  try {
    const res = await client.get(`/tuka/coupon/public/${code}`)
    const d = res.data?.data
    if (!d) return null
    return {
      id:            d.id,
      code:          d.code,
      title:         d.title,
      description:   d.description || null,
      discountType:  d.discountType,
      discountValue: d.discountValue,
      minOrderAmount:d.minOrderAmount,
      color:         d.color || '#1A7A5E',
      expired:       d.expired || false,
    }
  } catch {
    return null
  }
}

export async function claimCoupon(code: string): Promise<{ creditAmount: number; code: string }> {
  const res = await client.post('/tuka/coupon/claim', { code })
  return res.data?.data
}
