import { NextRequest, NextResponse } from "next/server"
import { createUser, publicUser } from "@/lib/user-store"
import { signToken } from "@/lib/auth-token"

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()
    const r = createUser({ email, password, name, plan: "free", role: "user" })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })

    const token = signToken({
      email: r.user.email,
      role: r.user.role,
      name: r.user.name,
      plan: r.user.plan,
      provider: "password",
    })

    const response = NextResponse.json({ success: true, user: publicUser(r.user) })
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 86400,
      path: "/",
    })
    return response
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
