"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/auth-provider"
import { AuthShell, SocialButtons, OrDivider } from "@/components/auth-shell"

function oauthErrorMessage(code: string | null, provider: string | null) {
  if (!code) return null
  if (code === "oauth_not_configured") {
    if (provider === "google")
      return "Google sign-in isn't configured on this server yet. Please use email and password for now."
    return `${provider ? provider[0].toUpperCase() + provider.slice(1) : "Social"} sign-in is coming soon. Please use email and password for now.`
  }
  if (code === "oauth_state_invalid" || code === "oauth_state_mismatch")
    return "Sign-in session expired. Please try again."
  if (code === "oauth_email_unverified")
    return "Your social account email is not verified."
  return "Could not complete social sign-in. Please try again."
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { login, loginWithProvider, user } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    const result = await login(email, password)
    setIsLoading(false)
    if (result.success) {
      router.push("/")
    } else {
      setError(result.error || "Invalid credentials")
    }
  }

  const handleProvider = (p: "google" | "apple" | "github") => {
    setSocialLoading(p)
    loginWithProvider(p)
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue your skin journey"
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
          New to SkinInsight?{" "}
          <Link href="/signup" className="text-indigo-400 font-semibold hover:text-indigo-300">
            Create an account
          </Link>
        </div>
      }
    >
      <SocialButtons onProvider={handleProvider} loading={socialLoading} />
      <OrDivider />

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="text-[13px] font-semibold text-slate-200">
              Password
            </label>
            <button
              type="button"
              onClick={() =>
                alert("Password reset is coming soon. Please contact support.")
              }
              className="text-[12px] text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Forgot?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Your password"
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
        </div>

        <Button
          type="submit"
          disabled={isLoading || !email || !password}
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
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginInner />
    </Suspense>
  )
}
