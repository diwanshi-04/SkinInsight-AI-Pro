"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Camera, Upload, CheckCircle2, Loader2, RefreshCw, Sparkles, Activity, Sun, Droplets, Flame, Wind, Eye, Heart, Layers, Zap, ShieldCheck,
  Image as ImageIcon, ScanFace, AlertTriangle, TrendingUp, Pill, MapPin, Share2, Download, Moon, Circle, ArrowLeft, ArrowRight,
  ChevronRight, Info, Target, Award, Bookmark, Clock, Filter, MessageCircle, ArrowUpRight, Calendar, FileText, FileJson,
} from "lucide-react"
import { buildSkinReportPdf } from "@/lib/pdf-report"
const ANGLES = [
  { id: "front", label: "Front", hint: "Look straight at the camera" },
  { id: "left", label: "Left", hint: "Slowly turn your head to your LEFT" },
  { id: "right", label: "Right", hint: "Slowly turn your head to your RIGHT" },
] as const
type AngleId = typeof ANGLES[number]["id"]

interface Region { oiliness: number; redness: number; spots: number; coverage: number }
interface AnalysisResult {
  anglesAnalyzed: number; agreement: number
  skinType: { label: string; confidence: number; scores: Record<string, number> }
  skinAge?: { estimate: number; band: string }
  concerns: Record<string, number>
  regions?: Record<string, Region>
  severityAlerts?: Array<{ level: string; concern: string; message: string }>
  ingredientPriority?: Array<{ ingredient: string; helps: string[]; score: number }>
  lesionCount: number; overallScore: number
  heatmap?: string; heatmapLegend?: Record<string, string>
  recommendations?: Array<{ concern: string; severity: number; level: string; tip: string; ingredients?: string[] }>
  routine?: Record<string, string[]>
  diet?: string[]; lifestyle?: string[]
  perAngle?: Array<{ label: string; confidence: number; overall: number }>
  version?: string
}

const CONCERN_META: Record<string, { icon: any; label: string; positive?: boolean; color: string }> = {
  acne: { icon: Activity, label: "Acne", color: "#ef4444" },
  pigmentation: { icon: Sun, label: "Pigmentation", color: "#a855f7" },
  redness: { icon: Flame, label: "Redness", color: "#f97316" },
  oiliness: { icon: Droplets, label: "Oiliness", color: "#eab308" },
  dryness: { icon: Wind, label: "Dryness", color: "#06b6d4" },
  pores: { icon: Eye, label: "Pores", color: "#64748b" },
  wrinkles: { icon: Layers, label: "Wrinkles", color: "#8b5cf6" },
  dullness: { icon: Zap, label: "Dullness", color: "#94a3b8" },
  dark_circles: { icon: Moon, label: "Dark circles", color: "#6366f1" },
  blackheads: { icon: Circle, label: "Blackheads", color: "#475569" },
  hydration: { icon: Heart, label: "Hydration", positive: true, color: "#10b981" },
  evenness: { icon: ShieldCheck, label: "Tone Evenness", positive: true, color: "#10b981" },
}
const REGION_LABELS: Record<string, string> = {
  forehead: "Forehead", left_cheek: "Left cheek", right_cheek: "Right cheek", nose: "Nose / T-zone", chin: "Chin",
}

const CONCERN_INFO: Record<string, { what: string; quickAction: string }> = {
  acne: { what: "Inflamed pores from oil, bacteria & dead skin.", quickAction: "Use a 2% salicylic acid wash 3×/week." },
  pigmentation: { what: "Dark spots from sun, hormones or old breakouts.", quickAction: "Daily SPF 50 + Vitamin C in the morning." },
  redness: { what: "Visible irritation from a compromised barrier.", quickAction: "Switch to fragrance-free, calming products with cica." },
  oiliness: { what: "Excess sebum production on the T-zone.", quickAction: "Use niacinamide serum & blot, don't over-wash." },
  dryness: { what: "Skin lacks oil; can feel tight or flaky.", quickAction: "Layer hyaluronic acid then a ceramide cream." },
  pores: { what: "Enlarged openings, often paired with oil.", quickAction: "Try a BHA exfoliant 2×/week and retinoid at night." },
  wrinkles: { what: "Loss of collagen — fine lines and creases.", quickAction: "Nightly retinoid + daily SPF prevent more damage." },
  dullness: { what: "Buildup of dead cells reducing glow.", quickAction: "Gentle AHA exfoliation + Vitamin C serum." },
  dark_circles: { what: "Pigment, vessels or shadow under the eyes.", quickAction: "Caffeine + peptide eye cream and proper sleep." },
  blackheads: { what: "Oxidized clogged pores on nose/chin.", quickAction: "Salicylic acid + clay mask once a week." },
  hydration: { what: "Water content of your skin.", quickAction: "Drink water and use humectants like glycerin daily." },
  evenness: { what: "Uniformity of your skin tone.", quickAction: "Vitamin C + SPF improves tone over weeks." },
}

function severityClass(score: number, positive = false) {
  const v = positive ? 100 - score : score
  if (v >= 70) return "bg-red-500"
  if (v >= 50) return "bg-orange-500"
  if (v >= 30) return "bg-yellow-500"
  return "bg-emerald-500"
}
function severityText(level: string) {
  return ({ high: "text-red-600 bg-red-50 border-red-200", medium: "text-amber-700 bg-amber-50 border-amber-200", low: "text-blue-700 bg-blue-50 border-blue-200" } as any)[level] || "text-muted-foreground"
}

function pushHistoryEntry(result: AnalysisResult) {
  if (typeof window === "undefined") return
  try {
    const key = "skinpro:history"
    const raw = localStorage.getItem(key)
    const arr: any[] = raw ? JSON.parse(raw) : []
    arr.push({ ts: Date.now(), date: new Date().toISOString().slice(0, 10), overall: result.overallScore, skinType: result.skinType.label, concerns: result.concerns, heatmap: result.heatmap })
    localStorage.setItem(key, JSON.stringify(arr.slice(-180)))
    localStorage.setItem("skinpro:lastAnalysis", JSON.stringify(result))
    window.dispatchEvent(new Event("skinpro:history-updated"))
    window.dispatchEvent(new CustomEvent("skinpro:analysis", { detail: result }))
  } catch {}
}

interface LiveMetrics {
  facePresent: boolean; centered: boolean; brightness: number; faceCoverage: number
  faceBox?: { x: number; y: number; w: number; h: number } // normalized 0-1, in raw video coords
  landmarks?: { x: number; y: number }[]   // 468 normalized landmarks (when MediaPipe is ready)
  yaw?: number       // degrees, +left / -right (user's perspective)
  pitch?: number     // degrees, +up / -down
  roll?: number      // degrees
  expression?: { smile: number; blink: number; mouthOpen: number; browUp: number } // 0-1 each
  spots: { x: number; y: number; r: number; type: "acne" | "shine" | "dark" | "darkcircle"; confident?: boolean }[]
  counts: { acne: number; darkcircle: number; shine: number; dark: number }
  motion: number       // 0-1, lower = stiller (good)
  sharpness: number    // 0-1, higher = sharper (good)
  poseOk: boolean      // face is positioned correctly for the active angle
  pose: "front" | "left" | "right" | "unknown"
  quality: number      // 0-1 overall capture quality
  tracking: boolean    // true when MediaPipe FaceLandmarker is producing results
}

export function FaceScanWizard() {
  const [tab, setTab] = useState<"scan" | "upload">("scan")
  const [angles, setAngles] = useState<Record<AngleId, string | null>>({ front: null, left: null, right: null })
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [activeAngle, setActiveAngle] = useState<AngleId>("front")
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoCapture, setAutoCapture] = useState(true)
  const [quickMode, setQuickMode] = useState(true)
  const [live, setLive] = useState<LiveMetrics>({ facePresent: false, centered: false, brightness: 0, faceCoverage: 0, spots: [], counts: { acne: 0, darkcircle: 0, shine: 0, dark: 0 }, motion: 1, sharpness: 0, poseOk: false, pose: "unknown", quality: 0, tracking: false })
  const [stableMs, setStableMs] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const captureRef = useRef<HTMLCanvasElement>(null)
  const analyzerRef = useRef<HTMLCanvasElement>(null)
  const lastStableRef = useRef<number>(0)
  const prevPixelsRef = useRef<Uint8ClampedArray | null>(null)
  // Smoothed (EMA) metric refs — kill flicker / micro-shakes
  const smoothMotionRef = useRef<number>(0)
  const smoothSharpRef = useRef<number>(0)
  const smoothBrightRef = useRef<number>(0)
  const smoothCxRef = useRef<number>(0.5)
  const smoothCyRef = useRef<number>(0.5)
  const smoothCoverageRef = useRef<number>(0)
  const smoothFaceBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const smoothSkewRef = useRef<number>(0)
  // Pose hysteresis: how many consecutive frames in each candidate pose
  const poseVoteRef = useRef<{ front: number; left: number; right: number; current: LiveMetrics["pose"] }>({ front: 0, left: 0, right: 0, current: "unknown" })
  // ── MediaPipe FaceLandmarker (professional face tracking) ──
  const landmarkerRef = useRef<any>(null)
  const landmarkerResultRef = useRef<any>(null)
  const landmarkerLastTsRef = useRef<number>(0)
  const [trackingReady, setTrackingReady] = useState(false)
  // Smoothed Euler angles + expressions (filled from MediaPipe results)
  const smoothYawRef = useRef<number>(0)
  const smoothPitchRef = useRef<number>(0)
  const smoothRollRef = useRef<number>(0)
  const smoothExprRef = useRef<{ smile: number; blink: number; mouthOpen: number; browUp: number }>({ smile: 0, blink: 0, mouthOpen: 0, browUp: 0 })
  // Best-frame buffer for current angle: keep highest-quality snapshot during the hold window
  const bestRef = useRef<{ score: number; dataUrl: string | null }>({ score: 0, dataUrl: null })
  // Persistence buffer for dark-circle confidence (need consistent detection across N frames)
  const darkCircleHistRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 })
  // Capture target duration per angle (ms)
  const HOLD_MS = 8000

  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()) }, [stream])

  // ── Lazy-load MediaPipe FaceLandmarker once (industry-grade face tracking) ──
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision")
        if (cancelled) return
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        )
        const fl = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        })
        if (cancelled) { try { fl.close() } catch {} ; return }
        landmarkerRef.current = fl
        setTrackingReady(true)
      } catch (e) {
        // MediaPipe failed to load — fall back to heuristic pose detection silently
        console.warn("[FaceLandmarker] init failed, using fallback:", e)
      }
    })()
    return () => { cancelled = true; try { landmarkerRef.current?.close?.() } catch {} ; landmarkerRef.current = null }
  }, [])

  // Run MediaPipe detection in its own loop (uses GPU; ~20-30fps without blocking the UI)
  useEffect(() => {
    if (!stream || !trackingReady) return
    let raf = 0
    const loop = () => {
      const v = videoRef.current
      const fl = landmarkerRef.current
      if (v && v.videoWidth && fl) {
        const ts = performance.now()
        // FaceLandmarker requires monotonically increasing timestamps
        if (ts > landmarkerLastTsRef.current) {
          landmarkerLastTsRef.current = ts
          try {
            const res = fl.detectForVideo(v, ts)
            landmarkerResultRef.current = (res?.faceLandmarks?.length > 0) ? res : null
          } catch { landmarkerResultRef.current = null }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [stream, trackingReady])

  // Listen for global "Start Live Scan" requests (from hero CTA, streak card, etc.)
  useEffect(() => {
    const handler = () => {
      if (!stream) startCamera()
      setTab("scan")
    }
    window.addEventListener("skinpro:startScan", handler)
    return () => window.removeEventListener("skinpro:startScan", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream])

  const startCamera = async () => {
    setError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false,
      })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
    } catch { setError("Camera unavailable. Please use Upload tab instead.") }
  }

  const analyzeFrame = useCallback((): LiveMetrics | null => {
    const v = videoRef.current; const c = analyzerRef.current
    if (!v || !c || !v.videoWidth) return null
    const W = 160; const H = Math.round((v.videoHeight / v.videoWidth) * W)
    c.width = W; c.height = H
    const ctx = c.getContext("2d", { willReadFrequently: true }); if (!ctx) return null
    ctx.drawImage(v, 0, 0, W, H)
    const img = ctx.getImageData(0, 0, W, H)
    const data = img.data

    // ---- Motion (frame difference) & sharpness (Sobel-like) ----
    let motion = 0, motionN = 0
    const prev = prevPixelsRef.current
    if (prev && prev.length === data.length) {
      for (let i = 0; i < data.length; i += 16) { // sparse sample
        motion += Math.abs(data[i] - prev[i]) + Math.abs(data[i + 1] - prev[i + 1]) + Math.abs(data[i + 2] - prev[i + 2])
        motionN++
      }
      motion = motionN > 0 ? Math.min(1, (motion / motionN) / 60) : 0
    }
    prevPixelsRef.current = new Uint8ClampedArray(data)

    // EMA smoothing on motion: brief hand jitters get absorbed instead of resetting the timer
    smoothMotionRef.current = smoothMotionRef.current * 0.78 + motion * 0.22
    motion = smoothMotionRef.current

    let sharpAcc = 0, sharpN = 0
    for (let y = 4; y < H - 4; y += 3) {
      for (let x = 4; x < W - 4; x += 3) {
        const i = (y * W + x) * 4
        const Y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        const Yr = 0.299 * data[i + 4] + 0.587 * data[i + 5] + 0.114 * data[i + 6]
        const Yd = 0.299 * data[(y + 1) * W * 4 + x * 4] + 0.587 * data[(y + 1) * W * 4 + x * 4 + 1] + 0.114 * data[(y + 1) * W * 4 + x * 4 + 2]
        sharpAcc += Math.abs(Y - Yr) + Math.abs(Y - Yd)
        sharpN++
      }
    }
    const sharpnessRaw = sharpN > 0 ? Math.min(1, (sharpAcc / sharpN) / 35) : 0
    smoothSharpRef.current = smoothSharpRef.current * 0.7 + sharpnessRaw * 0.3
    const sharpness = smoothSharpRef.current

    let skinPx = 0, totalLum = 0, cxAcc = 0, cyAcc = 0
    let minX = W, maxX = 0, minY = H, maxY = 0
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const Y = 0.299 * r + 0.587 * g + 0.114 * b
        const Cr = (r - Y) * 0.713 + 128
        const Cb = (b - Y) * 0.564 + 128
        totalLum += Y
        if (Cr >= 133 && Cr <= 173 && Cb >= 77 && Cb <= 127 && Y > 40) {
          skinPx++; cxAcc += x; cyAcc += y
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
      }
    }
    const sampledPx = (W * H) / 4
    const coverageRaw = skinPx / sampledPx
    const brightnessRaw = totalLum / sampledPx / 255
    const cxRaw = skinPx > 0 ? cxAcc / skinPx / W : 0.5
    const cyRaw = skinPx > 0 ? cyAcc / skinPx / H : 0.5

    // Smooth coverage / brightness / centroid (kills jitter on pose & centering)
    smoothCoverageRef.current = smoothCoverageRef.current * 0.65 + coverageRaw * 0.35
    smoothBrightRef.current = smoothBrightRef.current * 0.7 + brightnessRaw * 0.3
    smoothCxRef.current = smoothCxRef.current * 0.6 + cxRaw * 0.4
    smoothCyRef.current = smoothCyRef.current * 0.6 + cyRaw * 0.4
    const coverage = smoothCoverageRef.current
    const brightness = smoothBrightRef.current
    const cx = smoothCxRef.current
    const cy = smoothCyRef.current

    let faceBox: LiveMetrics["faceBox"] | undefined
    if (skinPx > sampledPx * 0.05 && maxX > minX && maxY > minY) {
      const raw = { x: minX / W, y: minY / H, w: (maxX - minX) / W, h: (maxY - minY) / H }
      const sb = smoothFaceBoxRef.current
      if (sb) {
        faceBox = {
          x: sb.x * 0.7 + raw.x * 0.3,
          y: sb.y * 0.7 + raw.y * 0.3,
          w: sb.w * 0.7 + raw.w * 0.3,
          h: sb.h * 0.7 + raw.h * 0.3,
        }
      } else faceBox = raw
      smoothFaceBoxRef.current = faceBox
    }

    // ---- Pose estimation: combine skin-centroid offset + density skew + aspect ratio,
    // then apply N-frame hysteresis so slow head turns are picked up reliably without flicker ----
    let pose: LiveMetrics["pose"] = "unknown"
    if (faceBox && skinPx > 100) {
      const fx0 = faceBox.x * W
      const fw = faceBox.w * W
      const midX = fx0 + fw / 2

      // Signal 1: density skew (left vs right half of face box)
      let leftSkin = 0, rightSkin = 0
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const Y = 0.299 * r + 0.587 * g + 0.114 * b
          const Cr = (r - Y) * 0.713 + 128
          const Cb = (b - Y) * 0.564 + 128
          if (Cr >= 133 && Cr <= 173 && Cb >= 77 && Cb <= 127 && Y > 40 && x >= fx0 && x <= fx0 + fw) {
            if (x < midX) leftSkin++; else rightSkin++
          }
        }
      }
      const total = leftSkin + rightSkin
      const skew = total > 0 ? (leftSkin - rightSkin) / total : 0
      smoothSkewRef.current = smoothSkewRef.current * 0.65 + skew * 0.35
      const sk = smoothSkewRef.current

      // Signal 2: face centroid offset within the face box (normalized -1..1)
      // When user turns left, visible skin centroid shifts toward the left side of the box.
      const cxAbs = cx * W
      const centroidOff = fw > 0 ? (cxAbs - midX) / (fw / 2) : 0

      // Combined turn signal (weighted)
      const turn = sk * 0.6 + centroidOff * 0.4

      // Signal 3: aspect ratio — narrower when face is turned
      const ar = faceBox.w / Math.max(0.001, faceBox.h)

      // Vote per frame with relaxed thresholds (catches slow turns)
      let frameVote: LiveMetrics["pose"]
      if (turn > 0.10 || (sk > 0.08 && ar < 0.85)) frameVote = "left"
      else if (turn < -0.10 || (sk < -0.08 && ar < 0.85)) frameVote = "right"
      else if (Math.abs(turn) < 0.07 && ar >= 0.78) frameVote = "front"
      else frameVote = poseVoteRef.current.current === "unknown" ? "front" : poseVoteRef.current.current

      // Hysteresis: increment the winning bucket, decay the others; flip pose only after 3 frames of consistent vote
      const v = poseVoteRef.current
      v.front = frameVote === "front" ? Math.min(8, v.front + 1) : Math.max(0, v.front - 1)
      v.left  = frameVote === "left"  ? Math.min(8, v.left  + 1) : Math.max(0, v.left  - 1)
      v.right = frameVote === "right" ? Math.min(8, v.right + 1) : Math.max(0, v.right - 1)

      const winner: LiveMetrics["pose"] =
        v.front >= v.left && v.front >= v.right ? "front" :
        v.left  >= v.right ? "left" : "right"
      const winnerScore = winner === "front" ? v.front : winner === "left" ? v.left : v.right
      // Only switch the committed pose after 3 consistent frames; otherwise keep the previous one
      if (winnerScore >= 3) v.current = winner
      pose = v.current === "unknown" ? winner : v.current
    } else {
      // No face → reset votes
      poseVoteRef.current = { front: 0, left: 0, right: 0, current: "unknown" }
    }

    // ---- Spot / acne (kept for capture-time analysis but NOT shown live as labels) ----
    const spots: LiveMetrics["spots"] = []
    const counts = { acne: 0, darkcircle: 0, shine: 0, dark: 0 }

    if (faceBox && coverage > 0.06) {
      const stride = 10
      const fx0 = faceBox.x * W, fy0 = faceBox.y * H, fw = faceBox.w * W, fh = faceBox.h * H
      for (let y = Math.max(8, fy0 + fh * 0.18); y < Math.min(H - 8, fy0 + fh * 0.95); y += stride) {
        for (let x = Math.max(8, fx0 + 4); x < Math.min(W - 8, fx0 + fw - 4); x += stride) {
          const i = (Math.floor(y) * W + Math.floor(x)) * 4
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const Y = 0.299 * r + 0.587 * g + 0.114 * b
          const Cr = (r - Y) * 0.713 + 128
          const Cb = (b - Y) * 0.564 + 128
          if (!(Cr >= 133 && Cr <= 173 && Cb >= 77 && Cb <= 127)) continue
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          const sat = max === 0 ? 0 : (max - min) / max
          if (Y > 210 && sat < 0.18) { counts.shine++; continue }
          const j = ((Math.floor(y) - 6) * W + (Math.floor(x) - 6)) * 4
          const Yn = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]
          if (Yn - Y > 24 && r - g > 14 && r - b > 10) counts.acne++
          else if (Yn - Y > 32) counts.dark++
        }
      }

      // ---- Dark circles (confidence-gated) ----
      const eyeBandY = fy0 + fh * 0.32
      const eyeBandH = fh * 0.14
      const cheekBandY = fy0 + fh * 0.55
      const cheekBandH = fh * 0.10
      const sampleBand = (yStart: number, yEnd: number, xStart: number, xEnd: number) => {
        let sum = 0, n = 0
        for (let y = Math.floor(yStart); y < Math.floor(yEnd); y += 3) {
          for (let x = Math.floor(xStart); x < Math.floor(xEnd); x += 3) {
            const i = (y * W + x) * 4
            const r = data[i], g = data[i + 1], b = data[i + 2]
            const Y = 0.299 * r + 0.587 * g + 0.114 * b
            const Cr = (r - Y) * 0.713 + 128
            const Cb = (b - Y) * 0.564 + 128
            if (Cr >= 133 && Cr <= 173 && Cb >= 77 && Cb <= 127) { sum += Y; n++ }
          }
        }
        return n > 0 ? sum / n : 0
      }
      const leftEyeXs = fx0 + fw * 0.12, leftEyeXe = fx0 + fw * 0.42
      const rightEyeXs = fx0 + fw * 0.58, rightEyeXe = fx0 + fw * 0.88
      const lE = sampleBand(eyeBandY, eyeBandY + eyeBandH, leftEyeXs, leftEyeXe)
      const rE = sampleBand(eyeBandY, eyeBandY + eyeBandH, rightEyeXs, rightEyeXe)
      const lC = sampleBand(cheekBandY, cheekBandY + cheekBandH, leftEyeXs, leftEyeXe)
      const rC = sampleBand(cheekBandY, cheekBandY + cheekBandH, rightEyeXs, rightEyeXe)
      // Strict confidence: cheek - eye luminance delta ≥ 14 AND consistent across consecutive frames
      const leftDelta = lE > 0 && lC > 0 ? lC - lE : 0
      const rightDelta = rE > 0 && rC > 0 ? rC - rE : 0
      darkCircleHistRef.current.left = leftDelta >= 14 ? Math.min(5, darkCircleHistRef.current.left + 1) : Math.max(0, darkCircleHistRef.current.left - 1)
      darkCircleHistRef.current.right = rightDelta >= 14 ? Math.min(5, darkCircleHistRef.current.right + 1) : Math.max(0, darkCircleHistRef.current.right - 1)
      if (darkCircleHistRef.current.left >= 3) {
        spots.push({ x: (leftEyeXs + leftEyeXe) / 2 / W, y: (eyeBandY + eyeBandH * 0.5) / H, r: Math.max(eyeBandH, (leftEyeXe - leftEyeXs)) * 0.55, type: "darkcircle", confident: true })
        counts.darkcircle++
      }
      if (darkCircleHistRef.current.right >= 3) {
        spots.push({ x: (rightEyeXs + rightEyeXe) / 2 / W, y: (eyeBandY + eyeBandH * 0.5) / H, r: Math.max(eyeBandH, (rightEyeXe - rightEyeXs)) * 0.55, type: "darkcircle", confident: true })
        counts.darkcircle++
      }
    }

    const facePresent = coverage > 0.06
    const goodLight = brightness > 0.28 && brightness < 0.88
    const centered = facePresent && Math.abs(cx - 0.5) < 0.24 && Math.abs(cy - 0.5) < 0.26 && goodLight
    // Pose check vs activeAngle (computed in tick)
    const poseOk = false  // placeholder; tick effect will set quality below using current activeAngle
    // Quality: low motion + good sharpness + good light + centered face
    const stillness = 1 - Math.min(1, motion * 1.2)
    const quality = facePresent ? Math.max(0, Math.min(1, 0.30 * stillness + 0.30 * sharpness + 0.20 * (goodLight ? 1 : 0) + 0.20 * (centered ? 1 : 0))) : 0

    // ── MediaPipe override (industry-grade): when FaceLandmarker has results,
    // use its 3D pose matrix + landmarks for face box, pose & expression. ──
    const lr = landmarkerResultRef.current
    let landmarks: { x: number; y: number }[] | undefined
    let yawDeg: number | undefined
    let pitchDeg: number | undefined
    let rollDeg: number | undefined
    let expression: LiveMetrics["expression"] | undefined
    let mpFacePresent = false
    let mpFaceBox: LiveMetrics["faceBox"] | undefined
    let mpCentered = centered
    let mpPose: LiveMetrics["pose"] | undefined

    if (lr?.faceLandmarks?.[0]?.length) {
      mpFacePresent = true
      const lm = lr.faceLandmarks[0] as { x: number; y: number }[]
      landmarks = lm
      // Real face box from landmarks
      let lx = 1, rx = 0, ty = 1, by = 0
      for (let k = 0; k < lm.length; k++) {
        const p = lm[k]
        if (p.x < lx) lx = p.x; if (p.x > rx) rx = p.x
        if (p.y < ty) ty = p.y; if (p.y > by) by = p.y
      }
      mpFaceBox = { x: lx, y: ty, w: rx - lx, h: by - ty }
      // Recompute centered using real face center
      const fcx = (lx + rx) / 2, fcy = (ty + by) / 2
      mpCentered = mpFacePresent && Math.abs(fcx - 0.5) < 0.24 && Math.abs(fcy - 0.5) < 0.28 && goodLight

      // Head pose from facial transformation matrix (column-major 4x4)
      const tm = lr.facialTransformationMatrixes?.[0]?.data as Float32Array | undefined
      if (tm && tm.length >= 16) {
        // Standard rotation matrix Euler extraction (Y-up, right-handed)
        // R02=tm[8], R12=tm[9], R22=tm[10], R20=tm[2], R21=tm[6], R00=tm[0], R01=tm[4]
        const r20 = tm[2], r21 = tm[6], r22 = tm[10]
        const r00 = tm[0], r10 = tm[1]
        const yawRaw = Math.atan2(-r20, Math.sqrt(r00 * r00 + r10 * r10)) * 180 / Math.PI
        const pitchRaw = Math.atan2(r21, r22) * 180 / Math.PI
        const rollRaw = Math.atan2(r10, r00) * 180 / Math.PI
        smoothYawRef.current = smoothYawRef.current * 0.65 + yawRaw * 0.35
        smoothPitchRef.current = smoothPitchRef.current * 0.65 + pitchRaw * 0.35
        smoothRollRef.current = smoothRollRef.current * 0.65 + rollRaw * 0.35
        yawDeg = smoothYawRef.current
        pitchDeg = smoothPitchRef.current
        rollDeg = smoothRollRef.current
        // Yaw is in raw camera space. The video is mirrored on display (selfie),
        // so when the user turns their head LEFT (their perspective), yaw goes positive.
        // Threshold ~12° gives a smooth, natural detect for slow turns.
        if (yawDeg > 14) mpPose = "left"
        else if (yawDeg < -14) mpPose = "right"
        else mpPose = "front"
      }

      // Blendshapes → expression scores
      const bs = lr.faceBlendshapes?.[0]?.categories as { categoryName: string; score: number }[] | undefined
      if (bs && bs.length) {
        const get = (n: string) => bs.find((c) => c.categoryName === n)?.score ?? 0
        const smileRaw = Math.min(1, (get("mouthSmileLeft") + get("mouthSmileRight")) * 1.6)
        const blinkRaw = Math.min(1, (get("eyeBlinkLeft") + get("eyeBlinkRight")) * 0.55)
        const mouthOpenRaw = Math.min(1, get("jawOpen") * 1.4)
        const browUpRaw = Math.min(1, (get("browInnerUp") + get("browOuterUpLeft") + get("browOuterUpRight")) * 0.7)
        const s = smoothExprRef.current
        s.smile = s.smile * 0.7 + smileRaw * 0.3
        s.blink = s.blink * 0.5 + blinkRaw * 0.5
        s.mouthOpen = s.mouthOpen * 0.7 + mouthOpenRaw * 0.3
        s.browUp = s.browUp * 0.7 + browUpRaw * 0.3
        expression = { ...s }
      }
    }

    const finalFacePresent = mpFacePresent || facePresent
    const finalFaceBox = mpFaceBox || faceBox
    const finalCentered = mpFacePresent ? mpCentered : centered
    const finalPose: LiveMetrics["pose"] = mpPose ?? pose
    const finalQuality = finalFacePresent
      ? Math.max(0, Math.min(1, 0.30 * stillness + 0.30 * sharpness + 0.20 * (goodLight ? 1 : 0) + 0.20 * (finalCentered ? 1 : 0)))
      : 0

    return {
      facePresent: finalFacePresent, centered: finalCentered, brightness, faceCoverage: coverage,
      faceBox: finalFaceBox, landmarks, yaw: yawDeg, pitch: pitchDeg, roll: rollDeg, expression,
      spots, counts, motion, sharpness, poseOk, pose: finalPose, quality: finalQuality,
      tracking: mpFacePresent,
    }
  }, [])

  const renderOverlay = useCallback((m: LiveMetrics, t: number) => {
    const v = videoRef.current; const o = overlayRef.current
    if (!v || !o || !v.videoWidth) return
    o.width = v.clientWidth; o.height = v.clientHeight
    const ctx = o.getContext("2d"); if (!ctx) return
    ctx.clearRect(0, 0, o.width, o.height)
    const W = o.width, H = o.height
    const cx = W / 2, cy = H / 2
    const ovalRX = W * 0.30, ovalRY = H * 0.42

    // Soft vignette outside oval
    ctx.save()
    ctx.fillStyle = "rgba(0,0,0,0.32)"
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath(); ctx.ellipse(cx, cy, ovalRX, ovalRY, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    // Face oval guide
    const oneGood = m.centered && m.motion < 0.28 && m.sharpness > 0.14
    ctx.lineWidth = 2.5
    ctx.setLineDash([10, 8])
    ctx.strokeStyle = oneGood ? "rgba(16,185,129,0.95)" : m.facePresent ? "rgba(245,158,11,0.95)" : "rgba(255,255,255,0.55)"
    ctx.beginPath(); ctx.ellipse(cx, cy, ovalRX, ovalRY, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])

    // Live face bounding box (mirror flipped)
    if (m.faceBox) {
      const fx = (1 - m.faceBox.x - m.faceBox.w) * W
      const fy = m.faceBox.y * H
      const fw = m.faceBox.w * W
      const fh = m.faceBox.h * H
      ctx.strokeStyle = oneGood ? "rgba(16,185,129,0.9)" : "rgba(99,102,241,0.85)"
      ctx.lineWidth = 2
      const corner = Math.min(fw, fh) * 0.12
      const drawCorner = (x: number, y: number, dx: number, dy: number) => {
        ctx.beginPath(); ctx.moveTo(x + dx * corner, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * corner); ctx.stroke()
      }
      drawCorner(fx, fy, 1, 1)
      drawCorner(fx + fw, fy, -1, 1)
      drawCorner(fx, fy + fh, 1, -1)
      drawCorner(fx + fw, fy + fh, -1, -1)
    }

    if (oneGood) {
      const sweepY = cy - ovalRY + ((t / 10) % (ovalRY * 2))
      const grad = ctx.createLinearGradient(0, sweepY - 32, 0, sweepY + 32)
      grad.addColorStop(0, "rgba(16,185,129,0)")
      grad.addColorStop(0.5, "rgba(16,185,129,0.55)")
      grad.addColorStop(1, "rgba(16,185,129,0)")
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.ellipse(cx, sweepY, ovalRX, 6, 0, 0, Math.PI * 2); ctx.fill()
    }

    // Confident dark-circle ellipses ONLY (no acne / spot labels live to avoid noise)
    for (const s of m.spots) {
      if (s.type !== "darkcircle" || !s.confident) continue
      const sx = (1 - s.x) * W, sy = s.y * H
      const radius = s.r * W * 0.5
      const pulse = 1 + 0.18 * Math.sin(t / 240)
      ctx.strokeStyle = "#6366f1"
      ctx.lineWidth = 2.5
      ctx.setLineDash([6, 5])
      ctx.beginPath(); ctx.ellipse(sx, sy, radius * 1.6 * pulse, radius * 0.7 * pulse, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
      // Compact label (only for the confident dark-circle markers)
      ctx.font = "600 9px ui-sans-serif, system-ui"
      const txt = "DARK CIRCLE"
      const tw = ctx.measureText(txt).width + 8
      ctx.fillStyle = "#6366f1"
      ctx.fillRect(sx - tw / 2, sy - radius - 14, tw, 12)
      ctx.fillStyle = "#fff"
      ctx.fillText(txt, sx - tw / 2 + 4, sy - radius - 5)
    }

    // ── Subtle landmark mesh (when MediaPipe is tracking): drawn as faint dots
    // on a sparse subset to convey "real-time AI tracking" without visual noise. ──
    if (m.tracking && m.landmarks && m.landmarks.length) {
      ctx.save()
      ctx.fillStyle = oneGood ? "rgba(16,185,129,0.55)" : "rgba(56,189,248,0.55)"
      // Draw every 6th landmark to keep it light (~78 dots out of 468)
      for (let i = 0; i < m.landmarks.length; i += 6) {
        const p = m.landmarks[i]
        // Video is mirrored on display → flip x
        const px = (1 - p.x) * W
        const py = p.y * H
        ctx.beginPath(); ctx.arc(px, py, 1.1, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()

      // Direction arrow showing yaw — tiny chevron next to the face box
      if (m.faceBox && typeof m.yaw === "number") {
        const fx = (1 - m.faceBox.x - m.faceBox.w) * W
        const fy = m.faceBox.y * H
        const fw = m.faceBox.w * W
        const ay = fy - 14
        const acx = fx + fw / 2
        const yawNorm = Math.max(-1, Math.min(1, m.yaw / 30))   // -1..1
        const ax = acx + yawNorm * 28
        ctx.save()
        ctx.fillStyle = "rgba(56,189,248,0.95)"
        ctx.beginPath(); ctx.arc(ax, ay, 3.5, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = "rgba(56,189,248,0.5)"
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(acx - 28, ay); ctx.lineTo(acx + 28, ay); ctx.stroke()
        ctx.restore()
      }

      // Tiny "AI TRACKING" badge in top-left of the canvas
      ctx.save()
      ctx.font = "600 9px ui-sans-serif, system-ui"
      const badge = "AI TRACKING"
      const bw = ctx.measureText(badge).width + 16
      ctx.fillStyle = "rgba(16,185,129,0.92)"
      ctx.fillRect(10, 10, bw, 16)
      ctx.fillStyle = "#fff"
      ctx.fillText(badge, 18, 21)
      ctx.restore()
    }
  }, [])

  // Snapshot current frame to a JPEG data URL with a quality score (used by best-frame buffer)
  const snapshotFrame = useCallback((): { dataUrl: string; quality: number } | null => {
    const v = videoRef.current; const c = captureRef.current
    if (!v || !c || !v.videoWidth) return null
    c.width = v.videoWidth; c.height = v.videoHeight
    const ctx = c.getContext("2d"); if (!ctx) return null
    ctx.drawImage(v, 0, 0)
    return { dataUrl: c.toDataURL("image/jpeg", 0.94), quality: 0 }
  }, [])

  const commitBestFrame = useCallback(() => {
    if (!bestRef.current.dataUrl) return false
    const dataUrl = bestRef.current.dataUrl
    setAngles((a) => {
      const next = { ...a, [activeAngle]: dataUrl }
      const idx = ANGLES.findIndex((x) => x.id === activeAngle)
      for (let off = 1; off <= ANGLES.length; off++) {
        const cand = ANGLES[(idx + off) % ANGLES.length]
        if (!next[cand.id]) { setActiveAngle(cand.id); break }
      }
      return next
    })
    bestRef.current = { score: 0, dataUrl: null }
    darkCircleHistRef.current = { left: 0, right: 0 }
    poseVoteRef.current = { front: 0, left: 0, right: 0, current: "unknown" }
    smoothMotionRef.current = 0
    smoothSkewRef.current = 0
    smoothYawRef.current = 0
    smoothPitchRef.current = 0
    smoothRollRef.current = 0
    smoothExprRef.current = { smile: 0, blink: 0, mouthOpen: 0, browUp: 0 }
    lastStableRef.current = 0; setStableMs(0)
    return true
  }, [activeAngle])

  const captureCurrent = useCallback(() => {
    // Manual capture: just take the current frame
    const snap = snapshotFrame(); if (!snap) return
    bestRef.current = { score: 1, dataUrl: snap.dataUrl }
    commitBestFrame()
  }, [snapshotFrame, commitBestFrame])

  useEffect(() => {
    if (!stream) return
    let raf = 0; let prevTs = performance.now()
    let lastSampleAt = 0
    const SAMPLE_EVERY_MS = 220
    const tick = (ts: number) => {
      const dt = ts - prevTs; prevTs = ts
      const m = analyzeFrame()
      if (m) {
        // pose check vs active angle
        const targetPose: LiveMetrics["pose"] = activeAngle === "front" ? "front" : activeAngle === "left" ? "left" : "right"
        const poseOk = m.pose === targetPose
        const enriched: LiveMetrics = { ...m, poseOk }
        setLive(enriched); renderOverlay(enriched, ts)

        const conditionsGood =
          autoCapture && tab === "scan" && !angles[activeAngle] &&
          m.facePresent && m.centered && poseOk &&
          m.motion < 0.28 && m.sharpness > 0.14

        if (conditionsGood) {
          lastStableRef.current += dt
          setStableMs(lastStableRef.current)
          // Sample a candidate frame periodically; keep the best by quality
          if (ts - lastSampleAt > SAMPLE_EVERY_MS) {
            lastSampleAt = ts
            const snap = snapshotFrame()
            if (snap && m.quality > bestRef.current.score) {
              bestRef.current = { score: m.quality, dataUrl: snap.dataUrl }
            }
          }
          if (lastStableRef.current >= HOLD_MS) {
            // 8s reached → commit best frame (or current if none yet)
            if (!bestRef.current.dataUrl) {
              const snap = snapshotFrame()
              if (snap) bestRef.current = { score: m.quality, dataUrl: snap.dataUrl }
            }
            commitBestFrame()
          }
        } else {
          // Reset progress if conditions break, but keep best frame buffer (gentle decay so brief blips don't restart)
          lastStableRef.current = Math.max(0, lastStableRef.current - dt * 0.6)
          setStableMs(lastStableRef.current)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stream, analyzeFrame, renderOverlay, autoCapture, activeAngle, angles, tab, snapshotFrame, commitBestFrame])

  // Auto-analyze once all 3 angles are captured
  const autoAnalyzedRef = useRef(false)
  useEffect(() => {
    const filled = Object.values(angles).filter(Boolean).length
    if (filled >= ANGLES.length && autoCapture && !analyzing && !result && !autoAnalyzedRef.current) {
      autoAnalyzedRef.current = true
      const tid = setTimeout(() => { analyze() }, 600)
      return () => clearTimeout(tid)
    }
    if (filled === 0) autoAnalyzedRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angles, autoCapture, analyzing, result])

  const onUpload = (angle: AngleId, file: File) => {
    const reader = new FileReader()
    reader.onload = () => setAngles((a) => ({ ...a, [angle]: String(reader.result) }))
    reader.readAsDataURL(file)
  }
  const reset = () => { setAngles({ front: null, left: null, right: null }); setResult(null); setError(null); setActiveAngle("front") }

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => (await fetch(dataUrl)).blob()

  const analyze = async () => {
    const filled = Object.entries(angles).filter(([, v]) => !!v)
    if (filled.length === 0) { setError("Please capture or upload at least one photo."); return }
    setAnalyzing(true); setError(null)
    try {
      const fd = new FormData()
      for (const [id, dataUrl] of filled) {
        const blob = await dataUrlToBlob(dataUrl as string)
        fd.append(id, blob, `${id}.jpg`)
      }
      const res = await fetch("/api/analyze-multi", { method: "POST", body: fd })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Analysis failed")
      setResult(json.analysis); pushHistoryEntry(json.analysis)
      stream?.getTracks().forEach((t) => t.stop()); setStream(null)
      setTimeout(() => document.getElementById("analysis-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
    } catch (e: any) { setError(e.message || "Something went wrong.") }
    finally { setAnalyzing(false) }
  }

  const filledCount = Object.values(angles).filter(Boolean).length
  const requiredCount = quickMode ? 1 : 3
  const visibleAngles = quickMode ? ANGLES.slice(0, 1) : ANGLES

  return (
    <section id="prediction" className="relative py-12 sm:py-20 md:py-24 overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden sm:block">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-br from-primary/10 /5 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-amber-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center mb-6 sm:mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 text-primary text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-3 sm:mb-4 border border-primary/20">
            <ScanFace className="w-3.5 h-3.5" />
            Live skin scan
          </span>
          <h2 className="text-[1.85rem] xs:text-3xl sm:text-5xl font-bold tracking-tight mb-2 sm:mb-3 text-balance leading-tight">
            Your AI skin analysis,{" "}
            <span className="text-primary">in 30 seconds</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-[13px] sm:text-base leading-relaxed">
            {quickMode
              ? "Look straight at the camera. We'll auto-capture the sharpest frame — no buttons, no waiting."
              : "Three angles for a deeper read. Front, then turn left, then right."}
          </p>

          {/* Mode toggle */}
          <div className="inline-flex mt-5 p-1 rounded-xl bg-muted/60 border border-border/60">
            <button
              onClick={() => { setQuickMode(true); setActiveAngle("front") }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${quickMode ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Zap className="w-3.5 h-3.5" /> Quick · 30 s
            </button>
            <button
              onClick={() => setQuickMode(false)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${!quickMode ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Target className="w-3.5 h-3.5" /> Deep · 3 angles
            </button>
          </div>
        </div>

        {!result && (
          <Card className="overflow-hidden border-2 border-border/60 shadow-xl bg-card/90 backdrop-blur">
            <CardContent className="p-4 sm:p-6">
              <Tabs value={tab} onValueChange={(v) => setTab(v as "scan" | "upload")}>
                <TabsList className="grid w-full grid-cols-2 mb-5 sm:mb-6 h-11 rounded-xl bg-muted/40 p-1">
                  <TabsTrigger value="scan" className="rounded-lg gap-2 data-[state=active]:shadow"><ScanFace className="w-4 h-4" /> Live scan</TabsTrigger>
                  <TabsTrigger value="upload" className="rounded-lg gap-2 data-[state=active]:shadow"><Upload className="w-4 h-4" /> Upload photos</TabsTrigger>
                </TabsList>

                <TabsContent value="scan">
                  {/* Minimal segmented stepper — only show if Deep mode (3 angles) */}
                  {!quickMode && (
                    <div className="mx-auto max-w-md mb-5">
                      <div className="flex items-center justify-between gap-1 px-1">
                        {ANGLES.map((a, i) => {
                          const captured = !!angles[a.id]
                          const active = activeAngle === a.id
                          return (
                            <div key={a.id} className="flex items-center flex-1">
                              <button
                                onClick={() => setActiveAngle(a.id)}
                                className="flex flex-col items-center gap-1.5 group flex-shrink-0"
                              >
                                <div className={`relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                  captured
                                    ? "bg-emerald-500 text-white"
                                    : active
                                    ? "bg-foreground text-background ring-4 ring-foreground/10"
                                    : "bg-muted text-muted-foreground border border-border"
                                }`}>
                                  {captured ? <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} /> : i + 1}
                                </div>
                                <span className={`text-[10px] font-semibold tracking-wide uppercase ${
                                  active ? "text-foreground" : captured ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                                }`}>{a.label}</span>
                              </button>
                              {i < ANGLES.length - 1 && (
                                <div className="flex-1 h-px mx-2 bg-border relative overflow-hidden -mt-4">
                                  <div className={`absolute inset-y-0 left-0 transition-all duration-500 ${captured ? "w-full bg-emerald-500" : "w-0"}`} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Camera frame — info panel on the LEFT, camera on the RIGHT (desktop) */}
                  <div className="mb-4 grid lg:grid-cols-[1fr_minmax(0,560px)] gap-6 lg:gap-8 items-start">
                    {/* LEFT — info / guidance panel (desktop only, hidden on mobile) */}
                    <aside className="hidden lg:flex flex-col gap-4 pt-1">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary text-[10px] font-bold uppercase tracking-[0.18em] w-fit">
                        <ScanFace className="w-3 h-3" /> What we check
                      </div>
                      <h3 className="text-2xl font-extrabold tracking-tight leading-tight">
                        10 skin metrics in <span className="text-primary">one selfie</span>.
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Our on-device model scores acne, dark circles, pigmentation, oiliness, redness, hydration, pores, fine lines, dark spots and overall tone — then matches a routine.
                      </p>

                      <ul className="grid gap-2 mt-1">
                        {[
                          { icon: ShieldCheck, t: "Stays on your device", d: "Frames never leave your browser." },
                          { icon: Eye, t: "Live face tracking", d: "We auto-capture the sharpest moment." },
                          { icon: Sun, t: "Best with daylight", d: "Face a window — no harsh overhead light." },
                        ].map((it, i) => {
                          const Icon = it.icon
                          return (
                            <li key={i} className="flex items-start gap-3 p-3 rounded-2xl border bg-card/60">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13px] font-bold leading-tight">{it.t}</div>
                                <div className="text-[12px] text-muted-foreground leading-snug mt-0.5">{it.d}</div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/60 border">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" /> Average scan: 30 s
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/60 border">
                          <Sparkles className="w-3 h-3 text-primary" /> Free, no signup
                        </span>
                      </div>
                    </aside>

                    {/* RIGHT — camera frame */}
                    <div className="relative -mx-4 sm:mx-0 lg:mx-0 sm:w-full sm:max-w-xl lg:max-w-none lg:w-full sm:mx-auto lg:ml-auto">
                      {/* Soft ambient glow behind the frame (desktop only — hidden on edge-to-edge mobile) */}
                      <div aria-hidden className="pointer-events-none absolute -inset-4 bg-gradient-to-br from-primary/15 to-secondary/10 blur-2xl rounded-[28px] -z-10 hidden sm:block" />
                      <div className="relative bg-black overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/40 sm:rounded-[24px] aspect-[3/4] sm:aspect-[4/5] max-h-[78vh]">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                        <canvas ref={captureRef} className="hidden" />
                        <canvas ref={analyzerRef} className="hidden" />

                    {stream && (() => {
                      // Compute single source of truth for the status
                      const status =
                        !live.facePresent ? { tone: "neutral", icon: ScanFace, msg: "Looking for your face" } :
                        !live.centered ? { tone: "warn", icon: Target, msg: "Center your face in the oval" } :
                        !live.poseOk ? { tone: "info", icon: activeAngle === "left" ? ArrowLeft : activeAngle === "right" ? ArrowRight : ScanFace, msg: activeAngle === "left" ? "Slowly turn left" : activeAngle === "right" ? "Slowly turn right" : "Look straight ahead" } :
                        live.brightness < 0.30 ? { tone: "warn", icon: Sun, msg: "Need more light" } :
                        live.motion >= 0.18 ? { tone: "warn", icon: Activity, msg: "Hold still" } :
                        live.sharpness < 0.18 ? { tone: "warn", icon: Activity, msg: "Steady — focusing" } :
                        angles[activeAngle] ? { tone: "good", icon: CheckCircle2, msg: "Captured" } :
                        { tone: "good", icon: CheckCircle2, msg: "Hold steady — capturing" }
                      const StatusIcon = status.icon
                      const dotColor = status.tone === "good" ? "bg-emerald-400" : status.tone === "warn" ? "bg-amber-400" : status.tone === "info" ? "bg-sky-400" : "bg-white/70"
                      return (
                        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
                          {/* Primary status — glass pill */}
                          <div className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md text-white text-xs font-medium ring-1 ring-white/10 shadow-lg max-w-[62%]">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
                            </span>
                            <StatusIcon className="w-3.5 h-3.5 opacity-90 shrink-0" />
                            <span className="truncate leading-tight">{status.msg}</span>
                          </div>
                          {/* Right-side compact metric chips */}
                          <div className="flex flex-col items-end gap-1.5 max-w-[36%]">
                            <div className="flex items-center gap-1.5">
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[10px] font-semibold ring-1 ring-white/10 tabular-nums">
                                <Sun className="w-3 h-3 text-amber-300" />
                                {Math.round(live.brightness * 100)}
                              </div>
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[10px] font-semibold ring-1 ring-white/10 tabular-nums">
                                <Sparkles className="w-3 h-3 text-emerald-300" />
                                {Math.round(live.quality * 100)}
                              </div>
                            </div>
                            {live.counts.darkcircle > 0 && (
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500/85 backdrop-blur-md text-white text-[10px] font-semibold ring-1 ring-white/20">
                                <Eye className="w-3 h-3" />
                                {live.counts.darkcircle} dark circle{live.counts.darkcircle !== 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Animated movement guide (left/right turns) */}
                    {stream && live.facePresent && !live.poseOk && !angles[activeAngle] && activeAngle !== "front" && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <MovementGuide direction={activeAngle as "left" | "right"} />
                      </div>
                    )}

                    {/* Refined hold-timer ring (bottom center) */}
                    {stream && stableMs > 0 && !angles[activeAngle] && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                        <HoldProgress ms={stableMs} total={8000} />
                      </div>
                    )}

                    {/* Slim bottom progress line */}
                    {stream && (
                      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5">
                        <div className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 transition-all duration-150" style={{ width: `${Math.min(100, (stableMs / 8000) * 100)}%` }} />
                      </div>
                    )}

                    {!stream && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black px-6 py-10 text-center">
                        {/* Decorative concentric rings (responsive) */}
                        <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-[88%] aspect-square rounded-full border border-white/[0.04]" />
                          <div className="absolute w-[70%] aspect-square rounded-full border border-white/[0.05]" />
                          <div className="absolute w-[52%] aspect-square rounded-full border border-white/[0.06]" />
                          <div className="absolute w-[34%] aspect-square rounded-full border border-white/[0.08]" />
                        </div>
                        {/* Subtle scanning beam */}
                        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" style={{ animation: "scan-beam 3.2s ease-in-out infinite" }} />
                        <style>{`
                          @keyframes scan-beam {
                            0%, 100% { transform: translateY(0); opacity: 0 }
                            10%, 90% { opacity: 1 }
                            50% { transform: translateY(70vh); opacity: 1 }
                          }
                        `}</style>

                        <div className="relative mb-6">
                          <div className="absolute inset-0 bg-primary/40 rounded-full blur-2xl animate-pulse" />
                          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-2xl ring-1 ring-white/20">
                            <ScanFace className="w-12 h-12 sm:w-14 sm:h-14 text-white" strokeWidth={1.7} />
                          </div>
                        </div>
                        <h3 className="text-white text-2xl sm:text-3xl font-bold mb-2 tracking-tight">Ready when you are</h3>
                        <p className="text-slate-400 text-sm sm:text-base mb-7 max-w-sm leading-relaxed">
                          Frames stay on your device. Nothing is uploaded until you press Analyze.
                        </p>
                        <Button size="lg" onClick={startCamera} className="rounded-full gap-2 bg-white text-slate-900 hover:bg-slate-100 font-semibold shadow-2xl px-8 h-[52px] text-[15px] min-w-[200px]">
                          <Camera className="w-[18px] h-[18px]" /> Enable camera
                        </Button>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> On-device</span>
                          <span className="text-slate-600">·</span>
                          <span className="inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-sky-400" /> AI tracking</span>
                          <span className="text-slate-600">·</span>
                          <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-400" /> 12 concerns</span>
                        </div>
                      </div>
                    )}
                      </div>
                    </div>
                  </div>

                  {stream && (
                    <div className="mt-5 flex items-center justify-center gap-3 sm:gap-5">
                      {/* Left: auto-capture toggle */}
                      <button
                        onClick={() => setAutoCapture(!autoCapture)}
                        aria-pressed={autoCapture}
                        className={`group inline-flex items-center gap-2 h-11 px-3.5 rounded-full border transition-all active:scale-95 touch-manipulation ${
                          autoCapture
                            ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className={`relative w-8 h-5 rounded-full transition-colors ${autoCapture ? "bg-primary" : "bg-muted"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoCapture ? "translate-x-3" : "translate-x-0"}`} />
                        </span>
                        <span className="text-xs font-semibold">Auto</span>
                      </button>

                      {/* Center: Pro shutter button */}
                      <button
                        onClick={captureCurrent}
                        aria-label="Capture frame"
                        className="group relative w-16 h-16 rounded-full p-1 ring-2 ring-foreground/20 hover:ring-foreground/40 active:scale-95 transition-all touch-manipulation"
                      >
                        <span className="block w-full h-full rounded-full bg-gradient-to-br from-white to-slate-200 dark:from-slate-100 dark:to-slate-300 group-active:scale-90 transition-transform shadow-inner" />
                        <span className="absolute inset-0 flex items-center justify-center text-slate-700">
                          <Camera className="w-5 h-5" strokeWidth={2.2} />
                        </span>
                      </button>

                      {/* Right: Reset / Retake */}
                      <button
                        onClick={() => { setAngles({ front: null, left: null, right: null }); setActiveAngle("front"); bestRef.current = { score: 0, dataUrl: null }; lastStableRef.current = 0; setStableMs(0) }}
                        disabled={filledCount === 0}
                        className="inline-flex items-center gap-2 h-11 px-3.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30 active:scale-95 transition-all touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">Retake</span>
                      </button>
                    </div>
                  )}

                  {/* Premium info pills under controls */}
                  <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" /> Private — on-device
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                      <Eye className="w-3 h-3" /> Live AI overlay
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      <Sparkles className="w-3 h-3" /> 12 concerns analysed
                    </span>
                  </div>
                </TabsContent>

                <TabsContent value="upload">
                  <div className={`grid gap-4 ${quickMode ? "grid-cols-1 max-w-sm mx-auto" : "md:grid-cols-3"}`}>
                    {visibleAngles.map((a) => (
                      <label key={a.id} className="cursor-pointer">
                        <div className="rounded-xl border-2 border-dashed border-border hover:border-primary aspect-square overflow-hidden flex items-center justify-center relative">
                          {angles[a.id] ? (
                            <img src={angles[a.id]!} alt={a.label} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center p-4 text-muted-foreground">
                              <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                              <div className="font-medium text-sm">{a.label}</div>
                              <div className="text-xs">{a.hint}</div>
                            </div>
                          )}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(a.id, e.target.files[0])} />
                      </label>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6 pt-5 border-t border-border/60 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex -space-x-1">
                    {Array.from({ length: requiredCount }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold ${
                          i < filledCount
                            ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i < filledCount ? "✓" : i + 1}
                      </div>
                    ))}
                  </div>
                  <span className="font-semibold text-sm">
                    {filledCount}/{requiredCount} {quickMode ? "captured" : "angles"}
                  </span>
                  {!quickMode && filledCount > 0 && (
                    <span className="hidden sm:inline text-xs text-muted-foreground">· more = higher confidence</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset} className="flex-1 sm:flex-initial gap-1.5">
                    <RefreshCw className="w-4 h-4" /> Reset
                  </Button>
                  <Button
                    onClick={analyze}
                    disabled={analyzing || filledCount === 0}
                    size="lg"
                    className="flex-1 sm:flex-initial bg-gradient-to-r from-primary to-secondary hover:opacity-95 text-white font-bold shadow-lg shadow-primary/30 gap-2"
                  >
                    {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> :
                      <><Sparkles className="w-4 h-4" /> {filledCount > 1 ? `Analyze ${filledCount} angles` : "Analyze my skin"}</>}
                  </Button>
                </div>
              </div>
              {error && <div className="mt-4 text-sm text-red-500">{error}</div>}
            </CardContent>
          </Card>
        )}

        {result && <AnalysisDisplay result={result} onReset={reset} />}
      </div>
    </section>
  )
}

function AnalysisDisplay({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const concernEntries = Object.entries(result.concerns)
  const topConcerns = concernEntries.filter(([k]) => k !== "hydration" && k !== "evenness").sort((a, b) => b[1] - a[1]).slice(0, 3)
  const positives = concernEntries.filter(([k, v]) => (k === "hydration" || k === "evenness") && v >= 60)

  const share = async () => {
    const text = `My SkinInsight Pro scan: ${result.skinType.label} skin · overall ${Math.round(result.overallScore)}/100${result.skinAge ? ` · skin-age ~${result.skinAge.estimate}` : ""}.`
    if (navigator.share) { try { await navigator.share({ title: "SkinInsight Pro", text }) } catch {} }
    else { await navigator.clipboard.writeText(text); alert("Summary copied to clipboard") }
  }
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob); const a = document.createElement("a")
    a.href = url; a.download = `skin-scan-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }
  const [pdfBusy, setPdfBusy] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const downloadPdf = async () => {
    if (pdfBusy) return
    setPdfBusy(true)
    setExportOpen(false)
    try {
      await buildSkinReportPdf({
        overallScore: result.overallScore,
        skinType: result.skinType,
        skinAge: result.skinAge,
        lesionCount: result.lesionCount,
        anglesAnalyzed: result.anglesAnalyzed,
        agreement: result.agreement,
        version: result.version,
        concerns: result.concerns as any,
        recommendations: result.recommendations as any,
        ingredientPriority: result.ingredientPriority as any,
        routine: result.routine as any,
        diet: result.diet,
        lifestyle: result.lifestyle,
        severityAlerts: result.severityAlerts as any,
      })
    } catch (e: any) {
      console.error("PDF generation failed", e)
      alert(`PDF generation failed: ${e?.message || e}\n\nCheck the browser console for details.`)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div id="analysis-result" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary"><TrendingUp className="w-3 h-3 mr-1" /> {result.anglesAnalyzed}-angle ensemble</Badge>
          <Badge variant="outline">Agreement {Math.round((result.agreement || 0) * 100)}%</Badge>
          {result.version && <Badge variant="outline">v{result.version}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={share}><Share2 className="w-4 h-4 mr-1" /> Share</Button>
          <Button
            size="sm"
            onClick={downloadPdf}
            disabled={pdfBusy}
            className="bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 shadow-md"
          >
            {pdfBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
            {pdfBusy ? "Building PDF…" : "Download PDF"}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJson} title="Export raw JSON">
            <FileJson className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}><RefreshCw className="w-4 h-4 mr-1" /> New scan</Button>
        </div>
      </div>

      {/* Hero Score Card — clean, professional */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white shadow-xl relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <CardContent className="p-0 relative">
          {/* Top status strip */}
          <div className="flex items-center justify-between gap-2 px-6 md:px-8 pt-4 text-[11px] font-mono uppercase tracking-widest text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              Live skin analysis
            </span>
            <span suppressHydrationWarning>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>

          <div className="grid md:grid-cols-[auto_1fr] gap-6 md:gap-8 p-6 md:p-8 pt-5 items-center">
            <ScoreRing score={Math.round(result.overallScore)} concerns={result.concerns} />
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/70 mb-1 inline-flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Your skin report
                  </span>
                  <ScoreDelta current={Math.round(result.overallScore)} />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold leading-tight capitalize">
                  {result.skinType.label} skin · {scoreVerdict(result.overallScore)}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <HeroStat
                  icon={ScanFace}
                  tone="cyan"
                  label="Skin type"
                  value={result.skinType.label}
                  sub={`${Math.round(result.skinType.confidence * 100)}% confidence`}
                />
                {result.skinAge && (
                  <HeroStat
                    icon={Clock}
                    tone="violet"
                    label="Skin age"
                    value={`~${result.skinAge.estimate}`}
                    sub={result.skinAge.band}
                  />
                )}
                <HeroStat
                  icon={Target}
                  tone="amber"
                  label="Spots found"
                  value={String(result.lesionCount)}
                  sub={`${result.anglesAnalyzed} angle${result.anglesAnalyzed > 1 ? "s" : ""}`}
                />
                <HeroStat
                  icon={Flame}
                  tone="rose"
                  label="Top concern"
                  value={CONCERN_META[topConcerns[0]?.[0]]?.label || "—"}
                  sub={topConcerns[0] ? `${Math.round(topConcerns[0][1])}/100 severity` : ""}
                />
              </div>

              {/* Quick action chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href="#routine"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-slate-900 hover:bg-white/90 transition shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" /> View tailored routine
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a
                  href="#products"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/25 hover:bg-white/25 transition"
                >
                  <Pill className="w-3.5 h-3.5" /> Recommended products
                </a>
                <a
                  href="#coach"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/25 hover:bg-white/25 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Ask AI coach
                </a>
              </div>
            </div>
          </div>
        </CardContent>

      </Card>

      {/* Severity alerts — surfaced immediately after hero */}
      {result.severityAlerts && result.severityAlerts.length > 0 && (
        <div className="space-y-2">
          {result.severityAlerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${severityText(a.level)}`}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium capitalize text-sm">{a.concern.replace(/_/g, " ")} · {a.level} priority</div>
                <div className="text-sm">{a.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tightened plain-English action plan */}
      <ActionPlan result={result} />

      <AskCoachSuggestions result={result} />

      {/* ── Top focus + heatmap ── */}
      <div className="grid lg:grid-cols-5 gap-4">
        {result.heatmap && (
          <Card className="lg:col-span-2 overflow-hidden border bg-card hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-bold leading-tight">Concern heatmap</div>
                    <div className="text-[10px] text-muted-foreground">AI-detected zones across your face</div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] border-0">Visual</Badge>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-black/5 ring-1 ring-border">
                <img src={result.heatmap} alt="heatmap" className="w-full" />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 to-transparent" />
              </div>
              {result.heatmapLegend && (
                <div className="flex flex-wrap gap-2 text-[11px] mt-3">
                  {Object.entries(result.heatmapLegend).map(([k, v]) => (
                    <div key={k} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/80 border border-border/50">
                      <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white/60 shadow" style={{ background: k }} /> {v}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <div className={`${result.heatmap ? "lg:col-span-3" : "lg:col-span-5"} space-y-3`}>
          <SectionHeader
            icon={Target}
            title="Top focus areas"
            subtitle="Where to direct your attention first"
            iconBg="from-rose-500 to-pink-500"
            badge="Personalized"
          />
          <div className="grid sm:grid-cols-3 gap-3">
            {topConcerns.map(([k, v], i) => {
              const meta = CONCERN_META[k] || { icon: Activity, label: k, color: "#888" }
              const info = CONCERN_INFO[k] || { what: "", quickAction: "" }
              const Icon = meta.icon
              const sev = v >= 65 ? "High" : v >= 40 ? "Medium" : "Low"
              const sevColor = v >= 65 ? "bg-rose-500" : v >= 40 ? "bg-amber-500" : "bg-emerald-500"
              return (
                <div key={k} className="group relative rounded-2xl border bg-gradient-to-br from-background to-muted/40 p-4 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden">
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition" style={{ background: meta.color }} />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md" style={{ background: meta.color }}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge className={`${sevColor} text-white text-[10px] border-0`}>{sev}</Badge>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">#{i + 1}</span>
                      <span className="font-semibold text-sm">{meta.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <span className="text-2xl font-bold tabular-nums" style={{ color: meta.color }}>{Math.round(v)}</span>
                      <span className="text-xs text-muted-foreground">/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
                      <div className="h-full transition-all" style={{ width: `${v}%`, background: meta.color }} />
                    </div>
                    {info.what && <p className="text-[11px] text-muted-foreground leading-snug mb-2">{info.what}</p>}
                    {info.quickAction && (
                      <div className="flex items-start gap-1.5 text-[11px] bg-background/60 rounded-md p-2 border border-border/40">
                        <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: meta.color }} />
                        <span className="text-foreground/90">{info.quickAction}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {positives.length > 0 && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 flex items-center gap-3 flex-wrap">
              <Award className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Strengths:</span>
              {positives.map(([k, v]) => (
                <Badge key={k} variant="outline" className="bg-background text-emerald-700 dark:text-emerald-300 border-emerald-300 capitalize text-[10px]">
                  {(CONCERN_META[k]?.label || k)} · {Math.round(v)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Regional breakdown: face diagram with region scores ── */}
      {result.regions && Object.keys(result.regions).length > 0 && (
        <Card className="overflow-hidden border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-base font-bold leading-tight">Regional breakdown</div>
                  <div className="text-[11px] text-muted-foreground">Heatmap of oiliness, redness &amp; spots per zone</div>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] border-0 inline-flex items-center gap-1">
                <Info className="w-3 h-3" /> Tap a zone
              </Badge>
            </div>
            <FaceDiagram regions={result.regions} />
          </CardContent>
        </Card>
      )}

      {/* ── All concerns: filterable + sortable grid ── */}
      <AllConcernsGrid concerns={concernEntries} />

      {/* ── Ingredient priority: rich cards ── */}
      {result.ingredientPriority && result.ingredientPriority.length > 0 && (
        <Card className="overflow-hidden border bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                  <Pill className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-base font-bold leading-tight">Ingredient priority</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Look for these on labels — ranked for your scan results.</div>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] border-0">{result.ingredientPriority.length} matches</Badge>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.ingredientPriority.map((ip, i) => {
                const isTop = i === 0
                return (
                  <div
                    key={i}
                    className={`group relative rounded-2xl border-2 p-4 transition-all overflow-hidden hover:-translate-y-0.5 hover:shadow-xl ${
                      isTop
                        ? "border-emerald-400/60 bg-gradient-to-br from-emerald-500/10 via-background to-teal-500/5 shadow-md shadow-emerald-500/10"
                        : "border-border/60 bg-background hover:border-emerald-300/60 dark:hover:border-emerald-700/60"
                    }`}
                  >
                    {/* corner glow */}
                    <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-emerald-400/20 blur-2xl group-hover:bg-emerald-400/30 transition" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold shadow-sm ${
                            isTop
                              ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          }`}>{i + 1}</div>
                          <div className="font-bold text-sm leading-tight">{ip.ingredient}</div>
                        </div>
                        {isTop && (
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px] shadow">
                            <Award className="w-2.5 h-2.5 mr-0.5" />Top pick
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Helps with</div>
                      <div className="flex flex-wrap gap-1">
                        {ip.helps.map((h, j) => (
                          <Badge key={j} variant="secondary" className="text-[10px] capitalize bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                            {h}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Top recommendations: priority numbered cards ── */}
      {result.recommendations && result.recommendations.length > 0 && (
        <Card className="overflow-hidden border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-base font-bold leading-tight">Top recommendations</div>
                  <div className="text-[11px] text-muted-foreground">Action plan ranked by your concern severity</div>
                </div>
              </div>
              <a href="#products" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 transition group">
                Browse matched products
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </a>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {result.recommendations.slice(0, 4).map((r, i) => {
                const meta = CONCERN_META[r.concern] || { icon: Activity, label: r.concern, color: "#888" }
                const Icon = meta.icon
                const lvlColor = r.level === "high" ? "from-rose-500 to-red-500" : r.level === "medium" ? "from-amber-500 to-orange-500" : "from-blue-500 to-cyan-500"
                const lvlBg = r.level === "high" ? "bg-rose-500/10 text-rose-600 dark:text-rose-300" : r.level === "medium" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                return (
                  <div key={i} className="group relative rounded-2xl border-2 border-border/60 p-4 hover:shadow-xl hover:-translate-y-0.5 hover:border-amber-300/60 dark:hover:border-amber-700/60 transition-all bg-card overflow-hidden">
                    {/* color stripe */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${lvlColor}`} />
                    {/* big rank number */}
                    <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-gradient-to-br from-muted to-background border-2 border-border/60 flex items-center justify-center text-base font-extrabold text-muted-foreground shadow-sm group-hover:scale-110 transition">
                      {i + 1}
                    </div>
                    <div className="flex items-start gap-3 mb-3 pr-10">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-md" style={{ background: meta.color }}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold capitalize text-sm leading-tight">{meta.label}</div>
                        <Badge className={`mt-1 ${lvlBg} border-0 text-[10px] capitalize font-semibold`}>
                          {r.level === "high" && <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
                          {r.level} priority
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed mb-3">{r.tip}</p>
                    {r.ingredients && r.ingredients.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-3 border-t border-dashed border-border/60">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mr-1 self-center inline-flex items-center gap-1">
                          <Pill className="w-3 h-3" /> Use
                        </span>
                        {r.ingredients.map((ing, j) => (
                          <Badge key={j} variant="outline" className="text-[10px] bg-emerald-500/5 border-emerald-300/40 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300">
                            {ing}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Your skincare day: interactive routine timeline ── */}
      {result.routine && <RoutineTimeline routine={result.routine} />}

      <div className="grid md:grid-cols-2 gap-4">
        {result.diet && (
          <TipsCard
            title="Diet tips"
            subtitle="What to eat for healthier skin"
            tips={result.diet}
            icon={Heart}
            tone="rose"
          />
        )}
        {result.lifestyle && (
          <TipsCard
            title="Lifestyle tips"
            subtitle="Daily habits that move the needle"
            tips={result.lifestyle}
            icon={Sparkles}
            tone="sky"
          />
        )}
      </div>
    </div>
  )
}

// ─── Score delta vs previous scan ───
function ScoreDelta({ current }: { current: number }) {
  const [prev, setPrev] = useState<number | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("skinpro:history")
      const arr: any[] = raw ? JSON.parse(raw) : []
      // newest entry is the just-saved current scan; find the one before
      if (arr.length >= 2) {
        const previous = arr[arr.length - 2]
        if (previous && typeof previous.overall === "number") {
          setPrev(Math.round(previous.overall))
        }
      }
    } catch {}
  }, [current])
  if (prev === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold text-white/80">
        first scan
      </span>
    )
  }
  const delta = current - prev
  const up = delta >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
        up
          ? "bg-emerald-500/20 border-emerald-300/40 text-emerald-200"
          : "bg-rose-500/20 border-rose-300/40 text-rose-200"
      }`}
      title={`Previous scan: ${prev}/100`}
    >
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {delta} vs last
    </span>
  )
}

// ─── Action plan: tightened, ranked by severity, no duplication with hero ───
function ActionPlan({ result }: { result: AnalysisResult }) {
  const PRETTY: Record<string, string> = {
    dark_circles: "dark circles",
    blackheads: "blackheads",
  }
  const pretty = (c: string) => PRETTY[c] || c.replace(/_/g, " ")

  const concernEntries = Object.entries(result.concerns)
  const top = concernEntries
    .filter(([k]) => k !== "hydration" && k !== "evenness")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  const hydration = (result.concerns as any).hydration as number | undefined
  const evenness = (result.concerns as any).evenness as number | undefined

  // Build a prioritized 4-step weekly plan
  type Step = {
    icon: any
    label: string
    title: string
    body: string
    severity?: "high" | "medium" | "low"
  }
  const steps: Step[] = []

  // 1 — always SPF
  steps.push({
    icon: Sun,
    label: "Every morning",
    title: "Cleanse → moisturize → SPF 50",
    body: `Sunscreen is the single biggest lever${
      top[0] ? ` for ${pretty(top[0][0])}` : ""
    }. Reapply every 3–4 hrs outdoors.`,
  })

  // 2 — top concern
  if (top[0]) {
    const k = top[0][0]
    const sev = top[0][1]
    const tip =
      (CONCERN_INFO as any)[k]?.quickAction ||
      "Use the recommended actives below in the right order."
    steps.push({
      icon: Target,
      label: `Treat: ${pretty(k)}`,
      title: `${Math.round(sev)}/100 severity — start here`,
      body: tip,
      severity: sev >= 65 ? "high" : sev >= 40 ? "medium" : "low",
    })
  }

  // 3 — hydration if low, else 2nd concern
  if (typeof hydration === "number" && hydration < 60) {
    steps.push({
      icon: Droplets,
      label: "Hydrate",
      title: `Hydration ${Math.round(hydration)}/100 — boost it`,
      body: "Layer hyaluronic-acid serum + a ceramide moisturizer at night. 2L water/day.",
      severity: hydration < 40 ? "high" : "medium",
    })
  } else if (top[1]) {
    const k = top[1][0]
    const sev = top[1][1]
    const tip =
      (CONCERN_INFO as any)[k]?.quickAction ||
      "Add a targeted active two nights a week."
    steps.push({
      icon: ShieldCheck,
      label: `Then: ${pretty(k)}`,
      title: `${Math.round(sev)}/100 severity`,
      body: tip,
      severity: sev >= 65 ? "high" : sev >= 40 ? "medium" : "low",
    })
  }

  // 4 — consistency / re-scan
  steps.push({
    icon: Heart,
    label: "Stick with it",
    title: "Re-scan in 7 days",
    body: "Real skin change takes 4–6 weeks. Track your streak in Daily Routine and rescan weekly to see your score climb.",
  })

  const sevTone = (s?: Step["severity"]) =>
    s === "high"
      ? "text-rose-600 dark:text-rose-400 ring-rose-500/30"
      : s === "medium"
      ? "text-amber-600 dark:text-amber-400 ring-amber-500/30"
      : "text-primary ring-primary/20"

  return (
    <Card className="overflow-hidden border bg-card">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                This week
              </div>
              <div className="text-base sm:text-lg font-bold leading-tight">
                Your action plan
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {typeof hydration === "number" && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${
                  hydration >= 70
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                <Droplets className="w-3 h-3" /> Hydration {Math.round(hydration)}
              </span>
            )}
            {typeof evenness === "number" && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${
                  evenness >= 70
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                <ShieldCheck className="w-3 h-3" /> Tone {Math.round(evenness)}
              </span>
            )}
          </div>
        </div>

        <ol className="relative space-y-3">
          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <li
                key={i}
                className="relative flex gap-3 sm:gap-4 rounded-xl border bg-muted/20 p-3 sm:p-4"
              >
                <div
                  className={`shrink-0 w-9 h-9 rounded-xl bg-background flex items-center justify-center border ring-2 ${sevTone(
                    s.severity,
                  )}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Step {i + 1}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">
                      · {s.label}
                    </span>
                    {s.severity === "high" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300">
                        HIGH
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-sm sm:text-[15px] mt-0.5 leading-tight">
                    {s.title}
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-snug mt-1">
                    {s.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

// ─── Ask AI Coach: personalised suggested questions after a scan ───
function AskCoachSuggestions({ result }: { result: AnalysisResult }) {
  const PRETTY: Record<string, string> = {
    dark_circles: "dark circles", fine_lines: "fine lines", uneven_tone: "uneven tone",
    enlarged_pores: "enlarged pores", blackheads: "blackheads",
  }
  const pretty = (c: string) => PRETTY[c] || c.replace(/_/g, " ")

  const concernEntries = Object.entries(result.concerns)
  const top = concernEntries.filter(([k]) => k !== "hydration" && k !== "evenness")
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
  const hydration = (result.concerns as any).hydration
  const skinAge = result.skinAge?.estimate
  const skinType = result.skinType?.label || "your"

  const questions: { icon: string; q: string }[] = []
  if (top[0]) questions.push({ icon: "🎯", q: `What's causing my ${pretty(top[0])} and how do I fix it?` })
  questions.push({ icon: "✨", q: `Build me a complete morning + night routine for ${skinType.toLowerCase()} skin` })
  if (top[1]) questions.push({ icon: "🧪", q: `Best ingredients to treat ${pretty(top[1])}?` })
  questions.push({ icon: "🛍️", q: `Recommend affordable products for my top concerns` })
  if (typeof hydration === "number" && hydration < 60) {
    questions.push({ icon: "💧", q: `My hydration is ${Math.round(hydration)}/100 — how do I boost it?` })
  }
  if (skinAge && skinAge > 28) {
    questions.push({ icon: "⏳", q: `Tips to look younger than my skin age of ${skinAge}?` })
  }
  if (top[2]) questions.push({ icon: "💡", q: `Quick daily tips for ${pretty(top[2])}` })
  questions.push({ icon: "❓", q: `What lifestyle changes will improve my skin score?` })

  const ask = (q: string) => {
    window.dispatchEvent(new CustomEvent("skinpro:askCoach", { detail: { question: q } }))
  }

  return (
    <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-slate-100 shadow-xl relative">
      {/* sheen */}
      <div className="absolute inset-0 pointer-events-none opacity-50"
        style={{ background: "radial-gradient(80% 60% at 100% 0%, rgba(99,102,241,0.25) 0%, transparent 60%), radial-gradient(70% 50% at 0% 100%, rgba(236,72,153,0.18) 0%, transparent 60%)" }} />
      <CardContent className="relative p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-11 h-11 shrink-0">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center"
                style={{ boxShadow: "0 6px 18px -4px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.35)" }}>
                <span aria-hidden className="absolute inset-x-1.5 top-1 h-1/2 rounded-xl opacity-50"
                  style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.6), transparent)" }} />
                <Sparkles className="relative w-5 h-5 text-white" strokeWidth={2.4} />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.18em] text-indigo-300 font-bold flex items-center gap-1.5">
                <MessageCircle className="w-3 h-3" /> Ask your AI coach
              </div>
              <div className="font-extrabold text-lg leading-tight mt-0.5">Pick a question — get a personalised answer</div>
              <div className="text-xs text-slate-400 mt-0.5">Answers are tailored to this scan</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {questions.map((it) => (
            <button
              key={it.q}
              onClick={() => ask(it.q)}
              className="group inline-flex items-center gap-2 max-w-full text-left px-3.5 py-2.5 rounded-2xl bg-white/[0.05] border border-white/10 hover:border-indigo-400/50 hover:bg-white/[0.08] active:scale-[0.98] transition text-[13px] font-medium text-slate-100"
            >
              <span className="text-base leading-none shrink-0">{it.icon}</span>
              <span className="truncate sm:whitespace-normal sm:line-clamp-2">{it.q}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
            </button>
          ))}
        </div>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("skinpro:openCoach"))}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-indigo-200 transition"
        >
          Open chat & ask my own question
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </CardContent>
    </Card>
  )
}

function RegionBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5"><span>{label}</span><span>{Math.round(value)}</span></div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} /></div>
    </div>
  )
}

// ── Face diagram for Regional breakdown ───────────────────────────────────
function FaceDiagram({ regions }: { regions: Record<string, { oiliness: number; redness: number; spots: number }> }) {
  const [active, setActive] = useState<string | null>(null)
  const entries = Object.entries(regions)
  const cur = active && regions[active] ? { key: active, ...regions[active] } : null
  // Region positions on the SVG (cx, cy, rx, ry as percent of viewBox 200x240)
  const HOTSPOTS: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
    forehead: { cx: 100, cy: 60, rx: 55, ry: 28 },
    nose: { cx: 100, cy: 130, rx: 18, ry: 35 },
    left_cheek: { cx: 60, cy: 140, rx: 25, ry: 28 },
    right_cheek: { cx: 140, cy: 140, rx: 25, ry: 28 },
    chin: { cx: 100, cy: 195, rx: 30, ry: 22 },
  }
  const heatColor = (v: number) => v >= 60 ? "#ef4444" : v >= 40 ? "#f97316" : v >= 25 ? "#facc15" : "#10b981"
  const score = (r: { oiliness: number; redness: number; spots: number }) => Math.max(r.oiliness, r.redness, r.spots)
  return (
    <div className="grid md:grid-cols-2 gap-6 items-center">
      <div className="relative max-w-xs mx-auto w-full">
        <svg viewBox="0 0 200 240" className="w-full h-auto">
          {/* Face outline */}
          <ellipse cx="100" cy="120" rx="75" ry="100" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
          {/* Hair shadow */}
          <path d="M 30 70 Q 100 -10 170 70 L 170 95 Q 100 60 30 95 Z" fill="hsl(var(--muted-foreground)/0.15)" />
          {entries.map(([k, v]) => {
            const h = HOTSPOTS[k]
            if (!h) return null
            const s = score(v)
            const isActive = active === k
            return (
              <g key={k} onClick={() => setActive(k === active ? null : k)} className="cursor-pointer">
                <ellipse
                  cx={h.cx} cy={h.cy} rx={h.rx} ry={h.ry}
                  fill={heatColor(s)} fillOpacity={isActive ? 0.65 : 0.42}
                  stroke={heatColor(s)} strokeOpacity={isActive ? 1 : 0.7} strokeWidth={isActive ? 2.5 : 1.5}
                  className="transition-all hover:fill-opacity-60"
                />
                <text x={h.cx} y={h.cy + 4} textAnchor="middle" className="fill-white text-[10px] font-bold pointer-events-none" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
                  {Math.round(s)}
                </text>
              </g>
            )
          })}
          {/* Eyes */}
          <ellipse cx="75" cy="105" rx="6" ry="3" fill="hsl(var(--foreground)/0.4)" />
          <ellipse cx="125" cy="105" rx="6" ry="3" fill="hsl(var(--foreground)/0.4)" />
        </svg>
        <div className="text-[10px] text-center text-muted-foreground mt-2">Tap any zone for details</div>
      </div>
      <div>
        {!cur && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-3">Region snapshot · highest score per zone</div>
            {entries.map(([k, v]) => {
              const s = score(v)
              return (
                <button key={k} onClick={() => setActive(k)} className="w-full flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50 transition text-left">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: heatColor(s) }} />
                  <span className="text-sm font-medium flex-1">{REGION_LABELS[k] || k}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: heatColor(s) }}>{Math.round(s)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        )}
        {cur && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{REGION_LABELS[cur.key] || cur.key}</div>
              <button onClick={() => setActive(null)} className="text-[11px] text-muted-foreground hover:text-foreground">← Back</button>
            </div>
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <RegionBar label="Oiliness" value={cur.oiliness} color="bg-yellow-500" />
              <RegionBar label="Redness" value={cur.redness} color="bg-orange-500" />
              <RegionBar label="Spots" value={cur.spots} color="bg-purple-500" />
            </div>
            <div className="text-xs text-muted-foreground">
              {score(cur) >= 60 ? "This zone needs the most attention — start your routine here." :
               score(cur) >= 40 ? "Moderate signs — consistent care will help." :
               "This zone looks healthy. Keep it up."}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── All concerns grid: filterable + sortable ──────────────────────────────
function AllConcernsGrid({ concerns }: { concerns: [string, number][] }) {
  const [sortMode, setSortMode] = useState<"severity" | "alpha">("severity")
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all")
  const filtered = concerns.filter(([k, v]) => {
    if (filter === "all") return true
    const meta = CONCERN_META[k]
    const eff = meta?.positive ? 100 - v : v
    if (filter === "high") return eff >= 60
    if (filter === "medium") return eff >= 35 && eff < 60
    return eff < 35
  })
  const sorted = [...filtered].sort((a, b) => sortMode === "alpha"
    ? (CONCERN_META[a[0]]?.label || a[0]).localeCompare(CONCERN_META[b[0]]?.label || b[0])
    : b[1] - a[1])
  return (
    <Card className="overflow-hidden border-2 border-sky-200/50 dark:border-sky-900/40 bg-gradient-to-br from-sky-50/30 via-background to-blue-50/20 dark:from-sky-950/15 dark:to-blue-950/10">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-md shadow-sky-500/25">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-base font-bold leading-tight">All concerns</div>
              <div className="text-[11px] text-muted-foreground">{sorted.length} of {concerns.length} shown · sorted {sortMode === "severity" ? "by severity" : "alphabetically"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-xl border-2 border-border/60 p-0.5 bg-background">
              {((["all","high","medium","low"] as const)).map(f => {
                const active = filter === f
                const dot = f === "high" ? "bg-rose-500" : f === "medium" ? "bg-amber-500" : f === "low" ? "bg-emerald-500" : ""
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition inline-flex items-center gap-1 ${
                      active ? "bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : dot}`} />}
                    {f}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setSortMode(s => s === "severity" ? "alpha" : "severity")}
              className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl border-2 border-border/60 bg-background hover:bg-muted hover:border-sky-300/60 transition font-semibold"
              title="Toggle sort"
            >
              <Filter className="w-3 h-3" /> {sortMode === "severity" ? "By severity" : "A → Z"}
            </button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(([k, v]) => {
            const meta = CONCERN_META[k] || { icon: Activity, label: k, color: "#888" }
            const Icon = meta.icon
            const eff = meta.positive ? 100 - v : v
            const sevLabel = eff >= 60 ? "High" : eff >= 35 ? "Medium" : "Low"
            const sevColor = eff >= 60 ? "text-rose-600 dark:text-rose-300" : eff >= 35 ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300"
            const sevBg = eff >= 60 ? "bg-rose-500/10" : eff >= 35 ? "bg-amber-500/10" : "bg-emerald-500/10"
            const info = CONCERN_INFO[k]
            return (
              <div
                key={k}
                className="group relative rounded-2xl border-2 border-border/60 p-3.5 hover:shadow-lg hover:-translate-y-0.5 hover:border-sky-300/60 dark:hover:border-sky-700/60 transition-all bg-card overflow-hidden"
              >
                {/* faint corner accent in concern color */}
                <div className="absolute -right-8 -top-8 w-20 h-20 rounded-full opacity-10 group-hover:opacity-20 transition" style={{ background: meta.color }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0" style={{ background: meta.color }}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-sm font-bold leading-tight">{meta.label}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sevBg} ${sevColor}`}>{sevLabel}</span>
                      <span className="text-base font-extrabold tabular-nums" style={{ color: meta.color }}>{Math.round(v)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden mb-1 relative">
                    <div
                      className="h-full transition-all rounded-full relative overflow-hidden"
                      style={{ width: `${v}%`, background: meta.positive ? (v >= 60 ? "#10b981" : "#94a3b8") : meta.color }}
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent ds-bar-shimmer" />
                    </div>
                  </div>
                  {info?.what && (
                    <div className="text-[10px] text-muted-foreground leading-snug opacity-0 group-hover:opacity-100 transition-opacity max-h-0 group-hover:max-h-20 overflow-hidden mt-2">
                      {info.what}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {sorted.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8 inline-flex flex-col items-center w-full gap-2">
            <Award className="w-6 h-6 text-emerald-500" />
            No concerns in this severity bucket — great news!
          </div>
        )}
        <style jsx global>{`
          @keyframes ds-bar-shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .ds-bar-shimmer { animation: ds-bar-shimmer 2.4s ease-in-out infinite; }
        `}</style>
      </CardContent>
    </Card>
  )
}

// ── Your skincare day: routine timeline with check-ins ───────────────────
function RoutineTimeline({ routine }: { routine: Record<string, string[]> }) {
  const todayKey = new Date().toISOString().slice(0, 10)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem("skinpro:routine")
      const all = raw ? JSON.parse(raw) : {}
      setChecked(all[todayKey] || {})
    } catch {}
  }, [todayKey])
  const toggle = (key: string) => {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        const raw = localStorage.getItem("skinpro:routine")
        const all = raw ? JSON.parse(raw) : {}
        all[todayKey] = next
        localStorage.setItem("skinpro:routine", JSON.stringify(all))
        window.dispatchEvent(new CustomEvent("skinpro:routine-updated"))
      } catch {}
      return next
    })
  }
  const allKeys: string[] = []
  Object.entries(routine).forEach(([when, steps]) => steps.forEach((_, i) => allKeys.push(`${when}-${i}`)))
  const doneCount = allKeys.filter(k => checked[k]).length
  const pct = allKeys.length ? Math.round((doneCount / allKeys.length) * 100) : 0
  const slotMeta: Record<string, { icon: any; color: string; bg: string; time: string }> = {
    morning: { icon: Sun, color: "text-amber-600", bg: "from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20", time: "AM · 6–9" },
    evening: { icon: Moon, color: "text-indigo-600", bg: "from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20", time: "PM · 8–10" },
    weekly: { icon: Sparkles, color: "text-purple-600", bg: "from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20", time: "1–2× / week" },
  }
  return (
    <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-purple-50/30 dark:to-purple-950/15">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-md shadow-primary/25">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-base font-bold leading-tight">Your skincare day</div>
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Today {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold">
              <CheckCircle2 className="w-3 h-3" />
              {doneCount}/{allKeys.length} done
            </div>
            <a href="#calendar" className="text-primary hover:underline flex items-center gap-1 font-semibold">
              View streak <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-5 relative">
          <div className="h-full bg-gradient-to-r from-primary via-violet-500 to-purple-600 transition-all relative overflow-hidden" style={{ width: `${pct}%` }}>
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent ds-bar-shimmer" />
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-foreground/70 tabular-nums">{pct}%</div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(routine).map(([when, steps]) => {
            const m = slotMeta[when] || { icon: Sparkles, color: "text-foreground", bg: "from-muted to-muted", time: "" }
            const Icon = m.icon
            const slotDone = steps.filter((_, i) => checked[`${when}-${i}`]).length
            return (
              <div key={when} className={`rounded-xl border bg-gradient-to-br ${m.bg} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg bg-background flex items-center justify-center ${m.color}`}><Icon className="w-4 h-4" /></div>
                    <div>
                      <div className="font-semibold capitalize text-sm">{when}</div>
                      <div className="text-[10px] text-muted-foreground">{m.time}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">{slotDone}/{steps.length}</span>
                </div>
                <ol className="space-y-1.5">
                  {steps.map((s, i) => {
                    const key = `${when}-${i}`
                    const done = !!checked[key]
                    return (
                      <li key={i}>
                        <button onClick={() => toggle(key)} className={`w-full flex items-start gap-2 text-left text-xs rounded-md p-2 transition ${done ? "bg-background/80 line-through text-muted-foreground" : "hover:bg-background/60"}`}>
                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition ${done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40"}`}>
                            {done && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>
                          <span className="flex-1 leading-snug"><span className="text-[10px] font-bold text-muted-foreground mr-1">{i + 1}.</span>{s}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })}
        </div>
        <div className="mt-4 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Info className="w-3 h-3" /> Tap a step to mark it done. Progress syncs to your skincare calendar.
        </div>
      </CardContent>
    </Card>
  )
}

function MovementGuide({ direction }: { direction: "left" | "right" }) {
  const Icon = direction === "left" ? ArrowLeft : ArrowRight
  return (
    <div className="flex flex-col items-center gap-2.5 select-none">
      {/* Refined arrow with sliding motion */}
      <div className="relative w-20 h-20 rounded-full bg-white/8 backdrop-blur-md ring-1 ring-white/20 flex items-center justify-center overflow-hidden">
        <span aria-hidden className="absolute inset-0 rounded-full bg-sky-400/15 animate-ping" style={{ animationDuration: "1.6s" }} />
        <Icon
          className="w-10 h-10 text-white drop-shadow-lg"
          strokeWidth={2.4}
          style={{ animation: `mg-slide-${direction} 1.4s ease-in-out infinite` }}
        />
        <style>{`
          @keyframes mg-slide-left {
            0%, 100% { transform: translateX(4px); opacity: 0.85 }
            50% { transform: translateX(-6px); opacity: 1 }
          }
          @keyframes mg-slide-right {
            0%, 100% { transform: translateX(-4px); opacity: 0.85 }
            50% { transform: translateX(6px); opacity: 1 }
          }
        `}</style>
      </div>
      <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md ring-1 ring-white/15 text-white text-[11px] font-semibold tracking-wide uppercase">
        Turn {direction}
      </div>
    </div>
  )
}

function HoldProgress({ ms, total }: { ms: number; total: number }) {
  const pct = Math.min(100, (ms / total) * 100)
  const r = 26
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const sec = Math.max(0, Math.ceil((total - ms) / 1000))
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      {/* Glowing backdrop */}
      <div aria-hidden className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md" />
      <div className="relative w-full h-full rounded-full bg-black/65 backdrop-blur-md ring-1 ring-white/15 shadow-xl flex items-center justify-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90 w-full h-full">
          <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
          <circle
            cx="32" cy="32" r={r} fill="none" stroke="url(#hp-grad)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.18s linear" }}
          />
          <defs>
            <linearGradient id="hp-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex flex-col items-center leading-none">
          <div className="text-white font-bold text-base tabular-nums">{sec}</div>
          <div className="text-[8px] text-white/60 font-semibold tracking-wider uppercase mt-0.5">hold</div>
        </div>
      </div>
    </div>
  )
}

/* ─── Reusable section header & tips card ─── */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  iconBg,
  badge,
}: {
  icon: any
  title: string
  subtitle?: string
  iconBg: string
  badge?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-md`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold leading-tight">{title}</h3>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {badge && (
        <Badge variant="secondary" className="text-[10px] bg-background border border-border/60">
          <Sparkles className="w-2.5 h-2.5 mr-0.5" /> {badge}
        </Badge>
      )}
    </div>
  )
}

function TipsCard({
  title,
  subtitle,
  tips,
  icon: Icon,
  tone,
}: {
  title: string
  subtitle?: string
  tips: string[]
  icon: any
  tone: "rose" | "sky"
}) {
  const tones: Record<string, { bg: string; ring: string; iconGrad: string; numBg: string; accent: string }> = {
    rose: {
      bg: "from-rose-50/50 via-background to-pink-50/30 dark:from-rose-950/15 dark:to-pink-950/10",
      ring: "border-rose-200/50 dark:border-rose-900/40",
      iconGrad: "from-rose-500 to-pink-500",
      numBg: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
      accent: "hover:border-rose-300/60 dark:hover:border-rose-700/60",
    },
    sky: {
      bg: "from-sky-50/50 via-background to-cyan-50/30 dark:from-sky-950/15 dark:to-cyan-950/10",
      ring: "border-sky-200/50 dark:border-sky-900/40",
      iconGrad: "from-sky-500 to-cyan-500",
      numBg: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
      accent: "hover:border-sky-300/60 dark:hover:border-sky-700/60",
    },
  }
  const t = tones[tone]
  return (
    <Card className={`overflow-hidden border-2 ${t.ring} bg-gradient-to-br ${t.bg}`}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${t.iconGrad} flex items-center justify-center shadow-md`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold leading-tight">{title}</div>
            {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">{tips.length}</Badge>
        </div>
        <ul className="space-y-2">
          {tips.map((d, i) => (
            <li
              key={i}
              className={`group flex items-start gap-3 p-2.5 rounded-xl bg-background/60 border border-border/50 ${t.accent} hover:shadow-sm transition-all`}
            >
              <div className={`w-6 h-6 rounded-lg ${t.numBg} flex items-center justify-center text-[11px] font-extrabold shrink-0 mt-0.5`}>
                {i + 1}
              </div>
              <span className="text-sm leading-snug text-foreground/90">{d}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function ScoreRing({ score, concerns }: { score: number; concerns?: Record<string, number> }) {  const r = 64
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))

  // Animated count-up + arc fill
  const [shown, setShown] = useState(0)
  const [delta, setDelta] = useState<number | null>(null)

  useEffect(() => {
    // load previous score for delta
    try {
      const prev = parseFloat(localStorage.getItem("skinpro:lastScore") || "")
      if (!Number.isNaN(prev)) setDelta(score - Math.round(prev))
      localStorage.setItem("skinpro:lastScore", String(score))
    } catch {}
    // ease count-up
    const start = performance.now()
    const dur = 1100
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(pct * eased))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score, pct])

  const offset = c - (shown / 100) * c

  // Grade letter
  const grade =
    pct >= 90 ? "A+" :
    pct >= 80 ? "A"  :
    pct >= 70 ? "B"  :
    pct >= 55 ? "C"  :
    pct >= 40 ? "D"  : "E"
  const gradeColor =
    pct >= 80 ? "from-emerald-400 to-teal-500" :
    pct >= 70 ? "from-cyan-400 to-blue-500" :
    pct >= 55 ? "from-amber-400 to-orange-500" :
    "from-rose-400 to-red-500"

  return (
    <div className="relative w-[180px] h-[180px] mx-auto md:mx-0 shrink-0">
      {/* glow halo */}
      <div className="absolute inset-2 rounded-full bg-white/20 blur-2xl pointer-events-none" />
      {/* rotating decorative outer ring */}
      <svg viewBox="0 0 180 180" className="absolute inset-0 w-full h-full hero-ring-rotate pointer-events-none">
        <circle cx="90" cy="90" r="82" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 6" />
      </svg>

      <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90 relative">
        <defs>
          <linearGradient id="hero-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#a7f3d0" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
          <filter id="hero-ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* track */}
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="14" />
        {/* progress */}
        <circle
          cx="90" cy="90" r={r} fill="none"
          stroke="url(#hero-ring)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          filter="url(#hero-ring-glow)"
          style={{ transition: "stroke-dashoffset 0.05s linear" }}
        />
      </svg>

      {/* center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[11px] uppercase tracking-[0.25em] text-white/80">Skin score</div>
        <div className="text-[58px] font-extrabold leading-none tabular-nums drop-shadow-md">{shown}</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/70 mt-0.5">/ 100</div>
        {delta !== null && delta !== 0 && (
          <div className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            delta > 0 ? "bg-emerald-400/25 text-emerald-100" : "bg-rose-400/25 text-rose-100"
          }`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} vs last
          </div>
        )}
      </div>

      {/* grade badge */}
      <div className={`absolute -top-1 -right-1 w-12 h-12 rounded-full bg-gradient-to-br ${gradeColor} text-white font-extrabold text-lg flex items-center justify-center shadow-lg ring-4 ring-white/20`}>
        {grade}
      </div>
    </div>
  )
}

function HeroStat({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: any
  tone: "cyan" | "violet" | "amber" | "rose"
  label: string
  value: string
  sub?: string
}) {
  const tones: Record<string, { bg: string; ring: string; iconBg: string }> = {
    cyan:   { bg: "from-cyan-400/25 to-blue-500/15",   ring: "border-cyan-200/30",  iconBg: "from-cyan-300 to-sky-500" },
    violet: { bg: "from-violet-400/25 to-purple-500/15", ring: "border-violet-200/30", iconBg: "from-violet-300 to-purple-500" },
    amber:  { bg: "from-amber-400/25 to-orange-500/15", ring: "border-amber-200/30", iconBg: "from-amber-300 to-orange-500" },
    rose:   { bg: "from-rose-400/25 to-pink-500/15",   ring: "border-rose-200/30",  iconBg: "from-rose-300 to-pink-500" },
  }
  const t = tones[tone]
  return (
    <div className={`hero-stat-pop relative rounded-2xl bg-gradient-to-br ${t.bg} backdrop-blur-md border ${t.ring} px-3 py-3 hover:-translate-y-0.5 hover:shadow-lg transition group overflow-hidden`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-white/75 mb-0.5">{label}</div>
          <div className="text-base font-extrabold capitalize truncate">{value}</div>
          {sub && <div className="text-[10px] text-white/75 truncate">{sub}</div>}
        </div>
        <div className={`shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br ${t.iconBg} flex items-center justify-center shadow-md group-hover:scale-110 transition`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      {/* shimmer */}
      <span className="absolute -inset-x-10 -top-10 h-20 rotate-12 bg-white/15 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

function scoreVerdict(score: number): string {
  if (score >= 85) return "looking great"
  if (score >= 70) return "in good shape"
  if (score >= 55) return "needs a little care"
  if (score >= 40) return "needs attention"
  return "needs focused care"
}

function scoreNarrative(result: AnalysisResult): string {
  const top = Object.entries(result.concerns)
    .filter(([k]) => k !== "hydration" && k !== "evenness")
    .sort((a, b) => b[1] - a[1])[0]
  if (!top) return "Here's a full breakdown of your skin and a routine tailored to it."
  const label = (CONCERN_META[top[0]]?.label || top[0]).toLowerCase()
  const sev = top[1] >= 60 ? "noticeable" : top[1] >= 40 ? "mild" : "very mild"
  return `Your main focus right now is ${sev} ${label}. Below is a tailored plan with ingredients, routine and lifestyle tips.`
}
