"use client"

import { useEffect, useState } from "react"
import { Lightbulb } from "lucide-react"

export function TipsTicker() {
  const [tips, setTips] = useState<string[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    const fetchTips = () => {
      fetch("/api/tips?n=10")
        .then((r) => r.json())
        .then((j) => { if (!cancelled && j.tips) setTips(j.tips) })
        .catch(() => {})
    }
    fetchTips()
    const refresh = setInterval(fetchTips, 60_000)
    return () => { cancelled = true; clearInterval(refresh) }
  }, [])

  useEffect(() => {
    if (tips.length === 0) return
    const t = setInterval(() => setIdx((i) => (i + 1) % tips.length), 5000)
    return () => clearInterval(t)
  }, [tips.length])

  if (tips.length === 0) return null
  return (
    <div className="relative bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/40 dark:to-orange-950/40 border-y border-amber-200/70 dark:border-amber-900/50 py-3 overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/40 z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-amber-50 to-transparent dark:from-amber-950/40 z-10 pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shrink-0">
          <Lightbulb className="w-4 h-4 text-white" fill="currentColor" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-0.5">Today's tip</div>
          <div key={idx} className="text-sm font-semibold text-amber-900 dark:text-amber-100 truncate animate-fade-in-up">
            {tips[idx]}
          </div>
        </div>
        <div className="hidden sm:flex gap-1 shrink-0">
          {tips.slice(0, 5).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === idx % 5 ? "bg-amber-600 w-6" : "bg-amber-300 w-1.5"}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
