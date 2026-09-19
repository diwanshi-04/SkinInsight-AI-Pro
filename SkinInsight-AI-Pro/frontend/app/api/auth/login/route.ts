import { NextRequest, NextResponse } from "next/server"
import { verifyCredentials, publicUser } from "@/lib/user-store"
import { signToken } from "@/lib/auth-token"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const account = verifyCredentials(email, password)
    if (!account) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const token = signToken({
      email: account.email,
      role: account.role,
      name: account.name,
      plan: account.plan,
      provider: "password",
    })

    const response = NextResponse.json({ success: true, user: publicUser(account) })
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
