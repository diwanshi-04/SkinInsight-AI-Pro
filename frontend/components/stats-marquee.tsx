"use client"

import { Sparkles, Zap, Users, Star, Shield, Activity } from "lucide-react"

const ITEMS = [
  { icon: Sparkles, label: "10 concerns scored" },
  { icon: Zap, label: "Under 30s scan" },
  { icon: Users, label: "2,800+ glowing users" },
  { icon: Star, label: "4.9 / 5 rating" },
  { icon: Shield, label: "Photos stay on device" },
  { icon: Activity, label: "Llama 3.3 powered coach" },
  { icon: Sparkles, label: "AI-built routines" },
  { icon: Star, label: "+18% avg score in 8 weeks" },
]

export function StatsMarquee() {
  // duplicate so the loop is seamless
  const row = [...ITEMS, ...ITEMS]
  return (
    <section
      aria-label="Highlights"
      className="relative border-y border-border/60 bg-foreground/[0.03] overflow-hidden"
    >
      {/* edge fades */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-24 z-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-24 z-10 bg-gradient-to-l from-background to-transparent" />

      <div className="marquee-track py-3 sm:py-5">
        {row.map((it, i) => (
          <div
            key={i}
            className="flex items-center gap-2 sm:gap-2.5 px-5 sm:px-7 text-[12px] sm:text-sm font-semibold text-foreground/75 whitespace-nowrap"
          >
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <it.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </span>
            {it.label}
            <span className="ml-5 sm:ml-7 text-primary/40">•</span>
          </div>
        ))}
      </div>
    </section>
  )
}
