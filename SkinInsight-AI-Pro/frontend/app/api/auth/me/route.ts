import { NextRequest, NextResponse } from "next/server"
import { getUser, publicUser } from "@/lib/user-store"
import { verifyToken } from "@/lib/auth-token"

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value
  const decoded = verifyToken(token)

  if (!decoded) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 })
    if (token) response.cookies.set("auth-token", "", { maxAge: 0, path: "/" })
    return response
  }

  const live = getUser(decoded.email)
  if (!live || live.disabled) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 })
    response.cookies.set("auth-token", "", { maxAge: 0, path: "/" })
    return response
  }

  return NextResponse.json({ authenticated: true, user: publicUser(live) })
}
