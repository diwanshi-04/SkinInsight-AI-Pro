"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  Upload, X, ImageIcon, AlertCircle, Camera, Video, StopCircle,
  Sparkles, Droplets, Sun, Activity, Heart, Utensils, Moon, Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ---------------------------------------------------------------------------
// Types matching the new /api/predict response (v6 SkinInsight Pro)
// ---------------------------------------------------------------------------
interface SkinTypeInfo {
  label: string
  confidence: number
  source: string
  scores: Record<string, number>
}

interface Recommendation {
  concern: string
  severity: number
  level: string
  tip: string
  ingredients: string[]
}

interface AnalysisResult {
  skinType: SkinTypeInfo
  concerns: Record<string, number>
  lesionCount: number
  overallScore: number
  heatmap?: string
  heatmapLegend: Record<string, string>
  recommendations: Recommendation[]
  routine: { morning: string[]; evening: string[]; weekly: string[] }
  diet: string[]
  lifestyle: string[]
  validation?: { is_skin_photo: boolean; skin_coverage: number; warning?: string | null }
  elapsedMs?: number
  version?: string
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
const CONCERN_META: Record<string, { label: string; icon: React.ReactNode; positive?: boolean }> = {
  acne:         { label: "Acne / Blemishes",   icon: <Activity className="w-4 h-4" /> },
  pigmentation: { label: "Pigmentation",        icon: <Sun className="w-4 h-4" /> },
  redness:      { label: "Redness",             icon: <Heart className="w-4 h-4" /> },
  oiliness:     { label: "Oiliness / Shine",    icon: <Droplets className="w-4 h-4" /> },
  dryness:      { label: "Dryness",             icon: <Sun className="w-4 h-4" /> },
  pores:        { label: "Visible Pores",       icon: <Activity className="w-4 h-4" /> },
  wrinkles:     { label: "Fine Lines",          icon: <Activity className="w-4 h-4" /> },
  dullness:     { label: "Dullness",            icon: <Sun className="w-4 h-4" /> },
  hydration:    { label: "Hydration",           icon: <Droplets className="w-4 h-4" />, positive: true },
  evenness:     { label: "Tone Evenness",       icon: <Sparkles className="w-4 h-4" />, positive: true },
}

function severityColor(sev: number): string {
  if (sev >= 65) return "bg-red-500"
  if (sev >= 40) return "bg-amber-500"
  if (sev >= 25) return "bg-yellow-400"
  return "bg-emerald-500"
}
function severityText(sev: number): string {
  if (sev >= 65) return "text-red-700 dark:text-red-300"
  if (sev >= 40) return "text-amber-700 dark:text-amber-300"
  if (sev >= 25) return "text-yellow-700 dark:text-yellow-300"
  return "text-emerald-700 dark:text-emerald-300"
}

export function PredictionSection() {
  const [image, setImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [activeTab, setActiveTab] = useState("upload")
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Warm up the ML backend on mount
  useEffect(() => {
    fetch("/api/predict", { method: "GET" }).catch(() => {})
  }, [])

  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node
    if (node && streamRef.current) {
      node.srcObject = streamRef.current
      node.play().catch(() => {})
    }
  }, [])

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.")
      return
    }
    setImageFile(file)
    setError(null)
    setAnalysis(null)
    const reader = new FileReader()
    reader.onload = (e) => setImage(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    const f = e.dataTransfer.files?.[0]; if (f) handleFile(f)
  }, [])

  const analyzeImage = async () => {
    if (!imageFile && !image) return
    setIsAnalyzing(true); setError(null)
    try {
      const formData = new FormData()
      if (imageFile) {
        formData.append("image", imageFile)
      } else if (image) {
        const r = await fetch(image); const blob = await r.blob()
        formData.append("image", blob, "capture.jpg")
      }
      const res = await fetch("/api/predict", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze image")
      }
      setAnalysis(data.analysis as AnalysisResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const clearImage = () => {
    setImage(null); setImageFile(null); setAnalysis(null); setError(null)
  }

  const startCamera = async () => {
    try {
      if (typeof window !== "undefined" &&
          window.location.protocol !== "https:" &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1") {
        setError("Camera requires HTTPS."); return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera not supported in this browser."); return
      }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }
      streamRef.current = stream
      setIsCameraActive(true); setError(null)
      requestAnimationFrame(() => {
        if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
          videoRef.current.srcObject = streamRef.current
          videoRef.current.play().catch(() => {})
        }
      })
    } catch (err) {
      const e = err as DOMException
      if (e.name === "NotAllowedError") setError("Camera access denied. Please allow camera permission.")
      else if (e.name === "NotFoundError") setError("No camera found.")
      else setError("Unable to access camera.")
    }
  }
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setIsCameraActive(false)
  }
  const captureImage = () => {
    if (!videoRef.current || !videoRef.current.videoWidth) {
      setError("Camera not ready yet."); return
    }
    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
      canvas.toBlob((blob) => {
        if (blob) setImageFile(new File([blob], "camera-capture.jpg", { type: "image/jpeg" }))
      }, "image/jpeg", 0.9)
      setImage(dataUrl); setAnalysis(null); setError(null)
      stopCamera(); setActiveTab("upload")
    }
  }

  useEffect(() => {
    if (activeTab !== "camera" && isCameraActive) stopCamera()
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // -------------------------------------------------------------------------
  return (
    <section id="prediction" className="py-16 md:py-24 bg-gradient-to-b from-background via-background to-muted/30">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4 border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            SkinInsight Pro · Live Scan
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Get your{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              personalised skin analysis
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            Upload a clear, well-lit photo of your face. We&apos;ll analyse your skin type and 10
            common concerns — and build you a routine. No medical diagnosis, just smart skincare insights.
          </p>
        </div>

        <Card className="overflow-hidden border-2 border-border/60 shadow-xl bg-card/80 backdrop-blur">
          <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-fuchsia-500/5 border-b border-border/50">
            <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg">
              <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-primary" />
              </span>
              Upload your photo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => { if (isCameraActive && v !== "camera") stopCamera(); setActiveTab(v) }}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="upload"><Upload className="w-4 h-4 mr-2" />Upload</TabsTrigger>
                <TabsTrigger value="camera"><Camera className="w-4 h-4 mr-2" />Camera</TabsTrigger>
              </TabsList>

              <TabsContent value="upload">
                {!image ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center transition-all cursor-pointer overflow-hidden group ${
                      isDragging
                        ? "border-primary bg-primary/10 scale-[1.02]"
                        : "border-border/70 hover:border-primary/60 hover:bg-primary/5"
                    }`}
                    onClick={() => document.getElementById("file-input")?.click()}
                  >
                    {/* Decorative gradient blob */}
                    <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br from-primary/20 to-fuchsia-500/10 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-gradient-to-tr from-amber-500/10 to-primary/10 blur-3xl pointer-events-none" />

                    <input id="file-input" type="file" accept="image/*" onChange={handleFileInput} className="hidden" />

                    <div className="relative">
                      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30 mb-5 group-hover:scale-110 transition-transform">
                        <Upload className="w-7 h-7 text-white" />
                      </div>
                      <p className="text-lg sm:text-xl font-semibold mb-1.5">
                        {isDragging ? "Drop it like it's hot" : "Drop your photo here"}
                      </p>
                      <p className="text-sm text-muted-foreground mb-5">
                        or <span className="text-primary font-medium underline underline-offset-2">click to browse</span> — JPG, PNG, WebP up to 10 MB
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          <Sun className="w-3 h-3" /> Natural light
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                          <ImageIcon className="w-3 h-3" /> Front-facing
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                          <Sparkles className="w-3 h-3" /> No filters
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="Preview" className="w-full max-h-[480px] object-contain" />
                    <Button variant="destructive" size="icon" onClick={clearImage} className="absolute top-3 right-3 rounded-full shadow-lg h-9 w-9">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="camera">
                <div className="space-y-4">
                  {!isCameraActive ? (
                    <div className="text-center p-8 border-2 border-dashed rounded-xl">
                      <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="mb-4 text-muted-foreground">Click below to start your camera</p>
                      <Button onClick={startCamera}><Camera className="w-4 h-4 mr-2" />Start Camera</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <video ref={videoCallbackRef} autoPlay playsInline muted className="w-full max-h-[480px] rounded-lg border bg-black" />
                      <div className="flex gap-2 justify-center">
                        <Button onClick={captureImage}><Camera className="w-4 h-4 mr-2" />Capture</Button>
                        <Button onClick={stopCamera} variant="outline"><StopCircle className="w-4 h-4 mr-2" />Stop</Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {image && (
              <div className="mt-6 flex gap-3">
                <Button onClick={analyzeImage} disabled={isAnalyzing} size="lg" className="flex-1">
                  {isAnalyzing ? (<><div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />Analyzing your skin...</>)
                              : (<><Sparkles className="w-4 h-4 mr-2" />Analyze My Skin</>)}
                </Button>
                <Button onClick={clearImage} variant="outline" size="lg">Reset</Button>
              </div>
            )}

            {isAnalyzing && (
              <p className="mt-3 text-sm text-muted-foreground text-center">
                First request after wakeup may take ~60s while the server boots. After that, results in 2–4 seconds.
              </p>
            )}

            {error && (
              <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Couldn&apos;t analyze that image</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ----------------- Analysis Results ----------------- */}
        {analysis && (
          <div className="mt-8 space-y-6">

            {/* Overall + skin type */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Overall Skin Score</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="relative w-28 h-28">
                      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="10" fill="none" className="text-muted/30" />
                        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="10" fill="none"
                          strokeDasharray={`${analysis.overallScore * 2.64} 264`}
                          className={analysis.overallScore >= 70 ? "text-emerald-500"
                                   : analysis.overallScore >= 50 ? "text-amber-500" : "text-red-500"} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                        {Math.round(analysis.overallScore)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-semibold">
                        {analysis.overallScore >= 75 ? "Looking great!"
                       : analysis.overallScore >= 55 ? "Pretty good, room for improvement"
                       : analysis.overallScore >= 35 ? "Needs some attention"
                       : "Let&apos;s build you a focused routine"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Based on 10 measured skin attributes. {analysis.lesionCount > 0 && `Detected ~${analysis.lesionCount} blemishes.`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Your Skin Type</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-3xl font-bold">{analysis.skinType.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(analysis.skinType.confidence * 100)}% confidence
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(analysis.skinType.scores).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-3">
                        <span className="w-24 text-sm capitalize text-muted-foreground">{k}</span>
                        <Progress value={v * 100} className="flex-1 h-2" />
                        <span className="text-xs w-10 text-right tabular-nums">{Math.round(v * 100)}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Source: {analysis.skinType.source}</p>
                </CardContent>
              </Card>
            </div>

            {/* Visual heatmap */}
            {analysis.heatmap && (
              <Card>
                <CardHeader><CardTitle>Concern Heatmap</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={analysis.heatmap} alt="Heatmap overlay" className="w-full rounded-lg border" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Highlighted regions show where each concern was detected on your photo:
                      </p>
                      <div className="space-y-2">
                        {Object.entries(analysis.heatmapLegend).map(([color, meaning]) => (
                          <div key={color} className="flex items-center gap-3 text-sm">
                            <span
                              className="inline-block w-5 h-5 rounded border"
                              style={{ background: color === "red" ? "#ff3c3c" : color === "purple" ? "#7832c8" : color === "orange" ? "#ff8250" : color === "yellow" ? "#ffe650" : color }}
                            />
                            <span><strong className="capitalize">{color}:</strong> {meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All concerns grid */}
            <Card>
              <CardHeader><CardTitle>Your Skin Concerns (0–100)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {Object.entries(analysis.concerns).map(([k, v]) => {
                    const meta = CONCERN_META[k] || { label: k, icon: <Activity className="w-4 h-4" /> }
                    const displayValue = meta.positive ? v : v
                    const severity = meta.positive ? Math.max(0, 100 - v) : v
                    return (
                      <div key={k} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={severityText(severity)}>{meta.icon}</span>
                            <span className="font-medium text-sm">{meta.label}</span>
                          </div>
                          <span className={`text-sm font-semibold tabular-nums ${severityText(severity)}`}>
                            {Math.round(displayValue)}{meta.positive ? "/100" : ""}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full transition-all ${severityColor(severity)}`} style={{ width: `${displayValue}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Top recommendations */}
            {analysis.recommendations.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Top Concerns &amp; Targeted Solutions</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {analysis.recommendations.map((r) => (
                    <div key={r.concern} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold capitalize">
                          {(CONCERN_META[r.concern]?.label) || r.concern}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.level === "High" ? "bg-red-500/15 text-red-700 dark:text-red-300"
                        : r.level === "Moderate" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                                 : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
                        }`}>{r.level} ({Math.round(r.severity)})</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{r.tip}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {r.ingredients.map((ing) => (
                          <span key={ing} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Routine */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Sun className="w-4 h-4" />Morning</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {analysis.routine.morning.map((s, i) => (<li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{s}</span></li>))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Moon className="w-4 h-4" />Evening</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {analysis.routine.evening.map((s, i) => (<li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{s}</span></li>))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="w-4 h-4" />Weekly</CardTitle></CardHeader>
                <CardContent>
                  {analysis.routine.weekly.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {analysis.routine.weekly.map((s, i) => (<li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{s}</span></li>))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No special weekly treatments needed right now.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Diet + Lifestyle */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Utensils className="w-4 h-4" />Diet Tips</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {analysis.diet.map((d, i) => (<li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{d}</span></li>))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Heart className="w-4 h-4" />Lifestyle</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {analysis.lifestyle.map((d, i) => (<li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{d}</span></li>))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Personalised skincare insights powered by AI · always tailored to your skin.
              {analysis.elapsedMs && <> · Analyzed in {(analysis.elapsedMs/1000).toFixed(1)}s · {analysis.version}</>}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
