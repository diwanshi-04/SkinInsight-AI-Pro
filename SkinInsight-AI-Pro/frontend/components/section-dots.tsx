"use client"

import { useEffect, useState } from "react"

const SECTIONS = [
  { id: "home", label: "Home" },
  { id: "about", label: "How it works" },
  { id: "prediction", label: "Live scan" },
  { id: "tracker", label: "Routine" },
  { id: "products", label: "Products" },
  { id: "compare", label: "Before & after" },
  { id: "calendar", label: "Calendar" },
]

export function SectionDots() {
  const [active, setActive] = useState("home")

  useEffect(() => {
    const onScroll = () => {
      const mid = window.scrollY + window.innerHeight * 0.3
      let cur = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (el && el.offsetTop <= mid) cur = s.id
      }
      setActive(cur)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="hidden xl:flex fixed right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-3" aria-hidden="false">
      {SECTIONS.map((s) => {
        const isActive = active === s.id
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="group relative flex items-center justify-end"
            aria-label={`Jump to ${s.label}`}
          >
            <span className="absolute right-7 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-card/95 border border-border text-xs font-medium shadow-md opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all whitespace-nowrap pointer-events-none">
              {s.label}
            </span>
            <span className={`block rounded-full transition-all border-2 ${
              isActive ? "w-3 h-3 bg-primary border-primary scale-110 shadow-md shadow-primary/40" : "w-2.5 h-2.5 bg-transparent border-muted-foreground/40 group-hover:border-primary"
            }`} />
          </a>
        )
      })}
    </div>
  )
}
