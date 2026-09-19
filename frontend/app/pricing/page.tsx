"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Sparkles, Crown, Zap, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "₹0",
    period: "forever",
    tagline: "Get started — no card required",
    icon: Sparkles,
    features: [
      "5 face scans per month",
      "AI doctor chat",
      "Product recommendations",
      "30-day scan history",
    ],
    cta: "Start free",
    color: "border-border",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "₹299",
    period: "per month",
    tagline: "For skincare enthusiasts",
    icon: Zap,
    features: [
      "50 face scans per month",
      "Unlimited AI doctor chat",
      "Personalized routine builder",
      "Progress tracking & calendar",
      "Email reminders",
      "Priority product matching",
    ],
    cta: "Upgrade to Pro",
    color: "border-primary ring-2 ring-primary/40",
    popular: true,
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "₹799",
    period: "per month",
    tagline: "For professionals & clinics",
    icon: Crown,
    features: [
      "Unlimited face scans",
      "Multi-angle deep analysis",
      "Skin-age tracking & reports",
      "Export PDF reports",
      "API access for businesses",
      "Priority email support",
    ],
    cta: "Go Premium",
    color: "border-amber-500/40",
  },
]

export default function PricingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const choose = async (plan: "free" | "pro" | "premium") => {
    if (!user) {
      router.push(`/login?next=/pricing&plan=${plan}`)
      return
    }
    setBusy(plan)
    setMsg(null)
    try {
      // Demo "checkout" — in production wire this to Razorpay/Stripe.
      // Calls the admin endpoint with the user's own email; only admins succeed.
      // For non-admins we simulate the upgrade locally and persist via a
      // dedicated /api/billing/upgrade endpoint.
      const r = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "Upgrade failed")
      setMsg(`You're now on the ${plan.toUpperCase()} plan. Reload to refresh your account.`)
      setTimeout(() => router.refresh(), 800)
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-12 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to app
          </Link>
        </div>
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">Simple, transparent pricing</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Cancel anytime. Upgrade when you need more. All plans include the same award-winning AI engine.
          </p>
          {user && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm bg-muted px-3 py-1.5 rounded-full">
              <span className="text-muted-foreground">Current plan:</span>
              <span className="font-semibold capitalize">{(user as any).plan || "free"}</span>
            </div>
          )}
        </div>

        {msg && (
          <div className="max-w-md mx-auto mb-6 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300 text-center">
            {msg}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((p) => {
            const Icon = p.icon
            const isCurrent = (user as any)?.plan === p.id
            return (
              <Card key={p.id} className={`relative p-6 sm:p-8 flex flex-col ${p.color}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Most popular
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{p.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{p.tagline}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold tracking-tight">{p.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">/ {p.period}</span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  variant={p.popular ? "default" : "outline"}
                  className="w-full"
                  disabled={isCurrent || busy === p.id}
                  onClick={() => choose(p.id)}
                >
                  {isCurrent ? "Current plan" : busy === p.id ? "Processing…" : p.cta}
                </Button>
              </Card>
            )
          })}
        </div>

        <div className="mt-12 text-center text-xs text-muted-foreground max-w-xl mx-auto">
          Demo billing flow — payments are not yet wired to Razorpay/Stripe. Plan changes apply
          immediately for this account. For an enterprise contract, contact{" "}
          <a className="underline" href="mailto:hello@skininsight.app">hello@skininsight.app</a>.
        </div>
      </div>
    </main>
  )
}
