/**
 * Lightweight in-process user store with optional file persistence.
 *
 * NOTE for production: serverless platforms (Vercel/Railway free tier) reset
 * file/memory state between deploys and cold starts. For real-business use,
 * swap `loadFromDisk`/`saveToDisk` for a database (Postgres, Supabase,
 * PlanetScale, MongoDB, etc.). The public API of this module stays the same.
 */
import fs from "fs"
import path from "path"
import os from "os"
import crypto from "crypto"

export type Plan = "free" | "pro" | "premium"
export type Role = "user" | "admin"

export interface UserRecord {
  email: string
  name: string
  password: string // scrypt hash ("scrypt:<salt>:<hash>") or legacy plaintext
  role: Role
  plan: Plan
  disabled: boolean
  createdAt: number
  scansThisMonth: number
  provider?: "password" | "google" | "apple" | "github"
}

// ---- password hashing -------------------------------------------------------
function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex")
  return `scrypt:${salt}:${derived}`
}
function verifyPassword(plain: string, stored: string): boolean {
  try {
    if (stored.startsWith("scrypt:")) {
      const [, salt, hash] = stored.split(":")
      const derived = crypto.scryptSync(plain, salt, 64)
      const known = Buffer.from(hash, "hex")
      return derived.length === known.length && crypto.timingSafeEqual(derived, known)
    }
    // Legacy plaintext fallback (timing-safe)
    const a = Buffer.from(plain)
    const b = Buffer.from(stored)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

const PLAN_LIMITS: Record<Plan, { scansPerMonth: number; aiChat: boolean; products: boolean }> = {
  free: { scansPerMonth: 5, aiChat: true, products: true },
  pro: { scansPerMonth: 50, aiChat: true, products: true },
  premium: { scansPerMonth: Infinity, aiChat: true, products: true },
}

const STORE_FILE = path.join(os.tmpdir(), "skinpro-users.json")

const SEED: UserRecord[] = [
  {
    email: "8080@gmail.com",
    name: "Admin",
    password: hashPassword("8080"),
    role: "admin",
    plan: "premium",
    disabled: false,
    createdAt: Date.now(),
    scansThisMonth: 0,
    provider: "password",
  },
]

// Legacy seed accounts that should be purged on load (they used demo creds
// that were publicly documented and are now considered insecure).
const LEGACY_EMAILS = new Set(["admin@skininsight.com", "user@skininsight.com"])

let _users: Map<string, UserRecord> | null = null

function loadFromDisk(): Map<string, UserRecord> {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8")
      const arr: UserRecord[] = JSON.parse(raw)
      const map = new Map<string, UserRecord>()
      arr.forEach((u) => {
        const key = u.email.toLowerCase()
        if (LEGACY_EMAILS.has(key)) return // strip insecure legacy seeds
        map.set(key, u)
      })
      // ensure current seeds exist
      SEED.forEach((s) => {
        if (!map.has(s.email)) map.set(s.email, s)
      })
      return map
    }
  } catch {}
  const map = new Map<string, UserRecord>()
  SEED.forEach((s) => map.set(s.email, s))
  return map
}

function saveToDisk(map: Map<string, UserRecord>) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(Array.from(map.values()), null, 2), "utf-8")
  } catch {
    // best-effort; ignore on read-only filesystems
  }
}

function store(): Map<string, UserRecord> {
  if (!_users) _users = loadFromDisk()
  return _users
}

export function listUsers(): UserRecord[] {
  return Array.from(store().values()).sort((a, b) => b.createdAt - a.createdAt)
}

export function getUser(email: string): UserRecord | undefined {
  return store().get(email.toLowerCase())
}

export function createUser(input: {
  email: string
  name: string
  password: string
  plan?: Plan
  role?: Role
}): { ok: true; user: UserRecord } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.password) return { ok: false, error: "Email and password required" }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Invalid email format" }
  if (input.password.length < 6) return { ok: false, error: "Password must be at least 6 characters" }
  const s = store()
  if (s.has(email)) return { ok: false, error: "Account already exists" }
  const u: UserRecord = {
    email,
    name: input.name?.trim() || email.split("@")[0],
    password: hashPassword(input.password),
    role: input.role || "user",
    plan: input.plan || "free",
    disabled: false,
    createdAt: Date.now(),
    scansThisMonth: 0,
    provider: "password",
  }
  s.set(email, u)
  saveToDisk(s)
  return { ok: true, user: u }
}

export function updateUser(
  email: string,
  patch: Partial<Pick<UserRecord, "name" | "plan" | "role" | "disabled" | "password">>
): UserRecord | null {
  const s = store()
  const u = s.get(email.toLowerCase())
  if (!u) return null
  // Auto-hash if caller supplied a raw password
  const next: UserRecord = {
    ...u,
    ...patch,
    password:
      patch.password !== undefined && !patch.password.startsWith("scrypt:")
        ? hashPassword(patch.password)
        : patch.password ?? u.password,
  }
  s.set(u.email, next)
  saveToDisk(s)
  return next
}

export function deleteUser(email: string): boolean {
  const s = store()
  const ok = s.delete(email.toLowerCase())
  if (ok) saveToDisk(s)
  return ok
}

export function verifyCredentials(email: string, password: string): UserRecord | null {
  const u = getUser(email)
  if (!u || u.disabled) return null
  if (!verifyPassword(password, u.password)) return null
  // Auto-upgrade legacy plaintext to scrypt on successful login
  if (!u.password.startsWith("scrypt:")) {
    const upgraded = { ...u, password: hashPassword(password) }
    store().set(u.email, upgraded)
    saveToDisk(store())
    return upgraded
  }
  return u
}

/**
 * Find or create a user from a verified OAuth profile (e.g. Google).
 * No password is stored — the account is OAuth-only.
 */
export function upsertOAuthUser(input: {
  email: string
  name?: string
  provider: "google" | "apple" | "github"
}): UserRecord {
  const email = input.email.trim().toLowerCase()
  const s = store()
  const existing = s.get(email)
  if (existing) return existing
  const u: UserRecord = {
    email,
    name: input.name?.trim() || email.split("@")[0],
    password: "oauth:" + crypto.randomBytes(16).toString("hex"), // unusable
    role: "user",
    plan: "free",
    disabled: false,
    createdAt: Date.now(),
    scansThisMonth: 0,
    provider: input.provider,
  }
  s.set(email, u)
  saveToDisk(s)
  return u
}

export function planLimits(plan: Plan) {
  return PLAN_LIMITS[plan]
}

export function publicUser(u: UserRecord) {
  return {
    email: u.email,
    name: u.name,
    role: u.role,
    plan: u.plan,
    disabled: u.disabled,
    scansThisMonth: u.scansThisMonth,
    createdAt: u.createdAt,
  }
}

export const PLANS = [
  {
    id: "free" as Plan,
    name: "Free",
    price: "₹0",
    period: "forever",
    tagline: "Try the basics",
    features: [
      "5 face scans per month",
      "Basic AI doctor chat",
      "Product recommendations",
      "30-day scan history",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    price: "₹299",
    period: "per month",
    tagline: "For skincare enthusiasts",
    features: [
      "50 face scans per month",
      "Unlimited AI doctor chat",
      "Personalized routine builder",
      "Progress tracking & calendar",
      "Email reminders",
      "Priority product matching",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    id: "premium" as Plan,
    name: "Premium",
    price: "₹799",
    period: "per month",
    tagline: "For professionals & clinics",
    features: [
      "Unlimited face scans",
      "Multi-angle deep analysis",
      "Skin-age tracking & reports",
      "Export PDF reports",
      "API access for businesses",
      "Priority email support",
    ],
    cta: "Go Premium",
    highlight: false,
  },
]
