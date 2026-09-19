import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { HowItWorks } from "@/components/how-it-works"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { ScanFace, ArrowRight, Sparkles, Shield, Clock, Award } from "lucide-react"

export const metadata = {
  title: "How AI Skin Analysis Works — From Selfie to Routine in 60s",
  description:
    "See how SkinInsight AI turns one selfie into a dermatologist-grade skin report: live face scan, on-device computer vision, multi-angle capture, and a personalized skincare routine — in four simple steps.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How AI Skin Analysis Works — SkinInsight AI",
    description:
      "Live face scan, on-device AI, multi-angle capture, personalized routine — see the four steps behind your skin report.",
    url: "/how-it-works",
  },
}

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 sm:pt-36 pb-12 sm:pb-16 overflow-hidden bg-gradient-to-b from-background via-muted/20 to-background">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-amber-500/5 blur-3xl" />
        </div>
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-[0.2em] mb-4 border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" /> The Method
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 text-balance">
            From selfie to{" "}
            <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
              glowing skin
            </span>{" "}
            — in 4 steps.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We combine a 12-concern computer-vision model, dermatologist-vetted ingredients,
            and a daily-habit loop. No guesswork, no aisle-staring.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Button asChild size="lg" className="rounded-xl gap-2 h-12 px-6 shadow-lg shadow-primary/30">
              <Link href="/#prediction">
                <ScanFace className="w-4 h-4" /> Try it now <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-xl h-12 px-6">
              <Link href="/pricing">See plans</Link>
            </Button>
          </div>

          {/* Trust strip */}
          <div className="mt-10 grid grid-cols-3 gap-3 max-w-xl mx-auto">
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border/50">
              <Clock className="w-5 h-5 text-primary" />
              <div className="text-xs font-bold">30-second scan</div>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border/50">
              <Shield className="w-5 h-5 text-primary" />
              <div className="text-xs font-bold">Private & on-device</div>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border/50">
              <Award className="w-5 h-5 text-primary" />
              <div className="text-xs font-bold">Derm-vetted</div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* Bottom CTA band */}
      <section className="py-16 sm:py-20">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-fuchsia-600 to-rose-500 p-8 sm:p-12 text-white text-center shadow-2xl">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-amber-300/20 rounded-full blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">Ready in 30 seconds.</h2>
              <p className="text-white/85 text-base sm:text-lg mb-6 max-w-lg mx-auto">
                Your first scan is free. No card, no signup gate — just open the camera and let us do the rest.
              </p>
              <Button asChild size="lg" className="rounded-xl gap-2 h-12 px-7 bg-white text-rose-600 hover:bg-amber-50 font-bold shadow-xl">
                <Link href="/#prediction">
                  <ScanFace className="w-5 h-5" /> Start my free scan
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
