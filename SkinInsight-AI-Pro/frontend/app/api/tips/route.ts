import { NextRequest, NextResponse } from "next/server"

const ML_SERVER_URL = process.env.ML_SERVER_URL || "http://127.0.0.1:5001"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const n = searchParams.get("n") || "6"
    const r = await fetch(`${ML_SERVER_URL}/tips?n=${encodeURIComponent(n)}`, { cache: "no-store" })
    const j = await r.json()
    return NextResponse.json(j)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "proxy error" }, { status: 500 })
  }
}
