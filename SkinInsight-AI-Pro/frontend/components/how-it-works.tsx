"use client"

import Link from "next/link"
import {
  Camera,
  ScanFace,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  Clock,
  Shield,
  Wand2,
} from "lucide-react"

const STEPS = [
  {
    n: "01",
    icon: Camera,
    eyebrow: "Capture",
    title: "Snap or upload a photo",
    body:
      "Use your phone camera in soft daylight, or drag any clear close-up shot. We support JPG, PNG and WebP up to 10 MB.",
    bullets: ["Front-facing portrait", "Good natural light", "Bare skin, no filters"],
    accent: "from-violet-500 to-fuchsia-500",
    soft: "from-violet-500/10 to-fuchsia-500/10",
    ring: "ring-violet-500/30",
    chipBg: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  {
    n: "02",
    icon: ScanFace,
    eyebrow: "Analyze",
    title: "Two AI models read your skin",
    body:
      "One model classifies your skin type (oily, dry, normal, combination). A second scans 10+ visible concerns — acne, redness, pigmentation, pores, dullness and more.",
    bullets: ["Skin-type confidence score", "Per-concern severity 0–100", "Lesion + texture heatmap"],
    accent: "from-sky-500 to-cyan-400",
    soft: "from-sky-500/10 to-cyan-400/10",
    ring: "ring-sky-500/30",
    chipBg: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  {
    n: "03",
    icon: Sparkles,
    eyebrow: "Recommend",
    title: "Get a personalised routine",
    body:
      "Morning, evening and weekly steps written for your exact concerns — with diet and lifestyle nudges that actually move the needle.",
    bullets: ["AM + PM step-by-step", "Diet & lifestyle tips", "Progress calendar built in"],
    accent: "from-emerald-500 to-teal-400",
    soft: "from-emerald-500/10 to-teal-400/10",
    ring: "ring-emerald-500/30",
    chipBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  {
    n: "04",
    icon: ShoppingBag,
    eyebrow: "Shop smart",
    title: "Real products matched to you",
    body:
      "Curated, science-backed Minimalist picks filtered by your top concerns and budget tier. No affiliate spam, no fluff.",
    bullets: ["Brand-verified catalog", "Price tiers from ₹189", "Direct links to checkout"],
    accent: "from-amber-500 to-orange-400",
    soft: "from-amber-500/10 to-orange-400/10",
    ring: "ring-amber-500/30",
    chipBg: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
]

const TRUST = [
  { icon: Clock, label: "Under 4 seconds", sub: "Avg. analysis time" },
  { icon: Shield, label: "Privacy-first", sub: "Photos never stored" },
  { icon: Wand2, label: "10+ concerns", sub: "Detected per scan" },
]

export function HowItWorks() {
  return (
    <section
      id="about"
      className="relative py-20 sm:py-28 overflow-hidden bg-gradient-to-b from-background via-muted/20 to-background"
    >
      {/* Background mesh */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-br from-primary/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-to-tl from-fuchsia-500/10 to-transparent rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-20">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            How SkinInsight works
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance">
            From a single photo to a{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              skincare plan that works
            </span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mt-5 text-pretty">
            No clinics, no waiting rooms, no guesswork. Four guided steps powered by computer
            vision and dermatology research — built to feel as easy as snapping a selfie.
          </p>
        </div>

        {/* Trust strip */}
        <div className="grid grid-cols-3 max-w-2xl mx-auto mb-16 sm:mb-20 gap-3 sm:gap-6">
          {TRUST.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 rounded-2xl bg-card/60 backdrop-blur border border-border/60"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <t.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold leading-tight truncate">
                  {t.label}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight truncate">
                  {t.sub}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Steps — vertical timeline */}
        <div className="relative">
          {/* Spine on lg */}
          <div className="hidden lg:block absolute left-1/2 top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

          <div className="space-y-10 sm:space-y-14 lg:space-y-20">
            {STEPS.map((s, i) => {
              const flip = i % 2 === 1
              const Icon = s.icon
              return (
                <div
                  key={s.n}
                  className="relative grid lg:grid-cols-2 gap-6 sm:gap-10 items-center group"
                >
                  {/* Center node on lg */}
                  <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-background border border-border shadow-lg items-center justify-center text-xs font-bold text-muted-foreground group-hover:border-primary group-hover:text-primary transition">
                    {s.n}
                  </div>

                  {/* Card */}
                  <div className={flip ? "lg:order-2" : ""}>
                    <div className="relative rounded-3xl p-6 sm:p-8 bg-card border border-border/70 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-0.5 overflow-hidden">
                      <div
                        className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${s.soft} opacity-60 pointer-events-none`}
                      />
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-5">
                          <span
                            className={`text-[11px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full ${s.chipBg}`}
                          >
                            Step {s.n} · {s.eyebrow}
                          </span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 text-balance">
                          {s.title}
                        </h3>
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-5 text-pretty">
                          {s.body}
                        </p>
                        <ul className="space-y-2">
                          {s.bullets.map((b) => (
                            <li
                              key={b}
                              className="flex items-start gap-2.5 text-sm text-foreground/80"
                            >
                              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Visual */}
                  <div className={`${flip ? "lg:order-1" : ""} flex justify-center`}>
                    <div className="relative w-full max-w-[420px] aspect-[5/4]">
                      <div
                        className={`absolute -inset-6 rounded-[40px] bg-gradient-to-br ${s.accent} opacity-20 blur-3xl`}
                      />
                      <div
                        className={`relative h-full w-full rounded-[32px] bg-gradient-to-br ${s.accent} p-[2px] shadow-2xl`}
                      >
                        <div className="relative h-full w-full rounded-[30px] bg-card/95 backdrop-blur-xl flex flex-col items-center justify-center gap-4 p-8 overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div
                              className={`w-64 h-64 rounded-full border ${s.ring} animate-[spin_30s_linear_infinite]`}
                            />
                            <div
                              className={`absolute w-48 h-48 rounded-full border ${s.ring} animate-[spin_20s_linear_infinite_reverse]`}
                            />
                            <div className={`absolute w-32 h-32 rounded-full border ${s.ring}`} />
                          </div>
                          <div
                            className={`relative w-20 h-20 rounded-2xl bg-gradient-to-br ${s.accent} flex items-center justify-center shadow-xl`}
                          >
                            <Icon className="w-10 h-10 text-white" strokeWidth={1.75} />
                          </div>
                          <div className="relative text-center">
                            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
                              Step {s.n}
                            </div>
                            <div className="text-lg font-bold mt-1">{s.eyebrow}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 sm:mt-24 text-center">
          <div className="inline-flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-2 sm:pl-6 sm:pr-2 sm:py-2 rounded-2xl bg-card border border-border/70 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground sm:mr-3">
              Ready to see your skin in a new way?
            </div>
            <Link
              href="#prediction"
              className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all"
            >
              Start free scan <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
