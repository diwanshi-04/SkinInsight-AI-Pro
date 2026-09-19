"use client"

import { Droplets, Activity, Sun, Flame, Wind, Sparkles, Heart, TrendingUp, Eye } from "lucide-react"

const skinTypes = [
  {
    name: "Oily",
    description: "Excess sebum, shiny T-zone, prone to enlarged pores and breakouts.",
    icon: Droplets,
    gradient: "from-amber-400 to-orange-500",
    bg: "from-amber-500/10 to-orange-500/5",
    pct: 38,
  },
  {
    name: "Dry",
    description: "Lacks moisture and natural oils — feels tight, may flake or look dull.",
    icon: Wind,
    gradient: "from-blue-400 to-cyan-500",
    bg: "from-blue-500/10 to-cyan-500/5",
    pct: 22,
  },
  {
    name: "Combination",
    description: "Oily T-zone, normal-to-dry cheeks. The most common adult skin profile.",
    icon: Sparkles,
    gradient: "from-primary to-secondary",
    bg: "from-fuchsia-500/10 to-pink-500/5",
    pct: 32,
  },
  {
    name: "Normal / Balanced",
    description: "Smooth, even tone, small pores, minimal sensitivity. Maintain it!",
    icon: Heart,
    gradient: "from-emerald-500 to-teal-500",
    bg: "from-emerald-500/10 to-teal-500/5",
    pct: 8,
  },
]

const concerns = [
  { name: "Acne & blemishes", icon: Activity, ingredients: ["Salicylic", "Niacinamide", "Adapalene"], color: "from-red-500 to-rose-500", glow: "bg-red-500/15" },
  { name: "Pigmentation", icon: Sun, ingredients: ["Vit-C", "Niacinamide", "SPF 50"], color: "from-purple-500 to-fuchsia-500", glow: "bg-purple-500/15" },
  { name: "Redness", icon: Flame, ingredients: ["Centella", "Azelaic", "Ceramides"], color: "from-pink-500 to-rose-400", glow: "bg-pink-500/15" },
  { name: "Oiliness & pores", icon: Droplets, ingredients: ["BHA", "Niacinamide", "Clay"], color: "from-amber-500 to-yellow-500", glow: "bg-amber-500/15" },
  { name: "Dryness & dullness", icon: Wind, ingredients: ["HA", "Glycerin", "Squalane"], color: "from-cyan-500 to-blue-500", glow: "bg-cyan-500/15" },
  { name: "Fine lines", icon: TrendingUp, ingredients: ["Retinol", "Peptides", "SPF"], color: "from-indigo-500 to-purple-500", glow: "bg-indigo-500/15" },
  { name: "Dark circles", icon: Eye, ingredients: ["Caffeine", "Vit-K", "Peptides"], color: "from-slate-500 to-zinc-600", glow: "bg-slate-500/15" },
  { name: "Texture & glow", icon: Sparkles, ingredients: ["AHAs", "PHA", "Vit-C"], color: "from-emerald-500 to-teal-500", glow: "bg-emerald-500/15" },
]

export function DiseaseInfoSection() {
  return (
    <section className="py-16 sm:py-24 relative overflow-hidden">
      <div className="absolute inset-0 mesh-dots opacity-20" />
      <div className="absolute top-1/3 left-0 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-xs font-bold uppercase tracking-widest mb-4">
            <Eye className="w-3 h-3" /> What we read from your face
          </div>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-foreground mb-4 tracking-tighter leading-[0.95] text-balance">
            Every concern,{" "}
            <span className="gradient-text">scored objectively</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-pretty text-base sm:text-lg">
            We measure 10 skin attributes from your photo — type, every concern, and the exact ingredients proven to help.
          </p>
        </div>

        {/* Stats banner */}
        <div className="mb-12 sm:mb-16 max-w-4xl mx-auto grid grid-cols-3 gap-2 sm:gap-4 p-1.5 rounded-3xl glass-strong shadow-elevated">
          {[
            { v: "10", l: "concerns scored" },
            { v: "13", l: "actives ranked" },
            { v: "30s", l: "to full report" },
          ].map((s) => (
            <div key={s.l} className="text-center px-4 py-5 sm:py-6 rounded-2xl bg-card/40">
              <div className="text-3xl sm:text-5xl font-extrabold gradient-text leading-none mb-1.5">{s.v}</div>
              <div className="text-[11px] sm:text-xs uppercase tracking-widest text-muted-foreground font-bold">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Skin types — radial bar style */}
        <div className="mb-14 sm:mb-20">
          <div className="flex items-end justify-between mb-6 sm:mb-8 flex-wrap gap-3">
            <div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Skin type detection</h3>
              <p className="text-sm text-muted-foreground mt-1">Auto-classified from sebum, hydration, and texture cues.</p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">% of users</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {skinTypes.map((t) => (
              <div key={t.name} className={`group relative rounded-3xl border border-border/60 bg-gradient-to-br ${t.bg} p-5 sm:p-6 overflow-hidden lift-on-hover`}>
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl group-hover:scale-110 transition" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shadow-md`}>
                      <t.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-2xl font-extrabold text-foreground">{t.pct}<span className="text-xs text-muted-foreground">%</span></div>
                  </div>
                  <h4 className="text-lg font-extrabold mb-1.5">{t.name}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{t.description}</p>
                  <div className="mt-4 h-1.5 rounded-full bg-card/60 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${t.gradient} transition-all duration-700`} style={{ width: `${t.pct * 2.5}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Concerns grid — premium cards with ingredient chips */}
        <div>
          <div className="flex items-end justify-between mb-6 sm:mb-8 flex-wrap gap-3">
            <div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Concerns we measure</h3>
              <p className="text-sm text-muted-foreground mt-1">Each scored 0–100, with the exact ingredients that help.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {concerns.map((c) => (
              <div key={c.name} className="group relative rounded-3xl border border-border/60 bg-card/60 backdrop-blur p-5 lift-on-hover overflow-hidden">
                <div className={`absolute -top-10 -right-10 w-36 h-36 ${c.glow} rounded-full blur-2xl group-hover:scale-110 transition`} />
                <div className="relative">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-md mb-4`}>
                    <c.icon className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-base sm:text-lg font-extrabold mb-3 leading-tight">{c.name}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {c.ingredients.map((ing) => (
                      <span key={ing} className="text-[10px] font-bold px-2 py-1 rounded-full bg-card border border-border/60 text-foreground/80">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
