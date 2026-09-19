"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import {
  Menu, X, LogIn, LogOut, Shield, User, UserPlus, Sparkles,
  Home as HomeIcon, BookOpen, ScanFace, ListChecks, ShoppingBag, CreditCard,
  ChevronRight, ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/components/auth-provider"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/#prediction", label: "Live Scan" },
  { href: "/#tracker", label: "Routine" },
  { href: "/#products", label: "Products" },
  { href: "/pricing", label: "Pricing" },
]

const mobileNavLinks: { href: string; label: string; icon: any; desc: string }[] = [
  { href: "/",                label: "Home",         icon: HomeIcon,   desc: "Dashboard & overview" },
  { href: "/how-it-works",    label: "How it works", icon: BookOpen,   desc: "Learn the AI process" },
  { href: "/#prediction",     label: "Live Scan",    icon: ScanFace,   desc: "Analyze your skin instantly" },
  { href: "/#tracker",        label: "Routine",      icon: ListChecks, desc: "Daily habits & streaks" },
  { href: "/#products",       label: "Products",     icon: ShoppingBag,desc: "Shop curated picks" },
  { href: "/pricing",         label: "Pricing",      icon: CreditCard, desc: "Plans & premium features" },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  const { user, logout } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      setScrolled(y > 20)
      const docH = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docH > 0 ? Math.min(100, (y / docH) * 100) : 0)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return
    const prev = document.body.style.overflow
    if (isOpen) document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  // Close drawer on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen])

  const handleLogout = async () => {
    await logout()
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? "bg-card/80 backdrop-blur-xl border-b border-border/60 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]"
        : "bg-background/40 backdrop-blur-md"
    }`}>
      {/* Scroll progress bar */}
      <span
        aria-hidden
        className="absolute left-0 bottom-0 h-[2px] bg-gradient-to-r from-primary via-primary to-secondary transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow-primary group-hover:scale-105 transition-transform">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
              SkinInsight <span className="gradient-text">AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3.5 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all font-medium text-sm group"
              >
                {link.label}
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary rounded-full group-hover:w-4 transition-all duration-300" />
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                {user.role === "admin" && (
                  <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-xl h-9 border-primary/30 hover:bg-primary/5">
                    <Link href="/admin">
                      <Shield className="w-3.5 h-3.5" />
                      Admin
                    </Link>
                  </Button>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground max-w-[120px] truncate">{user.name}</span>
                  {(user as any).plan && (user as any).plan !== "free" && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${(user as any).plan === "premium" ? "bg-amber-500/20 text-amber-600" : "bg-primary/20 text-primary"}`}>
                      {(user as any).plan}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 rounded-xl h-9 text-muted-foreground hover:text-foreground">
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-xl h-9 border-border/50">
                  <Link href="/login">
                    <LogIn className="w-3.5 h-3.5" />
                    Sign In
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild className="gap-1.5 rounded-xl h-9">
                  <Link href="/signup">
                    <UserPlus className="w-3.5 h-3.5" />
                    Sign up
                  </Link>
                </Button>
              </>
            )}
            <Button asChild size="sm" className="rounded-xl h-9 font-bold bg-gradient-to-r from-primary to-secondary text-white shadow-glow-primary hover:opacity-95 border-0">
              <Link href="/#prediction">Start Scan</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-1.5">
            <ThemeToggle />
            <button
              className="relative w-10 h-10 rounded-2xl bg-muted/40 border border-border/50 hover:bg-muted/70 active:scale-90 transition-all flex items-center justify-center text-foreground touch-manipulation"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              <span className="sr-only">{isOpen ? "Close" : "Menu"}</span>
              <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isOpen ? "rotate-180 opacity-0 scale-50" : "rotate-0 opacity-100 scale-100"}`}>
                <Menu className="w-5 h-5" />
              </span>
              <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isOpen ? "rotate-0 opacity-100 scale-100" : "-rotate-180 opacity-0 scale-50"}`}>
                <X className="w-5 h-5" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer + Backdrop */}
      <div
        className={`md:hidden fixed inset-0 top-16 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />

        {/* Drawer */}
        <div
          className={`absolute top-0 inset-x-0 max-h-[calc(100dvh-4rem)] overflow-y-auto bg-card/95 backdrop-blur-2xl border-b border-border/60 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.25)] transition-all duration-300 ease-out ${
            isOpen ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
          }`}
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
        >
          <div className="px-4 pt-4 pb-6 space-y-4">
            {/* User card / Auth CTA */}
            {user ? (
              <div className="rounded-2xl p-4 bg-gradient-to-br from-primary/10 /5 to-amber-500/10 border border-border/50 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md text-white font-extrabold text-lg shrink-0">
                  {user.name?.[0]?.toUpperCase() ?? <User className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{user.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {(user as any).plan && (user as any).plan !== "free" ? (
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${(user as any).plan === "premium" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-primary/20 text-primary"}`}>
                        {(user as any).plan}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Free</span>
                    )}
                    {user.role === "admin" && (
                      <Link href="/admin" onClick={() => setIsOpen(false)} className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary inline-flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" /> Admin
                      </Link>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { handleLogout(); setIsOpen(false) }}
                  className="w-9 h-9 rounded-xl bg-background/70 border border-border/50 hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition active:scale-90"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="rounded-2xl h-12 px-3 flex items-center justify-center gap-1.5 bg-muted/50 border border-border/60 text-foreground font-semibold text-sm active:scale-95 transition"
                >
                  <LogIn className="w-4 h-4" /> Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setIsOpen(false)}
                  className="rounded-2xl h-12 px-3 flex items-center justify-center gap-1.5 bg-foreground text-background font-semibold text-sm active:scale-95 transition shadow-md"
                >
                  <UserPlus className="w-4 h-4" /> Sign up
                </Link>
              </div>
            )}

            {/* Primary CTA */}
            <Link
              href="/#prediction"
              onClick={() => setIsOpen(false)}
              className="group relative block rounded-2xl overflow-hidden p-[1.5px] bg-gradient-to-r from-primary to-secondary active:scale-[0.98] transition-transform"
            >
              <div className="relative rounded-[14px] bg-card px-4 py-3.5 flex items-center gap-3">
                <span className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10" />
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
                  <ScanFace className="w-5 h-5 text-white" />
                </div>
                <div className="relative flex-1 min-w-0">
                  <div className="text-sm font-extrabold leading-tight">Start a Live Scan</div>
                  <div className="text-[11px] text-muted-foreground">Free AI analysis in 30 seconds</div>
                </div>
                <ArrowRight className="relative w-4 h-4 text-primary group-active:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Section label */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/70">Explore</span>
              <span className="flex-1 h-px bg-border/50" />
            </div>

            {/* Nav grid */}
            <div className="grid gap-1.5">
              {mobileNavLinks.map((link, i) => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="group flex items-center gap-3 px-3 py-3 rounded-2xl bg-muted/30 hover:bg-muted/60 active:scale-[0.98] border border-transparent hover:border-border/50 transition-all touch-manipulation"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 text-primary" strokeWidth={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold leading-tight">{link.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{link.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground group-active:translate-x-0.5 transition-all" />
                  </Link>
                )
              })}
            </div>

            {/* Footer hint */}
            <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/70">
              <Sparkles className="w-3 h-3" />
              <span>SkinInsight AI · v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
