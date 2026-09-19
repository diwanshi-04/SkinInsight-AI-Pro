import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { posts } from './posts'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://skininsightai.app'

export const metadata: Metadata = {
  title: 'Skincare Blog — AI Dermatology, Routines & Ingredient Guides',
  description:
    'Evidence-based skincare guides written for the AI age. Learn how to find your skin type, fix acne, treat dark circles and build a personalized routine — backed by clinical research.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Skincare Blog — SkinInsight AI',
    description:
      'Evidence-based skincare guides: skin type, acne, dark circles, routines and ingredients.',
    url: '/blog',
    type: 'website',
  },
}

export default function BlogIndex() {
  const sorted = [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: sorted.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/blog/${p.slug}`,
      name: p.title,
    })),
  }

  return (
    <main className="min-h-screen">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <section className="relative pt-28 sm:pt-36 pb-12 sm:pb-16 overflow-hidden bg-gradient-to-b from-background via-muted/20 to-background">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-10 sm:mb-14">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-[0.2em] mb-4 border border-primary/20">
              ✨ Evidence-Based Skincare
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              The SkinInsight AI Blog
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Clinical research, AI dermatology insights, and the routines that actually work — written for people who want answers, not affiliate links.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {sorted.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group block p-6 rounded-2xl border bg-card hover:border-primary/40 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-3">
                  <span>{p.readMinutes} min read</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground">
                    {new Date(p.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
                  {p.title}
                </h2>
                <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.keywords.slice(0, 3).map((k) => (
                    <span
                      key={k}
                      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-muted text-muted-foreground"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
