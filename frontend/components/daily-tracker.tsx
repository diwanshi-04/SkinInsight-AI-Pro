"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Droplet,
  Sun,
  Moon,
  Plus,
  Minus,
  Sparkles,
  Flame,
  Trophy,
  Share2,
  Zap,
  Target,
  Lock,
  CheckCircle2,
  RefreshCw,
  GlassWater,
  Coffee,
  Smartphone,
  Waves,
  PartyPopper,
  Clock,
  Timer,
} from "lucide-react"

const DAILY_GOAL_ML = 2500
const DEFAULT_ROUTINE = {
  morning: ["Gentle cleanser", "Vitamin C serum", "Moisturizer", "SPF 50"],
  evening: ["Gentle cleanser", "Treatment (retinol/BHA)", "Moisturizer"],
}

const todayKey = () => new Date().toISOString().slice(0, 10)
const dayKey = (offsetDaysBack: number) => {
  const d = new Date()
  d.setDate(d.getDate() - offsetDaysBack)
  return d.toISOString().slice(0, 10)
}
const dayLabel = (offsetDaysBack: number) => {
  const d = new Date()
  d.setDate(d.getDate() - offsetDaysBack)
  return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)
}

interface DayState {
  water: number
  morning: boolean[]
  evening: boolean[]
}

const emptyDay = (): DayState => ({
  water: 0,
  morning: DEFAULT_ROUTINE.morning.map(() => false),
  evening: DEFAULT_ROUTINE.evening.map(() => false),
})

function loadDay(key: string): DayState {
  if (typeof window === "undefined") return emptyDay()
  try {
    const raw = localStorage.getItem(`skinpro:daily:${key}`)
    if (raw) {
      const parsed = JSON.parse(raw) as DayState
      // Defensive: ensure arrays exist with right length
      return {
        water: typeof parsed.water === "number" ? parsed.water : 0,
        morning: Array.isArray(parsed.morning) && parsed.morning.length === DEFAULT_ROUTINE.morning.length
          ? parsed.morning
          : DEFAULT_ROUTINE.morning.map(() => false),
        evening: Array.isArray(parsed.evening) && parsed.evening.length === DEFAULT_ROUTINE.evening.length
          ? parsed.evening
          : DEFAULT_ROUTINE.evening.map(() => false),
      }
    }
  } catch {}
  return emptyDay()
}

/* ─────────────  XP / level math  ───────────── */
const XP_PER_STEP = 15
const XP_HYDRATION_GOAL = 40
const XP_HALF_HYDRATION = 15
const XP_STREAK_BONUS = 10 // per active streak day
const XP_PER_LEVEL = 200

function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1)
}
function xpInLevel(xp: number) {
  return xp % XP_PER_LEVEL
}

/* ─────────────  Mascot component  ───────────── */
function Mascot({
  pct,
  streak,
  allDone,
}: {
  pct: number // 0-100 today completion
  streak: number
  allDone: boolean
}) {
  // Mood from completion
  const mood = pct >= 100 ? "ecstatic" : pct >= 60 ? "happy" : pct >= 25 ? "neutral" : "sad"

  // Color tier from streak
  const tier =
    streak >= 100 ? 4 :
    streak >= 30  ? 3 :
    streak >= 14  ? 2 :
    streak >= 7   ? 1 :
    0
  const palettes = [
    { a: "#67e8f9", b: "#3b82f6", glow: "rgba(59,130,246,0.55)" }, // cool
    { a: "#fbbf24", b: "#f97316", glow: "rgba(249,115,22,0.6)" }, // warm
    { a: "#fb7185", b: "#e11d48", glow: "rgba(225,29,72,0.6)" }, // hot
    { a: "#c084fc", b: "#7c3aed", glow: "rgba(124,58,237,0.65)" }, // mythic
    { a: "#fde68a", b: "#f59e0b", glow: "rgba(245,158,11,0.75)" }, // legendary gold
  ]
  const p = palettes[tier]

  // Number of visible flame "tongues" — caps at 5
  const flames = Math.min(5, streak === 0 ? 0 : Math.max(1, Math.floor(streak / 3) + 1))

  return (
    <div className="relative w-44 h-44 sm:w-52 sm:h-52 shrink-0 mx-auto">
      {/* Outer aura — pulses harder at higher tiers */}
      <div
        className="absolute inset-0 rounded-full blur-2xl mascot-aura"
        style={{ background: p.glow, opacity: 0.5 + tier * 0.08 }}
      />

      {/* Floating sparkles when streak active */}
      {streak >= 3 && (
        <>
          <span className="absolute -top-2 left-6 text-amber-300 mascot-sparkle-a">✦</span>
          <span className="absolute top-3 -right-1 text-fuchsia-300 mascot-sparkle-b">✦</span>
          <span className="absolute bottom-6 -left-2 text-cyan-300 mascot-sparkle-c">✦</span>
        </>
      )}
      {allDone && (
        <span className="absolute -top-3 right-4 text-emerald-300 text-xl mascot-sparkle-a">★</span>
      )}

      {/* Flames at the base */}
      {flames > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-2 flex gap-0.5 items-end pointer-events-none">
          {Array.from({ length: flames }).map((_, i) => (
            <span
              key={i}
              className="block mascot-flame"
              style={{
                width: 10 + Math.abs(i - Math.floor(flames / 2)) * -1 + (i === Math.floor(flames / 2) ? 4 : 0) + 8,
                height: i === Math.floor(flames / 2) ? 32 : 22,
                background: `linear-gradient(to top, ${p.b}, ${p.a}, #fff7ed)`,
                borderRadius: "50% 50% 30% 30% / 60% 60% 40% 40%",
                animationDelay: `${i * 0.12}s`,
                opacity: 0.9,
                filter: "drop-shadow(0 0 6px " + p.glow + ")",
              }}
            />
          ))}
        </div>
      )}

      {/* Mascot orb (the "Glowy" character) */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 mascot-bob">
        <defs>
          <radialGradient id="orbGrad" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor={p.a} />
            <stop offset="100%" stopColor={p.b} />
          </radialGradient>
          <radialGradient id="orbHighlight" cx="35%" cy="25%" r="22%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* body */}
        <circle cx="100" cy="100" r="62" fill="url(#orbGrad)" />
        {/* highlight */}
        <ellipse cx="78" cy="78" rx="22" ry="14" fill="url(#orbHighlight)" />
        {/* cheeks */}
        <ellipse cx="70" cy="118" rx="9" ry="5" fill="#fda4af" opacity={0.55} />
        <ellipse cx="130" cy="118" rx="9" ry="5" fill="#fda4af" opacity={0.55} />

        {/* eyes (blinking) */}
        <g className="mascot-eye">
          <ellipse cx="84" cy="98" rx="5" ry="7" fill="#0f172a" />
          <circle cx="86" cy="95" r="1.6" fill="#fff" />
        </g>
        <g className="mascot-eye">
          <ellipse cx="116" cy="98" rx="5" ry="7" fill="#0f172a" />
          <circle cx="118" cy="95" r="1.6" fill="#fff" />
        </g>

        {/* mouth — varies by mood */}
        {mood === "ecstatic" && (
          <path d="M82 122 Q100 145 118 122 Q100 132 82 122" fill="#0f172a" />
        )}
        {mood === "happy" && (
          <path d="M84 124 Q100 138 116 124" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
        {mood === "neutral" && (
          <line x1="86" y1="126" x2="114" y2="126" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
        )}
        {mood === "sad" && (
          <path d="M86 130 Q100 120 114 130" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
        )}

        {/* crown when allDone or tier>=3 */}
        {(allDone || tier >= 3) && (
          <g transform="translate(72,28)">
            <path d="M0 22 L8 6 L18 18 L28 0 L38 18 L48 6 L56 22 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="28" cy="11" r="2.5" fill="#ef4444" />
          </g>
        )}
      </svg>
    </div>
  )
}

/* ─────────────  Hydration card (gyroscope-driven water)  ───────────── */
function HydrationCard({
  water,
  mounted,
  onAdd,
  lastSipAt,
}: {
  water: number
  mounted: boolean
  onAdd: (delta: number) => void
  lastSipAt: number | null
}) {
  const pct = Math.min(100, (water / DAILY_GOAL_ML) * 100)
  const remainingMl = Math.max(0, DAILY_GOAL_ML - water)
  const goalReached = water >= DAILY_GOAL_ML

  // Tilt of liquid surface in degrees (from gamma) and shake amplitude
  const [tilt, setTilt] = useState(0)
  const [slosh, setSlosh] = useState(0) // px offset for shake
  const [motionState, setMotionState] = useState<"unknown" | "needs-permission" | "active" | "denied">("unknown")
  const [now, setNow] = useState<number | null>(null)
  const lastShakeRef = useRef(0)
  const lastAccRef = useRef<{ x: number; y: number; z: number } | null>(null)

  // Set up listeners (auto on Android, requires user gesture on iOS 13+)
  useEffect(() => {
    if (typeof window === "undefined") return
    setNow(Date.now())
    const tickClock = setInterval(() => setNow(Date.now()), 30_000)

    const needsPerm =
      typeof (DeviceOrientationEvent as any)?.requestPermission === "function" ||
      typeof (DeviceMotionEvent as any)?.requestPermission === "function"

    if (needsPerm) {
      setMotionState("needs-permission")
    } else if ("DeviceOrientationEvent" in window) {
      attachListeners()
    }

    function attachListeners() {
      const onOrient = (e: DeviceOrientationEvent) => {
        if (e.gamma == null) return
        // gamma: -90..90 (left/right tilt). Clamp to -45..45 then map.
        const g = Math.max(-45, Math.min(45, e.gamma))
        setTilt(-g * 0.6) // negative so water "stays level"
      }
      const onMotion = (e: DeviceMotionEvent) => {
        const a = e.accelerationIncludingGravity
        if (!a || a.x == null || a.y == null || a.z == null) return
        const prev = lastAccRef.current
        lastAccRef.current = { x: a.x!, y: a.y!, z: a.z! }
        if (!prev) return
        const dx = (a.x! - prev.x)
        const dy = (a.y! - prev.y)
        const dz = (a.z! - prev.z)
        const mag = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (mag > 12 && Date.now() - lastShakeRef.current > 250) {
          lastShakeRef.current = Date.now()
          setSlosh(Math.min(8, mag * 0.4))
          setTimeout(() => setSlosh(0), 600)
        }
      }
      window.addEventListener("deviceorientation", onOrient)
      window.addEventListener("devicemotion", onMotion)
      setMotionState("active")
      ;(window as any).__hydDetach = () => {
        window.removeEventListener("deviceorientation", onOrient)
        window.removeEventListener("devicemotion", onMotion)
      }
    }

    return () => {
      clearInterval(tickClock)
      try { (window as any).__hydDetach?.() } catch {}
    }
  }, [])

  const enableMotion = async () => {
    try {
      const reqOri = (DeviceOrientationEvent as any)?.requestPermission
      const reqMot = (DeviceMotionEvent as any)?.requestPermission
      const r1 = typeof reqOri === "function" ? await reqOri() : "granted"
      const r2 = typeof reqMot === "function" ? await reqMot() : "granted"
      if (r1 === "granted" && r2 === "granted") {
        // re-run effect logic by reloading listeners
        const onOrient = (e: DeviceOrientationEvent) => {
          if (e.gamma == null) return
          const g = Math.max(-45, Math.min(45, e.gamma))
          setTilt(-g * 0.6)
        }
        const onMotion = (e: DeviceMotionEvent) => {
          const a = e.accelerationIncludingGravity
          if (!a || a.x == null || a.y == null || a.z == null) return
          const prev = lastAccRef.current
          lastAccRef.current = { x: a.x!, y: a.y!, z: a.z! }
          if (!prev) return
          const dx = (a.x! - prev.x), dy = (a.y! - prev.y), dz = (a.z! - prev.z)
          const mag = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (mag > 12 && Date.now() - lastShakeRef.current > 250) {
            lastShakeRef.current = Date.now()
            setSlosh(Math.min(8, mag * 0.4))
            setTimeout(() => setSlosh(0), 600)
          }
        }
        window.addEventListener("deviceorientation", onOrient)
        window.addEventListener("devicemotion", onMotion)
        setMotionState("active")
      } else {
        setMotionState("denied")
      }
    } catch {
      setMotionState("denied")
    }
  }

  const sinceSip = mounted && lastSipAt && now ? Math.floor((now - lastSipAt) / 60_000) : null
  const sipLabel =
    sinceSip == null ? "Tap a cup to log a sip" :
    sinceSip < 1 ? "Just sipped — nice!" :
    sinceSip < 60 ? `Last sip ${sinceSip}m ago` :
    `Last sip ${Math.floor(sinceSip / 60)}h ago`

  // Status pill
  const status = !mounted ? "" :
    goalReached ? "Hydrated! 💧" :
    pct >= 75 ? "Almost there" :
    pct >= 50 ? "Halfway!" :
    pct >= 25 ? "Keep sipping" :
    "Time to drink"

  // Compute wave top Y (in 0..100 viewBox space) — water fills from bottom
  const waveY = 100 - pct

  return (
    <Card className="md:col-span-1 overflow-hidden border-2 border-blue-300/40 dark:border-blue-700/40 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-sky-500/5 relative">
      <CardContent className="p-5 sm:p-6 relative">
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-bold">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md shadow-cyan-500/30">
              <Droplet className="w-4 h-4 text-white" fill="currentColor" />
            </div>
            <div className="leading-tight">
              <div>Hydration</div>
              <div className="text-[10px] font-medium text-muted-foreground" suppressHydrationWarning>
                {mounted ? sipLabel : ""}
              </div>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-[11px]" suppressHydrationWarning>
            {mounted ? `${water}/${DAILY_GOAL_ML}ml` : `0/${DAILY_GOAL_ML}ml`}
          </Badge>
        </div>

        {/* Bottle */}
        <div className="relative mx-auto" style={{ width: 132, height: 200 }}>
          {/* glow behind */}
          <div className="absolute inset-0 rounded-[36px] bg-cyan-400/20 blur-2xl pointer-events-none" />
          {/* bottle cap */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-12 h-3 rounded-t-md bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-700 shadow-sm" />
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-2 rounded-full bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-800" />

          <div
            className="relative w-full h-full rounded-[36px] border-2 border-blue-300/60 dark:border-blue-500/40 overflow-hidden bg-gradient-to-b from-blue-50/60 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 shadow-inner"
            style={{ transform: `translateX(${slosh}px)`, transition: slosh ? "none" : "transform 0.4s ease-out" }}
          >
            {/* Glass shine */}
            <div className="absolute top-3 left-3 w-2 h-32 bg-white/40 rounded-full blur-[1px] pointer-events-none" />

            {/* Bubbles */}
            {mounted && pct > 5 && (
              <>
                <span className="dt-bubble" style={{ left: "22%", animationDelay: "0s", bottom: `${Math.min(pct - 4, 80)}%` }} />
                <span className="dt-bubble dt-bubble-md" style={{ left: "55%", animationDelay: "1.4s", bottom: `${Math.min(pct - 8, 70)}%` }} />
                <span className="dt-bubble dt-bubble-sm" style={{ left: "72%", animationDelay: "2.6s", bottom: `${Math.min(pct - 6, 75)}%` }} />
                <span className="dt-bubble dt-bubble-sm" style={{ left: "38%", animationDelay: "3.4s", bottom: `${Math.min(pct - 10, 65)}%` }} />
              </>
            )}

            {/* Water (SVG with animated waves) */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
              style={{ transition: "transform 0.5s ease-out" }}
            >
              <defs>
                <linearGradient id="dt-water" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="60%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
              <g
                style={{
                  transform: `translateY(${waveY}%) rotate(${tilt}deg)`,
                  transformOrigin: "50% 50%",
                  transition: "transform 0.45s cubic-bezier(.22,1,.36,1)",
                }}
              >
                {/* back wave */}
                <path
                  className="dt-wave-back"
                  d="M-50 8 Q 0 0 50 8 T 150 8 V 200 H -50 Z"
                  fill="url(#dt-water)"
                  opacity="0.55"
                />
                {/* front wave */}
                <path
                  className="dt-wave-front"
                  d="M-50 12 Q 0 4 50 12 T 150 12 V 200 H -50 Z"
                  fill="url(#dt-water)"
                />
                {/* surface highlight */}
                <path
                  className="dt-wave-front"
                  d="M-50 11 Q 0 3 50 11 T 150 11"
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="0.8"
                />
              </g>
            </svg>

            {/* % text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="font-extrabold text-3xl text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]" suppressHydrationWarning>
                {mounted ? Math.round(pct) : 0}%
              </div>
              <div className="text-[10px] font-semibold text-white/90 uppercase tracking-widest drop-shadow">{status || "of goal"}</div>
              {mounted && !goalReached && (
                <div className="mt-1 text-[10px] font-mono text-white/85 bg-black/20 backdrop-blur px-2 py-0.5 rounded-full">
                  {remainingMl}ml left
                </div>
              )}
              {mounted && goalReached && (
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/90 text-white px-2 py-0.5 rounded-full">
                  <PartyPopper className="w-3 h-3" /> Goal smashed
                </div>
              )}
            </div>

            {/* measurement ticks */}
            <div className="absolute right-1.5 top-3 bottom-3 flex flex-col justify-between items-end pointer-events-none">
              {[100, 75, 50, 25, 0].map((m) => (
                <div key={m} className="flex items-center gap-1">
                  <span className="text-[8px] font-mono text-blue-700/60 dark:text-cyan-200/50">{m}</span>
                  <span className="block w-2 h-px bg-blue-700/40 dark:bg-cyan-200/40" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick add cup row */}
        <div className="grid grid-cols-4 gap-1.5 mt-5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAdd(-250)}
            className="rounded-xl h-10"
            title="Undo last cup"
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <button
            onClick={() => onAdd(150)}
            className="group rounded-xl h-10 px-2 flex items-center justify-center gap-1 bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/40 dark:to-cyan-900/40 border-2 border-sky-300/60 dark:border-cyan-700/40 hover:scale-[1.03] active:scale-95 transition shadow-sm"
            title="Sip — 150ml"
          >
            <Coffee className="w-3.5 h-3.5 text-sky-700 dark:text-cyan-300" />
            <span className="text-[11px] font-bold text-sky-800 dark:text-cyan-200">150</span>
          </button>
          <button
            onClick={() => onAdd(250)}
            className="group rounded-xl h-10 px-2 flex items-center justify-center gap-1 bg-gradient-to-br from-blue-500 to-cyan-500 text-white hover:scale-[1.03] active:scale-95 transition shadow-md shadow-cyan-500/25"
            title="Glass — 250ml"
          >
            <GlassWater className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">250</span>
          </button>
          <button
            onClick={() => onAdd(500)}
            className="group rounded-xl h-10 px-2 flex items-center justify-center gap-1 bg-gradient-to-br from-blue-700 to-indigo-600 text-white hover:scale-[1.03] active:scale-95 transition shadow-md shadow-blue-700/25"
            title="Bottle — 500ml"
          >
            <Droplet className="w-3.5 h-3.5" fill="currentColor" />
            <span className="text-[11px] font-bold">500</span>
          </button>
        </div>

        {/* Motion permission / hint */}
        {mounted && (
          <div className="mt-3 flex items-center justify-between text-[10px]">
            {motionState === "needs-permission" && (
              <button
                onClick={enableMotion}
                className="inline-flex items-center gap-1 font-bold text-cyan-700 dark:text-cyan-300 hover:underline"
              >
                <Smartphone className="w-3 h-3" /> Tilt &amp; shake to play
              </button>
            )}
            {motionState === "active" && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Waves className="w-3 h-3 text-cyan-500" /> Tilt your phone — water follows
              </span>
            )}
            {motionState === "denied" && (
              <span className="text-muted-foreground">Motion access denied</span>
            )}
            {motionState === "unknown" && (
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Waves className="w-3 h-3" /> Open on phone for tilt fun
              </span>
            )}
            <span className="font-mono text-muted-foreground">
              +{XP_HYDRATION_GOAL} XP @ goal
            </span>
          </div>
        )}

        {/* Local CSS for waves & bubbles */}
        <style jsx global>{`
          @keyframes dt-wave-back-anim {
            0% { transform: translateX(0); }
            100% { transform: translateX(-100%); }
          }
          @keyframes dt-wave-front-anim {
            0% { transform: translateX(0); }
            100% { transform: translateX(100%); }
          }
          .dt-wave-back {
            animation: dt-wave-back-anim 7s linear infinite;
          }
          .dt-wave-front {
            animation: dt-wave-front-anim 4.5s linear infinite;
          }
          @keyframes dt-bubble-rise {
            0%   { transform: translateY(0) scale(0.6); opacity: 0; }
            15%  { opacity: 0.9; }
            100% { transform: translateY(-110px) scale(1.1); opacity: 0; }
          }
          .dt-bubble {
            position: absolute;
            width: 8px; height: 8px;
            border-radius: 9999px;
            background: rgba(255,255,255,0.85);
            box-shadow: inset -1px -1px 2px rgba(0,0,0,0.1);
            animation: dt-bubble-rise 4s ease-in infinite;
            pointer-events: none;
          }
          .dt-bubble-md { width: 6px; height: 6px; animation-duration: 5s; }
          .dt-bubble-sm { width: 4px; height: 4px; animation-duration: 6s; }
        `}</style>
      </CardContent>
    </Card>
  )
}

/* ─────────────  Routine card (morning / evening)  ───────────── */
function RoutineCard({
  phase,
  steps,
  done,
  mounted,
  onToggle,
}: {
  phase: "morning" | "evening"
  steps: string[]
  done: boolean[]
  mounted: boolean
  onToggle: (i: number) => void
}) {
  const completed = done.filter(Boolean).length
  const total = steps.length
  const pct = total === 0 ? 0 : (completed / total) * 100
  const allDone = completed === total

  // Sun/moon arc geometry — semicircle 0° (left) → 180° (right)
  // We position the orb along the arc based on progress.
  const arcR = 70
  const cx = 90
  const cy = 84
  const ang = Math.PI - (pct / 100) * Math.PI // 180°→0° in radians, mapped to PI→0
  const orbX = cx + arcR * Math.cos(ang)
  const orbY = cy - arcR * Math.sin(ang)

  const isMorning = phase === "morning"
  const palette = isMorning
    ? {
        ring: "from-amber-400 to-orange-500",
        accentHex: "#f59e0b",
        cardBg: "from-amber-500/5 via-orange-500/5 to-yellow-500/5",
        border: "border-amber-300/40 dark:border-amber-700/40",
        chip: "text-amber-600 dark:text-amber-300",
        sky1: "from-amber-200/40 via-orange-200/20 to-transparent dark:from-amber-700/20 dark:via-orange-800/10",
        title: "Morning",
        Icon: Sun,
        orbGradient: "url(#dt-sun)",
        hoverBorder: "hover:border-amber-400/60",
        idleBox: "border-amber-300/60 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-transparent",
        xpIdleBg: "bg-amber-500/10",
        bannerGrad: "from-emerald-500 via-teal-500 to-orange-500",
      }
    : {
        ring: "from-indigo-500 to-purple-600",
        accentHex: "#6366f1",
        cardBg: "from-indigo-500/5 via-purple-500/5 to-violet-500/5",
        border: "border-indigo-300/40 dark:border-indigo-700/40",
        chip: "text-indigo-600 dark:text-indigo-300",
        sky1: "from-indigo-300/30 via-purple-400/20 to-transparent dark:from-indigo-800/30 dark:via-purple-900/20",
        title: "Evening",
        Icon: Moon,
        orbGradient: "url(#dt-moon)",
        hoverBorder: "hover:border-indigo-400/60",
        idleBox: "border-indigo-300/60 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-transparent",
        xpIdleBg: "bg-indigo-500/10",
        bannerGrad: "from-emerald-500 via-teal-500 to-purple-500",
      }

  // Step icon & hint helpers (heuristic by name)
  const stepMeta = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes("cleanser")) return { icon: "💧", hint: "60s gentle massage" }
    if (n.includes("vitamin c")) return { icon: "🍊", hint: "Brightens & protects" }
    if (n.includes("retinol") || n.includes("treatment") || n.includes("bha")) return { icon: "🧪", hint: "Pea-sized, avoid eyes" }
    if (n.includes("moisturizer")) return { icon: "🧴", hint: "Lock in hydration" }
    if (n.includes("spf") || n.includes("sun")) return { icon: "🌞", hint: "Reapply every 2h" }
    return { icon: "✨", hint: "Tap when done" }
  }

  return (
    <Card className={`overflow-hidden border-2 ${palette.border} bg-gradient-to-br ${palette.cardBg} relative`}>
      <CardContent className="p-5 sm:p-6 relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-bold">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${palette.ring} flex items-center justify-center shadow-md`}>
              <palette.Icon className="w-4 h-4 text-white" fill="currentColor" />
            </div>
            <div className="leading-tight">
              <div>{palette.title}</div>
              <div className="text-[10px] font-medium text-muted-foreground" suppressHydrationWarning>
                {mounted ? (allDone ? "Routine complete" : `${total - completed} left`) : ""}
              </div>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-[11px]" suppressHydrationWarning>
            {mounted ? `${completed}/${total}` : `0/${total}`}
          </Badge>
        </div>

        {/* Sky arc with sun/moon */}
        <div className={`relative mx-auto rounded-2xl overflow-hidden bg-gradient-to-b ${palette.sky1} mb-4`} style={{ height: 96, width: "100%" }}>
          {/* stars (evening) */}
          {!isMorning && (
            <>
              <span className="absolute w-1 h-1 rounded-full bg-white/80 top-3 left-6 dt-twinkle" />
              <span className="absolute w-1 h-1 rounded-full bg-white/70 top-6 left-24 dt-twinkle" style={{ animationDelay: "1.2s" }} />
              <span className="absolute w-0.5 h-0.5 rounded-full bg-white/80 top-8 right-12 dt-twinkle" style={{ animationDelay: "0.6s" }} />
              <span className="absolute w-1 h-1 rounded-full bg-white/60 top-2 right-20 dt-twinkle" style={{ animationDelay: "1.8s" }} />
              <span className="absolute w-0.5 h-0.5 rounded-full bg-white/70 top-10 left-1/2 dt-twinkle" style={{ animationDelay: "2.4s" }} />
            </>
          )}
          {/* sun rays (morning) */}
          {isMorning && allDone && (
            <div className="absolute inset-0 dt-rays pointer-events-none" />
          )}

          <svg viewBox="0 0 180 100" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="dt-sun" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="70%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
              <linearGradient id="dt-moon" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e0e7ff" />
                <stop offset="60%" stopColor="#c7d2fe" />
                <stop offset="100%" stopColor="#a5b4fc" />
              </linearGradient>
              <filter id="dt-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {/* horizon */}
            <line x1="10" y1="84" x2="170" y2="84" stroke="currentColor" strokeOpacity="0.18" strokeDasharray="3 4" />
            {/* arc track */}
            <path
              d={`M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${cy}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            {/* progress arc */}
            <path
              d={`M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${orbX} ${orbY}`}
              fill="none"
              stroke={palette.accentHex}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* orb */}
            <g filter="url(#dt-glow)">
              <circle cx={orbX} cy={orbY} r="14" fill={palette.orbGradient} />
              {!isMorning && (
                /* moon crater shadow */
                <circle cx={orbX + 5} cy={orbY - 2} r="11" fill="rgba(99,102,241,0.55)" />
              )}
            </g>
          </svg>

          {/* progress label */}
          <div className="absolute bottom-1 left-2 text-[10px] font-mono text-muted-foreground" suppressHydrationWarning>
            {mounted ? `${Math.round(pct)}% done` : ""}
          </div>
          <div className="absolute bottom-1 right-2 text-[10px] font-bold text-muted-foreground inline-flex items-center gap-1">
            <Zap className={`w-3 h-3 ${palette.chip}`} /> +{total * XP_PER_STEP} XP
          </div>
        </div>

        {/* Steps */}
        <ul className="space-y-2">
          {steps.map((step, i) => {
            const isDone = !!done[i]
            const meta = stepMeta(step)
            return (
              <li key={i}>
                <button
                  onClick={() => onToggle(i)}
                  className={`group w-full text-left flex items-center gap-3 p-3 rounded-2xl border-2 transition-all active:scale-[0.98] touch-manipulation relative overflow-hidden ${
                    isDone
                      ? "bg-gradient-to-r from-emerald-500/15 via-teal-500/8 to-emerald-500/5 border-emerald-400/60"
                      : `bg-card border-border/60 ${palette.hoverBorder} hover:-translate-y-[1px] hover:shadow-md`
                  }`}
                >
                  {/* shimmer when complete */}
                  {isDone && <span className="absolute inset-0 dt-step-shimmer pointer-events-none" />}
                  {/* checkbox / icon */}
                  <div className={`relative w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 transition ${
                    isDone
                      ? "bg-gradient-to-br from-emerald-500 to-teal-500 border-emerald-500 shadow-md shadow-emerald-500/30"
                      : palette.idleBox
                  }`}>
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-white dt-pop" />
                    ) : (
                      <span className="text-base leading-none">{meta.icon}</span>
                    )}
                  </div>
                  {/* text */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {step}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{meta.hint}</div>
                  </div>
                  {/* xp */}
                  <span className={`text-[10px] font-bold inline-flex items-center gap-0.5 shrink-0 px-2 py-1 rounded-full ${
                    isDone
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : `${palette.xpIdleBg} ${palette.chip}`
                  }`}>
                    <Zap className="w-3 h-3" />+{XP_PER_STEP}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* All-done celebration banner */}
        {mounted && allDone && (
          <div className={`mt-3 rounded-2xl p-3 bg-gradient-to-r ${palette.bannerGrad} text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md dt-pop`}>
            <PartyPopper className="w-4 h-4" />
            {isMorning ? "Glow-up routine complete!" : "Sweet dreams — routine complete!"}
            <Sparkles className="w-4 h-4" />
          </div>
        )}

        <style jsx global>{`
          @keyframes dt-twinkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.6); }
          }
          .dt-twinkle { animation: dt-twinkle 2.4s ease-in-out infinite; }
          @keyframes dt-pop {
            0% { transform: scale(0.6); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); }
          }
          .dt-pop { animation: dt-pop 0.45s cubic-bezier(.22,1,.36,1) both; }
          @keyframes dt-step-shimmer {
            0% { background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.18) 30%, transparent 60%); transform: translateX(-30%); }
            100% { background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.18) 30%, transparent 60%); transform: translateX(120%); }
          }
          .dt-step-shimmer { animation: dt-step-shimmer 2.4s linear infinite; mix-blend-mode: overlay; }
          @keyframes dt-rays {
            0% { background: radial-gradient(circle at 50% 90%, rgba(253,224,71,0.45), transparent 60%); }
            50% { background: radial-gradient(circle at 50% 90%, rgba(253,224,71,0.65), transparent 65%); }
            100% { background: radial-gradient(circle at 50% 90%, rgba(253,224,71,0.45), transparent 60%); }
          }
          .dt-rays { animation: dt-rays 3.2s ease-in-out infinite; }
        `}</style>
      </CardContent>
    </Card>
  )
}

/* ─────────────  Component  ───────────── */
export function DailyTracker() {
  // SSR-safe: start with empty defaults so server & first client render match
  const [state, setState] = useState<DayState>(() => emptyDay())
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [history, setHistory] = useState<boolean[]>(() => Array(7).fill(false))
  const [mounted, setMounted] = useState(false)
  const [shareToast, setShareToast] = useState("")
  const [unlockToast, setUnlockToast] = useState<string | null>(null)
  const [lastSipAt, setLastSipAt] = useState<number | null>(null)

  // Load everything client-side after mount (avoids hydration mismatch)
  useEffect(() => {
    setMounted(true)
    const today = loadDay(todayKey())
    setState(today)

    // Compute streak
    let s = 0
    for (let i = 0; i < 365; i++) {
      const day = loadDay(dayKey(i))
      const did = day.water > 0 || day.morning.some(Boolean) || day.evening.some(Boolean)
      if (!did) break
      s++
    }
    setStreak(s)

    // Best streak
    try {
      const b = parseInt(localStorage.getItem("skinpro:streak:best") || "0", 10) || 0
      const newBest = Math.max(b, s)
      if (newBest !== b) localStorage.setItem("skinpro:streak:best", String(newBest))
      setBestStreak(newBest)
    } catch {}

    // 7-day history (most recent on right)
    const hist: boolean[] = []
    for (let i = 6; i >= 0; i--) {
      const day = loadDay(dayKey(i))
      hist.push(day.water > 0 || day.morning.some(Boolean) || day.evening.some(Boolean))
    }
    setHistory(hist)

    // last sip timestamp (only relevant for today)
    try {
      const ls = parseInt(localStorage.getItem("skinpro:lastSip") || "0", 10)
      if (ls && Date.now() - ls < 24 * 60 * 60 * 1000) setLastSipAt(ls)
    } catch {}
  }, [])

  const persist = (next: DayState) => {
    setState(next)
    try {
      localStorage.setItem(`skinpro:daily:${todayKey()}`, JSON.stringify(next))
      // Recompute streak inline
      let s = 0
      for (let i = 0; i < 365; i++) {
        const day = i === 0 ? next : loadDay(dayKey(i))
        const did = day.water > 0 || day.morning.some(Boolean) || day.evening.some(Boolean)
        if (!did) break
        s++
      }
      setStreak(s)
      const b = parseInt(localStorage.getItem("skinpro:streak:best") || "0", 10) || 0
      const newBest = Math.max(b, s)
      if (newBest !== b) {
        localStorage.setItem("skinpro:streak:best", String(newBest))
        setBestStreak(newBest)
      }
      // Update today's slot in history
      setHistory((h) => {
        const copy = [...h]
        copy[6] = next.water > 0 || next.morning.some(Boolean) || next.evening.some(Boolean)
        return copy
      })
    } catch {}
  }

  const addWater = (delta: number) => {
    persist({ ...state, water: Math.max(0, Math.min(5000, state.water + delta)) })
    if (delta > 0) {
      const now = Date.now()
      setLastSipAt(now)
      try { localStorage.setItem("skinpro:lastSip", String(now)) } catch {}
    }
  }

  const toggleStep = (when: "morning" | "evening", idx: number) => {
    const next = { ...state, [when]: state[when].map((v, i) => (i === idx ? !v : v)) }
    persist(next as DayState)
  }

  const resetToday = () => {
    if (confirm("Reset today's progress? Your streak will continue if you log again today.")) {
      persist(emptyDay())
    }
  }

  /* ─── Derived metrics ─── */
  const waterPct = Math.min(100, (state.water / DAILY_GOAL_ML) * 100)
  const morningDone = state.morning.filter(Boolean).length
  const eveningDone = state.evening.filter(Boolean).length
  const totalSteps = state.morning.length + state.evening.length
  const totalDone = morningDone + eveningDone
  const overallPct = Math.round(((totalDone + (state.water >= DAILY_GOAL_ML ? 2 : state.water >= DAILY_GOAL_ML / 2 ? 1 : 0)) / (totalSteps + 2)) * 100)
  const allDone = totalDone === totalSteps && state.water >= DAILY_GOAL_ML * 0.6

  // Today's XP earned from current state
  const todayXp = useMemo(() => {
    let xp = totalDone * XP_PER_STEP
    if (state.water >= DAILY_GOAL_ML) xp += XP_HYDRATION_GOAL
    else if (state.water >= DAILY_GOAL_ML / 2) xp += XP_HALF_HYDRATION
    if (allDone) xp += 50 // perfect day bonus
    return xp
  }, [totalDone, state.water, allDone])

  // Lifetime XP (rough): streak * baseline + today bonus
  const lifetimeXp = streak * 60 + streak * XP_STREAK_BONUS + todayXp
  const level = levelFromXp(lifetimeXp)
  const xpProgress = xpInLevel(lifetimeXp)
  const xpToNext = XP_PER_LEVEL - xpProgress

  /* ─── Quests (derived) ─── */
  type Quest = { id: string; title: string; xp: number; done: boolean; icon: typeof Sun; tone: string }
  const quests: Quest[] = [
    {
      id: "morning",
      title: "Complete morning routine",
      xp: state.morning.length * XP_PER_STEP,
      done: morningDone === state.morning.length,
      icon: Sun,
      tone: "from-amber-400 to-orange-500",
    },
    {
      id: "evening",
      title: "Complete evening routine",
      xp: state.evening.length * XP_PER_STEP,
      done: eveningDone === state.evening.length,
      icon: Moon,
      tone: "from-indigo-500 to-purple-600",
    },
    {
      id: "hydration",
      title: `Drink ${DAILY_GOAL_ML / 1000}L of water`,
      xp: XP_HYDRATION_GOAL,
      done: state.water >= DAILY_GOAL_ML,
      icon: Droplet,
      tone: "from-blue-500 to-cyan-500",
    },
    {
      id: "perfect",
      title: "Earn the Perfect Day bonus",
      xp: 50,
      done: allDone,
      icon: Sparkles,
      tone: "from-primary to-secondary",
    },
  ]
  const questsDone = quests.filter((q) => q.done).length

  /* ─── Milestones ─── */
  const MILESTONES = [
    { d: 3, label: "Spark", emoji: "✨" },
    { d: 7, label: "Glow Week", emoji: "🔥" },
    { d: 14, label: "Radiant", emoji: "🌟" },
    { d: 30, label: "Mythic Glow", emoji: "👑" },
    { d: 100, label: "Legendary", emoji: "🏆" },
  ]
  const nextMilestone = MILESTONES.find((m) => streak < m.d) || MILESTONES[MILESTONES.length - 1]
  const milestonePct = Math.min(100, Math.round((streak / nextMilestone.d) * 100))

  // Detect milestone unlock
  useEffect(() => {
    if (!mounted) return
    const lastSeen = parseInt(localStorage.getItem("skinpro:streak:milestoneSeen") || "0", 10) || 0
    const justHit = MILESTONES.find((m) => streak >= m.d && lastSeen < m.d)
    if (justHit) {
      localStorage.setItem("skinpro:streak:milestoneSeen", String(justHit.d))
      setUnlockToast(`${justHit.emoji} Milestone unlocked: ${justHit.label} (${justHit.d}-day streak)`)
      window.setTimeout(() => setUnlockToast(null), 5000)
    }
  }, [streak, mounted])

  const handleShare = async () => {
    const text = `🔥 ${streak}-day skincare streak on SkinInsight AI · Level ${level} · ${lifetimeXp} XP. Join me!`
    try {
      if (navigator.share) {
        await navigator.share({ title: "My SkinInsight streak", text })
        return
      }
      await navigator.clipboard.writeText(text)
      setShareToast("Copied to clipboard!")
      window.setTimeout(() => setShareToast(""), 2000)
    } catch {
      setShareToast("Could not share")
      window.setTimeout(() => setShareToast(""), 2000)
    }
  }

  return (
    <section id="tracker" className="relative py-12 sm:py-16 bg-gradient-to-b from-background via-muted/20 to-background overflow-hidden">
      {/* Local mascot keyframes */}
      <style jsx>{`
        @keyframes mascotBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes mascotBlink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(0.1) } }
        @keyframes mascotPulse { 0%,100% { transform: scale(1); opacity: var(--ao,0.55) } 50% { transform: scale(1.08); opacity: calc(var(--ao,0.55) + 0.12) } }
        @keyframes flameFlicker { 0%,100% { transform: scaleY(1) translateY(0); filter: brightness(1) } 50% { transform: scaleY(1.15) translateY(-2px); filter: brightness(1.18) } }
        @keyframes sparkleA { 0%,100% { opacity: 0; transform: translateY(0) scale(0.8) } 50% { opacity: 1; transform: translateY(-6px) scale(1.1) } }
        @keyframes sparkleB { 0%,100% { opacity: 0; transform: translate(0,0) scale(0.8) } 50% { opacity: 1; transform: translate(4px,-4px) scale(1.15) } }
        @keyframes sparkleC { 0%,100% { opacity: 0; transform: translate(0,0) scale(0.8) } 50% { opacity: 1; transform: translate(-4px,2px) scale(1.05) } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: translateY(0) } }
        :global(.mascot-bob) { animation: mascotBob 3.6s ease-in-out infinite }
        :global(.mascot-eye) { transform-origin: center; animation: mascotBlink 4.2s ease-in-out infinite }
        :global(.mascot-aura) { animation: mascotPulse 2.6s ease-in-out infinite }
        :global(.mascot-flame) { transform-origin: bottom center; animation: flameFlicker 0.9s ease-in-out infinite }
        :global(.mascot-sparkle-a) { animation: sparkleA 2.4s ease-in-out infinite }
        :global(.mascot-sparkle-b) { animation: sparkleB 2.7s ease-in-out infinite 0.4s }
        :global(.mascot-sparkle-c) { animation: sparkleC 3s ease-in-out infinite 0.8s }
        :global(.toast-in) { animation: toastIn 0.35s ease-out both }
      `}</style>

      {/* Unlock toast */}
      {unlockToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 toast-in">
          <div className="px-4 py-2.5 rounded-full bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm shadow-2xl border border-white/20">
            {unlockToast}
          </div>
        </div>
      )}

      <div className="container mx-auto max-w-6xl px-4 relative">
        {/* Premium header */}
        <div className="text-center mb-7 sm:mb-9">
          <Badge variant="secondary" className="mb-3 px-3 py-1 rounded-full">
            <Sparkles className="w-3 h-3 mr-1.5" /> Daily quest
          </Badge>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-2 tracking-tight">
            Today's <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">routine</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Check off each step as you complete it. Stay consistent for healthier skin.
          </p>
        </div>

        {/* ──────────  Compact streak strip  ────────── */}
        <Card className="mb-5 sm:mb-6 border border-border/60">
          <CardContent className="p-4 sm:p-5 flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-extrabold leading-none tabular-nums">{streak}</div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">day streak</div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-border/60" />
            <div>
              <div className="text-sm font-bold">Today's progress</div>
              <div className="text-xs text-muted-foreground tabular-nums">{Math.round(overallPct)}% complete · best {bestStreak}d</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="grid grid-cols-7 gap-1">
                {history.map((on, i) => (
                  <div
                    key={i}
                    className={`w-5 h-5 rounded-md border ${on ? "bg-primary border-primary" : "bg-muted border-border/60"}`}
                    title={dayLabel(6 - i)}
                  />
                ))}
              </div>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted transition text-[11px] font-bold"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            </div>
          </CardContent>
        </Card>

        {/* ──────────  Daily Quests  ────────── */}
        <Card className="overflow-hidden border-2 border-border/60 mb-5 sm:mb-6">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-bold leading-tight">Daily quests</div>
                  <div className="text-[11px] text-muted-foreground">{questsDone}/{quests.length} complete · resets at midnight</div>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-[11px]" suppressHydrationWarning>
                {mounted ? `+${todayXp} XP` : "+0 XP"}
              </Badge>
            </div>

            <ul className="grid sm:grid-cols-2 gap-2.5">
              {quests.map((q) => {
                const Icon = q.icon
                return (
                  <li key={q.id}>
                    <div
                      className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition ${
                        q.done
                          ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border-emerald-400/60"
                          : "bg-card border-border/60"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${q.tone} flex items-center justify-center shadow-md shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-bold ${q.done ? "line-through text-muted-foreground" : ""}`}>{q.title}</div>
                        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          +{q.xp} XP
                        </div>
                      </div>
                      {q.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        {/* ──────────  Hydration / Morning / Evening  ────────── */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
          {/* Hydration */}
          <HydrationCard
            water={state.water}
            mounted={mounted}
            onAdd={addWater}
            lastSipAt={lastSipAt}
          />

          {/* Morning */}
          <RoutineCard
            phase="morning"
            steps={DEFAULT_ROUTINE.morning}
            done={state.morning}
            mounted={mounted}
            onToggle={(i) => toggleStep("morning", i)}
          />

          {/* Evening */}
          <RoutineCard
            phase="evening"
            steps={DEFAULT_ROUTINE.evening}
            done={state.evening}
            mounted={mounted}
            onToggle={(i) => toggleStep("evening", i)}
          />
        </div>

        {/* Bottom row: reset + share toast */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" onClick={resetToday} className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Reset today
          </Button>
          {shareToast && (
            <span className="text-xs font-semibold text-emerald-600 toast-in">{shareToast}</span>
          )}
        </div>
      </div>
    </section>
  )
}
