"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Lock, Mail, ArrowRight, ArrowLeft, Shield, Server, BarChart3, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/auth-provider"

export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login, user } = useAuth()
  const router = useRouter()

  if (user) {
    router.push(user.role === "admin" ? "/admin" : "/")
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    const result = await login(email, password)
    if (result.success) {
      // Check if user is admin after login
      const meRes = await fetch("/api/auth/me")
      const meData = await meRes.json()
      if (meData.user?.role === "admin") {
        router.push("/admin")
      } else {
        // Not an admin — logout and show error
        await fetch("/api/auth/logout", { method: "POST" })
        setError("Access denied. Admin credentials required.")
      }
    } else {
      setError(result.error || "Invalid credentials")
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side — Admin Branding */}
      <div className="hidden lg:flex lg:w-[45%] relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0zMHY2aDZ2LTZoLTZ6bTAgMTJ2Nmg2di02aC02em0tMTIgMTJ2Nmg2di02aC02em0wLTEydjZoNnYtNmgtNnptLTEyIDEydjZoNnYtNmgtNnptMTItMjR2Nmg2di02aC02em0tMTIgMTJ2Nmg2di02aC02em0yNCAyNHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-80" />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -top-48 -right-48 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm mb-16">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs font-medium text-white/80 mb-6">
              <Shield className="w-3.5 h-3.5" />
              ADMIN PORTAL
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-4">
              Control<br />
              <span className="text-white/60">Center</span>
            </h1>
            <p className="text-lg text-white/50 max-w-md leading-relaxed">
              Manage models, monitor analytics, and oversee the SkinInsight AI platform.
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Analytics Dashboard</p>
                <p className="text-sm text-white/40">Monitor scan statistics & model performance</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">ML Server Status</p>
                <p className="text-sm text-white/40">Real-time health monitoring of AI models</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">User Management</p>
                <p className="text-sm text-white/40">View user activity and scan history</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} SkinInsight AI Pro — Admin Portal
          </p>
        </div>
      </div>

      {/* Right Side — Admin Login Form */}
      <div className="w-full lg:w-[55%] flex items-center justify-center bg-background px-6 py-12 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/3 via-transparent to-transparent" />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile back link */}
          <div className="lg:hidden mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-foreground/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-foreground" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              Admin Sign In
            </h2>
            <p className="text-muted-foreground mt-2 text-base">
              Restricted access — admin credentials required
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-foreground mb-2">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@yourdomain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-12 text-base rounded-xl border-border/80 bg-muted/20 focus:bg-background focus:border-primary/50 transition-all"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-foreground mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pl-12 pr-12 text-base rounded-xl border-border/80 bg-muted/20 focus:bg-background focus:border-primary/50 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base rounded-xl gap-2 font-semibold shadow-lg shadow-primary/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  Access Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* User login link */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Not an admin? Sign in as user &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
