import client from './client'

export type PopupAd = {
  id: number
  title: string
  image: string | null
  content: string | null
  linkType: 'none' | 'article' | 'url'
  linkValue: string | null
  couponCode: string | null
  showOnce: number
}

export async function fetchActivePopups(): Promise<PopupAd[]> {
  try {
    const res = await client.get('/tuka/popup/active')
    return res.data?.data || []
  } catch {
    return []
  }
}
