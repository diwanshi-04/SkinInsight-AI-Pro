"use client"

import Link from "next/link"
import { ArrowLeft, Sparkles, ShieldCheck, Lock, Activity, CheckCircle2 } from "lucide-react"
import type { ReactNode } from "react"

interface AuthShellProps {
  /** "Sign in" / "Create account" headline */
  title: string
  /** Sub-line under the headline */
  subtitle: string
  /** The form */
  children: ReactNode
  /** Footer link area (e.g. switch to other page) */
  footer?: ReactNode
  /** Pre-form banner (errors, info) */
  banner?: ReactNode
}

export function AuthShell({ title, subtitle, children, footer, banner }: AuthShellProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950 text-slate-100">
      {/* === Brand panel (left, desktop only) === */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[46%] relative overflow-hidden">
        {/* Aurora background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #4338ca 75%, #7c3aed 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, rgba(56,189,248,0.35) 0%, transparent 60%), radial-gradient(120% 80% at 100% 100%, rgba(236,72,153,0.4) 0%, transparent 55%)",
          }}
        />
        <div className="absolute inset-0 mesh-dots opacity-15" />
        {/* Soft floating orbs */}
        <span className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <span className="absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full text-white">
          {/* Top: back link + brand (separate rows, no overlap) */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
            <Link href="/" className="inline-flex items-center gap-3 mt-8 mb-4">
              <span
                className="relative w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #d946ef 50%, #f59e0b 100%)",
                  boxShadow:
                    "0 6px 20px -4px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.45)",
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-x-1.5 top-1 h-1/2 rounded-xl opacity-50"
                  style={{
                    background: "linear-gradient(to bottom, rgba(255,255,255,0.6), transparent)",
                  }}
                />
                <Sparkles className="relative w-5 h-5 text-white" strokeWidth={2.4} />
              </span>
              <span className="text-xl font-extrabold tracking-tight">
                SkinInsight <span className="gradient-text">AI</span>
              </span>
            </Link>

            <h2 className="mt-8 text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
              Your skin,
              <br />
              <span className="gradient-text">decoded by AI.</span>
            </h2>
            <p className="mt-5 text-base text-white/70 max-w-md leading-relaxed">
              Industry-leading multi-model analysis. Personalised routines. A private AI coach in your pocket — all in one secure account.
            </p>
          </div>

          {/* Middle: feature highlights */}
          <ul className="mt-10 space-y-3 max-w-md">
            {[
              "Multi-angle, multi-model deep skin analysis",
              "Personal AI coach trained on your scan data",
              "Bank-grade security · your photos never leave the device unencrypted",
              "Free forever plan · no credit card required",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-white/85">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {/* Bottom: trust row */}
          <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-white/65">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              SOC 2 ready
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-300" />
              End-to-end encrypted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-fuchsia-300" />
              Trusted by 25k+ users
            </span>
          </div>
        </div>
      </aside>

      {/* === Form panel === */}
      <main className="flex-1 flex items-center justify-center px-5 sm:px-8 py-10 sm:py-14 relative">
        {/* mobile-only ambient glow */}
        <div className="lg:hidden absolute inset-0 pointer-events-none opacity-60" style={{
          background:
            "radial-gradient(60% 30% at 0% 0%, rgba(99,102,241,0.18) 0%, transparent 60%), radial-gradient(60% 30% at 100% 0%, rgba(236,72,153,0.15) 0%, transparent 60%)",
        }} />

        <div className="w-full max-w-md relative">
          {/* Mobile brand */}
          <div className="lg:hidden mb-7">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span
                className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #d946ef 50%, #f59e0b 100%)",
                  boxShadow:
                    "0 4px 14px -2px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
                }}
              >
                <Sparkles className="w-5 h-5 text-white" strokeWidth={2.4} />
              </span>
              <span className="text-lg font-extrabold tracking-tight">
                SkinInsight <span className="gradient-text">AI</span>
              </span>
            </Link>
          </div>

          <div className="mb-7">
            <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight leading-tight">
              {title}
            </h1>
            <p className="text-slate-400 mt-2 text-[15px]">{subtitle}</p>
          </div>

          {banner}
          {children}
          {footer && <div className="mt-7">{footer}</div>}

          <p className="mt-10 text-center text-[11px] text-slate-500 leading-relaxed">
            By continuing you agree to our{" "}
            <Link href="/" className="underline underline-offset-2 hover:text-slate-300">Terms</Link>{" "}
            and{" "}
            <Link href="/" className="underline underline-offset-2 hover:text-slate-300">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}

/* === Reusable social buttons === */
export function SocialButtons({
  onProvider,
  loading,
}: {
  onProvider: (p: "google" | "apple" | "github") => void
  loading?: string | null
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      <button
        type="button"
        onClick={() => onProvider("google")}
        disabled={!!loading}
        className="group h-11 inline-flex items-center justify-center gap-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold border border-white/10 hover:bg-slate-100 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading === "google" ? (
          <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        <span>Google</span>
      </button>
      <button
        type="button"
        onClick={() => onProvider("apple")}
        disabled={!!loading}
        className="group h-11 inline-flex items-center justify-center gap-2.5 rounded-xl bg-black text-white text-sm font-semibold border border-white/15 hover:bg-zinc-900 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading === "apple" ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <AppleIcon />
        )}
        <span>Apple</span>
      </button>
      <button
        type="button"
        onClick={() => onProvider("github")}
        disabled={!!loading}
        className="group h-11 inline-flex items-center justify-center gap-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold border border-white/10 hover:bg-slate-700 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading === "github" ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <GitHubIcon />
        )}
        <span>GitHub</span>
      </button>
    </div>
  )
}

export function OrDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-bold">{label}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  )
}

/* === Brand SVG icons === */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7C33.7 6.1 29.1 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.7 6.1 29.1 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5 0 9.6-1.9 13-5l-6-5c-2 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.5 39.5 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.3 5.7l6 5c.6-.5 7-5.1 7-14.7 0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  )
}
function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 384 512" fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM256.4 124.5c25.4-30.2 23.1-57.7 22.4-67.6-22.5 1.3-48.6 15.3-63.5 32.5-16.4 18.5-26 41.4-23.9 65.1 24.3 1.9 46.5-10.6 65-30z"/>
    </svg>
  )
}
function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.1 11.1 0 015.78 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
    </svg>
  )
}
