"use client"

import { useEffect, useMemo, useState } from "react"
import { Flame, Calendar, Trophy, Camera, ArrowRight, Zap, Target, Lock, Snowflake, Clock, Sparkles, TrendingUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "skinpro:streak"
const QUEST_KEY = "skinpro:dailyQuest"

type StreakState = {
  current: number
  longest: number
  lastDateISO: string | null // YYYY-MM-DD
  totalScans: number
  history: string[] // last 30 ISO dates with a scan
}

const DAILY_QUESTS = [
  { id: "scan", icon: Camera, label: "Today's quick scan", reward: "+1 day streak", target: "scan" },
  { id: "spf", icon: Zap, label: "Apply SPF before 11 AM", reward: "Glow boost", target: "tip" },
  { id: "water", icon: Target, label: "Drink 2L of water", reward: "Hydration win", target: "tip" },
  { id: "patch", icon: Trophy, label: "Patch-test new product", reward: "Safety star", target: "tip" },
]

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function daysBetween(a: string, b: string) {
  const da = new Date(a + "T00:00:00")
  const db = new Date(b + "T00:00:00")
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

function loadStreak(): StreakState {
  if (typeof window === "undefined") {
    return { current: 0, longest: 0, lastDateISO: null, totalScans: 0, history: [] }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { current: 0, longest: 0, lastDateISO: null, totalScans: 0, history: [] }
}

function saveStreak(s: StreakState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

const BADGES = [
  { days: 3, name: "Sprout", emoji: "🌱", color: "from-emerald-400 to-teal-400" },
  { days: 7, name: "Glow Up", emoji: "✨", color: "from-violet-400 to-fuchsia-400" },
  { days: 14, name: "Radiant", emoji: "🔥", color: "from-amber-400 to-orange-400" },
  { days: 30, name: "Skin Pro", emoji: "👑", color: "from-rose-400 to-pink-500" },
  { days: 60, name: "Dermatologist", emoji: "🧬", color: "from-sky-400 to-indigo-500" },
]

export function DailyStreak() {
  const [state, setState] = useState<StreakState>({ current: 0, longest: 0, lastDateISO: null, totalScans: 0, history: [] })
  const [questDone, setQuestDone] = useState<Record<string, boolean>>({})
  const [freezes, setFreezes] = useState(2) // weekly streak freezes available
  const [animatedXp, setAnimatedXp] = useState(0)
  const [tickNow, setTickNow] = useState<Date | null>(null)
  const [shake, setShake] = useState(false)

  // ── load on mount + listen for new scans dispatched by the wizard
  useEffect(() => {
    setState(loadStreak())
    try {
      const q = localStorage.getItem(QUEST_KEY + ":" + todayKey())
      if (q) setQuestDone(JSON.parse(q))
    } catch {}

    // Load weekly freezes (resets each ISO week)
    try {
      const fkey = "skinpro:freezes"
      const raw = localStorage.getItem(fkey)
      const week = (() => {
        const d = new Date()
        const onejan = new Date(d.getFullYear(), 0, 1)
        return d.getFullYear() + "-W" + Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
      })()
      if (raw) {
        const parsed = JSON.parse(raw) as { week: string; left: number }
        if (parsed.week === week) setFreezes(parsed.left)
        else { setFreezes(2); localStorage.setItem(fkey, JSON.stringify({ week, left: 2 })) }
      } else {
        localStorage.setItem(fkey, JSON.stringify({ week, left: 2 }))
      }
    } catch {}

    // Start the time-until-midnight ticker
    setTickNow(new Date())
    const t = window.setInterval(() => setTickNow(new Date()), 1000 * 30)

    const onScan = () => bumpStreak()
    window.addEventListener("skinpro:analysis", onScan as any)
    return () => {
      window.removeEventListener("skinpro:analysis", onScan as any)
      window.clearInterval(t)
    }
  }, [])

  // Animate the XP counter when streak changes
  useEffect(() => {
    const target = state.current * 25 + state.totalScans * 10
    if (target === animatedXp) return
    const start = animatedXp
    const delta = target - start
    const dur = 700
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setAnimatedXp(Math.round(start + delta * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.current, state.totalScans])

  function useFreeze() {
    if (freezes <= 0) {
      setShake(true); window.setTimeout(() => setShake(false), 450); return
    }
    const next = freezes - 1
    setFreezes(next)
    try {
      const d = new Date()
      const onejan = new Date(d.getFullYear(), 0, 1)
      const week = d.getFullYear() + "-W" + Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
      localStorage.setItem("skinpro:freezes", JSON.stringify({ week, left: next }))
    } catch {}
    // Treat freeze as keeping streak alive: mark today as done with a flag
    setState((prev) => {
      const today = todayKey()
      if (prev.lastDateISO === today) return prev
      const history = Array.from(new Set([...(prev.history || []), today])).slice(-30)
      const next2: StreakState = {
        ...prev,
        current: prev.current + 1,
        longest: Math.max(prev.longest, prev.current + 1),
        lastDateISO: today,
        history,
      }
      saveStreak(next2)
      return next2
    })
  }

  function bumpStreak() {
    setState((prev) => {
      const today = todayKey()
      if (prev.lastDateISO === today) {
        const next = { ...prev, totalScans: prev.totalScans + 1 }
        saveStreak(next)
        return next
      }
      let current = 1
      if (prev.lastDateISO && daysBetween(prev.lastDateISO, today) === 1) {
        current = prev.current + 1
      }
      const history = Array.from(new Set([...(prev.history || []), today])).slice(-30)
      const next: StreakState = {
        current,
        longest: Math.max(prev.longest, current),
        lastDateISO: today,
        totalScans: prev.totalScans + 1,
        history,
      }
      saveStreak(next)
      // mark daily quest "scan" as complete
      const today2 = todayKey()
      const q = { ...questDone, scan: true }
      setQuestDone(q)
      try { localStorage.setItem(QUEST_KEY + ":" + today2, JSON.stringify(q)) } catch {}
      return next
    })
  }

  function toggleQuest(id: string) {
    if (id === "scan") return // scan is auto-completed by an actual scan
    const today = todayKey()
    const q = { ...questDone, [id]: !questDone[id] }
    setQuestDone(q)
    try { localStorage.setItem(QUEST_KEY + ":" + today, JSON.stringify(q)) } catch {}
  }

  const last7 = useMemo(() => {
    const out: { date: string; done: boolean; isToday: boolean; label: string }[] = []
    const today = new Date()
    const set = new Set(state.history)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      out.push({
        date: iso,
        done: set.has(iso),
        isToday: i === 0,
        label: ["S", "M", "T", "W", "T", "F", "S"][d.getDay()],
      })
    }
    return out
  }, [state.history])

  const completedToday = state.lastDateISO === todayKey()
  const nextBadge = BADGES.find((b) => state.current < b.days) || BADGES[BADGES.length - 1]
  const prevBadge = [...BADGES].reverse().find((b) => state.current >= b.days)
  const progressToNext = prevBadge
    ? ((state.current - prevBadge.days) / (nextBadge.days - prevBadge.days)) * 100
    : (state.current / nextBadge.days) * 100

  const startScan = () => {
    const el = document.getElementById("prediction")
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("skinpro:startScan"))
      }, 500)
    }
  }

  return (
    <section className="py-10 sm:py-12 bg-gradient-to-b from-background to-muted/20">
      {/* Local keyframes for the animated streak card */}
      <style jsx global>{`
        @keyframes ds-flame-flicker { 0%,100% { transform: scaleY(1) translateY(0); filter: brightness(1) } 50% { transform: scaleY(1.12) translateY(-2px); filter: brightness(1.18) } }
        @keyframes ds-ember-rise   { 0% { opacity: 0; transform: translate(var(--x,0px), 0) scale(0.6) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(var(--x,0px), -90px) scale(0.3) } }
        @keyframes ds-ring-spin    { to { transform: rotate(360deg) } }
        @keyframes ds-bob          { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes ds-pop          { 0% { transform: scale(0.5); opacity: 0 } 60% { transform: scale(1.18); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes ds-shimmer      { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }
        @keyframes ds-shake        { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }
        @keyframes ds-spark        { 0%,100% { opacity: 0; transform: scale(0.5) } 50% { opacity: 1; transform: scale(1.2) } }
        .ds-flame-anim { animation: ds-flame-flicker 1.1s ease-in-out infinite; transform-origin: bottom center }
        .ds-bob        { animation: ds-bob 3.4s ease-in-out infinite }
        .ds-pop        { animation: ds-pop 0.5s cubic-bezier(.34,1.56,.64,1) both }
        .ds-shimmer::after { content:""; position:absolute; inset:0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent); transform: translateX(-100%); animation: ds-shimmer 2.4s linear infinite }
        .ds-shake      { animation: ds-shake 0.4s ease-in-out }
        .ds-ring-spin  { animation: ds-ring-spin 18s linear infinite }
      `}</style>
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
          {/* ── Streak card (premium, animated) ── */}
          <Card className={`relative overflow-hidden p-0 text-white border-0 lg:col-span-2 ${shake ? "ds-shake" : ""}`}>
            {/* === Layered background === */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, #f97316 0%, #e11d48 45%, #a21caf 100%)" }}
            />
            {/* aurora glow blobs */}
            <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-amber-300/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-fuchsia-400/25 blur-3xl pointer-events-none" />
            {/* subtle dot grid */}
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            {/* shine sweep */}
            <div className="absolute inset-0 ds-shimmer overflow-hidden pointer-events-none mix-blend-overlay" />

            {/* === Content === */}
            <div className="relative p-6 sm:p-7">
              {/* Top status bar */}
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  <span>{completedToday ? "Streak protected" : state.current > 0 ? "Streak at risk" : "Begin journey"}</span>
                </div>
                {tickNow && state.current > 0 && !completedToday && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/25 backdrop-blur-md border border-white/15 text-[11px] font-bold tabular-nums">
                    <Clock className="w-3 h-3" />
                    {(() => {
                      const end = new Date(tickNow); end.setHours(24, 0, 0, 0)
                      const ms = end.getTime() - tickNow.getTime()
                      const h = Math.max(0, Math.floor(ms / 3600000))
                      const m = Math.max(0, Math.floor((ms % 3600000) / 60000))
                      return `${h}h ${m}m left`
                    })()}
                  </div>
                )}
                {completedToday && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/30 backdrop-blur-md border border-emerald-200/30 text-[11px] font-bold">
                    <span className="text-base leading-none">✓</span>
                    Done today
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-[auto_1fr] gap-5 sm:gap-7 items-center">
                {/* === Animated flame mascot with circular progress === */}
                <div className="relative shrink-0 mx-auto sm:mx-0 ds-bob" style={{ width: 132, height: 132 }}>
                  {/* Outer rotating ring */}
                  <svg viewBox="0 0 132 132" className="absolute inset-0 ds-ring-spin opacity-60">
                    <defs>
                      <linearGradient id="ringGrad" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#fde68a" />
                        <stop offset="50%" stopColor="#fff" />
                        <stop offset="100%" stopColor="#fbcfe8" />
                      </linearGradient>
                    </defs>
                    <circle cx="66" cy="66" r="62" fill="none" stroke="url(#ringGrad)" strokeWidth="1" strokeDasharray="2 8" opacity="0.6" />
                  </svg>

                  {/* Progress ring (level progress) */}
                  <svg viewBox="0 0 132 132" className="absolute inset-0 -rotate-90">
                    <circle cx="66" cy="66" r="56" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
                    <circle
                      cx="66" cy="66" r="56" fill="none"
                      stroke="white" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${(Math.min(100, Math.max(0, progressToNext)) / 100) * 351.86} 351.86`}
                      style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.55))", transition: "stroke-dasharray 700ms ease" }}
                    />
                  </svg>

                  {/* Glow halo */}
                  <div className="absolute inset-3 rounded-full bg-amber-300/50 blur-2xl animate-pulse" />

                  {/* Embers — only when streak >= 3 */}
                  {state.current >= 3 && (
                    <div className="absolute inset-0 pointer-events-none">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="absolute left-1/2 bottom-6 w-1.5 h-1.5 rounded-full bg-amber-200"
                          style={{
                            // @ts-expect-error css var
                            "--x": `${(i % 2 === 0 ? -1 : 1) * (4 + i * 3)}px`,
                            animation: `ds-ember-rise ${1.6 + i * 0.3}s ease-out infinite`,
                            animationDelay: `${i * 0.4}s`,
                            filter: "blur(0.5px)",
                            boxShadow: "0 0 6px #fde68a",
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Flame core */}
                  <div className="absolute inset-5 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center shadow-2xl border border-white/30">
                    <div className="ds-flame-anim">
                      <Flame
                        className={`w-12 h-12 sm:w-14 sm:h-14 drop-shadow-[0_0_14px_rgba(253,230,138,0.85)] ${
                          state.current > 0 ? "text-amber-100" : "text-white/50"
                        }`}
                        fill={state.current > 0 ? "currentColor" : "none"}
                      />
                    </div>
                  </div>

                  {/* Multiplier badge */}
                  {state.current >= 3 && (
                    <div className="absolute -top-1 -right-1 ds-pop">
                      <div className="px-2 py-1 rounded-full bg-gradient-to-r from-amber-300 to-rose-400 border-2 border-white text-[10px] font-black tracking-tight text-rose-950 shadow-lg">
                        ×{Math.min(5, 1 + Math.floor(state.current / 7))}
                      </div>
                    </div>
                  )}
                </div>

                {/* === Streak counts + 7-day strip === */}
                <div className="min-w-0">
                  {/* Big number */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="text-6xl sm:text-7xl font-black tracking-tight tabular-nums leading-none"
                      style={{
                        background: "linear-gradient(180deg, #fff 0%, #fde68a 70%, #fbcfe8 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        textShadow: "0 6px 24px rgba(0,0,0,0.18)",
                      }}
                    >
                      {state.current}
                    </span>
                    <span className="text-sm sm:text-base font-semibold text-white/85">day streak</span>
                  </div>

                  {/* Stat chips row */}
                  <div className="flex items-center gap-2 mt-2 mb-4 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[11px] font-bold tabular-nums">
                      <Trophy className="w-3 h-3 text-amber-200" />
                      Best {state.longest}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[11px] font-bold tabular-nums">
                      <Zap className="w-3 h-3 text-amber-200" />
                      {animatedXp} XP
                    </span>
                    {state.current > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[11px] font-bold">
                        <TrendingUp className="w-3 h-3 text-emerald-200" />
                        On fire
                      </span>
                    )}
                  </div>

                  {/* Last 7 days */}
                  <div className="flex items-center gap-1.5">
                    {last7.map((d, idx) => (
                      <div key={d.date} className="flex-1 min-w-0 flex flex-col items-center gap-1 group">
                        <div
                          title={`${d.label} — ${d.done ? "scanned ✓" : d.isToday ? "today (pending)" : "no scan"}`}
                          className={`relative w-full aspect-square max-w-[44px] rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 will-change-transform group-hover:scale-110 group-hover:-translate-y-0.5 ${
                            d.done
                              ? "bg-white text-rose-600 shadow-lg shadow-black/20"
                              : d.isToday
                              ? "bg-white/20 ring-2 ring-white/70 text-white"
                              : "bg-white/10 text-white/55"
                          }`}
                          style={{ animationDelay: `${idx * 60}ms` }}
                        >
                          {d.done ? (
                            <span className="ds-pop">✓</span>
                          ) : (
                            d.label
                          )}
                          {d.done && (
                            <span className="absolute inset-0 rounded-lg pointer-events-none" style={{ boxShadow: "0 0 12px rgba(255,255,255,0.6)" }} />
                          )}
                          {d.isToday && !d.done && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white animate-pulse" />
                          )}
                        </div>
                        <span className={`text-[9px] font-bold ${d.isToday ? "text-white" : "text-white/50"}`}>
                          {d.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* === Action row === */}
              <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                <Button
                  size="lg"
                  onClick={startScan}
                  disabled={completedToday}
                  className={`flex-1 sm:flex-[2] rounded-xl font-bold gap-2 h-12 ${
                    completedToday
                      ? "bg-white/20 text-white/80 hover:bg-white/20 cursor-default"
                      : "bg-white text-rose-600 hover:bg-amber-50 shadow-xl"
                  }`}
                >
                  {completedToday ? "Done today ✓" : (<><Camera className="w-4 h-4" /> Scan now & extend</>)}
                </Button>
                <Button
                  size="lg"
                  onClick={useFreeze}
                  disabled={completedToday || freezes <= 0}
                  variant="outline"
                  className="flex-1 rounded-xl font-bold gap-2 h-12 bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20 disabled:bg-white/5 disabled:text-white/50"
                  title={freezes > 0 ? `${freezes} streak freeze${freezes === 1 ? "" : "s"} left this week` : "No freezes left this week"}
                >
                  <Snowflake className="w-4 h-4 text-cyan-200" />
                  Freeze
                  <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-white/20">
                    {freezes}
                  </span>
                </Button>
              </div>

              {/* === Progress to next badge (richer) === */}
              <div className="relative mt-5 pt-5 border-t border-white/15">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-white/85 font-medium inline-flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Next badge:{" "}
                    <span className="font-bold inline-flex items-center gap-1">
                      <span className="text-base leading-none">{nextBadge.emoji}</span>
                      {nextBadge.name}
                    </span>
                  </span>
                  <span className="font-bold tabular-nums">{state.current}/{nextBadge.days} days</span>
                </div>
                <div className="relative h-2.5 bg-black/25 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(0, progressToNext))}%`,
                      background: "linear-gradient(90deg, #fde68a 0%, #fff 50%, #fbcfe8 100%)",
                      boxShadow: "0 0 12px rgba(255,255,255,0.7)",
                    }}
                  >
                    <div className="absolute inset-0 ds-shimmer overflow-hidden mix-blend-overlay" />
                  </div>
                </div>
                {/* Per-day milestone ticks */}
                <div className="absolute inset-x-0 bottom-0 h-2.5 pointer-events-none">
                  {prevBadge && (
                    <div className="relative h-full max-w-full">
                      {Array.from({ length: Math.max(1, nextBadge.days - (prevBadge?.days || 0)) }).map((_, i, arr) => (
                        <span
                          key={i}
                          className="absolute top-0 w-px h-full bg-white/15"
                          style={{ left: `${((i + 1) / arr.length) * 100}%` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-white/70 mt-2 leading-relaxed">
                  {state.current === 0
                    ? "Take your first scan to ignite the flame ✨"
                    : completedToday
                    ? `Keep coming back — ${nextBadge.days - state.current} more day${nextBadge.days - state.current === 1 ? "" : "s"} until ${nextBadge.name}.`
                    : `Don't break the streak — scan today to keep ${state.current} alive.`}
                </p>
              </div>
            </div>
          </Card>

          {/* ── Daily quests card ── */}
          <Card className="p-5 sm:p-6 bg-card border-2 border-border/60 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Today's plan</div>
                  <div className="font-bold text-lg mt-0.5">Daily quests</div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
              </div>

              <div className="space-y-2">
                {DAILY_QUESTS.map((q) => {
                  const Icon = q.icon
                  const done = q.id === "scan" ? completedToday : !!questDone[q.id]
                  return (
                    <button
                      key={q.id}
                      onClick={() => (q.id === "scan" ? startScan() : toggleQuest(q.id))}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                        done
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-muted/30 border-border hover:border-primary/40 hover:bg-muted/60"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          done ? "bg-emerald-500 text-white" : "bg-background border border-border text-muted-foreground"
                        }`}
                      >
                        {done ? "✓" : <Icon className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-semibold leading-tight ${done ? "line-through opacity-60" : ""}`}>
                          {q.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{q.reward}</div>
                      </div>
                      {q.id === "scan" && !done && (
                        <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Stats footer */}
              <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-xl font-black tracking-tight">{state.totalScans}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total scans</div>
                </div>
                <div>
                  <div className="text-xl font-black tracking-tight flex items-center justify-center gap-1">
                    {state.longest} <Trophy className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Best streak</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Badge gallery */}
        <div className="mt-5 flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {BADGES.map((b) => {
            const unlocked = state.longest >= b.days
            return (
              <div
                key={b.name}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border-2 text-xs font-semibold transition ${
                  unlocked
                    ? `border-transparent bg-gradient-to-r ${b.color} text-white shadow-md`
                    : "border-dashed border-border text-muted-foreground bg-muted/30"
                }`}
              >
                <span className="text-base">{unlocked ? b.emoji : <Lock className="w-3 h-3 inline" />}</span>
                <span>{b.name}</span>
                <span className="opacity-70">· {b.days}d</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
