"use client"

import {
  ScanFace,
  Layers,
  MessageCircle,
  Calendar,
  Pill,
  Lock,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type Step = {
  n: string
  eyebrow: string
  title: string
  body: string
  icon: React.ComponentType<{ className?: string }>
  chips: string[]
  visual: React.ReactNode
}

const STEPS: Step[] = [
  {
    n: "01",
    eyebrow: "Scan",
    title: "Multi-angle face scan",
    body: "Auto-capture front + sides with quality gates. Each angle is mapped to face regions and analysed for 10 distinct concerns — no manual tagging.",
    icon: ScanFace,
    chips: ["Auto-capture", "Region map", "Quality gates", "Privacy-first"],
    visual: <VisualScan />,
  },
  {
    n: "02",
    eyebrow: "Read",
    title: "10 concerns + ingredient priority",
    body: "Acne, pigmentation, redness, oiliness, hydration, pores, fine lines, dullness, tone, texture — each scored 0–100 with the actives that actually help.",
    icon: Layers,
    chips: ["Niacinamide", "Retinol", "AHAs", "SPF 50", "Centella"],
    visual: <VisualConcerns />,
  },
  {
    n: "03",
    eyebrow: "Coach",
    title: "AI skin coach, on call",
    body: "Stream personalised answers about your routine, ingredients, and concerns 24/7. Every reply is grounded in your latest scan.",
    icon: MessageCircle,
    chips: ["Llama 3.3", "Context-aware", "Plain English"],
    visual: <VisualCoach />,
  },
  {
    n: "04",
    eyebrow: "Track",
    title: "See real progress",
    body: "Daily routine + a streak calendar. Compare any two scans side-by-side and watch your score climb week over week.",
    icon: TrendingUp,
    chips: ["Calendar", "Streaks", "Compare scans"],
    visual: <VisualProgress />,
  },
]

export function FeaturesSection() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="absolute inset-0 mesh-dots opacity-20" />
      <div className="deco-orb deco-orb-primary w-[28rem] h-[28rem] -top-20 -left-20 opacity-40" />
      <div className="deco-orb deco-orb-secondary w-[28rem] h-[28rem] bottom-0 -right-24 opacity-40" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* header */}
        <div className="max-w-3xl mb-16 sm:mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-pane text-xs font-semibold text-foreground/80 mb-5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> How it works
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.02] mb-4">
            One scan. <span className="gradient-text">Every layer</span> of your
            skin.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            From the first selfie to your eight-week glow-up — here's the full
            workflow, end to end.
          </p>
        </div>

        {/* alternating editorial rows */}
        <div className="relative">
          {/* faint vertical step line on desktop */}
          <div
            aria-hidden
            className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-6 bottom-12 w-px step-line"
          />

          <div className="space-y-20 sm:space-y-28">
            {STEPS.map((s, i) => (
              <StepRow key={s.n} step={s} reverse={i % 2 === 1} />
            ))}
          </div>
        </div>

        {/* secondary trust strip — pill row, not boxes */}
        <div className="mt-20 sm:mt-24 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {[
            { icon: Lock, label: "Private by design" },
            { icon: Calendar, label: "Daily routine" },
            { icon: Pill, label: "Ingredient picks" },
          ].map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-pane text-sm font-semibold text-foreground/80"
            >
              <p.icon className="w-4 h-4 text-primary" />
              {p.label}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 sm:mt-14 flex justify-center">
          <Button
            size="xl"
            asChild
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-elevated"
          >
            <Link href="/#prediction">Try every feature free →</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────── editorial row ───────────────────── */
function StepRow({ step, reverse }: { step: Step; reverse: boolean }) {
  const Icon = step.icon
  return (
    <div className="relative grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* big faded number */}
      <span
        aria-hidden
        className={`deco-number absolute -z-0 -top-12 ${
          reverse ? "-right-2 lg:right-10" : "-left-2 lg:left-10"
        }`}
      >
        {step.n}
      </span>

      {/* center node on the line */}
      <div
        aria-hidden
        className="hidden lg:flex absolute left-1/2 -translate-x-1/2 top-12 z-10 w-3 h-3 rounded-full bg-primary ring-4 ring-background"
      />

      {/* copy */}
      <div
        className={`relative lg:col-span-6 ${
          reverse ? "lg:order-2 lg:pl-12" : "lg:pr-12"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
            <Icon className="w-5 h-5" />
          </span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-primary font-bold">
            {step.eyebrow}
          </span>
        </div>
        <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-tight mb-3">
          {step.title}
        </h3>
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-5 max-w-lg">
          {step.body}
        </p>
        <div className="flex flex-wrap gap-2">
          {step.chips.map((c) => (
            <span
              key={c}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-card border border-border/60 text-foreground/80"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* visual */}
      <div className={`lg:col-span-6 ${reverse ? "lg:order-1" : ""}`}>
        {step.visual}
      </div>
    </div>
  )
}

/* ───────────────────── visuals ───────────────────── */
function VisualScan() {
  return (
    <div className="relative mx-auto max-w-md aspect-[4/5] ring-gradient rounded-organic overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 shadow-elevated">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[68%] aspect-square">
          <div className="absolute inset-0 rounded-full border border-emerald-400/30" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin"
            style={{ animationDuration: "3.2s" }}
          />
          <div className="absolute inset-3 rounded-full border border-dashed border-white/10" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
        </div>
      </div>
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px]">
        <span className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold backdrop-blur inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" /> Capturing
        </span>
        <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 font-mono backdrop-blur">
          Front · Left · Right
        </span>
      </div>
    </div>
  )
}

function VisualConcerns() {
  const rows = [
    { l: "Hydration", v: 72, c: "from-emerald-400 to-teal-400" },
    { l: "Oiliness", v: 58, c: "from-amber-400 to-orange-400" },
    { l: "Pigmentation", v: 41, c: "from-violet-400 to-fuchsia-400" },
    { l: "Acne", v: 32, c: "from-rose-400 to-red-400" },
    { l: "Pores", v: 47, c: "from-sky-400 to-cyan-400" },
    { l: "Texture", v: 64, c: "from-primary to-secondary" },
  ]
  return (
    <div className="relative mx-auto max-w-md ring-gradient rounded-organic-alt p-6 sm:p-7 bg-card shadow-elevated">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Concern matrix
        </span>
        <span className="text-[10px] font-bold text-primary">Live</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.l}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-foreground/80">{r.l}</span>
              <span className="font-extrabold tabular-nums">{r.v}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${r.c}`}
                style={{ width: `${r.v}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VisualCoach() {
  return (
    <div className="relative mx-auto max-w-md ring-gradient rounded-organic p-6 sm:p-7 bg-card shadow-elevated">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-sm">Skin Coach</div>
          <div className="text-[10px] text-emerald-600 font-bold inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
            online · streaming
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="text-xs px-3 py-2 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground inline-block max-w-[85%] ml-auto">
          What's the best SPF for combo skin?
        </div>
        <div className="text-xs px-3 py-2 rounded-2xl rounded-tl-sm bg-muted text-foreground/90 inline-block max-w-[90%]">
          For combo skin in India, look for a fluid, non-comedogenic SPF 50.
          Minimalist Sunscreen 50 or Re'equil Oxybenzone-free are solid daily
          picks. Reapply every 3–4 hrs outdoors.
        </div>
        <div className="text-[10px] text-muted-foreground italic">
          Powered by Llama 3.3 · grounded in your latest scan
        </div>
      </div>
    </div>
  )
}

function VisualProgress() {
  const days = [
    [62, 64, 66, 65, 68, 70, 72],
    [70, 72, 71, 74, 76, 75, 78],
  ]
  return (
    <div className="relative mx-auto max-w-md ring-gradient rounded-organic-alt p-6 sm:p-7 bg-card shadow-elevated">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Skin score
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold leading-none tabular-nums">
              78
            </span>
            <span className="text-emerald-600 text-xs font-bold">+6</span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground font-semibold">
          Last 14 days
        </div>
      </div>

      {/* simple sparkline-ish bar duo */}
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {days[0].map((v, i) => (
          <div
            key={i}
            className="rounded bg-primary/30"
            style={{ height: `${v / 1.5}px`, minHeight: 8 }}
          />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days[1].map((v, i) => (
          <div
            key={i}
            className="rounded bg-gradient-to-t from-primary to-secondary"
            style={{ height: `${v / 1.5}px`, minHeight: 8 }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-5 text-[11px] text-muted-foreground">
        <span>Mon</span>
        <span>Wed</span>
        <span>Fri</span>
        <span>Sun</span>
      </div>
    </div>
  )
}
