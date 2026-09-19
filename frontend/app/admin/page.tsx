"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Users,
  Activity,
  Camera,
  Upload,
  Shield,
  BarChart3,
  LogOut,
  Settings,
  Eye,
  Server,
  Home,
  Sparkles,
  Database,
  TrendingUp,
  Package,
  Search,
  Download,
  RefreshCw,
  Filter,
  Star,
  UserPlus,
  Trash2,
  CreditCard,
  Ban,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"
import { ThemeToggle } from "@/components/theme-toggle"

// All overview metrics are computed live from real data sources (see useMemo blocks in component).

export default function AdminPage() {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const [mlServerStatus, setMlServerStatus] = useState<"online" | "offline" | "checking">("checking")
  const [serverInfo, setServerInfo] = useState<any>(null)
  const [liveHistory, setLiveHistory] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [productTier, setProductTier] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"overview" | "scans" | "products" | "users" | "system">("overview")
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "", plan: "free", role: "user" })
  const [userMsg, setUserMsg] = useState<string | null>(null)

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const r = await fetch("/api/admin/users")
      const j = await r.json()
      setUsers(j.users || [])
    } catch {} finally { setUsersLoading(false) }
  }

  const updateUserField = async (email: string, patch: any) => {
    setUserMsg(null)
    try {
      const r = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...patch }),
      })
      if (!r.ok) throw new Error((await r.json()).error || "Update failed")
      await fetchUsers()
    } catch (e: any) { setUserMsg(e.message) }
  }

  const removeUser = async (email: string) => {
    if (!confirm(`Delete account ${email}?`)) return
    try {
      const r = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`, { method: "DELETE" })
      if (!r.ok) throw new Error((await r.json()).error || "Delete failed")
      await fetchUsers()
    } catch (e: any) { setUserMsg(e.message) }
  }

  const addUser = async () => {
    setUserMsg(null)
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "Create failed")
      setNewUser({ email: "", name: "", password: "", plan: "free", role: "user" })
      setUserMsg(`Created ${j.user.email}`)
      await fetchUsers()
    } catch (e: any) { setUserMsg(e.message) }
  }

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/admin/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    async function checkServer() {
      try {
        const res = await fetch("/api/predict", { method: "GET" })
        setMlServerStatus("online")
        try {
          const r2 = await fetch("/api/products?")
          const j = await r2.json()
          setServerInfo({ products: j.count || 0 })
        } catch {}
      } catch {
        setMlServerStatus("offline")
      }
    }
    checkServer()
  }, [])

  // Load live data from localStorage + auto-fetch users so overview has real numbers
  useEffect(() => {
    try {
      const raw = localStorage.getItem("skinpro:history")
      if (raw) setLiveHistory(JSON.parse(raw))
    } catch {}
    fetch("/api/products?")
      .then(r => r.json())
      .then(j => setProducts(j.items || []))
      .catch(() => {})
    fetchUsers()
  }, [])

  const refreshAll = async () => {
    try {
      const raw = localStorage.getItem("skinpro:history")
      setLiveHistory(raw ? JSON.parse(raw) : [])
      const r = await fetch("/api/products?")
      const j = await r.json()
      setProducts(j.items || [])
      const res = await fetch("/api/predict", { method: "GET" })
      setMlServerStatus("online")
    } catch { setMlServerStatus("offline") }
  }

  const exportData = () => {
    const data = { history: liveHistory, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `skinpro-export-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  // Derived live stats
  const realStats = (() => {
    if (liveHistory.length === 0) return null
    const avgScore = liveHistory.reduce((s, h) => s + (h.overall || 0), 0) / liveHistory.length
    const last7 = liveHistory.filter(h => Date.now() - h.ts < 7 * 86400000).length
    const last30 = liveHistory.filter(h => Date.now() - h.ts < 30 * 86400000).length
    const skinTypes: Record<string, number> = {}
    liveHistory.forEach(h => { skinTypes[h.skinType || "Unknown"] = (skinTypes[h.skinType || "Unknown"] || 0) + 1 })
    return { avgScore, last7, last30, skinTypes, total: liveHistory.length }
  })()

  // Last 14 days bar chart
  const dailyChart = (() => {
    const map: Record<string, number> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      map[d.toISOString().slice(0, 10)] = 0
    }
    liveHistory.forEach(h => { if (map[h.date] !== undefined) map[h.date]++ })
    const max = Math.max(1, ...Object.values(map))
    return Object.entries(map).map(([d, c]) => ({ d, c, pct: (c / max) * 100 }))
  })()

  const filteredProducts = products.filter(p => {
    if (productTier && p.tier !== productTier) return false
    if (productSearch) {
      const q = productSearch.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.concerns || []).some((c: string) => c.includes(q))
    }
    return true
  })

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="text-xl font-bold text-foreground tracking-tight">
                  SkinInsight <span className="text-primary">AI</span>
                </span>
              </Link>
              <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-foreground text-background rounded-md">
                Admin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                {user.email}
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 rounded-lg h-9 text-muted-foreground hover:text-foreground">
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of SkinInsight AI platform analytics</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={refreshAll} className="gap-1.5 h-9">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportData} className="gap-1.5 h-9" disabled={liveHistory.length === 0}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
              mlServerStatus === "online"
                ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
                : mlServerStatus === "offline"
                ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                : "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400"
            }`}>
              <Server className="w-4 h-4" />
              <div className={`w-2 h-2 rounded-full ${
                mlServerStatus === "online" ? "bg-green-500" : mlServerStatus === "offline" ? "bg-red-500" : "bg-yellow-500 animate-pulse"
              }`} />
              ML: {mlServerStatus === "checking" ? "Checking..." : mlServerStatus}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
          {([
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "scans", label: "Live scans", icon: Activity, badge: liveHistory.length },
            { id: "products", label: "Products", icon: Package, badge: products.length },
            { id: "users", label: "Users", icon: Users, badge: users.length },
            { id: "system", label: "System", icon: Server },
          ] as const).map(t => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id as any); if (t.id === "users" && users.length === 0) fetchUsers() }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
                {"badge" in t && t.badge !== undefined && t.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{t.badge}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Live activity tab ── */}
        {activeTab === "scans" && (
          <div className="space-y-6">
            {realStats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total scans</div><div className="text-3xl font-bold">{realStats.total}</div></CardContent></Card>
                  <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Last 7 days</div><div className="text-3xl font-bold">{realStats.last7}</div></CardContent></Card>
                  <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Last 30 days</div><div className="text-3xl font-bold">{realStats.last30}</div></CardContent></Card>
                  <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Avg score</div><div className="text-3xl font-bold">{Math.round(realStats.avgScore)}</div></CardContent></Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5 text-primary" /> Activity (last 14 days)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-1.5 h-40">
                      {dailyChart.map(({ d, c, pct }) => (
                        <div key={d} className="flex-1 flex flex-col items-center justify-end gap-1 group">
                          <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">{c}</div>
                          <div className="w-full bg-primary/20 hover:bg-primary/40 transition rounded-t" style={{ height: `${Math.max(2, pct)}%` }} title={`${d}: ${c} scan(s)`} />
                          <div className="text-[9px] text-muted-foreground">{d.slice(8)}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Database className="w-5 h-5 text-primary" /> Recent scan log (live)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Score</th>
                            <th className="py-2 px-3">Skin type</th>
                            <th className="py-2 px-3">Top concern</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...liveHistory].reverse().slice(0, 20).map((h, i) => {
                            const top = h.concerns ? Object.entries(h.concerns).sort((a: any, b: any) => b[1] - a[1])[0] : null
                            return (
                              <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                                <td className="py-2.5 px-3 font-mono text-xs">{new Date(h.ts).toLocaleString()}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                    h.overall >= 75 ? "bg-emerald-500/10 text-emerald-600" :
                                    h.overall >= 60 ? "bg-emerald-300/20 text-emerald-700" :
                                    h.overall >= 45 ? "bg-yellow-400/20 text-yellow-700" :
                                    "bg-red-500/10 text-red-600"
                                  }`}>{Math.round(h.overall)}</span>
                                </td>
                                <td className="py-2.5 px-3">{h.skinType || "—"}</td>
                                <td className="py-2.5 px-3 capitalize">
                                  {top ? <span><span className="font-medium">{(top[0] as string).replace("_"," ")}</span> <span className="text-xs text-muted-foreground ml-1">({Math.round(top[1] as number)})</span></span> : "—"}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {liveHistory.length === 0 && <div className="text-center text-muted-foreground py-6 text-sm">No live scans yet — run a scan from the home page.</div>}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No live scan data yet. Use the app to run a scan and it will appear here.</CardContent></Card>
            )}
          </div>
        )}

        {/* ── Products tab ── */}
        {activeTab === "products" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      placeholder="Search by name, brand, or concern…"
                      className="w-full pl-9 pr-3 py-2 rounded-md border bg-background text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1 rounded-md border p-0.5 bg-muted/30">
                    {["", "drugstore", "affordable", "premium"].map(t => (
                      <button key={t} onClick={() => setProductTier(t)} className={`text-xs px-3 py-1.5 rounded capitalize transition ${productTier === t ? "bg-background shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}>{t || "All"}</button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-3 px-3">Product</th>
                        <th className="py-3 px-3">Brand</th>
                        <th className="py-3 px-3">Tier</th>
                        <th className="py-3 px-3">Price</th>
                        <th className="py-3 px-3">Rating</th>
                        <th className="py-3 px-3">Concerns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="py-3 px-3 font-medium">{p.name}</td>
                          <td className="py-3 px-3 text-muted-foreground">{p.brand}</td>
                          <td className="py-3 px-3"><span className="inline-flex px-2 py-0.5 rounded bg-muted text-xs capitalize">{p.tier}</span></td>
                          <td className="py-3 px-3 font-semibold tabular-nums">{p.price}</td>
                          <td className="py-3 px-3"><span className="inline-flex items-center gap-1 text-xs"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{p.rating?.toFixed(1) || "—"}</span></td>
                          <td className="py-3 px-3"><div className="flex flex-wrap gap-1">{(p.concerns || []).slice(0, 3).map((c: string, j: number) => <span key={j} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] capitalize">{c.replace("_", " ")}</span>)}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredProducts.length === 0 && <div className="text-center text-muted-foreground py-10 text-sm">No products match your filter.</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Users tab ── */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="w-5 h-5 text-primary" /> Add user</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  <input className="px-3 py-2 rounded-md border bg-background text-sm" placeholder="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                  <input className="px-3 py-2 rounded-md border bg-background text-sm" placeholder="name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                  <input className="px-3 py-2 rounded-md border bg-background text-sm" placeholder="password (min 6)" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                  <select className="px-3 py-2 rounded-md border bg-background text-sm" value={newUser.plan} onChange={(e) => setNewUser({ ...newUser, plan: e.target.value })}>
                    <option value="free">Free</option><option value="pro">Pro</option><option value="premium">Premium</option>
                  </select>
                  <div className="flex gap-2">
                    <select className="flex-1 px-3 py-2 rounded-md border bg-background text-sm" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                      <option value="user">User</option><option value="admin">Admin</option>
                    </select>
                    <Button onClick={addUser} className="shrink-0">Add</Button>
                  </div>
                </div>
                {userMsg && <div className="mt-3 text-sm text-muted-foreground">{userMsg}</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg"><Users className="w-5 h-5 text-primary" /> All users ({users.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={fetchUsers} disabled={usersLoading} className="gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-3 px-3">Email</th>
                        <th className="py-3 px-3">Name</th>
                        <th className="py-3 px-3">Role</th>
                        <th className="py-3 px-3">Plan</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Joined</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.email} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-mono text-xs">{u.email}</td>
                          <td className="py-2.5 px-3">{u.name}</td>
                          <td className="py-2.5 px-3">
                            <select className="px-2 py-1 rounded border bg-background text-xs" value={u.role} onChange={(e) => updateUserField(u.email, { role: e.target.value })}>
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <select className="px-2 py-1 rounded border bg-background text-xs" value={u.plan} onChange={(e) => updateUserField(u.email, { plan: e.target.value })}>
                              <option value="free">free</option>
                              <option value="pro">pro</option>
                              <option value="premium">premium</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            {u.disabled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 text-xs"><Ban className="w-3 h-3" />disabled</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-xs"><CheckCircle2 className="w-3 h-3" />active</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => updateUserField(u.email, { disabled: !u.disabled })}>
                                {u.disabled ? "Enable" : "Disable"}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700" onClick={() => removeUser(u.email)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && !usersLoading && (
                    <div className="text-center text-muted-foreground py-10 text-sm">No users yet — click Refresh to load.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="w-5 h-5 text-primary" /> Subscription summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {(["free", "pro", "premium"] as const).map((plan) => {
                    const count = users.filter((u) => u.plan === plan).length
                    const revenue = plan === "pro" ? count * 299 : plan === "premium" ? count * 799 : 0
                    return (
                      <div key={plan} className="rounded-lg border p-4">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{plan}</div>
                        <div className="text-2xl font-bold mt-1">{count}</div>
                        {revenue > 0 && <div className="text-xs text-emerald-600 mt-1">₹{revenue.toLocaleString("en-IN")}/mo MRR</div>}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── System tab ── */}
        {activeTab === "system" && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Server className="w-5 h-5 text-primary" /> ML Server</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`font-semibold ${mlServerStatus === "online" ? "text-emerald-600" : mlServerStatus === "offline" ? "text-rose-600" : "text-amber-600"}`}>{mlServerStatus}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">URL</span><span className="font-mono text-xs">/api/predict</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Catalog size</span><span className="font-semibold">{products.length} products</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Uptime check</span><span className="text-xs text-muted-foreground">on demand</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Database className="w-5 h-5 text-primary" /> Local data</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Scan history</span><span className="font-semibold">{liveHistory.length} entries</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Storage used</span><span className="font-mono text-xs">~{Math.round(JSON.stringify(liveHistory).length / 1024)} KB</span></div>
                <div className="pt-3 border-t flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportData} disabled={liveHistory.length === 0}>Export JSON</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Clear all local scan history?")) { localStorage.removeItem("skinpro:history"); setLiveHistory([]) } }} className="text-rose-600 hover:text-rose-700">Clear history</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Overview tab — 100% computed from real data ── */}
        {activeTab === "overview" && (() => {
          const totalScans = liveHistory.length
          const userCount = users.length
          const last7Scans = liveHistory.filter(h => Date.now() - h.ts < 7 * 86400000).length
          const prev7Scans = liveHistory.filter(h => {
            const age = Date.now() - h.ts
            return age >= 7 * 86400000 && age < 14 * 86400000
          }).length
          const scansDelta = prev7Scans === 0 ? (last7Scans > 0 ? 100 : 0) : Math.round(((last7Scans - prev7Scans) / prev7Scans) * 100)

          const avgScore = totalScans > 0
            ? Math.round(liveHistory.reduce((s, h) => s + (h.overall || 0), 0) / totalScans)
            : 0

          // Skin-type distribution (real)
          const skinTypeMap: Record<string, number> = {}
          liveHistory.forEach(h => { const k = h.skinType || "Unknown"; skinTypeMap[k] = (skinTypeMap[k] || 0) + 1 })
          const skinTypeDist = Object.entries(skinTypeMap)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count], i) => ({
              name,
              count,
              percentage: Math.round((count / Math.max(1, totalScans)) * 100),
              color: ["bg-primary", "bg-secondary", "bg-emerald-500", "bg-amber-500", "bg-rose-500"][i % 5],
            }))

          // Aggregate concern severity across all scans (real)
          const concernAgg: Record<string, { sum: number; n: number }> = {}
          liveHistory.forEach(h => {
            if (!h.concerns) return
            Object.entries(h.concerns).forEach(([k, v]) => {
              if (!concernAgg[k]) concernAgg[k] = { sum: 0, n: 0 }
              concernAgg[k].sum += Number(v) || 0
              concernAgg[k].n += 1
            })
          })
          const concernDist = Object.entries(concernAgg)
            .map(([name, { sum, n }], i) => ({
              name: name.replace(/_/g, " "),
              avg: Math.round(sum / Math.max(1, n)),
              n,
              color: ["bg-rose-500", "bg-amber-500", "bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-primary"][i % 6],
            }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 6)

          // Plan distribution from real users
          const planMap = { free: 0, pro: 0, premium: 0 } as Record<string, number>
          users.forEach(u => { if (u.plan in planMap) planMap[u.plan]++ })
          const mrr = planMap.pro * 299 + planMap.premium * 799

          const adminCount = users.filter(u => u.role === "admin").length
          const disabledCount = users.filter(u => u.disabled).length

          const overviewStats = [
            {
              label: "Total scans",
              value: totalScans.toLocaleString(),
              icon: Camera,
              change: totalScans > 0 ? `${scansDelta >= 0 ? "+" : ""}${scansDelta}% vs prev 7d` : "awaiting first scan",
              positive: scansDelta >= 0,
              color: "text-primary", bg: "bg-primary/10",
            },
            {
              label: "Registered users",
              value: userCount.toLocaleString(),
              icon: Users,
              change: adminCount > 0 ? `${adminCount} admin · ${disabledCount} disabled` : "load Users tab to refresh",
              positive: true,
              color: "text-secondary", bg: "bg-secondary/10",
            },
            {
              label: "Avg skin score",
              value: totalScans > 0 ? `${avgScore}/100` : "—",
              icon: Activity,
              change: totalScans > 0 ? `across ${totalScans} scan${totalScans === 1 ? "" : "s"}` : "no scans yet",
              positive: avgScore >= 60,
              color: "text-emerald-600", bg: "bg-emerald-500/10",
            },
            {
              label: "Monthly recurring",
              value: `\u20B9${mrr.toLocaleString("en-IN")}`,
              icon: CreditCard,
              change: `${planMap.pro} pro · ${planMap.premium} premium`,
              positive: true,
              color: "text-primary", bg: "bg-primary/10",
            },
          ]

          const recent = [...liveHistory].sort((a, b) => b.ts - a.ts).slice(0, 8)

          return (
            <>
              {/* Stats grid — real */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {overviewStats.map((stat) => {
                  const Icon = stat.icon
                  return (
                    <Card key={stat.label} className="shadow-sm border-border/50 hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                            <p className="text-3xl font-bold text-foreground mt-1 tracking-tight tabular-nums">{stat.value}</p>
                            <p className={`text-xs font-medium mt-1.5 truncate ${stat.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {stat.change}
                            </p>
                          </div>
                          <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-7 h-7 ${stat.color}`} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Empty-state hint */}
              {totalScans === 0 && users.length === 0 && (
                <Card className="mb-8 border-dashed">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="text-sm">
                      <div className="font-semibold text-foreground mb-1">No data yet</div>
                      <p className="text-muted-foreground">
                        Run a scan from the home page to populate scan history, or open the Users tab to load registered accounts. All numbers on this dashboard are computed from real data — nothing is faked.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Activity bars + Concern severity (real) */}
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Activity (last 14 days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {totalScans === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8">No scans recorded yet.</div>
                    ) : (
                      <div className="flex items-end gap-1.5 h-44">
                        {dailyChart.map(({ d, c, pct }) => (
                          <div key={d} className="flex-1 flex flex-col items-center justify-end gap-1 group">
                            <div className="text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition">{c}</div>
                            <div className="w-full bg-primary/25 hover:bg-primary/50 transition rounded-t" style={{ height: `${Math.max(2, pct)}%` }} title={`${d}: ${c} scan(s)`} />
                            <div className="text-[9px] text-muted-foreground">{d.slice(8)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <BarChart3 className="w-5 h-5 text-rose-500" />
                      Top concerns (avg severity)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {concernDist.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8">No concern data yet.</div>
                    ) : (
                      <div className="space-y-4">
                        {concernDist.map(item => (
                          <div key={item.name}>
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="text-foreground font-medium capitalize">{item.name}</span>
                              <span className="text-muted-foreground font-mono text-xs">avg {item.avg} · n={item.n}</span>
                            </div>
                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, item.avg)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Skin-type pie + plan + system snapshot */}
              <div className="grid lg:grid-cols-3 gap-6 mb-8">
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Eye className="w-5 h-5 text-secondary" />
                      Skin type mix
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {skinTypeDist.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8">No skin-type data yet.</div>
                    ) : (
                      <div className="space-y-4">
                        {skinTypeDist.map(item => (
                          <div key={item.name}>
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="text-foreground font-medium">{item.name}</span>
                              <span className="text-muted-foreground font-mono text-xs">{item.count} ({item.percentage}%)</span>
                            </div>
                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${item.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <CreditCard className="w-5 h-5 text-primary" />
                      Plan mix
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {users.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        Open the Users tab to load.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(["free","pro","premium"] as const).map(plan => {
                          const c = planMap[plan]
                          const pct = Math.round((c / Math.max(1, users.length)) * 100)
                          return (
                            <div key={plan}>
                              <div className="flex justify-between text-sm mb-1.5 capitalize">
                                <span className="font-medium">{plan}</span>
                                <span className="text-muted-foreground font-mono text-xs">{c} ({pct}%)</span>
                              </div>
                              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${plan === "premium" ? "bg-amber-500" : plan === "pro" ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Server className="w-5 h-5 text-emerald-500" />
                      System snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ML server</span>
                      <span className={`font-semibold capitalize ${mlServerStatus === "online" ? "text-emerald-600" : mlServerStatus === "offline" ? "text-rose-600" : "text-amber-600"}`}>{mlServerStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Product catalog</span>
                      <span className="font-semibold tabular-nums">{products.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Local storage</span>
                      <span className="font-mono text-xs">~{Math.round(JSON.stringify(liveHistory).length / 1024)} KB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Build</span>
                      <span className="font-mono text-xs">Next 16 · Turbopack</span>
                    </div>
                    <div className="pt-3 border-t flex gap-2">
                      <Button size="sm" variant="outline" onClick={refreshAll} className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Recheck</Button>
                      <Button size="sm" variant="ghost" onClick={() => setActiveTab("system")}>Open system tab</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent scans — real */}
              <Card className="shadow-sm border-border/50 mb-8">
                <CardHeader className="pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <Activity className="w-5 h-5 text-primary" />
                    Recent scans
                  </CardTitle>
                  {totalScans > 8 && (
                    <Button size="sm" variant="ghost" onClick={() => setActiveTab("scans")} className="text-xs">View all →</Button>
                  )}
                </CardHeader>
                <CardContent>
                  {recent.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No scans yet. <Link href="/" className="text-primary underline-offset-2 hover:underline">Run a scan</Link> to see it appear here.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">When</th>
                            <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Score</th>
                            <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Skin type</th>
                            <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Top concern</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recent.map((h, i) => {
                            const top = h.concerns ? Object.entries(h.concerns).sort((a: any, b: any) => b[1] - a[1])[0] : null
                            const score = Math.round(h.overall || 0)
                            return (
                              <tr key={i} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-3 text-muted-foreground text-xs whitespace-nowrap">{new Date(h.ts).toLocaleString()}</td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${score >= 75 ? "bg-emerald-500" : score >= 60 ? "bg-primary" : score >= 45 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${score}%` }} />
                                    </div>
                                    <span className="text-foreground font-mono text-xs w-8 tabular-nums">{score}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-muted text-foreground">{h.skinType || "—"}</span>
                                </td>
                                <td className="py-3 px-3 capitalize text-sm">
                                  {top ? <span><span className="font-medium">{(top[0] as string).replace(/_/g, " ")}</span> <span className="text-xs text-muted-foreground ml-1">({Math.round(top[1] as number)})</span></span> : "—"}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick actions */}
              <div className="grid sm:grid-cols-3 gap-4">
                <Link href="/">
                  <Card className="shadow-sm border-border/50 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer h-full group">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Home className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Open app</p>
                        <p className="text-sm text-muted-foreground">Run a scan from home</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <button onClick={() => { setActiveTab("users"); if (users.length === 0) fetchUsers() }} className="text-left">
                  <Card className="shadow-sm border-border/50 hover:shadow-md hover:border-secondary/20 transition-all cursor-pointer h-full group">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Users className="w-6 h-6 text-secondary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Manage users</p>
                        <p className="text-sm text-muted-foreground">{userCount} registered · {adminCount} admin</p>
                      </div>
                    </CardContent>
                  </Card>
                </button>
                <button onClick={() => setActiveTab("products")} className="text-left">
                  <Card className="shadow-sm border-border/50 hover:shadow-md hover:border-emerald-500/20 transition-all cursor-pointer h-full group">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Package className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Product catalog</p>
                        <p className="text-sm text-muted-foreground">{products.length} items loaded</p>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </div>
            </>
          )
        })()}
      </main>
    </div>
  )
}
