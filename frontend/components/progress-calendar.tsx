"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp, TrendingDown, Calendar as CalIcon, Flame, Sun, Moon,
  CheckCircle2, AlertCircle, Camera, Bell, Target, Sparkles,
} from "lucide-react"

interface HistEntry {
  ts: number
  date: string
  overall: number
  skinType: string
  concerns: Record<string, number>
}

type RoutineMap = Record<string, Record<string, boolean>>

function loadHistory(): HistEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem("skinpro:history")
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function loadRoutines(): RoutineMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem("skinpro:routine")
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveRoutines(r: RoutineMap) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem("skinpro:routine", JSON.stringify(r))
    window.dispatchEvent(new CustomEvent("skinpro:routine-updated"))
  } catch {}
}

function loadGoal(): { concern: string; targetScore: number; targetDate: string } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("skinpro:goal")
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveGoal(g: { concern: string; targetScore: number; targetDate: string } | null) {
  if (typeof window === "undefined") return
  try {
    if (g) localStorage.setItem("skinpro:goal", JSON.stringify(g))
    else localStorage.removeItem("skinpro:goal")
  } catch {}
}

function monthGrid(d: Date) {
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDay = new Date(year, month, 1)
  const start = new Date(firstDay)
  start.setDate(start.getDate() - firstDay.getDay())
  const cells: { date: string; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const cur = new Date(start)
    cur.setDate(start.getDate() + i)
    cells.push({
      date: cur.toISOString().slice(0, 10),
      inMonth: cur.getMonth() === month,
    })
  }
  return cells
}

function dayHasMorning(routines: RoutineMap, date: string): boolean {
  const day = routines[date] || {}
  return Object.entries(day).some(([k, v]) => v && k.startsWith("morning-"))
}
function dayHasEvening(routines: RoutineMap, date: string): boolean {
  const day = routines[date] || {}
  return Object.entries(day).some(([k, v]) => v && k.startsWith("evening-"))
}
function dayCompleted(routines: RoutineMap, date: string): "full" | "half" | "none" {
  const m = dayHasMorning(routines, date)
  const e = dayHasEvening(routines, date)
  if (m && e) return "full"
  if (m || e) return "half"
  return "none"
}

function calcStreak(routines: RoutineMap): number {
  let s = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (dayCompleted(routines, key) !== "none") s++
    else if (i === 0) continue
    else break
  }
  return s
}

const ALL_CONCERNS = ["acne","pigmentation","redness","oiliness","dryness","pores","wrinkles","dullness","dark_circles","blackheads"]

export function ProgressCalendar() {
  const [history, setHistory] = useState<HistEntry[]>([])
  const [routines, setRoutines] = useState<RoutineMap>({})
  const [cursor, setCursor] = useState(() => new Date())
  const [goal, setGoal] = useState<{ concern: string; targetScore: number; targetDate: string } | null>(null)
  const [showGoalModal, setShowGoalModal] = useState(false)

  useEffect(() => {
    setHistory(loadHistory())
    setRoutines(loadRoutines())
    setGoal(loadGoal())
    const h = () => setHistory(loadHistory())
    const r = () => setRoutines(loadRoutines())
    window.addEventListener("skinpro:history-updated", h)
    window.addEventListener("skinpro:routine-updated", r)
    return () => {
      window.removeEventListener("skinpro:history-updated", h)
      window.removeEventListener("skinpro:routine-updated", r)
    }
  }, [])

  const todayKey = new Date().toISOString().slice(0, 10)
  const byDate = useMemo(() => {
    const m: Record<string, HistEntry> = {}
    for (const e of history) {
      const prev = m[e.date]
      if (!prev || e.ts > prev.ts) m[e.date] = e
    }
    return m
  }, [history])

  const cells = useMemo(() => monthGrid(cursor), [cursor])
  const sorted = [...history].sort((a, b) => a.ts - b.ts)
  const last = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const delta = last && prev ? last.overall - prev.overall : 0
  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" })
  const streak = calcStreak(routines)
  const todayMorning = dayHasMorning(routines, todayKey)
  const todayEvening = dayHasEvening(routines, todayKey)

  const week = useMemo(() => {
    const arr: { date: string; status: "full" | "half" | "none"; label: string }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      arr.push({
        date: key,
        status: dayCompleted(routines, key),
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
      })
    }
    return arr
  }, [routines])
  const weekFull = week.filter(w => w.status === "full").length
  const weekAny = week.filter(w => w.status !== "none").length

  const reminders = useMemo(() => {
    const arr: { type: "warn" | "info" | "good"; text: string }[] = []
    if (!todayMorning && new Date().getHours() >= 8) arr.push({ type: "warn", text: "Morning routine not done yet — take 2 minutes for cleanser + SPF." })
    if (!todayEvening && new Date().getHours() >= 21) arr.push({ type: "warn", text: "Evening routine reminder — double cleanse before bed." })
    const lastScanDate = last ? new Date(last.ts) : null
    if (!lastScanDate) arr.push({ type: "info", text: "Run your first face scan to start tracking progress." })
    else {
      const daysSince = Math.floor((Date.now() - lastScanDate.getTime()) / 86400000)
      if (daysSince >= 7) arr.push({ type: "info", text: `It's been ${daysSince} days since your last scan — re-scan to track progress.` })
    }
    if (streak >= 7) arr.push({ type: "good", text: `🔥 ${streak}-day streak! Consistency is the secret to skin health.` })
    if (delta >= 5) arr.push({ type: "good", text: `Your overall score improved by +${delta.toFixed(1)} since last scan!` })
    if (delta <= -5) arr.push({ type: "warn", text: `Your overall score dropped by ${delta.toFixed(1)}. Review your routine.` })
    return arr.slice(0, 3)
  }, [todayMorning, todayEvening, last, streak, delta])

  const toggleToday = (slot: "morning" | "evening") => {
    setRoutines(prev => {
      const next = { ...prev }
      const day = { ...(next[todayKey] || {}) }
      const key = `${slot}-quick`
      day[key] = !day[key]
      next[todayKey] = day
      saveRoutines(next)
      return next
    })
  }

  const goalProgress = useMemo(() => {
    if (!goal || !last) return null
    const cur = last.concerns[goal.concern] ?? 0
    const start = sorted.length > 1 ? (sorted[0].concerns[goal.concern] ?? cur) : cur
    const totalChange = start - goal.targetScore
    const made = start - cur
    const pct = totalChange > 0 ? Math.max(0, Math.min(100, (made / totalChange) * 100)) : 0
    const daysLeft = Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000))
    return { cur, start, target: goal.targetScore, pct, daysLeft, made }
  }, [goal, last, sorted])

  const cellColor = (d: string) => {
    const e = byDate[d]
    if (!e) return ""
    const v = e.overall
    if (v >= 75) return "bg-emerald-500 text-white"
    if (v >= 60) return "bg-emerald-300"
    if (v >= 45) return "bg-yellow-300"
    return "bg-red-300"
  }

  return (
    <section id="calendar" className="py-16 bg-muted/30">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-3"><CalIcon className="w-3 h-3 mr-1" /> Skincare Diary</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Your skincare diary</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">Track routine, build streaks and watch your skin improve over weeks.</p>
        </div>

        {/* Today's quick check-in */}
        <Card className="mb-5 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
                <div className="text-lg font-bold flex items-center gap-2">
                  <Flame className={`w-5 h-5 ${streak >= 3 ? "text-orange-500" : "text-muted-foreground"}`} />
                  {streak} day streak
                  {streak >= 7 && <Badge className="bg-orange-500 text-white border-0 text-[10px]">On fire!</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant={todayMorning ? "default" : "outline"} size="sm" onClick={() => toggleToday("morning")} className="gap-1.5">
                  <Sun className="w-4 h-4" /> Morning {todayMorning && <CheckCircle2 className="w-3.5 h-3.5" />}
                </Button>
                <Button variant={todayEvening ? "default" : "outline"} size="sm" onClick={() => toggleToday("evening")} className="gap-1.5">
                  <Moon className="w-4 h-4" /> Evening {todayEvening && <CheckCircle2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            <div className="flex items-end gap-1.5 justify-between">
              {week.map(w => (
                <div key={w.date} className="flex-1 text-center">
                  <div className={`h-12 rounded-md mb-1 transition ${
                    w.status === "full" ? "bg-emerald-500" :
                    w.status === "half" ? "bg-amber-400" : "bg-muted"
                  } ${w.date === todayKey ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`} />
                  <div className="text-[10px] text-muted-foreground">{w.label}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>Past 7 days · <span className="font-bold text-foreground">{weekFull}</span> full · {weekAny - weekFull} partial</span>
              <a href="#prediction" className="text-primary hover:underline flex items-center gap-1"><Camera className="w-3 h-3" /> Run new scan</a>
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total scans</div>
              <div className="text-2xl font-bold">{history.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Latest score</div>
              <div className="text-2xl font-bold flex items-center gap-1.5">
                {last ? Math.round(last.overall) : "—"}
                {last && prev && delta !== 0 && (
                  <span className={`text-xs flex items-center gap-0.5 ${delta > 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Skin type</div>
              <div className="text-2xl font-bold">{last?.skinType || "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Adherence (7d)</div>
              <div className="text-2xl font-bold">{Math.round((weekFull / 7) * 100)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Reminders */}
        {reminders.length > 0 && (
          <div className="space-y-2 mb-5">
            {reminders.map((r, i) => (
              <div key={i} className={`rounded-lg border p-3 flex items-start gap-2.5 text-sm ${
                r.type === "warn" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200" :
                r.type === "good" ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200" :
                "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200"
              }`}>
                {r.type === "warn" ? <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
                 r.type === "good" ? <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
                 <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <span>{r.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Goal */}
        <Card className="mb-5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-semibold text-sm"><Target className="w-4 h-4 text-primary" /> Skin goal</div>
              {goal ? (
                <Button variant="ghost" size="sm" onClick={() => { saveGoal(null); setGoal(null) }} className="text-xs h-7">Clear</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowGoalModal(true)} className="text-xs h-7">Set goal</Button>
              )}
            </div>
            {!goal && (
              <p className="text-xs text-muted-foreground">Pick a concern to focus on (e.g. reduce acne to 30) and we'll track your progress here.</p>
            )}
            {goal && goalProgress && (
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="font-semibold capitalize">{goal.concern.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">{goalProgress.daysLeft} days left</div>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden mb-2">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${goalProgress.pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Start: {Math.round(goalProgress.start)}</span>
                  <span className="font-semibold text-foreground">Now: {Math.round(goalProgress.cur)}</span>
                  <span>Target: {goal.targetScore}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar grid */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d) }} className="px-3 py-1 rounded border hover:bg-muted">‹</button>
              <div className="font-semibold">{monthLabel}</div>
              <button onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d) }} className="px-3 py-1 rounded border hover:bg-muted">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
              {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="text-center">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((c, i) => {
                const e = byDate[c.date]
                const status = dayCompleted(routines, c.date)
                const isToday = c.date === todayKey
                return (
                  <div
                    key={i}
                    title={`${c.date}${e ? ` · score ${Math.round(e.overall)}` : ""}${status !== "none" ? ` · ${status} routine` : ""}`}
                    className={`aspect-square rounded text-xs flex flex-col items-center justify-center border transition relative ${
                      c.inMonth ? "border-border" : "border-transparent text-muted-foreground/40"
                    } ${cellColor(c.date)} ${isToday ? "ring-2 ring-primary" : ""}`}
                  >
                    <span className="leading-none">{Number(c.date.slice(8))}</span>
                    {status !== "none" && c.inMonth && (
                      <div className="flex gap-0.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${dayHasMorning(routines, c.date) ? "bg-amber-500" : "bg-transparent border border-muted-foreground/30"}`} />
                        <div className={`w-1.5 h-1.5 rounded-full ${dayHasEvening(routines, c.date) ? "bg-indigo-500" : "bg-transparent border border-muted-foreground/30"}`} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" /> Score 75+</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-300" /> 60+</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-300" /> 45+</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-300" /> below 45</div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> AM done</div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> PM done</div>
            </div>
          </CardContent>
        </Card>

        {/* Goal modal */}
        {showGoalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowGoalModal(false)}>
            <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
              <CardContent className="p-6">
                <div className="font-semibold text-lg mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Set a skin goal</div>
                <GoalForm
                  onSave={(g) => { saveGoal(g); setGoal(g); setShowGoalModal(false) }}
                  onCancel={() => setShowGoalModal(false)}
                  concerns={last ? Object.keys(last.concerns).filter(c => ALL_CONCERNS.includes(c)) : ALL_CONCERNS}
                  currentScores={last?.concerns || {}}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </section>
  )
}

function GoalForm({ concerns, currentScores, onSave, onCancel }: {
  concerns: string[]
  currentScores: Record<string, number>
  onSave: (g: { concern: string; targetScore: number; targetDate: string }) => void
  onCancel: () => void
}) {
  const [concern, setConcern] = useState(concerns[0] || "acne")
  const cur = Math.round(currentScores[concern] || 50)
  const [target, setTarget] = useState(Math.max(0, cur - 15))
  const [days, setDays] = useState(30)
  useEffect(() => { setTarget(Math.max(0, Math.round((currentScores[concern] || 50)) - 15)) }, [concern, currentScores])
  const targetDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }, [days])
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Focus on</label>
        <select value={concern} onChange={e => setConcern(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm capitalize">
          {concerns.map(c => <option key={c} value={c}>{c.replace("_", " ")} (current: {Math.round(currentScores[c] || 0)})</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Target score (lower is better)</label>
        <input type="range" min={0} max={cur} value={target} onChange={e => setTarget(Number(e.target.value))} className="w-full" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>0</span><span className="font-bold text-foreground">{target}</span><span>{cur} (now)</span></div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Within</label>
        <div className="flex gap-2">
          {[14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`flex-1 px-3 py-2 rounded-md border text-sm ${days === d ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>{d} days</button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ concern, targetScore: target, targetDate })}>Save goal</Button>
      </div>
    </div>
  )
}
