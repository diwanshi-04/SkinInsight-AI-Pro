"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/auth-provider"
import { AuthShell, SocialButtons, OrDivider } from "@/components/auth-shell"

function scorePassword(pw: string) {
  let s = 0
  if (pw.length >= 8) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s // 0..4
}

const STRENGTH_META = [
  { label: "Too short", color: "bg-rose-500", text: "text-rose-300" },
  { label: "Weak", color: "bg-rose-500", text: "text-rose-300" },
  { label: "Fair", color: "bg-amber-500", text: "text-amber-300" },
  { label: "Strong", color: "bg-emerald-500", text: "text-emerald-300" },
  { label: "Excellent", color: "bg-emerald-400", text: "text-emerald-300" },
] as const

function oauthErrorMessage(code: string | null, provider: string | null) {
  if (!code) return null
  if (code === "oauth_not_configured") {
    if (provider === "google")
      return "Google sign-up isn't configured on this server yet. Please use email and password for now."
    return `${provider ? provider[0].toUpperCase() + provider.slice(1) : "Social"} sign-up is coming soon.`
  }
  return "Could not complete social sign-up. Please try again."
}

function SignupInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { signup, loginWithProvider, user } = useAuth()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)

  useEffect(() => {
    if (user) router.replace("/")
  }, [user, router])

  useEffect(() => {
    const errCode = params.get("error")
    const provider = params.get("provider")
    const msg = oauthErrorMessage(errCode, provider)
    if (msg) setError(msg)
  }, [params])

  const score = useMemo(() => scorePassword(password), [password])
  const meta = STRENGTH_META[score]
  const passwordsMatch = confirm.length > 0 && confirm === password

  const canSubmit =
    name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    score >= 2 &&
    passwordsMatch &&
    agree &&
    !isLoading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!canSubmit) {
      if (!passwordsMatch) setError("Passwords do not match.")
      else if (score < 2) setError("Please choose a stronger password.")
      else if (!agree) setError("Please accept the Terms to continue.")
      return
    }
    setIsLoading(true)
    const result = await signup(name.trim(), email.trim().toLowerCase(), password)
    setIsLoading(false)
    if (result.success) {
      router.push("/")
    } else {
      setError(result.error || "Could not create your account.")
    }
  }

  const handleProvider = (p: "google" | "apple" | "github") => {
    setSocialLoading(p)
    loginWithProvider(p)
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever · no credit card required"
      banner={
        error ? (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-200">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        ) : null
      }
      footer={
        <div className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 font-semibold hover:text-indigo-300">
            Sign in
          </Link>
        </div>
      }
    >
      <SocialButtons onProvider={handleProvider} loading={socialLoading} />
      <OrDivider label="or sign up with email" />

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="block text-[13px] font-semibold text-slate-200 mb-2">
            Full name
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Alex Kim"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 pl-11 pr-4 text-[15px] rounded-xl bg-white/[0.04] border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-400/60 focus-visible:ring-2 focus-visible:ring-indigo-400/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-[13px] font-semibold text-slate-200 mb-2">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-11 pr-4 text-[15px] rounded-xl bg-white/[0.04] border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-400/60 focus-visible:ring-2 focus-visible:ring-indigo-400/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-[13px] font-semibold text-slate-200 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-11 pr-11 text-[15px] rounded-xl bg-white/[0.04] border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-400/60 focus-visible:ring-2 focus-visible:ring-indigo-400/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-200"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Strength meter */}
          {password.length > 0 && (
            <div className="mt-2.5">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i < score ? meta.color : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className={`font-semibold ${meta.text}`}>{meta.label}</span>
                <span className="text-slate-500">8+ chars · mixed case · number · symbol</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirm" className="block text-[13px] font-semibold text-slate-200 mb-2">
            Confirm password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`h-12 pl-11 pr-11 text-[15px] rounded-xl bg-white/[0.04] text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 ${
                confirm.length > 0 && !passwordsMatch
                  ? "border-rose-500/50 focus-visible:border-rose-400/70 focus-visible:ring-rose-400/20"
                  : "border-white/10 focus-visible:border-indigo-400/60 focus-visible:ring-indigo-400/20"
              }`}
            />
            {passwordsMatch && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            )}
          </div>
          {confirm.length > 0 && !passwordsMatch && (
            <p className="mt-1.5 text-[11px] text-rose-300">Passwords do not match.</p>
          )}
        </div>

        <label className="flex items-start gap-2.5 text-[12px] text-slate-300 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-indigo-500 cursor-pointer"
          />
          <span className="leading-relaxed">
            I agree to the{" "}
            <Link href="/" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-12 text-[15px] rounded-xl gap-2 font-bold text-white border-0 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
            boxShadow:
              "0 8px 22px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <SignupInner />
    </Suspense>
  )
}
