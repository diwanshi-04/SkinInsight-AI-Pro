import { NextRequest, NextResponse } from "next/server"

/**
 * AI Coach chat route — talks to Groq's Llama 3.3 70B Versatile model.
 * Falls back to the rule-based ML server reply if no Groq key is configured
 * or if Groq returns an error.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || ""
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const ML_SERVER_URL = process.env.ML_SERVER_URL || "http://127.0.0.1:5001"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SYSTEM_PROMPT = `You are SkinInsight AI Coach — a calm, evidence-based dermatology assistant inside the SkinInsight AI app.

Your job is to help the user understand their skin scan, build simple routines, recommend ingredients/products, and give safe daily-care advice.

Voice & style
- Warm, confident, friendly. Short sentences. Plain English. No medical jargon unless you immediately explain it.
- Format with short markdown: tiny bold headers ("**AM**", "**PM**"), 3-6 bullet points max, line breaks for breathing room.
- Keep replies under 180 words unless the user explicitly asks for "more detail" or a "full routine".
- Never start with "Sure!", "Of course!", or "As an AI". Just answer.
- When recommending products, suggest categories + key ingredients first; mention specific affordable products (Minimalist, The Ordinary, CeraVe, Cetaphil, La Roche-Posay) when helpful.
- For Indian users, prefer Minimalist / Plum / Dot & Key / Re'equil where they fit.

Safety
- You are NOT a doctor. For severe acne, suspected skin disease, persistent rashes, painful or rapidly changing spots → tell the user to see a dermatologist. Be kind but clear.
- Never diagnose disease from text. Refer to scan results when available.
- Never recommend prescription-only retinoids (tretinoin, isotretinoin) without saying "ask a dermatologist".

Use the user's scan context (if provided) to personalise every answer — refer to their skin type, top concerns, and overall score naturally.`

interface AnalysisCtx {
  skin_type?: { label?: string; confidence?: number }
  concerns?: Record<string, number>
  overall_score?: number
  skin_age?: { estimate?: number; band?: string }
}

function buildContextBlock(a: AnalysisCtx | null | undefined): string {
  if (!a || typeof a !== "object") return ""
  const parts: string[] = []
  if (a.skin_type?.label) {
    const conf = a.skin_type.confidence ? ` (${Math.round((a.skin_type.confidence || 0) * 100)}% confidence)` : ""
    parts.push(`Skin type: **${a.skin_type.label}**${conf}`)
  }
  if (typeof a.overall_score === "number") {
    parts.push(`Overall skin score: **${Math.round(a.overall_score)}/100**`)
  }
  if (a.skin_age?.estimate) {
    parts.push(`Estimated skin age: ~${a.skin_age.estimate}${a.skin_age.band ? ` (${a.skin_age.band})` : ""}`)
  }
  if (a.concerns && typeof a.concerns === "object") {
    const top = Object.entries(a.concerns)
      .filter(([k]) => k !== "hydration" && k !== "evenness")
      .sort((x, y) => (y[1] as number) - (x[1] as number))
      .slice(0, 4)
      .map(([k, v]) => `${k.replace(/_/g, " ")} ${Math.round(v as number)}/100`)
    if (top.length) parts.push(`Top concerns: ${top.join(", ")}`)
    const hyd = a.concerns.hydration
    const ev = a.concerns.evenness
    if (typeof hyd === "number") parts.push(`Hydration: ${Math.round(hyd)}/100`)
    if (typeof ev === "number") parts.push(`Tone evenness: ${Math.round(ev)}/100`)
  }
  if (!parts.length) return ""
  return `\n\n---\nUser's most recent scan:\n${parts.map((p) => `- ${p}`).join("\n")}\n---\n`
}

function sseChunk(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`
}

async function fallbackToMlServer(body: any): Promise<Response> {
  try {
    const upstream = await fetch(`${ML_SERVER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: body.message,
        last_analysis: body.lastAnalysis ?? body.last_analysis ?? null,
        history: body.history || [],
        stream: body.stream !== false,
      }),
    })
    if (body.stream === false) {
      const j = await upstream.json()
      return NextResponse.json(j)
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "no upstream" }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}
  const message = (body?.message || "").toString().trim()
  if (!message) {
    return NextResponse.json({ success: false, error: "empty message" }, { status: 400 })
  }

  // No Groq key → forward to Python ML server (legacy rule-based)
  if (!GROQ_API_KEY) {
    return fallbackToMlServer(body)
  }

  const lastAnalysis: AnalysisCtx | null = body?.lastAnalysis ?? body?.last_analysis ?? null
  const rawHistory = Array.isArray(body?.history) ? body.history : []
  const history = rawHistory
    .slice(-10)
    .map((m: any) => ({
      role: String(m?.role || "").toLowerCase(),
      content: String(m?.text || m?.content || "").slice(0, 4000),
    }))
    .filter((m: any) => (m.role === "user" || m.role === "assistant") && m.content)

  const ctxBlock = buildContextBlock(lastAnalysis)
  const systemContent = SYSTEM_PROMPT + ctxBlock

  const messages = [
    { role: "system", content: systemContent },
    ...history,
    { role: "user", content: message },
  ]

  const wantsStream = body?.stream !== false

  // Call Groq
  let groqRes: Response
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: 700,
        stream: wantsStream,
      }),
    })
  } catch (e: any) {
    return fallbackToMlServer(body)
  }

  if (!groqRes.ok || !groqRes.body) {
    let errText = ""
    try { errText = await groqRes.text() } catch {}
    console.warn("[chat] Groq error", groqRes.status, errText.slice(0, 300))
    return fallbackToMlServer(body)
  }

  if (!wantsStream) {
    const j = await groqRes.json().catch(() => null) as any
    const reply = j?.choices?.[0]?.message?.content || ""
    return NextResponse.json({ success: true, reply })
  }

  // Translate Groq's OpenAI-style SSE into our { delta } / { done } protocol
  const reader = groqRes.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = ""
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""
          for (const raw of lines) {
            const line = raw.trim()
            if (!line.startsWith("data:")) continue
            const payload = line.slice(5).trim()
            if (!payload || payload === "[DONE]") continue
            try {
              const obj = JSON.parse(payload)
              const delta = obj?.choices?.[0]?.delta?.content
              if (delta) controller.enqueue(encoder.encode(sseChunk({ delta })))
            } catch { /* ignore partial JSON */ }
          }
        }
        controller.enqueue(encoder.encode(sseChunk({ done: true })))
      } catch {
        controller.enqueue(encoder.encode(sseChunk({ delta: "\n\n_(connection interrupted)_" })))
        controller.enqueue(encoder.encode(sseChunk({ done: true })))
      } finally {
        controller.close()
      }
    },
    cancel() {
      try { reader.cancel() } catch {}
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
