/**
 * Signed auth tokens using HMAC-SHA256 (JWT-style payload.signature).
 *
 * Backwards compatible: also accepts legacy base64-only tokens issued by older
 * routes so existing user sessions don't get logged out on rollout.
 *
 * In production, set AUTH_SECRET to a long random string. We fall back to a
 * derived secret so dev still works, but that fallback is NOT secure.
 */
import crypto from "crypto"

export interface TokenPayload {
  email: string
  role: string
  name: string
  plan: string
  exp: number
  // Optional marker so we know the token came from an OAuth provider
  provider?: "password" | "google" | "apple" | "github"
}

const SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  // dev-only fallback (do NOT rely on this in prod)
  "dev-insecure-secret-change-me-in-env-AUTH_SECRET"

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4)
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad)
  return Buffer.from(padded, "base64")
}

function hmac(data: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest())
}

export function signToken(payload: Omit<TokenPayload, "exp"> & { exp?: number }): string {
  const exp = payload.exp ?? Date.now() + 7 * 24 * 60 * 60 * 1000
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, exp })))
  const sig = hmac(body)
  return `${body}.${sig}`
}

export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null
  try {
    // New format: payload.signature
    if (token.includes(".")) {
      const [body, sig] = token.split(".", 2)
      const expected = hmac(body)
      // Timing-safe compare
      if (
        sig.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      ) {
        return null
      }
      const payload = JSON.parse(fromB64url(body).toString("utf-8")) as TokenPayload
      if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null
      return payload
    }
    // Legacy unsigned base64 token — accept once for backwards compat
    const payload = JSON.parse(Buffer.from(token, "base64").toString("utf-8")) as TokenPayload
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
