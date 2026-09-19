import { NextRequest, NextResponse } from "next/server"
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  publicUser,
  Plan,
  Role,
} from "@/lib/user-store"
import { verifyToken } from "@/lib/auth-token"

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value
  const decoded = verifyToken(token)
  if (!decoded || decoded.role !== "admin") return null
  return decoded
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const users = listUsers().map(publicUser)
  return NextResponse.json({ count: users.length, users })
}

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await request.json()
  const r = createUser({
    email: body.email,
    name: body.name,
    password: body.password,
    plan: body.plan as Plan,
    role: body.role as Role,
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ success: true, user: publicUser(r.user) })
}

export async function PATCH(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await request.json()
  if (!body.email) return NextResponse.json({ error: "email required" }, { status: 400 })
  const u = updateUser(body.email, {
    plan: body.plan,
    role: body.role,
    disabled: body.disabled,
    name: body.name,
    password: body.password,
  })
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ success: true, user: publicUser(u) })
}

export async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email")
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })
  if (email.toLowerCase() === "8080@gmail.com") {
    return NextResponse.json({ error: "Cannot delete the seed admin" }, { status: 400 })
  }
  const ok = deleteUser(email)
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
