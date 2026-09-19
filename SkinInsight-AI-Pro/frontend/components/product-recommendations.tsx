"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingBag, ExternalLink, Sparkles, Star, Filter, Truck, Heart, Droplets, Sun, FlaskConical, Snowflake } from "lucide-react"

interface Product {
  name: string
  brand: string
  price: string
  tier: string
  concerns: string[]
  key_ingredients: string[]
  url: string
  image?: string
  category?: string
  rating?: number
  reviews?: number
}

const TIERS = [
  { id: "", label: "All" },
  { id: "drugstore", label: "Drugstore" },
  { id: "affordable", label: "Affordable" },
  { id: "premium", label: "Premium" },
]

const PRETTY: Record<string, string> = {
  dark_circles: "dark circles",
  blackheads: "blackheads",
}

const CATEGORY_META: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  cleanser: { icon: Droplets, color: "text-sky-600", bg: "from-sky-100 to-blue-100 dark:from-sky-900/40 dark:to-blue-900/40", label: "Cleanser" },
  serum: { icon: FlaskConical, color: "text-purple-600", bg: "from-purple-100 to-fuchsia-100 dark:from-purple-900/40 dark:to-fuchsia-900/40", label: "Serum" },
  moisturizer: { icon: Snowflake, color: "text-emerald-600", bg: "from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40", label: "Moisturizer" },
  sunscreen: { icon: Sun, color: "text-amber-600", bg: "from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40", label: "Sunscreen" },
  treatment: { icon: Sparkles, color: "text-rose-600", bg: "from-rose-100 to-pink-100 dark:from-rose-900/40 dark:to-pink-900/40", label: "Treatment" },
}

// Curated Unsplash fallbacks (high-quality skincare product shots) per category.
// Used when the upstream product CDN URL fails to load.
const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  cleanser:    "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80",
  serum:       "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80",
  moisturizer: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=600&q=80",
  sunscreen:   "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=600&q=80",
  treatment:   "https://images.unsplash.com/photo-1631730486572-226d1f595b68?auto=format&fit=crop&w=600&q=80",
}
const DEFAULT_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?auto=format&fit=crop&w=600&q=80"

function pretty(c: string) {
  return PRETTY[c] || c
}

function StarRow({ rating = 0 }: { rating?: number }) {
  const r = Math.max(0, Math.min(5, rating))
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(r) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/40"}`} />
      ))}
    </div>
  )
}

export function ProductRecommendations() {
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [tier, setTier] = useState("")
  const [concerns, setConcerns] = useState<string[]>([])
  const [activeConcern, setActiveConcern] = useState<string>("")

  useEffect(() => {
    const pull = (a: any) => {
      if (!a?.concerns) return
      const top = Object.entries(a.concerns)
        .filter(([k]) => k !== "hydration" && k !== "evenness")
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 4)
        .map(([k]) => k)
      setConcerns(top)
    }
    try {
      const raw = localStorage.getItem("skinpro:lastAnalysis")
      if (raw) pull(JSON.parse(raw))
    } catch {}
    const h = (e: any) => pull(e.detail)
    window.addEventListener("skinpro:analysis", h as any)
    return () => window.removeEventListener("skinpro:analysis", h as any)
  }, [])

  const concernQuery = useMemo(() => {
    if (activeConcern) return activeConcern
    return concerns.join(",")
  }, [activeConcern, concerns])

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (concernQuery) qs.set("concerns", concernQuery)
    if (tier) qs.set("tier", tier)
    fetch(`/api/products?${qs.toString()}`)
      .then((r) => r.json())
      .then((j) => setItems(j.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [concernQuery, tier])

  const hasScan = concerns.length > 0

  return (
    <section id="products" className="py-12 sm:py-20 bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4">
        <div className="text-center mb-6 sm:mb-8">
          <Badge variant="secondary" className="mb-3"><ShoppingBag className="w-3 h-3 mr-1" /> Real products</Badge>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-2 text-balance">
            Picked for{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              your skin
            </span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto px-2">
            {hasScan
              ? "Filtered by your top concerns. Tap a chip to focus or change the price tier."
              : "Run a face scan and we'll match products to your real concerns."}
          </p>
        </div>

        {/* Routine bundle hero CTA — only when user has scanned */}
        {hasScan && items.length >= 3 && (
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-secondary p-4 sm:p-6 mb-6 text-white shadow-xl">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 border border-white/20">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-amber-200" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mb-0.5">Routine bundle</div>
                <div className="text-base sm:text-lg font-bold leading-tight">Build your full AM + PM kit</div>
                <div className="text-xs sm:text-sm text-white/85 mt-0.5">Cleanser → serum → moisturizer → SPF — picked for {concerns.slice(0,2).map(pretty).join(" & ")}.</div>
              </div>
              <a href="#tracker" className="shrink-0">
                <Button size="sm" className="rounded-xl bg-white text-rose-600 hover:bg-amber-50 font-bold shadow-lg gap-1.5 h-10 px-3 sm:px-4">
                  <span className="hidden sm:inline">View routine</span>
                  <span className="sm:hidden">View</span>
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* Sticky filter bar (mobile) */}
        {hasScan && (
          <div className="sticky top-14 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 mb-3 bg-background/95 backdrop-blur-md sm:bg-transparent sm:backdrop-blur-0 sm:static sm:py-0 border-b border-border/50 sm:border-0">
            <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible scrollbar-none">
              <button
                onClick={() => setActiveConcern("")}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border font-semibold transition ${
                  activeConcern === "" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card hover:bg-muted border-border"
                }`}
              >
                ✦ All
              </button>
              {concerns.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveConcern(c)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full border capitalize font-semibold transition ${
                    activeConcern === c ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card hover:bg-muted border-border"
                  }`}
                >
                  {pretty(c)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price tier filter */}
        <div className="flex justify-center items-center gap-1.5 mb-6 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Price:</span>
          {TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTier(t.id)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                tier === t.id ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted border-border"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border bg-card animate-pulse h-[300px] sm:h-[420px]" />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm">No matches with this filter — try widening the tier or clearing the concern.</div>
            </CardContent>
          </Card>
        )}

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {items.map((p, i) => {
              const matchScore = activeConcern
                ? (p.concerns.includes(activeConcern) ? 1 : 0)
                : p.concerns.filter((c) => concerns.includes(c)).length
              const cat = CATEGORY_META[p.category || ""] || { icon: ShoppingBag, color: "text-slate-500", bg: "from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900", label: "Skincare" }
              const CatIcon = cat.icon
              const isBestMatch = matchScore >= 2
              return (
                <Card
                  key={`${p.name}-${i}`}
                  className="group relative overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-border/60 flex flex-col bg-card rounded-2xl"
                >
                  {isBestMatch && (
                    <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider py-1 px-2 sm:px-3 text-center shadow">
                      ★ Best match
                    </div>
                  )}
                  <div className={`relative aspect-square bg-gradient-to-br ${cat.bg} overflow-hidden ${isBestMatch ? "pt-5" : ""}`}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <CatIcon className={`w-10 h-10 sm:w-16 sm:h-16 ${cat.color} opacity-25`} strokeWidth={1.5} />
                      <div className={`mt-1 sm:mt-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${cat.color} opacity-50`}>{cat.label}</div>
                    </div>
                    {(() => {
                      const fallback = CATEGORY_FALLBACK_IMAGE[p.category || ""] || DEFAULT_FALLBACK_IMAGE
                      const src = p.image || fallback
                      return (
                        <img
                          src={src}
                          alt={p.name}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement
                            // Try category fallback first, then the default; otherwise hide.
                            if (img.src !== fallback) { img.src = fallback; return }
                            if (img.src !== DEFAULT_FALLBACK_IMAGE) { img.src = DEFAULT_FALLBACK_IMAGE; return }
                            img.style.display = "none"
                          }}
                        />
                      )
                    })()}
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between gap-1">
                      <Badge className={`capitalize bg-background/95 text-foreground border-0 shadow-sm backdrop-blur text-[9px] sm:text-[10px] px-1.5 py-0.5 ${isBestMatch ? "mt-5" : ""}`}>
                        {p.tier}
                      </Badge>
                      <button className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background/90 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-rose-500 transition shadow-sm ${isBestMatch ? "mt-5" : ""}`} aria-label="Save">
                        <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="hidden sm:flex absolute bottom-0 left-0 right-0 bg-foreground text-background py-2 text-xs font-semibold text-center translate-y-full group-hover:translate-y-0 transition-transform duration-300 items-center justify-center gap-1.5">
                      <ExternalLink className="w-3 h-3" /> Quick view
                    </a>
                  </div>

                  <CardContent className="p-2.5 sm:p-4 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                      <div className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">{p.brand}</div>
                      <div className={`hidden sm:flex text-[10px] items-center gap-1 ${cat.color}`}>
                        <CatIcon className="w-3 h-3" /> {cat.label}
                      </div>
                    </div>
                    <h3 className="font-semibold text-xs sm:text-sm leading-snug mb-1.5 sm:mb-2 line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] group-hover:text-primary transition-colors">
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                      <StarRow rating={p.rating || 0} />
                      <span className="text-[10px] sm:text-[11px] font-semibold">{p.rating?.toFixed(1) || "—"}</span>
                      {p.reviews && <span className="text-[9px] sm:text-[10px] text-muted-foreground">({p.reviews >= 1000 ? `${(p.reviews/1000).toFixed(1)}k` : p.reviews})</span>}
                    </div>
                    <div className="hidden sm:flex flex-wrap gap-1 mb-3">
                      {p.concerns.slice(0, 3).map((c, j) => (
                        <Badge
                          key={j}
                          variant="outline"
                          className={`text-[10px] capitalize px-1.5 py-0 ${
                            concerns.includes(c) ? "border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : ""
                          }`}
                        >
                          {pretty(c)}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-auto pt-2 sm:pt-3 border-t border-border/60">
                      <div className="flex items-end justify-between mb-2">
                        <div>
                          <div className="text-[9px] sm:text-[10px] text-muted-foreground">Price</div>
                          <div className="text-base sm:text-xl font-bold tracking-tight">{p.price}</div>
                        </div>
                        <div className="hidden sm:flex text-[10px] text-emerald-600 dark:text-emerald-400 items-center gap-1 mb-1">
                          <Truck className="w-3 h-3" /> Free delivery
                        </div>
                      </div>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                        <Button size="sm" className="w-full gap-1 sm:gap-1.5 h-8 sm:h-9 text-[11px] sm:text-xs font-semibold rounded-lg">
                          <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Shop
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {!hasScan && (
          <div className="text-center mt-8">
            <a href="#prediction">
              <Button variant="outline" size="sm">Run a face scan for tailored picks</Button>
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
