import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { StatsMarquee } from "@/components/stats-marquee"
import { FaceScanWizard } from "@/components/face-scan-wizard"
import { DailyTracker } from "@/components/daily-tracker"
import { ProductRecommendations } from "@/components/product-recommendations"
import { ProgressCalendar } from "@/components/progress-calendar"
import { FeaturesSection } from "@/components/features-section"
import { Footer } from "@/components/footer"
import { AiDoctorChat } from "@/components/ai-doctor-chat"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

export default function Home() {
  return (
    <main className="relative min-h-screen pb-28 md:pb-0">
      {/* Page-wide ambient backdrop — subtle, single-hue */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-30 sm:opacity-[0.55] dark:opacity-20 sm:dark:opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(60rem 60rem at 8% -10%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 60%), radial-gradient(50rem 50rem at 100% 30%, color-mix(in oklch, var(--secondary) 9%, transparent), transparent 60%), radial-gradient(40rem 40rem at 50% 110%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 60%)",
        }}
      />

      <Navbar />

      {/* 1 — Intro */}
      <HeroSection />

      {/* 2 — Live highlights strip */}
      <StatsMarquee />

      {/* 3 — Core action: live scan */}
      <FaceScanWizard />

      {/* 4 — Daily routine + streak (combined hub) */}
      <DailyTracker />

      {/* 5 — Long-term progress (history + comparison) */}
      <ProgressCalendar />

      {/* 6 — Product recommendations */}
      <ProductRecommendations />

      {/* 7 — Editorial walkthrough */}
      <FeaturesSection />

      <Footer />
      <AiDoctorChat />
      <MobileBottomNav />
    </main>
  )
}
