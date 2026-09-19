"use client"

import { useEffect, useRef, useState } from "react"
import { Home, ScanFace, Sparkles, ShoppingBag, Calendar, Flame } from "lucide-react"

type Tab = {
  id: string
  label: string
  icon: any
  target: string
  primary?: boolean
}

const TABS: Tab[] = [
  { id: "home", label: "Home", icon: Home, target: "#home" },
  { id: "tracker", label: "Routine", icon: Sparkles, target: "#tracker" },
  { id: "scan", label: "Scan", icon: ScanFace, target: "#prediction", primary: true },
  { id: "products", label: "Shop", icon: ShoppingBag, target: "#products" },
  { id: "calendar", label: "Progress", icon: Calendar, target: "#calendar" },
]

function haptic(ms = 12) {
  try {
    if (typeof navigator !== "undefined" && (navigator as any).vibrate) {
      ;(navigator as any).vibrate(ms)
    }
  } catch {}
}

export function MobileBottomNav() {
  const [active, setActive] = useState("home")
  const [hidden, setHidden] = useState(false)
  const [streak, setStreak] = useState<number | null>(null)
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const lastY = useRef(0)
  const indicatorRef = useRef<HTMLSpanElement | null>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    setMounted(true)
    try {
      const s = Number(localStorage.getItem("skinpro:streak:best") || 0)
      if (s > 0) setStreak(s)
      const ls = Number(localStorage.getItem("skinpro:lastScore") || 0)
      if (ls > 0) setLastScore(Math.round(ls))
    } catch {}
  }, [])

  // Active section + auto-hide on scroll-down, show on scroll-up
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastY.current
      if (y > 220 && dy > 6) setHidden(true)
      else if (dy < -4 || y < 100) setHidden(false)
      lastY.current = y

      const ids = ["home", "tracker", "prediction", "products", "calendar"]
      let found = "home"
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.top <= 140 && r.bottom > 140) {
          found =
            id === "prediction" ? "scan" :
            id === "tracker" ? "tracker" :
            id === "products" ? "products" :
            id === "calendar" ? "calendar" : "home"
        }
      }
      setActive(found)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Slide indicator under active tab (skip primary FAB)
  useEffect(() => {
    const btn = tabRefs.current[active]
    const ind = indicatorRef.current
    if (!ind) return
    if (!btn || TABS.find((t) => t.id === active)?.primary) {
      ind.style.opacity = "0"
      return
    }
    const parent = btn.parentElement?.parentElement
    if (!parent) return
    const pRect = parent.getBoundingClientRect()
    const bRect = btn.getBoundingClientRect()
    const cx = bRect.left - pRect.left + bRect.width / 2
    ind.style.transform = `translateX(${cx}px)`
    ind.style.opacity = "1"
  }, [active, mounted])

  const go = (target: string, id: string) => {
    haptic(id === "scan" ? 22 : 10)
    if (id === "scan") {
      const el = document.getElementById("prediction")
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("skinpro:startScan"))
      }, 500)
      return
    }
    const el = document.querySelector(target) as HTMLElement | null
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    else if (target.startsWith("#")) window.location.hash = target
  }

  return (
    <>
      <nav
        aria-label="Primary mobile navigation"
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 transition-transform duration-300 will-change-transform ${
          hidden ? "translate-y-[120%]" : "translate-y-0"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="relative mx-2 mb-2 rounded-[28px] bg-card/85 backdrop-blur-2xl border border-border/60 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]">
          <span className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />

          <span
            ref={indicatorRef}
            aria-hidden
            className="absolute top-1.5 left-0 -translate-x-1/2 w-12 h-1 rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_12px_rgba(168,85,247,0.6)] transition-all duration-[500ms] ease-[cubic-bezier(.34,1.56,.64,1)] pointer-events-none"
            style={{ opacity: 0 }}
          />

          <div className="grid grid-cols-5 items-end h-[70px] px-1">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = active === t.id

              if (t.primary) {
                return (
                  <button
                    key={t.id}
                    onClick={() => go(t.target, t.id)}
                    aria-label={t.label}
                    className="relative flex flex-col items-center justify-end h-full -mt-7 active:scale-90 transition-transform duration-200 touch-manipulation focus:outline-none"
                  >
                    {/* Soft aurora halo (no harsh ring) */}
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary opacity-30 blur-2xl pointer-events-none animate-mbn-halo" />
                    {/* Subtle inner soft ring that fades into the dock (replaces the old hard ring) */}
                    <span className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-[68px] h-[68px] rounded-[24px] bg-gradient-to-b from-card/0 via-card/60 to-card pointer-events-none" />

                    <div
                      className={`relative w-16 h-16 rounded-[22px] bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_12px_32px_-6px_rgba(168,85,247,0.55)] transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] animate-mbn-breathe ${
                        isActive ? "scale-110" : "scale-100"
                      }`}
                    >
                      {/* Glossy inner highlight */}
                      <span className="absolute inset-1 rounded-[18px] bg-gradient-to-b from-white/30 via-white/0 to-transparent pointer-events-none" />
                      {/* Light-sweep "scanning" beam across the icon */}
                      <span className="absolute inset-0 rounded-[22px] overflow-hidden pointer-events-none">
                        <span className="absolute -inset-x-4 top-0 h-6 bg-gradient-to-b from-white/60 via-white/0 to-transparent blur-md animate-mbn-scan" />
                      </span>

                      {/* Icon — natural smile, no eye twinkle */}
                      <Icon className="relative w-7 h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]" strokeWidth={2.5} />

                      {lastScore != null && (
                        <span
                          suppressHydrationWarning
                          className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-white text-[10px] font-extrabold text-primary flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.18)] border border-white/80"
                        >
                          {lastScore}
                        </span>
                      )}
                    </div>
                    <span className="relative text-[10px] font-extrabold mt-1 text-foreground tracking-wide">{t.label}</span>
                  </button>
                )
              }

              const showStreak = t.id === "tracker" && streak != null && streak > 0

              return (
                <button
                  key={t.id}
                  ref={(el) => { tabRefs.current[t.id] = el }}
                  onClick={() => go(t.target, t.id)}
                  aria-label={t.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex flex-col items-center justify-center gap-0.5 h-full pt-1.5 active:scale-90 touch-manipulation focus:outline-none transition-colors duration-300 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`relative flex items-center justify-center w-11 h-9 rounded-2xl transition-all duration-[450ms] ease-[cubic-bezier(.34,1.56,.64,1)] will-change-transform ${
                      isActive
                        ? "bg-primary/15 ring-1 ring-primary/20 scale-110"
                        : "bg-transparent scale-95"
                    }`}
                  >
                    <Icon
                      className={`transition-all duration-[450ms] ease-[cubic-bezier(.34,1.56,.64,1)] will-change-transform ${
                        isActive ? "w-[22px] h-[22px] -translate-y-0.5" : "w-5 h-5 translate-y-0"
                      }`}
                      strokeWidth={isActive ? 2.6 : 2}
                    />
                    {showStreak && (
                      <span
                        suppressHydrationWarning
                        className="absolute -top-1 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-primary text-[9px] font-extrabold text-primary-foreground flex items-center justify-center gap-0.5 shadow-md ring-2 ring-card"
                      >
                        <Flame className="w-2.5 h-2.5" strokeWidth={3} />
                        {streak}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] leading-none transition-all duration-300 ${
                      isActive ? "font-extrabold opacity-100 -translate-y-0" : "font-semibold opacity-70 translate-y-0.5"
                    }`}
                  >
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <style jsx global>{`
        @keyframes mbn-halo {
          0%, 100% { opacity: 0.25; transform: translateX(-50%) scale(1); }
          50%      { opacity: 0.5;  transform: translateX(-50%) scale(1.18); }
        }
        .animate-mbn-halo { animation: mbn-halo 3.2s ease-in-out infinite; }

        @keyframes mbn-breathe {
          0%, 100% { transform: scale(1) translateZ(0); }
          50%      { transform: scale(1.04) translateZ(0); }
        }
        .animate-mbn-breathe { animation: mbn-breathe 3.6s ease-in-out infinite; }

        @keyframes mbn-scan {
          0%   { transform: translateY(-110%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(420%); opacity: 0; }
        }
        .animate-mbn-scan { animation: mbn-scan 3.4s ease-in-out infinite; }
      `}</style>
    </>
  )
}
