import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { ArrowRight, ArrowLeft, ScanFace } from 'lucide-react'
import { posts, postBySlug, type Block } from '../posts'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://skininsightai.app'

export async function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const p = postBySlug(slug)
  if (!p) return {}
  const ogTitle = encodeURIComponent(p.title.length > 70 ? p.title.slice(0, 67) + '…' : p.title)
  const ogSub = encodeURIComponent(p.description.length > 110 ? p.description.slice(0, 107) + '…' : p.description)
  return {
    title: p.title,
    description: p.description,
    keywords: p.keywords,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: {
      title: p.title,
      description: p.description,
      url: `/blog/${p.slug}`,
      type: 'article',
      publishedTime: p.publishedAt,
      modifiedTime: p.updatedAt,
      images: [`/api/og?title=${ogTitle}&subtitle=${ogSub}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: p.title,
      description: p.description,
      images: [`/api/og?title=${ogTitle}&subtitle=${ogSub}`],
    },
  }
}

function renderBlock(b: Block, i: number) {
  switch (b.type) {
    case 'h2':
      return (
        <h2 key={i} className="text-2xl sm:text-3xl font-bold tracking-tight mt-12 mb-4">
          {b.text}
        </h2>
      )
    case 'h3':
      return (
        <h3 key={i} className="text-xl sm:text-2xl font-bold mt-8 mb-3">
          {b.text}
        </h3>
      )
    case 'p':
      return (
        <p
          key={i}
          className="text-base sm:text-lg text-foreground/85 leading-relaxed mb-5"
          dangerouslySetInnerHTML={{ __html: b.html }}
        />
      )
    case 'ul':
      return (
        <ul key={i} className="list-disc pl-6 mb-6 space-y-2 text-base sm:text-lg text-foreground/85">
          {b.items.map((it, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol key={i} className="list-decimal pl-6 mb-6 space-y-2 text-base sm:text-lg text-foreground/85">
          {b.items.map((it, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ol>
      )
    case 'callout': {
      const tone =
        b.tone === 'warn'
          ? 'border-amber-500/30 bg-amber-500/5'
          : b.tone === 'tip'
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-sky-500/30 bg-sky-500/5'
      return (
        <div
          key={i}
          className={`my-6 p-5 rounded-xl border ${tone} text-base sm:text-lg text-foreground/90`}
          dangerouslySetInnerHTML={{ __html: b.html }}
        />
      )
    }
    case 'quote':
      return (
        <blockquote
          key={i}
          className="my-6 pl-5 border-l-4 border-primary/40 italic text-foreground/80"
          dangerouslySetInnerHTML={{ __html: b.html + (b.cite ? ` — <cite>${b.cite}</cite>` : '') }}
        />
      )
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const p = postBySlug(slug)
  if (!p) notFound()

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title,
    description: p.description,
    image: `${SITE_URL}/api/og?title=${encodeURIComponent(p.title)}`,
    datePublished: p.publishedAt,
    dateModified: p.updatedAt,
    author: { '@type': 'Organization', name: 'SkinInsight AI', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'SkinInsight AI',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${p.slug}` },
    keywords: p.keywords.join(', '),
  }

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: p.faq.map((q) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: { '@type': 'Answer', text: q.a },
    })),
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: p.title, item: `${SITE_URL}/blog/${p.slug}` },
    ],
  }

  const related = posts.filter((x) => x.slug !== p.slug).slice(0, 2)

  return (
    <main className="min-h-screen">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <article className="container max-w-3xl mx-auto px-4 pt-28 sm:pt-36 pb-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> All articles
        </Link>

        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
          <span>{p.readMinutes} min read</span>
          <span className="text-muted-foreground/60">·</span>
          <time dateTime={p.publishedAt} className="text-muted-foreground">
            {new Date(p.publishedAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-4">
          {p.title}
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-10">{p.description}</p>

        <div className="prose prose-lg max-w-none">{p.body.map(renderBlock)}</div>

        {/* Inline scanner CTA */}
        <div className="my-12 p-6 sm:p-8 rounded-2xl border bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-amber-500/5 text-center">
          <ScanFace className="w-10 h-10 mx-auto mb-3 text-primary" />
          <h3 className="text-xl sm:text-2xl font-bold mb-2">
            Want this personalized for your skin?
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 max-w-md mx-auto">
            Run a free 10-second AI face scan and get the exact routine + ingredient list for your skin.
          </p>
          <Link href="/#scan">
            <Button size="lg" className="gap-2">
              Start free scan <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* FAQ */}
        {p.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
              Frequently asked questions
            </h2>
            <div className="space-y-4">
              {p.faq.map((q, i) => (
                <details
                  key={i}
                  className="group p-5 rounded-xl border bg-card hover:border-primary/40 transition"
                >
                  <summary className="cursor-pointer font-semibold text-base sm:text-lg list-none flex justify-between items-center gap-3">
                    <span>{q.q}</span>
                    <span className="text-primary group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <p className="mt-3 text-sm sm:text-base text-foreground/80">{q.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl sm:text-2xl font-bold mb-5">Continue reading</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group block p-5 rounded-xl border bg-card hover:border-primary/40 transition"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">
                    {r.readMinutes} min read
                  </div>
                  <div className="font-bold group-hover:text-primary transition-colors">
                    {r.title}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <Footer />
    </main>
  )
}
