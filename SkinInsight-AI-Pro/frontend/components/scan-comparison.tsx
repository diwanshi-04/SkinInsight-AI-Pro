"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, TrendingUp, TrendingDown, Minus, GitCompare, Sparkles } from "lucide-react"

interface HistEntry {
  ts: number
  date: string
  overall: number
  skinType: string
  concerns: Record<string, number>
  heatmap?: string
}

const POSITIVE = new Set(["hydration", "evenness"])

function loadHistory(): HistEntry[] {
  if (typeof window === "undefined") return []
  try { const raw = localStorage.getItem("skinpro:history"); return raw ? JSON.parse(raw) : [] } catch { return [] }
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function deltaIcon(delta: number, positive: boolean) {
  const improved = positive ? delta > 0 : delta < 0
  if (Math.abs(delta) < 1) return { Icon: Minus, color: "text-muted-foreground", label: "No change" }
  return improved
    ? { Icon: TrendingDown, color: "text-emerald-500", label: "Improved" }
    : { Icon: TrendingUp, color: "text-red-500", label: "Worsened" }
}

export function ScanComparison() {
  const [history, setHistory] = useState<HistEntry[]>([])
  const [sliderPos, setSliderPos] = useState(50)

  useEffect(() => {
    setHistory(loadHistory())
    const h = () => setHistory(loadHistory())
    window.addEventListener("skinpro:history-updated", h)
    return () => window.removeEventListener("skinpro:history-updated", h)
  }, [])

  if (history.length < 2) {
    return (
      <section id="compare" className="py-16 bg-background">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-6">
            <Badge variant="secondary" className="mb-3"><GitCompare className="w-3 h-3 mr-1" /> Before & after</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">Track your transformation</h2>
            <p className="text-muted-foreground">Your second scan unlocks a side-by-side comparison.</p>
          </div>
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <p className="text-lg font-semibold mb-1">{history.length === 0 ? "Run your first scan" : "Scan again in a few days"}</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {history.length === 0
                  ? "Once you've done a scan, we'll save it here and start charting your skincare progress."
                  : "Stick with your routine for 5–7 days, then re-scan. We'll show concern-by-concern deltas, drift in skin age, and a visual slider."}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    )
  }

  const sorted = [...history].sort((a, b) => a.ts - b.ts)
  const before = sorted[0]
  const after = sorted[sorted.length - 1]

  const concernKeys = Array.from(new Set([...Object.keys(before.concerns || {}), ...Object.keys(after.concerns || {})]))
  const overallDelta = after.overall - before.overall

  return (
    <section id="compare" className="py-16 bg-background">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-3"><GitCompare className="w-3 h-3 mr-1" /> Before & after</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Your skin's journey</h2>
          <p className="text-muted-foreground">First scan vs. most recent — measured, not guessed.</p>
        </div>

        {/* Visual slider if heatmaps available */}
        {before.heatmap && after.heatmap && (
          <Card className="mb-6 overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-[16/10] select-none bg-black overflow-hidden">
                <img src={after.heatmap} alt="after" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                  <img src={before.heatmap} alt="before" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                {/* slider line */}
                <div className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl" style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-slate-900 -rotate-90 absolute -top-1" />
                    <ArrowRight className="w-4 h-4 text-slate-900 rotate-90 absolute -bottom-1" />
                  </div>
                </div>
                {/* labels */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded">Before · {fmtDate(before.ts)}</div>
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded">After · {fmtDate(after.ts)}</div>
                <input
                  type="range" min={0} max={100} value={sliderPos}
                  onChange={(e) => setSliderPos(parseInt(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
                  aria-label="Compare scans"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overall delta */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="p-5 text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Before</div>
            <div className="text-3xl font-bold">{Math.round(before.overall)}</div>
            <div className="text-xs text-muted-foreground mt-1">{fmtDate(before.ts)}</div>
          </CardContent></Card>
          <Card className={`${overallDelta >= 0 ? "bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-emerald-200 dark:border-emerald-900" : "bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-200 dark:border-red-900"}`}>
            <CardContent className="p-5 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Change</div>
              <div className={`text-3xl font-bold ${overallDelta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {overallDelta >= 0 ? "+" : ""}{Math.round(overallDelta)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{overallDelta >= 0 ? "trending up" : "needs work"}</div>
            </CardContent>
          </Card>
          <Card><CardContent className="p-5 text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Now</div>
            <div className="text-3xl font-bold">{Math.round(after.overall)}</div>
            <div className="text-xs text-muted-foreground mt-1">{fmtDate(after.ts)}</div>
          </CardContent></Card>
        </div>

        {/* Per-concern deltas */}
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium mb-4">Concern-by-concern deltas</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {concernKeys.map((k) => {
                const b = before.concerns?.[k] ?? 0
                const a = after.concerns?.[k] ?? 0
                const d = a - b
                const positive = POSITIVE.has(k)
                const di = deltaIcon(d, positive)
                return (
                  <div key={k} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium capitalize">{k}</div>
                      <div className={`flex items-center gap-1 text-xs font-semibold ${di.color}`}>
                        <di.Icon className="w-3.5 h-3.5" />
                        {d > 0 ? "+" : ""}{Math.round(d)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground tabular-nums w-7 text-right">{Math.round(b)}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                        <div className="absolute inset-y-0 bg-blue-400/40" style={{ width: `${Math.min(100, b)}%` }} />
                        <div className="absolute inset-y-0 bg-emerald-500" style={{ width: `${Math.min(100, a)}%`, mixBlendMode: "multiply" }} />
                      </div>
                      <span className="font-semibold tabular-nums w-7">{Math.round(a)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
