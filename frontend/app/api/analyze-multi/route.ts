import { NextRequest, NextResponse } from "next/server"

const ML_SERVER_URL = process.env.ML_SERVER_URL || "http://127.0.0.1:5001"
const TIMEOUT_MS = 90_000

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    // Accept multiple files under any field name
    const upstream = new FormData()
    let count = 0
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        upstream.append(key || `image_${count}`, value, value.name || `image_${count}.jpg`)
        count++
      }
    }
    if (count === 0) {
      return NextResponse.json({ success: false, error: "no images provided" }, { status: 400 })
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(`${ML_SERVER_URL}/analyze_multi`, {
      method: "POST",
      body: upstream,
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t))
    const json = await res.json()
    if (!json.success) {
      return NextResponse.json(json, { status: 502 })
    }
    return NextResponse.json({
      success: true,
      analysis: {
        anglesAnalyzed: json.angles_analyzed,
        agreement: json.agreement,
        skinType: json.skin_type,
        skinAge: json.skin_age,
        concerns: json.concerns,
        regions: json.regions,
        severityAlerts: json.severity_alerts,
        ingredientPriority: json.ingredient_priority,
        lesionCount: json.lesion_count,
        overallScore: json.overall_score,
        heatmap: json.heatmap,
        heatmapLegend: json.heatmap_legend,
        recommendations: json.recommendations,
        routine: json.routine,
        diet: json.diet,
        lifestyle: json.lifestyle,
        validation: json.validation,
        version: json.version,
        perAngle: json.per_angle,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "proxy error" }, { status: 500 })
  }
}
