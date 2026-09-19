"use client"

import Link from "next/link"
import { Mail, MapPin, Heart, ArrowRight, Sparkles, ScanFace, Instagram, Twitter, Github, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Footer() {
  return (
    <footer id="contact" className="relative overflow-hidden">
      {/* ── Premium CTA banner ── */}
      <div className="relative">
        <div className="absolute inset-0 aurora-bg opacity-60" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
          <div className="relative max-w-5xl mx-auto rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden ring-1 ring-border/60 bg-card">
            {/* Subtle gradient wash on left, image-like depth on right */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/8" />
            <div className="deco-orb deco-orb-primary w-[22rem] h-[22rem] -top-32 -left-32 hidden sm:block" />
            <div className="deco-orb deco-orb-secondary w-[22rem] h-[22rem] -bottom-32 -right-32 hidden sm:block" />

            <div className="relative grid md:grid-cols-[1.4fr_1fr] gap-6 md:gap-8 p-6 sm:p-10 lg:p-14 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-4 sm:mb-5">
                  <Sparkles className="w-3 h-3" /> Free forever to start
                </div>
                <h2 className="text-[2rem] sm:text-5xl md:text-[3.5rem] font-extrabold tracking-tighter leading-[0.95] mb-3 sm:mb-4">
                  Ready to <span className="gradient-text">glow?</span>
                </h2>
                <p className="text-[14px] sm:text-lg text-muted-foreground max-w-xl mb-6 sm:mb-8">
                  Run your first scan in under 30 seconds. No signup, no card, no commitments.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                  <Button
                    size="xl"
                    asChild
                    className="bg-foreground text-background hover:opacity-90 font-bold gap-2 px-6 sm:px-8"
                  >
                    <Link href="/#prediction">
                      <ScanFace className="w-5 h-5" /> Start free scan
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button
                    size="xl"
                    asChild
                    variant="outline"
                    className="font-bold gap-2 px-6 sm:px-7"
                  >
                    <Link href="/pricing">See pricing</Link>
                  </Button>
                </div>
              </div>

              {/* Visual stat block — grid on mobile too (compact) */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {[
                  { k: "30s", v: "Average scan time" },
                  { k: "10", v: "Skin concerns scored" },
                  { k: "50k+", v: "Scans processed" },
                  { k: "4.8★", v: "User rating" },
                ].map((s) => (
                  <div key={s.v} className="rounded-xl sm:rounded-2xl border bg-background/60 backdrop-blur p-3 sm:p-4">
                    <div className="text-xl sm:text-2xl font-extrabold tracking-tight gradient-text">{s.k}</div>
                    <div className="text-[10px] sm:text-[11px] text-muted-foreground leading-snug mt-0.5 sm:mt-1">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main footer ── */}
      <div className="bg-card/50 backdrop-blur-xl border-t border-border/60 relative">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-5">
              <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow-primary">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-extrabold tracking-tight">
                  SkinInsight <span className="gradient-text">AI</span>
                </span>
              </Link>
              <p className="text-muted-foreground max-w-md leading-relaxed text-sm sm:text-[15px] mb-6">
                <strong className="text-foreground/90">SkinInsight AI</strong> (also known as Skin Insight AI or Skin Score) is a free AI skin analysis web app. Scan your face, score 10 concerns, and get a routine that actually works for your skin.
              </p>

              {/* Social */}
              <div className="flex items-center gap-2.5">
                {[
                  { icon: Instagram, href: "https://github.com/diwanshi-04/SkinInsight-AI-Pro", label: "Instagram" },
                  { icon: Twitter, href: "#", label: "Twitter" },
                  { icon: Github, href: "https://github.com/diwanshi-04/SkinInsight-AI-Pro", label: "GitHub" },
                  { icon: Mail, href: "mailto:diwanshipandey331@gmail.com", label: "Email" },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target={s.href.startsWith("http") ? "_blank" : undefined}
                    rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    aria-label={s.label}
                    className="w-10 h-10 rounded-xl bg-card border border-border/60 flex items-center justify-center text-muted-foreground transition-all active:scale-95 hover:text-primary hover:bg-primary/5 hover:border-primary/30"
                  >
                    <s.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Product */}
            <div className="md:col-span-2">
              <h3 className="font-bold text-foreground mb-4 text-xs uppercase tracking-widest">Product</h3>
              <ul className="space-y-3">
                {[
                  { href: "/#prediction", label: "Live Scan" },
                  { href: "/#tracker", label: "Routine" },
                  { href: "/#products", label: "Shop" },
                  { href: "/#calendar", label: "Progress" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-muted-foreground hover:text-foreground transition-all text-sm hover:translate-x-0.5 inline-flex items-center gap-1 duration-200">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div className="md:col-span-2">
              <h3 className="font-bold text-foreground mb-4 text-xs uppercase tracking-widest">Company</h3>
              <ul className="space-y-3">
                {[
                  { href: "/how-it-works", label: "How it works" },
                  { href: "/blog", label: "Blog" },
                  { href: "/pricing", label: "Pricing" },
                  { href: "/login", label: "Sign in" },
                  { href: "/signup", label: "Sign up" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-muted-foreground hover:text-foreground transition-all text-sm hover:translate-x-0.5 inline-flex duration-200">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="col-span-2 md:col-span-3">
              <h3 className="font-bold text-foreground mb-4 text-xs uppercase tracking-widest">Get in touch</h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="mailto:diwanshipandey331@gmail.com"
                    className="group flex items-start gap-3 p-3 rounded-2xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-soft transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Business inquiries</div>
                      <div className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition">
                        diwanshipandey331@gmail.com
                      </div>
                    </div>
                  </a>
                </li>
                <li className="flex items-start gap-3 p-3 rounded-2xl bg-card/40 border border-border/40">
                  <div className="w-9 h-9 rounded-xl bg-secondary/10 ring-1 ring-secondary/20 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Worldwide</div>
                    <div className="text-sm font-medium text-foreground">Made in India · serving 30+ countries</div>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-border/60 mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-xs sm:text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} SkinInsight AI. All rights reserved.
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
              Crafted with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for glowing skin
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
