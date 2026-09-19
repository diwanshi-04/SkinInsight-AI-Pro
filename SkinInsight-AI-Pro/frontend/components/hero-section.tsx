"use client"

import { Button } from "@/components/ui/button"
import {
  Shield,
  Zap,
  ScanFace,
  ArrowRight,
  Sparkles,
  Activity,
  Droplets,
  Sun,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"

export function HeroSection() {
  const startScan = () => {
    const el = document.getElementById("prediction")
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      setTimeout(
        () => window.dispatchEvent(new CustomEvent("skinpro:startScan")),
        600,
      )
    }
  }

  return (
    <section
      id="home"
      className="relative pt-20 pb-10 sm:pt-24 sm:pb-16 md:pt-28 md:pb-24 overflow-hidden"
    >
      {/* layered ambient background */}
      <div className="absolute inset-0 aurora-bg" />
      <div className="absolute inset-0 mesh-dots opacity-20 sm:opacity-30" />
      <div className="deco-orb deco-orb-primary w-[20rem] h-[20rem] sm:w-[26rem] sm:h-[26rem] -top-20 -left-20 sm:-top-24 sm:-left-24 animate-blob hidden sm:block" />
      <div className="deco-orb deco-orb-secondary w-[20rem] h-[20rem] sm:w-[30rem] sm:h-[30rem] top-32 -right-24 sm:top-40 sm:-right-32 animate-blob-reverse hidden sm:block" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          {/* ── LEFT: editorial copy ── */}
          <div className="lg:col-span-7 relative">
            {/* faded deco number */}
            <span
              aria-hidden
              className="deco-number absolute -top-10 -left-2 hidden md:block"
            >
              30s
            </span>

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-pane text-[11px] sm:text-xs font-semibold text-foreground/80 mb-4 sm:mb-6">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="hidden xs:inline">AI skin analysis · </span>Llama 3.3 powered
                <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
                  Live
                </span>
              </div>

              <h1 className="text-[2.1rem] xs:text-[2.4rem] sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold leading-[1.02] sm:leading-[0.98] tracking-tight mb-4 sm:mb-5">
                <span className="block text-foreground">Read your skin</span>
                <span className="block">
                  <span className="gradient-text">like a derm</span>
                  <span className="text-foreground">.</span>
                </span>
                <span className="block text-foreground/70 text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-semibold mt-1.5 sm:mt-2">
                  In one selfie.
                </span>
              </h1>

              <p className="text-[15px] sm:text-lg md:text-xl text-muted-foreground max-w-xl mb-6 sm:mb-8 leading-relaxed">
                Score 10 concerns, get a routine that's actually yours, and
                track real progress — no clinic, no guesswork, no fluff.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 mb-6 sm:mb-8">
                <Button
                  size="xl"
                  onClick={startScan}
                  className="group gap-2 px-7 sm:px-8 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-elevated"
                >
                  <ScanFace className="w-5 h-5" />
                  Start free scan
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  asChild
                  className="gap-2 px-6 sm:px-7 text-base font-medium border-2 backdrop-blur"
                >
                  <Link href="/how-it-works">How it works</Link>
                </Button>
              </div>

              {/* trust strip — inline, no boxes */}
              <div className="flex flex-wrap items-center gap-x-5 sm:gap-x-6 gap-y-2 sm:gap-y-3 text-[13px] sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="hidden xs:inline">Photos stay </span>On-device
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-primary" />
                  Under 30 s
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: device-frame creative mock (hidden on small phones) ── */}
          <div className="lg:col-span-5 hidden sm:block">
            <DeviceMock />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────── Creative phone-style scan preview ─────────────── */
function DeviceMock() {
  return (
    <div className="relative mx-auto max-w-sm">
      {/* glow halo */}
      <div className="deco-orb deco-orb-primary w-72 h-72 -top-8 -left-8 opacity-60" />
      <div className="deco-orb deco-orb-secondary w-64 h-64 -bottom-6 -right-6 opacity-50" />

      {/* floating data chips around the device — depth */}
      <FloatingChip
        className="absolute -top-3 -left-6 z-20 hidden sm:flex"
        icon={Droplets}
        label="Hydration"
        value="72"
        accent="emerald"
        delay={0}
      />
      <FloatingChip
        className="absolute top-24 -right-8 z-20 hidden sm:flex"
        icon={Sun}
        label="Pigment"
        value="41"
        accent="amber"
        delay={0.6}
      />
      <FloatingChip
        className="absolute bottom-28 -left-10 z-20 hidden sm:flex"
        icon={Activity}
        label="Acne"
        value="32"
        accent="rose"
        delay={1.2}
      />
      <FloatingChip
        className="absolute -bottom-4 right-2 z-20 hidden sm:flex"
        icon={TrendingUp}
        label="Trend"
        value="+18%"
        accent="primary"
        delay={1.8}
      />

      {/* the device itself */}
      <div className="relative ring-gradient rounded-[2.2rem] p-1.5 shadow-elevated bg-card">
        <div className="relative aspect-[9/16] rounded-[1.7rem] overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
          {/* notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 rounded-full bg-black/80 z-10" />

          {/* face glow */}
          <svg
            viewBox="0 0 100 160"
            className="absolute inset-0 w-full h-full"
            aria-hidden
          >
            <defs>
              <radialGradient id="hero-face" cx="50%" cy="40%" r="34%">
                <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#6366f1" stopOpacity="0.18" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            <ellipse cx="50" cy="60" rx="22" ry="30" fill="url(#hero-face)" />
            {/* subtle face contour */}
            <path
              d="M30 60 Q30 30 50 30 Q70 30 70 60 Q70 95 50 95 Q30 95 30 60 Z"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.6"
            />
          </svg>

          {/* scan ring — centered on face ellipse (cx=50, cy=60 of 100×160 viewBox) */}
          <div className="absolute left-1/2 top-[37.5%] -translate-x-1/2 -translate-y-1/2 w-[52%] aspect-square">
            <div className="relative w-full h-full">
              <div className="absolute inset-0 rounded-full border border-emerald-400/30" />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin"
                style={{ animationDuration: "3.2s" }}
              />
              <div className="absolute inset-3 rounded-full border border-dashed border-white/10" />
              {/* moving scan line */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
              {/* corner brackets */}
              {[
                { p: "top-1 left-1", r: "border-t-2 border-l-2 rounded-tl-md" },
                { p: "top-1 right-1", r: "border-t-2 border-r-2 rounded-tr-md" },
                { p: "bottom-1 left-1", r: "border-b-2 border-l-2 rounded-bl-md" },
                { p: "bottom-1 right-1", r: "border-b-2 border-r-2 rounded-br-md" },
              ].map((c, i) => (
                <span
                  key={i}
                  className={`absolute ${c.p} w-4 h-4 ${c.r} border-emerald-400/80`}
                />
              ))}
            </div>
          </div>

          {/* status row */}
          <div className="absolute top-9 left-3 right-3 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
              Scanning
            </span>
            <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 font-mono backdrop-blur">
              3 / 3 angles
            </span>
          </div>

          {/* result bar */}
          <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-black/65 border border-white/10 backdrop-blur-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
                Skin score
              </span>
              <span className="text-[10px] text-emerald-300 font-bold">
                +6 vs last week
              </span>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-extrabold text-white leading-none tabular-nums">
                78
              </span>
              <span className="text-xs text-white/60 mb-1">/ 100</span>
              <span className="ml-auto text-[10px] text-white/70 font-semibold">
                Combo · ~26y
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
                style={{ width: "78%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FloatingChip({
  className = "",
  icon: Icon,
  label,
  value,
  accent,
  delay = 0,
}: {
  className?: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  accent: "emerald" | "amber" | "rose" | "primary"
  delay?: number
}) {
  const tone = {
    emerald: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
    amber: "text-amber-600 bg-amber-500/10 border-amber-500/30",
    rose: "text-rose-600 bg-rose-500/10 border-rose-500/30",
    primary: "text-primary bg-primary/10 border-primary/30",
  }[accent]

  return (
    <div
      className={`${className} items-center gap-2 px-3 py-2 rounded-2xl glass-pane shadow-elevated text-xs font-semibold animate-blob`}
      style={{ animationDelay: `${delay}s` }}
    >
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center border ${tone}`}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="text-foreground/80">{label}</span>
      <span className="font-extrabold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  )
}
