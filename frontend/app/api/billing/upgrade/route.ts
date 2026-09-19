import { NextRequest, NextResponse } from "next/server"
import { updateUser, publicUser, Plan } from "@/lib/user-store"
import { signToken, verifyToken } from "@/lib/auth-token"

const VALID: Plan[] = ["free", "pro", "premium"]

export async function POST(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value
  const decoded = verifyToken(token)
  if (!decoded) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const { plan } = await request.json()
  if (!VALID.includes(plan)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 })

  const u = updateUser(decoded.email, { plan })
  if (!u) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  // Refresh the auth cookie so the new plan is reflected on next /me check.
  const newToken = signToken({
    email: u.email,
    role: u.role,
    name: u.name,
    plan: u.plan,
    provider: decoded.provider || "password",
  })
  const res = NextResponse.json({ success: true, user: publicUser(u) })
  res.cookies.set("auth-token", newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 86400,
    path: "/",
  })
  return res
}
