import client from './client'
import { resolveImageUrl } from './cards'
import { swrFetch, TTL } from '../util/cache'

export type Banner = {
  id: number
  title: string
  image: string | null
  content: string
}

export type Article = {
  id: number
  title: string
  subtitle: string | null
  image: string | null
  readCount: number
  createDate: string
}

export type ArticleDetail = Article & { content: string }

export async function fetchBanners(): Promise<Banner[]> {
  const res = await client.get('/tuka/banner/public')
  const list: any[] = res.data?.data || []
  return list.map(b => ({
    id:      b.id,
    title:   b.title,
    image:   resolveImageUrl(b.image),
    content: b.content || '',
  }))
}

export async function fetchArticles(onFresh?: (a: Article[]) => void): Promise<Article[]> {
  return swrFetch('articles:list', TTL.countries, async () => {
    const res = await client.get('/tuka/article/public')
    const list: any[] = res.data?.data || []
    return list.map(a => ({
      id:         a.id,
      title:      a.title,
      subtitle:   a.subtitle || null,
      image:      resolveImageUrl(a.image),
      readCount:  a.readCount || 0,
      createDate: a.createDate || '',
    }))
  }, onFresh)
}

export async function fetchArticleDetail(id: number): Promise<ArticleDetail> {
  const res = await client.get(`/tuka/article/${id}`)
  const a = res.data?.data || {}
  return {
    id:         a.id,
    title:      a.title,
    subtitle:   a.subtitle || null,
    image:      resolveImageUrl(a.image),
    content:    a.content || '',
    readCount:  a.readCount || 0,
    createDate: a.createDate || '',
  }
}
