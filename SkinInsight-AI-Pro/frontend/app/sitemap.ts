import type { MetadataRoute } from 'next'
import { posts } from './blog/posts'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://skininsightai.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/how-it-works', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/blog', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/login', priority: 0.5, changeFrequency: 'yearly' },
    { path: '/signup', priority: 0.6, changeFrequency: 'yearly' },
  ]
  const staticEntries = routes.map((r) => ({
    url: `${SITE_URL}${r.path === '/' ? '' : r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
  const blogEntries = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))
  return [...staticEntries, ...blogEntries]
}
