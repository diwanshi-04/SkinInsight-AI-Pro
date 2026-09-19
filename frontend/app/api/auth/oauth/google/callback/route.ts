import { NextRequest, NextResponse } from "next/server"
import { upsertOAuthUser } from "@/lib/user-store"
import { signToken } from "@/lib/auth-token"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const origin = process.env.APP_URL || url.origin
  const stateCookie = request.cookies.get("oauth-state")?.value
  const fail = (msg: string) => {
    const r = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`)
    r.cookies.set("oauth-state", "", { maxAge: 0, path: "/" })
    return r
  }

  if (!code || !state || !stateCookie) return fail("oauth_state_invalid")
  const [storedState, next = "/"] = stateCookie.split("|")
  if (state !== storedState) return fail("oauth_state_mismatch")

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail("oauth_not_configured")

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/oauth/google/callback`,
      grant_type: "authorization_code",
    }),
  })
  if (!tokenRes.ok) return fail("oauth_token_exchange_failed")
  const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string }

  // Fetch userinfo
  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userRes.ok) return fail("oauth_userinfo_failed")
  const profile = (await userRes.json()) as { email?: string; name?: string; email_verified?: boolean }

  if (!profile.email) return fail("oauth_no_email")
  if (profile.email_verified === false) return fail("oauth_email_unverified")

  const account = upsertOAuthUser({
    email: profile.email,
    name: profile.name,
    provider: "google",
  })

  const token = signToken({
    email: account.email,
    role: account.role,
    name: account.name,
    plan: account.plan,
    provider: "google",
  })

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/"
  const res = NextResponse.redirect(`${origin}${safeNext}`)
  res.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 86400,
    path: "/",
  })
  res.cookies.set("oauth-state", "", { maxAge: 0, path: "/" })
  return res
}
