// Generates a polished PDF skin report from an AnalysisResult.
// Uses jsPDF programmatic drawing — no html2canvas, no rasterized text — so output stays crisp.
// jsPDF is dynamically imported so SSR doesn't resolve its node entry.

type JsPdfCtor = typeof import("jspdf").jsPDF
let _jsPDF: JsPdfCtor | null = null
async function getJsPDF(): Promise<JsPdfCtor> {
  if (_jsPDF) return _jsPDF
  // Import the ES/browser dist directly. The package root would resolve to
  // jspdf.node.* during Next.js SSR analysis and pull in fflate's worker code,
  // breaking the build. The dist path is safe and webpack/turbopack-friendly.
  const mod: any = await import("jspdf/dist/jspdf.es.min.js")
  const ctor = mod.jsPDF || mod.default
  if (!ctor) throw new Error("jsPDF constructor not found in module exports")
  _jsPDF = ctor as JsPdfCtor
  return _jsPDF
}
type Doc = InstanceType<JsPdfCtor>

type Concerns = Record<string, number>

type RoutineStep = string | { step?: string; product?: string; why?: string }

export interface PdfReportInput {
  overallScore?: number
  skinType?: { label?: string; confidence?: number }
  skinAge?: { estimate?: number; band?: string }
  lesionCount?: number
  anglesAnalyzed?: number
  agreement?: number
  version?: string
  concerns?: Concerns
  recommendations?: { concern?: string; level?: string; tip?: string; ingredients?: string[] }[]
  ingredientPriority?: { ingredient?: string; helps?: string[] }[]
  // Accept both the rich object form AND the plain `string[]` form returned by the API.
  routine?: Record<string, RoutineStep[] | undefined> | {
    morning?: RoutineStep[]
    evening?: RoutineStep[]
    weekly?: RoutineStep[]
  }
  diet?: string[]
  lifestyle?: string[]
  severityAlerts?: { concern?: string; level?: string; message?: string }[]
  heatmap?: string  // data URL (optional)
}

// Normalize a routine entry that may be a plain string OR an object into the
// renderable shape used internally by the PDF.
function normalizeSteps(steps: RoutineStep[] | undefined | null): { step: string; product: string; why?: string }[] {
  if (!Array.isArray(steps)) return []
  return steps
    .map((s): { step: string; product: string; why?: string } | null => {
      if (s == null) return null
      if (typeof s === "string") {
        const txt = s.trim()
        if (!txt) return null
        // Try to split "Step name — product / why" patterns gracefully.
        const m = txt.match(/^(.+?)\s*[—:\-]\s*(.+)$/)
        if (m) return { step: m[1].trim(), product: m[2].trim() }
        return { step: txt, product: "" }
      }
      const step = (s.step || "").toString().trim()
      const product = (s.product || "").toString().trim()
      const why = s.why ? s.why.toString().trim() : undefined
      if (!step && !product) return null
      return { step: step || product, product: step ? product : "", why }
    })
    .filter(Boolean) as { step: string; product: string; why?: string }[]
}

function safeText(v: unknown, fallback = ""): string {
  if (v == null) return fallback
  const s = String(v)
  return s.length ? s : fallback
}

const BRAND = {
  primary: [37, 99, 235] as [number, number, number],     // blue-600
  secondary: [13, 148, 136] as [number, number, number],  // teal-600
  ink: [15, 23, 42] as [number, number, number],          // slate-900
  body: [51, 65, 85] as [number, number, number],         // slate-700
  mute: [100, 116, 139] as [number, number, number],      // slate-500
  line: [226, 232, 240] as [number, number, number],      // slate-200
  bgSoft: [248, 250, 252] as [number, number, number],    // slate-50
  ok: [16, 185, 129] as [number, number, number],         // emerald-500
  warn: [245, 158, 11] as [number, number, number],       // amber-500
  bad: [244, 63, 94] as [number, number, number],         // rose-500
}

const PAGE = { w: 210, h: 297, m: 16 } // A4 mm

function pretty(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function scoreColor(v: number): [number, number, number] {
  if (v >= 75) return BRAND.ok
  if (v >= 60) return [34, 197, 94]
  if (v >= 45) return BRAND.warn
  return BRAND.bad
}

function severityColor(level: string): [number, number, number] {
  return level === "high" ? BRAND.bad : level === "medium" ? BRAND.warn : [59, 130, 246]
}

function setRgb(doc: Doc, fn: "setFillColor" | "setDrawColor" | "setTextColor", c: [number, number, number]) {
  ;(doc as any)[fn](c[0], c[1], c[2])
}

// ─── reusable footer + header ───
function addPageFrame(doc: Doc, page: number, total: number, generatedAt: string) {
  // top brand bar
  setRgb(doc, "setFillColor", BRAND.primary)
  doc.rect(0, 0, PAGE.w, 6, "F")
  setRgb(doc, "setFillColor", BRAND.secondary)
  doc.rect(0, 6, PAGE.w, 1.2, "F")

  // footer
  setRgb(doc, "setDrawColor", BRAND.line)
  doc.setLineWidth(0.2)
  doc.line(PAGE.m, PAGE.h - 12, PAGE.w - PAGE.m, PAGE.h - 12)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  setRgb(doc, "setTextColor", BRAND.mute)
  doc.text("SkinInsight AI · skin-score.app", PAGE.m, PAGE.h - 7)
  doc.text(generatedAt, PAGE.w / 2, PAGE.h - 7, { align: "center" })
  doc.text(`Page ${page} / ${total}`, PAGE.w - PAGE.m, PAGE.h - 7, { align: "right" })

  // medical disclaimer
  doc.setFontSize(7)
  doc.text(
    "Informational only · not a medical diagnosis · consult a dermatologist for clinical concerns",
    PAGE.w / 2,
    PAGE.h - 3,
    { align: "center" }
  )
}

// ─── primitive: rounded chip ───
function chip(doc: Doc, x: number, y: number, label: string, color: [number, number, number]) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  const tw = doc.getTextWidth(label) + 6
  setRgb(doc, "setFillColor", [color[0], color[1], color[2]])
  doc.roundedRect(x, y - 3.4, tw, 5, 1.5, 1.5, "F")
  setRgb(doc, "setTextColor", [255, 255, 255])
  doc.text(label, x + tw / 2, y, { align: "center" })
  return tw
}

// ─── primitive: progress bar ───
function progressBar(doc: Doc, x: number, y: number, w: number, value: number, color: [number, number, number]) {
  setRgb(doc, "setFillColor", BRAND.line)
  doc.roundedRect(x, y, w, 2.2, 1, 1, "F")
  const fillW = Math.max(0.5, Math.min(100, value) / 100 * w)
  setRgb(doc, "setFillColor", color)
  doc.roundedRect(x, y, fillW, 2.2, 1, 1, "F")
}

// ─── primitive: section header ───
function sectionHeader(doc: Doc, y: number, title: string, subtitle?: string) {
  setRgb(doc, "setFillColor", BRAND.primary)
  doc.roundedRect(PAGE.m, y - 4.5, 1.2, 5.5, 0.6, 0.6, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  setRgb(doc, "setTextColor", BRAND.ink)
  doc.text(title, PAGE.m + 4, y)

  if (subtitle) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    setRgb(doc, "setTextColor", BRAND.mute)
    doc.text(subtitle, PAGE.m + 4, y + 4.5)
    return y + 10
  }
  return y + 6.5
}

// ─── primitive: large score ring ───
function scoreRing(doc: Doc, cx: number, cy: number, r: number, score: number) {
  const color = scoreColor(score)
  // outer track
  setRgb(doc, "setDrawColor", BRAND.line)
  doc.setLineWidth(3.2)
  doc.circle(cx, cy, r, "S")

  // arc approximation using bezier-like polyline (jsPDF has no arc — use line segments)
  const pct = Math.max(0, Math.min(100, score)) / 100
  const segs = Math.max(8, Math.round(64 * pct))
  setRgb(doc, "setDrawColor", color)
  doc.setLineWidth(3.2)
  // start at top (12 o'clock), go clockwise
  let prevX = cx
  let prevY = cy - r
  for (let i = 1; i <= segs; i++) {
    const t = (i / 64) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(t) * r
    const y = cy + Math.sin(t) * r
    doc.line(prevX, prevY, x, y)
    prevX = x; prevY = y
  }

  // big score number
  doc.setFont("helvetica", "bold")
  doc.setFontSize(34)
  setRgb(doc, "setTextColor", BRAND.ink)
  doc.text(String(Math.round(score)), cx, cy + 1, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  setRgb(doc, "setTextColor", BRAND.mute)
  doc.text("/ 100", cx, cy + 6, { align: "center" })
}

function verdict(score: number) {
  if (score >= 85) return "Excellent · keep maintaining"
  if (score >= 70) return "Good · small improvements ahead"
  if (score >= 55) return "Fair · clear targets to focus on"
  if (score >= 40) return "Needs attention · consistent routine recommended"
  return "Action needed · prioritize the focus areas"
}

// ─── helper: ensure space, add new page if not enough ───
function ensure(state: { doc: Doc; y: number; page: number }, need: number) {
  if (state.y + need > PAGE.h - 18) {
    state.doc.addPage()
    state.page++
    state.y = 18
  }
}

// ─── exported: build & download ───
export async function buildSkinReportPdf(r: PdfReportInput, opts?: { open?: boolean }) {
  const JsPDF = await getJsPDF()
  const doc: Doc = new JsPDF({ unit: "mm", format: "a4", compress: true })
  const generatedAt = new Date().toLocaleString(undefined, {
    dateStyle: "medium", timeStyle: "short",
  })

  // ╔════════ PAGE 1 — cover + summary ════════╗
  // brand bar
  setRgb(doc, "setFillColor", BRAND.primary)
  doc.rect(0, 0, PAGE.w, 6, "F")
  setRgb(doc, "setFillColor", BRAND.secondary)
  doc.rect(0, 6, PAGE.w, 1.2, "F")

  // header logo block
  let y = 22
  setRgb(doc, "setFillColor", BRAND.primary)
  doc.roundedRect(PAGE.m, y - 6, 9, 9, 2, 2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  setRgb(doc, "setTextColor", [255, 255, 255])
  doc.text("S", PAGE.m + 4.5, y - 0.4, { align: "center" })

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  setRgb(doc, "setTextColor", BRAND.ink)
  doc.text("SkinInsight AI", PAGE.m + 12, y - 1.5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  setRgb(doc, "setTextColor", BRAND.mute)
  doc.text("Personal skin analysis report", PAGE.m + 12, y + 3)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  setRgb(doc, "setTextColor", BRAND.mute)
  doc.text(generatedAt, PAGE.w - PAGE.m, y - 1.5, { align: "right" })
  if (r.version) {
    doc.text(`Model v${r.version}`, PAGE.w - PAGE.m, y + 3, { align: "right" })
  }

  // separator
  y += 8
  setRgb(doc, "setDrawColor", BRAND.line)
  doc.setLineWidth(0.3)
  doc.line(PAGE.m, y, PAGE.w - PAGE.m, y)

  // ── Hero score panel ──
  y += 8
  setRgb(doc, "setFillColor", BRAND.bgSoft)
  doc.roundedRect(PAGE.m, y, PAGE.w - PAGE.m * 2, 64, 3, 3, "F")

  const safeScore = Math.max(0, Math.min(100, Number(r.overallScore) || 0))
  scoreRing(doc, PAGE.m + 28, y + 32, 22, safeScore)

  // verdict + skin type
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  setRgb(doc, "setTextColor", BRAND.ink)
  doc.text(`${r.skinType?.label ? pretty(r.skinType.label) : "Your"} skin`, PAGE.m + 58, y + 16)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  setRgb(doc, "setTextColor", BRAND.body)
  doc.text(verdict(safeScore), PAGE.m + 58, y + 22)

  // mini stat tiles inside panel
  const tile = (idx: number, label: string, value: string, sub: string) => {
    const tw = (PAGE.w - PAGE.m * 2 - 60) / 2 - 4
    const tx = PAGE.m + 58 + (idx % 2) * (tw + 4)
    const ty = y + 28 + Math.floor(idx / 2) * 16
    setRgb(doc, "setFillColor", [255, 255, 255])
    setRgb(doc, "setDrawColor", BRAND.line)
    doc.setLineWidth(0.2)
    doc.roundedRect(tx, ty, tw, 13, 2, 2, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    setRgb(doc, "setTextColor", BRAND.mute)
    doc.text(label.toUpperCase(), tx + 3, ty + 4)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    setRgb(doc, "setTextColor", BRAND.ink)
    doc.text(value, tx + 3, ty + 9)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    setRgb(doc, "setTextColor", BRAND.mute)
    doc.text(sub, tx + 3, ty + 11.8)
  }

  const stLabel = r.skinType?.label ? pretty(r.skinType.label) : "Unknown"
  const stConf = Math.round(((r.skinType?.confidence ?? 0)) * 100)
  const angles = r.anglesAnalyzed ?? 1
  tile(0, "Skin type", stLabel, `${stConf}% confidence`)
  if (r.skinAge?.estimate) tile(1, "Skin age", `~${r.skinAge.estimate}`, r.skinAge.band || "")
  else tile(1, "Angles", String(angles), "ensemble scan")
  tile(2, "Spots found", String(r.lesionCount ?? 0), `${angles} angle${angles > 1 ? "s" : ""}`)
  tile(3, "Agreement", `${Math.round((r.agreement || 0) * 100)}%`, "cross-angle consistency")

  y += 70

  // ── Concern severity overview ──
  y = sectionHeader(doc, y + 4, "Concern severity", "Lower = healthier · higher = more attention")
  const concerns = (r.concerns && typeof r.concerns === "object") ? r.concerns : {}
  const concernEntries = Object.entries(concerns).filter(([k]) => k !== "hydration" && k !== "evenness")
    .sort((a, b) => b[1] - a[1])

  for (const [k, v] of concernEntries.slice(0, 8)) {
    if (y > PAGE.h - 30) break
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9.5)
    setRgb(doc, "setTextColor", BRAND.ink)
    doc.text(pretty(k), PAGE.m, y)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    setRgb(doc, "setTextColor", BRAND.mute)
    const val = `${Math.round(v)}/100`
    doc.text(val, PAGE.w - PAGE.m, y, { align: "right" })

    progressBar(doc, PAGE.m, y + 1.5, PAGE.w - PAGE.m * 2, v, scoreColor(100 - v))
    y += 7.5
  }

  const state = { doc, y, page: 1 }

  // ╔════════ PAGE 2 — alerts + recommendations + ingredients ════════╗
  doc.addPage()
  state.page = 2
  state.y = 18

  // severity alerts
  if (Array.isArray(r.severityAlerts) && r.severityAlerts.length > 0) {
    state.y = sectionHeader(doc, state.y, "Priority alerts", "Address these first")
    for (const a of r.severityAlerts) {
      if (!a) continue
      const level = safeText(a.level, "medium")
      const concern = a.concern ? pretty(a.concern) : "General"
      const message = safeText(a.message, "—")
      ensure(state, 16)
      const sc = severityColor(level)
      setRgb(doc, "setFillColor", [sc[0], sc[1], sc[2]])
      doc.roundedRect(PAGE.m, state.y - 3, 1.4, 12, 0.7, 0.7, "F")

      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      setRgb(doc, "setTextColor", BRAND.ink)
      doc.text(`${concern} · ${level} priority`, PAGE.m + 4, state.y)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      setRgb(doc, "setTextColor", BRAND.body)
      const msg = doc.splitTextToSize(message, PAGE.w - PAGE.m * 2 - 6)
      doc.text(msg, PAGE.m + 4, state.y + 4.5)
      state.y += 4.5 + msg.length * 4 + 4
    }
    state.y += 3
  }

  // recommendations
  if (Array.isArray(r.recommendations) && r.recommendations.length > 0) {
    ensure(state, 14)
    state.y = sectionHeader(doc, state.y, "Top recommendations", "Action plan ranked by your scan")
    let idx = 1
    for (const rec of r.recommendations.slice(0, 6)) {
      if (!rec) continue
      const level = safeText(rec.level, "medium").toLowerCase()
      const concern = rec.concern ? pretty(rec.concern) : "General"
      const tip = safeText(rec.tip, "—")
      const ingArr = Array.isArray(rec.ingredients) ? rec.ingredients.filter(Boolean) : []
      const tipLines = doc.splitTextToSize(tip, PAGE.w - PAGE.m * 2 - 12)
      const ingLines = ingArr.length
        ? doc.splitTextToSize(`Use: ${ingArr.join(", ")}`, PAGE.w - PAGE.m * 2 - 12)
        : []
      const blockH = 9 + tipLines.length * 4 + (ingLines.length ? ingLines.length * 3.5 + 2 : 0) + 5
      ensure(state, blockH)

      // numbered chip
      const sc = severityColor(level)
      setRgb(doc, "setFillColor", [sc[0], sc[1], sc[2]])
      doc.circle(PAGE.m + 3.5, state.y, 3.5, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      setRgb(doc, "setTextColor", [255, 255, 255])
      doc.text(String(idx), PAGE.m + 3.5, state.y + 1.2, { align: "center" })

      doc.setFont("helvetica", "bold")
      doc.setFontSize(10.5)
      setRgb(doc, "setTextColor", BRAND.ink)
      doc.text(concern, PAGE.m + 9, state.y + 1.2)

      // priority chip
      chip(doc, PAGE.w - PAGE.m - 22, state.y + 1, `${level.toUpperCase()} PRIORITY`, sc)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9.5)
      setRgb(doc, "setTextColor", BRAND.body)
      doc.text(tipLines, PAGE.m + 9, state.y + 6.5)

      let cy = state.y + 6.5 + tipLines.length * 4
      if (ingLines.length) {
        cy += 1.5
        doc.setFont("helvetica", "italic")
        doc.setFontSize(8.5)
        setRgb(doc, "setTextColor", BRAND.secondary)
        doc.text(ingLines, PAGE.m + 9, cy)
        cy += ingLines.length * 3.5
      }

      state.y = cy + 4.5
      idx++
    }
  }

  // ingredients
  if (Array.isArray(r.ingredientPriority) && r.ingredientPriority.length > 0) {
    ensure(state, 18)
    state.y = sectionHeader(doc, state.y + 2, "Ingredient priority", "Look for these on product labels")
    const cols = 2
    const colW = (PAGE.w - PAGE.m * 2 - 4) / cols
    let col = 0
    let rowY = state.y
    for (let i = 0; i < r.ingredientPriority.length; i++) {
      const ip = r.ingredientPriority[i]
      if (!ip) continue
      const helpsArr = Array.isArray(ip.helps) ? ip.helps.filter(Boolean) : []
      const helps = helpsArr.length ? helpsArr.map(h => String(h).replace(/_/g, " ")).join(", ") : "general care"
      const ingName = safeText(ip.ingredient, "Ingredient")
      const helpsLines = doc.splitTextToSize(helps, colW - 14)
      const cardH = 12 + helpsLines.length * 3.5
      if (col === 0) ensure(state, cardH + 2)

      const cx = PAGE.m + col * (colW + 4)
      setRgb(doc, "setFillColor", BRAND.bgSoft)
      doc.roundedRect(cx, rowY, colW, cardH, 2, 2, "F")
      // rank
      setRgb(doc, "setFillColor", i === 0 ? BRAND.ok : BRAND.secondary)
      doc.roundedRect(cx + 3, rowY + 3, 7, 7, 1.4, 1.4, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      setRgb(doc, "setTextColor", [255, 255, 255])
      doc.text(String(i + 1), cx + 6.5, rowY + 8, { align: "center" })

      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      setRgb(doc, "setTextColor", BRAND.ink)
      doc.text(ingName, cx + 13, rowY + 7.5)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      setRgb(doc, "setTextColor", BRAND.mute)
      doc.text("HELPS WITH", cx + 13, rowY + 11.5)
      doc.setFontSize(8.5)
      setRgb(doc, "setTextColor", BRAND.body)
      doc.text(helpsLines, cx + 13, rowY + 14.5)

      col++
      if (col >= cols) { col = 0; rowY = state.y = state.y + cardH + 3 }
    }
    if (col !== 0) state.y = rowY + 18
  }

  // ╔════════ PAGE 3 — routine + tips ════════╗
  // Normalize routine arrays once — accepts both string[] and object[] shapes.
  const routineRaw: any = r.routine || {}
  const morningSteps = normalizeSteps(routineRaw.morning)
  const eveningSteps = normalizeSteps(routineRaw.evening)
  const weeklySteps = normalizeSteps(routineRaw.weekly)
  const dietArr = Array.isArray(r.diet) ? r.diet.filter(Boolean) : []
  const lifestyleArr = Array.isArray(r.lifestyle) ? r.lifestyle.filter(Boolean) : []
  const hasRoutine = morningSteps.length || eveningSteps.length || weeklySteps.length
  const hasTips = dietArr.length || lifestyleArr.length

  if (hasRoutine || hasTips) {
    doc.addPage()
    state.page = 3
    state.y = 18
  }

  if (hasRoutine) {
    state.y = sectionHeader(doc, state.y, "Your skincare day", "Steps in order · use as a daily checklist")

    const drawRoutine = (title: string, steps: { step: string; product: string; why?: string }[], color: [number, number, number]) => {
      if (!steps || steps.length === 0) return
      ensure(state, 12)
      setRgb(doc, "setFillColor", color)
      doc.roundedRect(PAGE.m, state.y - 3, 25, 6, 2, 2, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8.5)
      setRgb(doc, "setTextColor", [255, 255, 255])
      doc.text(title.toUpperCase(), PAGE.m + 12.5, state.y + 1, { align: "center" })
      state.y += 7

      let n = 1
      for (const s of steps) {
        const stepLabel = safeText(s.step, "Step")
        const productLabel = safeText(s.product, "")
        const why = s.why ? doc.splitTextToSize(safeText(s.why), PAGE.w - PAGE.m * 2 - 12) : []
        const blockH = 8 + why.length * 3.5
        ensure(state, blockH + 3)

        setRgb(doc, "setDrawColor", BRAND.line)
        setRgb(doc, "setFillColor", [255, 255, 255])
        doc.setLineWidth(0.2)
        doc.roundedRect(PAGE.m, state.y - 1, PAGE.w - PAGE.m * 2, blockH, 2, 2, "FD")

        setRgb(doc, "setFillColor", color)
        doc.circle(PAGE.m + 5, state.y + 3, 2.8, "F")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8)
        setRgb(doc, "setTextColor", [255, 255, 255])
        doc.text(String(n), PAGE.m + 5, state.y + 4, { align: "center" })

        doc.setFont("helvetica", "bold")
        doc.setFontSize(9.5)
        setRgb(doc, "setTextColor", BRAND.ink)
        doc.text(stepLabel, PAGE.m + 10, state.y + 3)

        if (productLabel) {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(9)
          setRgb(doc, "setTextColor", BRAND.body)
          doc.text(productLabel, PAGE.m + 10, state.y + 7.2)
        }

        if (why.length) {
          doc.setFont("helvetica", "italic")
          doc.setFontSize(8)
          setRgb(doc, "setTextColor", BRAND.mute)
          doc.text(why, PAGE.m + 10, state.y + 11)
        }

        state.y += blockH + 2
        n++
      }
      state.y += 3
    }
    drawRoutine("AM Routine", morningSteps, BRAND.warn)
    drawRoutine("PM Routine", eveningSteps, [99, 102, 241])
    if (weeklySteps.length) drawRoutine("Weekly", weeklySteps, BRAND.secondary)
  }

  // diet + lifestyle two columns
  if (hasTips) {
    ensure(state, 14)
    state.y = sectionHeader(doc, state.y, "Diet & lifestyle", "Daily habits that move the needle")

    const colW = (PAGE.w - PAGE.m * 2 - 4) / 2

    const drawList = (x: number, title: string, items: string[], color: [number, number, number]) => {
      let cy = state.y
      setRgb(doc, "setFillColor", [color[0], color[1], color[2]])
      doc.roundedRect(x, cy - 3, colW, 6, 2, 2, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8.5)
      setRgb(doc, "setTextColor", [255, 255, 255])
      doc.text(title.toUpperCase(), x + colW / 2, cy + 1, { align: "center" })
      cy += 8

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      setRgb(doc, "setTextColor", BRAND.body)
      for (const t of items) {
        const lines = doc.splitTextToSize(`•  ${safeText(t)}`, colW - 4)
        if (cy + lines.length * 4 > PAGE.h - 18) break
        doc.text(lines, x + 2, cy)
        cy += lines.length * 4 + 1.5
      }
      return cy
    }

    const yL = dietArr.length ? drawList(PAGE.m, "Diet tips", dietArr, BRAND.bad) : state.y
    const yR = lifestyleArr.length ? drawList(PAGE.m + colW + 4, "Lifestyle tips", lifestyleArr, BRAND.primary) : state.y
    state.y = Math.max(yL, yR) + 4
  }

  // ── frame all pages ──
  const total = (doc as any).internal.pages.length - 1
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    addPageFrame(doc, p, total, generatedAt)
  }

  const filename = `skin-report-${new Date().toISOString().slice(0, 10)}.pdf`
  // Use blob output + manual anchor click — this avoids jsPDF's internal `save()`
  // which sometimes fails silently inside iframes / strict CSP environments.
  try {
    const blob: Blob = doc.output("blob") as any
    const url = URL.createObjectURL(blob)
    if (opts?.open) {
      window.open(url, "_blank")
    } else {
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    // Last-resort fallback: jsPDF's built-in save
    try { doc.save(filename) } catch { throw e }
  }
}
