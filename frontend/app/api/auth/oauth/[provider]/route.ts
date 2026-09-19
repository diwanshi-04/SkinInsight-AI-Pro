/**
 * OAuth start handler — supports Google (production-ready) and Apple/GitHub
 * (graceful fallback). Configure with env vars:
 *
 *   GOOGLE_CLIENT_ID=...
 *   GOOGLE_CLIENT_SECRET=...
 *   APP_URL=https://your-domain.com   (used to build redirect URI)
 *
 * If env vars are missing we redirect back to the auth page with a clear error
 * so the rest of the app keeps working.
 */
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

type Params = { provider: string }

export async function GET(request: NextRequest, ctx: { params: Promise<Params> }) {
  const { provider } = await ctx.params
  const url = new URL(request.url)
  const next = url.searchParams.get("next") || "/"
  const origin = process.env.APP_URL || url.origin

  if (provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.redirect(`${origin}/login?error=oauth_not_configured&provider=google`)
    }
    const state = crypto.randomBytes(24).toString("hex")
    const redirectUri = `${origin}/api/auth/oauth/google/callback`
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    auth.searchParams.set("client_id", clientId)
    auth.searchParams.set("redirect_uri", redirectUri)
    auth.searchParams.set("response_type", "code")
    auth.searchParams.set("scope", "openid email profile")
    auth.searchParams.set("state", state)
    auth.searchParams.set("prompt", "select_account")

    const res = NextResponse.redirect(auth.toString())
    res.cookies.set("oauth-state", `${state}|${next}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 min
      path: "/",
    })
    return res
  }

  // Apple / GitHub — not configured in this build
  return NextResponse.redirect(`${origin}/login?error=oauth_not_configured&provider=${provider}`)
}
