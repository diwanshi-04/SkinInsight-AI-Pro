import { NextRequest, NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// SkinInsight Pro v6 — thin proxy to the Python ML server.
// The Python server returns a fully-formed analysis (skin_type + concerns +
// recommendations + heatmap), so this route just forwards the request and
// reshapes the response a tiny bit for the UI.
// ---------------------------------------------------------------------------
const ML_SERVER_URL = process.env.ML_SERVER_URL || "http://127.0.0.1:5001"
const ANALYZE_TIMEOUT_MS = 60_000

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface MLResponse {
  success: boolean
  error?: string
  version?: string
  elapsed_ms?: number
  validation?: {
    is_skin_photo: boolean
    skin_coverage: number
    warning?: string | null
  }
  skin_type?: {
    label: string
    confidence: number
    source: string
    scores: Record<string, number>
  }
  concerns?: Record<string, number>
  lesion_count?: number
  overall_score?: number
  heatmap?: string
  heatmap_legend?: Record<string, string>
  recommendations?: Array<{
    concern: string
    severity: number
    level: string
    tip: string
    ingredients: string[]
  }>
  routine?: { morning: string[]; evening: string[]; weekly: string[] }
  diet?: string[]
  lifestyle?: string[]
}

async function callMLServer(formData: FormData): Promise<MLResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS)
  try {
    const res = await fetch(`${ML_SERVER_URL}/analyze`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`ML server ${res.status}: ${text.slice(0, 200)}`)
    }
    return (await res.json()) as MLResponse
  } finally {
    clearTimeout(timeout)
  }
}

// Quick warmup (used by the UI on page load to wake Railway's free tier)
export async function GET() {
  try {
    const res = await fetch(`${ML_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status }, { status: 200 })
    }
    const data = await res.json()
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData()
    const file = incoming.get("image")
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "No image uploaded. Please select a photo." },
        { status: 400 }
      )
    }

    // Forward as-is to the ML server
    const out = new FormData()
    out.append("image", file, "upload.jpg")

    let ml: MLResponse
    try {
      ml = await callMLServer(out)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        {
          success: false,
          error:
            "Analysis service is waking up. Please try again in 30 seconds. " +
            `(${msg})`,
        },
        { status: 503 }
      )
    }

    if (!ml.success) {
      return NextResponse.json(
        { success: false, error: ml.error || "Analysis failed" },
        { status: 500 }
      )
    }

    // Validation gate: not a skin photo / too small
    if (ml.validation && ml.validation.is_skin_photo === false) {
      return NextResponse.json(
        {
          success: false,
          error:
            ml.validation.warning ||
            "This doesn't look like a clear skin photo. Please upload a well-lit, close-up photo of your face or skin area.",
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      analysis: {
        skinType: ml.skin_type,
        concerns: ml.concerns ?? {},
        lesionCount: ml.lesion_count ?? 0,
        overallScore: ml.overall_score ?? 0,
        heatmap: ml.heatmap,
        heatmapLegend: ml.heatmap_legend ?? {},
        recommendations: ml.recommendations ?? [],
        routine: ml.routine ?? { morning: [], evening: [], weekly: [] },
        diet: ml.diet ?? [],
        lifestyle: ml.lifestyle ?? [],
        validation: ml.validation,
        elapsedMs: ml.elapsed_ms,
        version: ml.version,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
