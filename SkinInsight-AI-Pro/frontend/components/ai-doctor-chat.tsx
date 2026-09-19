"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  X,
  Send,
  Stethoscope,
  Loader2,
  Sparkles,
  Bot,
  User as UserIcon,
  Zap,
  ChevronDown,
  RefreshCw,
  Plus,
} from "lucide-react"

interface Msg {
  role: "user" | "assistant"
  text: string
  ts: number
}

const DEFAULT_PROMPTS = [
  { icon: "✨", text: "Build me a routine" },
  { icon: "🧴", text: "What helps with acne?" },
  { icon: "🌞", text: "Best SPF for me?" },
  { icon: "💧", text: "How to fix dryness" },
  { icon: "🔬", text: "Explain retinol" },
]

const TEASERS = [
  "Got a skin question? Ask me ✨",
  "I've read your scan — let's chat",
  "What's bothering your skin today?",
  "Need a routine? I'm here",
]

const PRETTY: Record<string, string> = {
  dark_circles: "dark circles",
  blackheads: "blackheads",
}
const pretty = (c: string) => PRETTY[c] || c

function quickPromptsFor(analysis: any): { icon: string; text: string }[] {
  if (!analysis?.concerns) return DEFAULT_PROMPTS
  const top = Object.entries(analysis.concerns)
    .filter(([k]) => k !== "hydration" && k !== "evenness")
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3)
    .map(([k]) => k as string)
  const out: { icon: string; text: string }[] = []
  if (top[0]) out.push({ icon: "🎯", text: `What's causing my ${pretty(top[0])}?` })
  out.push({ icon: "✨", text: "Build me a routine" })
  if (top[1]) out.push({ icon: "🧪", text: `Best ingredients for ${pretty(top[1])}` })
  out.push({ icon: "🛍️", text: "Recommend products" })
  if (top[2]) out.push({ icon: "💡", text: `Tips for ${pretty(top[2])}` })
  return out
}

function timeAgo(ts: number) {
  const diff = (Date.now() - ts) / 1000
  if (diff < 60) return "now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export function AiDoctorChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState<any>(null)
  const [teaserIdx, setTeaserIdx] = useState(-1) // -1 = hidden
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [vh, setVh] = useState<number | null>(null) // visual viewport height when keyboard open
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)

  // Hydrate persisted state
  useEffect(() => {
    try {
      const m = localStorage.getItem("skinpro:chat")
      if (m) setMessages(JSON.parse(m))
      const a = localStorage.getItem("skinpro:lastAnalysis")
      if (a) setLastAnalysis(JSON.parse(a))
    } catch {}
    const handler = (e: any) => {
      const detail = e.detail
      if (detail) {
        setLastAnalysis(detail)
        try { localStorage.setItem("skinpro:lastAnalysis", JSON.stringify(detail)) } catch {}
      }
    }
    window.addEventListener("skinpro:analysis", handler as any)
    return () => window.removeEventListener("skinpro:analysis", handler as any)
  }, [])

  // Listen for "Ask AI Coach" suggestions from the scan results card
  useEffect(() => {
    const ask = (e: any) => {
      const q = e?.detail?.question
      if (typeof q === "string" && q.trim()) {
        setPendingQuestion(q.trim())
        setOpen(true)
      }
    }
    const justOpen = () => setOpen(true)
    window.addEventListener("skinpro:askCoach", ask as any)
    window.addEventListener("skinpro:openCoach", justOpen as any)
    return () => {
      window.removeEventListener("skinpro:askCoach", ask as any)
      window.removeEventListener("skinpro:openCoach", justOpen as any)
    }
  }, [])

  // Persist and auto-scroll
  useEffect(() => {
    try { localStorage.setItem("skinpro:chat", JSON.stringify(messages.slice(-30))) } catch {}
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
  }, [messages])

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = "hidden"
      // focus input on desktop
      if (window.innerWidth >= 640) setTimeout(() => inputRef.current?.focus(), 200)
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  // Visual viewport tracking — keeps the chat panel exactly the size of the visible area when the mobile keyboard opens.
  useEffect(() => {
    if (!open) { setVh(null); return }
    const vv = (typeof window !== "undefined" && window.visualViewport) || null
    if (!vv) return
    let raf = 0
    const update = () => {
      // Only apply when keyboard is actually shrinking the viewport meaningfully (>120px gap)
      const layoutH = window.innerHeight
      const visualH = vv.height
      const keyboardOpen = layoutH - visualH > 120
      setVh(keyboardOpen ? visualH : null)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        // counter iOS scroll-into-view that pushes the page up
        if (keyboardOpen) window.scrollTo(0, 0)
      })
    }
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    window.addEventListener("orientationchange", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
      window.removeEventListener("orientationchange", update)
      cancelAnimationFrame(raf)
    }
  }, [open])

  // Teaser bubble — show after 8s, then rotate every 12s while closed
  useEffect(() => {
    if (open) { setTeaserIdx(-1); return }
    const seenKey = "skinpro:chatTeaserSeen"
    const seen = typeof window !== "undefined" ? localStorage.getItem(seenKey) : "1"
    if (seen) return
    const first = setTimeout(() => setTeaserIdx(0), 6000)
    const rotate = setInterval(() => {
      setTeaserIdx((i) => (i < 0 ? 0 : (i + 1) % TEASERS.length))
    }, 14000)
    const hide = setTimeout(() => {
      setTeaserIdx(-1)
      try { localStorage.setItem(seenKey, "1") } catch {}
    }, 60000)
    return () => { clearTimeout(first); clearInterval(rotate); clearTimeout(hide) }
  }, [open])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollDown(distFromBottom > 120)
  }

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || streaming) return
    setInput("")
    const userMsg: Msg = { role: "user", text: msg, ts: Date.now() }
    setMessages((m) => [...m, userMsg, { role: "assistant", text: "", ts: Date.now() }])
    setStreaming(true)

    try {
      // Send the last 8 turns (excluding the empty assistant placeholder we just pushed)
      const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text })).filter((m) => m.text)
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          lastAnalysis: lastAnalysis
            ? {
                skin_type: lastAnalysis.skinType,
                concerns: lastAnalysis.concerns,
                overall_score: lastAnalysis.overallScore,
                skin_age: lastAnalysis.skinAge,
              }
            : null,
          history,
          stream: true,
        }),
      })
      if (!res.body) throw new Error("no stream")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (!line.startsWith("data:")) continue
          const payload = line.slice(5).trim()
          if (!payload) continue
          try {
            const obj = JSON.parse(payload)
            if (obj.delta) {
              setMessages((m) => {
                const next = [...m]
                next[next.length - 1] = { ...next[next.length - 1], text: next[next.length - 1].text + obj.delta }
                return next
              })
            }
          } catch {}
        }
      }
    } catch {
      setMessages((m) => {
        const next = [...m]
        next[next.length - 1] = { role: "assistant", text: "Sorry, I couldn't reach the assistant. Please try again.", ts: Date.now() }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  // Fire any pending suggested question once the chat is open
  useEffect(() => {
    if (open && pendingQuestion && !streaming) {
      const q = pendingQuestion
      setPendingQuestion(null)
      // small delay so the panel finishes mounting before the request
      const t = setTimeout(() => { send(q) }, 120)
      return () => clearTimeout(t)
    }
  }, [open, pendingQuestion, streaming])

  const clearChat = () => {
    if (!confirm("Start a new conversation?")) return
    setMessages([])
    try { localStorage.removeItem("skinpro:chat") } catch {}
  }

  const prompts = useMemo(() => quickPromptsFor(lastAnalysis), [lastAnalysis])
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.text)
  const followUps = useMemo(() => {
    if (!lastAssistant || streaming) return []
    // Detect the last topic from the most recent assistant + user messages so chips
    // pull the conversation forward instead of repeating the same generic three.
    const TOPIC_KEYS = [
      "dark circles", "blackheads", "pigmentation", "dryness", "oiliness",
      "redness", "wrinkles", "dullness", "acne", "pores",
    ]
    const recent = messages.slice(-4).map((m) => m.text.toLowerCase()).join(" ")
    const topic = TOPIC_KEYS.find((t) => recent.includes(t))
    // Rotate variants based on assistant turn count so chips don't repeat verbatim
    const turn = messages.filter((m) => m.role === "assistant" && m.text).length
    const variants: { icon: string; text: string }[][] = topic
      ? [
          [
            { icon: "📋", text: `Give me a step-by-step plan for ${topic}` },
            { icon: "⚠️", text: `Common mistakes with ${topic}` },
            { icon: "🛍️", text: `Best products for ${topic}` },
          ],
          [
            { icon: "🍎", text: `Diet & lifestyle for ${topic}` },
            { icon: "🧪", text: `Best ingredients for ${topic}` },
            { icon: "⏱️", text: `How long until ${topic} improves?` },
          ],
          [
            { icon: "🔬", text: `Why is ${topic} happening?` },
            { icon: "🛍️", text: "Recommend products" },
            { icon: "✨", text: "Build me a full routine" },
          ],
        ]
      : [
          [
            { icon: "✨", text: "Build me a routine" },
            { icon: "🧴", text: "What's my biggest concern?" },
            { icon: "🛍️", text: "Recommend products" },
          ],
          [
            { icon: "🌞", text: "Best SPF for me?" },
            { icon: "🔬", text: "Explain retinol" },
            { icon: "🍎", text: "Lifestyle tips for skin" },
          ],
        ]
    return variants[turn % variants.length]
  }, [lastAssistant, streaming, messages])

  return (
    <>
      {/* === Floating action button === */}
      {!open && (
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex items-end gap-2">
          {/* Teaser speech bubble */}
          {teaserIdx >= 0 && (
            <div
              key={teaserIdx}
              className="hidden xs:block sm:block animate-fade-in-up mb-2"
              style={{ animationDuration: "0.4s" }}
            >
              <div className="relative max-w-[200px] bg-card border border-border/60 rounded-2xl rounded-br-sm px-3.5 py-2 shadow-elevated text-xs font-semibold text-foreground">
                {TEASERS[teaserIdx]}
                <button
                  onClick={(e) => { e.stopPropagation(); setTeaserIdx(-1); try { localStorage.setItem("skinpro:chatTeaserSeen", "1") } catch {} }}
                  aria-label="Dismiss"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center hover:scale-110 transition"
                >
                  <X className="w-3 h-3" />
                </button>
                {/* tail */}
                <div className="absolute -bottom-1 right-3 w-3 h-3 bg-card border-r border-b border-border/60 rotate-45" />
              </div>
            </div>
          )}

          <button
            onClick={() => setOpen(true)}
            aria-label="Open AI skincare assistant"
            className="relative group w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-2xl active:scale-90 transition-all duration-300"
          >
            {/* Soft floor shadow */}
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-2.5 bg-black/40 blur-md rounded-full opacity-50" />
            {/* Brand aurora halo */}
            <span className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-primary to-secondary opacity-40 blur-xl group-hover:opacity-70 transition-opacity duration-500" />
            {/* === Brand logo tile (matches navbar) === */}
            <span
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden"
              style={{
                boxShadow: "0 10px 28px -6px rgba(99,102,241,0.55), 0 4px 10px rgba(236,72,153,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
              }}
            >
              {/* glossy top highlight */}
              <span aria-hidden className="absolute inset-x-2 top-1 h-1/2 rounded-2xl opacity-50" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.6), transparent)" }} />
              <Sparkles className="relative w-6 h-6 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" strokeWidth={2.4} />
            </span>
            {/* Online dot */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-background shadow-md">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
            </span>
            {/* Unread dot */}
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 ring-2 ring-background shadow-lg flex items-center justify-center text-[9px] font-extrabold text-white">
                {Math.min(messages.filter((m) => m.role === "assistant" && m.text).length, 9)}
              </span>
            )}
          </button>
        </div>
      )}

      {/* === Mobile backdrop === */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 backdrop-blur-md animate-fade-in"
          style={{
            animationDuration: "0.2s",
            background: "radial-gradient(ellipse at center, rgba(2,6,23,0.6) 0%, rgba(2,6,23,0.85) 100%)",
          }}
        />
      )}

      {/* === Chat panel — PROFESSIONAL DARK THEME === */}
      {open && (
        <div
          ref={panelRef}
          className="fixed z-50 flex flex-col overflow-hidden
                     left-0 right-0 top-0
                     sm:inset-auto sm:right-6 sm:top-auto sm:left-auto sm:bottom-6
                     sm:w-[420px]
                     sm:rounded-[24px] sm:border sm:border-white/10
                     animate-slide-up-mobile text-slate-100"
          style={{
            animationDuration: "0.36s",
            height: vh != null
              ? `${vh}px`
              : (typeof window !== "undefined" && window.innerWidth >= 640) ? "680px" : "100dvh",
            maxHeight: (typeof window !== "undefined" && window.innerWidth >= 640) ? "calc(100vh - 3rem)" : undefined,
            paddingTop: "env(safe-area-inset-top, 0px)",
            transition: "height 0.18s ease-out",
            // Deep professional slate background
            background: "linear-gradient(180deg, #0f172a 0%, #111827 50%, #0b1224 100%)",
            boxShadow: "0 30px 80px -20px rgba(0,0,0,0.7), 0 8px 32px -8px rgba(99,102,241,0.25)",
          }}
        >
          {/* subtle brand sheen */}
          <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: "radial-gradient(80% 40% at 100% 0%, rgba(99,102,241,0.25) 0%, transparent 60%), radial-gradient(70% 35% at 0% 100%, rgba(236,72,153,0.18) 0%, transparent 60%)" }} />
          <div className="absolute inset-0 pointer-events-none mesh-dots opacity-[0.04]" />
          {/* === Professional header === */}
          <div className="relative shrink-0 overflow-hidden text-white border-b border-white/10">
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.7) 100%)" }} />
            <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(120% 100% at 0% 0%, rgba(99,102,241,0.25) 0%, transparent 60%), radial-gradient(120% 100% at 100% 100%, rgba(236,72,153,0.18) 0%, transparent 60%)" }} />

            {/* drag handle on mobile */}
            <div className="sm:hidden flex justify-center pt-2 pb-1 relative">
              <div className="w-10 h-1 rounded-full bg-white/25" />
            </div>

            <div className="relative px-4 py-3 sm:p-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {/* Brand logo (same as navbar) */}
                <div className="relative w-11 h-11 shrink-0">
                  <div
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden"
                    style={{ boxShadow: "0 6px 18px -4px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.35)" }}
                  >
                    <span aria-hidden className="absolute inset-x-1.5 top-1 h-1/2 rounded-xl opacity-50" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.6), transparent)" }} />
                    <Sparkles className="relative w-5 h-5 text-white" strokeWidth={2.4} />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="font-extrabold text-[15px] leading-tight truncate">SkinInsight <span className="gradient-text">AI</span></div>
                    <span className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-[9px] font-bold tracking-widest text-white/90">PRO</span>
                  </div>
                  <div className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="font-medium truncate">
                      {streaming ? "Typing…" : lastAnalysis ? "Personalised to your scan" : "Online · ready to chat"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    aria-label="New chat"
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition text-slate-200"
                    title="New chat"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition text-slate-200"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>

          {/* === Messages === */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-none px-3 py-4 sm:px-4"
          >
            <div className="space-y-3.5">
              {messages.length === 0 && (
                <div className="text-center pt-2 pb-4 animate-fade-in-up">
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary blur-2xl opacity-60 animate-pulse-glow" />
                    <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow-primary">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="font-extrabold text-xl text-white tracking-tight">Hey, I'm your skin coach</div>
                  <div className="text-sm text-slate-300 mt-2 max-w-[280px] mx-auto leading-relaxed">
                    {lastAnalysis
                      ? "I've read your latest scan — every reply is tailored to you."
                      : "Run a scan first, or ask me anything about skincare."}
                  </div>

                  {lastAnalysis && (
                    <div className="mt-5 mx-auto max-w-[300px] rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left shadow-soft backdrop-blur-sm">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Zap className="w-3 h-3 text-indigo-300" fill="currentColor" />
                        <div className="text-[10px] uppercase tracking-[0.15em] text-indigo-300 font-extrabold">From your scan</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white/[0.04] p-2 border border-white/10">
                          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Type</div>
                          <div className="font-extrabold text-sm capitalize truncate text-slate-100">{lastAnalysis.skinType?.label}</div>
                        </div>
                        <div className="rounded-xl bg-white/[0.04] p-2 border border-white/10">
                          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Score</div>
                          <div className="font-extrabold text-sm gradient-text">{Math.round(lastAnalysis.overallScore)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {messages.map((m, i) => {
                const isUser = m.role === "user"
                const prev = messages[i - 1]
                const showAvatar = !isUser && (!prev || prev.role !== m.role)
                const isStreamingThis = streaming && i === messages.length - 1 && !m.text
                return (
                  <div
                    key={i}
                    className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up`}
                    style={{ animationDuration: "0.28s" }}
                  >
                    {!isUser && (
                      <div className={`shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md ${showAvatar ? "" : "opacity-0"}`}>
                        <Sparkles className="w-3.5 h-3.5 text-white" strokeWidth={2.6} />
                      </div>
                    )}
                    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[80%]`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                          isUser
                            ? "text-white rounded-br-md"
                            : "text-slate-100 rounded-bl-md border border-white/10"
                        }`}
                        style={{
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          ...(isUser
                            ? {
                                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
                                boxShadow: "0 4px 14px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                              }
                            : {
                                background: "linear-gradient(180deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.85) 100%)",
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                                boxShadow: "0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
                              }),
                        }}
                      >
                        {isStreamingThis ? (
                          <span className="flex items-center gap-1.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "120ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "240ms" }} />
                          </span>
                        ) : (
                          m.text
                        )}
                      </div>
                      <div className={`text-[10px] text-slate-400 mt-1 px-1 font-medium ${isUser ? "text-right" : ""}`}>
                        {timeAgo(m.ts)}
                      </div>
                    </div>
                    {isUser && (
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 border border-white/10 flex items-center justify-center shadow-md">
                        <UserIcon className="w-3.5 h-3.5 text-white" strokeWidth={2.6} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Floating scroll-to-bottom */}
          {showScrollDown && (
            <button
              onClick={() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }}
              className="absolute bottom-32 right-4 w-9 h-9 rounded-full bg-slate-800 border border-white/10 shadow-elevated flex items-center justify-center hover:scale-110 transition z-10 text-slate-200"
              aria-label="Scroll to latest"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {/* === Quick prompts (initial) === */}
          {messages.length === 0 && (
            <div className="relative px-3 sm:px-4 pb-2 shrink-0">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1 snap-x snap-mandatory">
                {prompts.map((p) => (
                  <button
                    key={p.text}
                    onClick={() => send(p.text)}
                    className="snap-start shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-white/10 hover:border-indigo-400/50 active:scale-95 transition font-semibold whitespace-nowrap text-slate-200 bg-white/[0.04] hover:bg-white/[0.08]"
                  >
                    <span className="text-sm leading-none">{p.icon}</span>
                    <span>{p.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === Follow-up suggestions after assistant reply === */}
          {messages.length > 0 && followUps.length > 0 && (
            <div className="relative px-3 sm:px-4 pb-2 shrink-0">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                {followUps.map((p) => (
                  <button
                    key={p.text}
                    onClick={() => send(p.text)}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border border-indigo-400/30 active:scale-95 transition font-bold text-indigo-200 whitespace-nowrap bg-indigo-500/10 hover:bg-indigo-500/20"
                  >
                    <span>{p.icon}</span>
                    <span>{p.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === Input bar === */}
          <div
            className="relative shrink-0 border-t border-white/10 px-3 py-2.5 sm:px-4 sm:py-3"
            style={{
              background: "linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(11,18,36,0.95) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              paddingBottom: vh != null ? "10px" : "calc(10px + env(safe-area-inset-bottom, 0px))",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-end gap-2">
              <button
                onClick={clearChat}
                aria-label="New chat"
                disabled={messages.length === 0}
                className="hidden sm:flex shrink-0 w-11 h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none text-slate-300 hover:text-white"
                title="New chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="flex-1 relative">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder="Ask about your skin…"
                  className="min-h-[44px] max-h-[120px] resize-none text-[15px] rounded-2xl border border-white/10 focus-visible:border-indigo-400/60 focus-visible:ring-2 focus-visible:ring-indigo-400/20 pr-3 py-2.5 placeholder:text-slate-500 text-slate-100"
                  style={{
                    background: "rgba(15,23,42,0.6)",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
                  }}
                  rows={1}
                />
              </div>
              <button
                onClick={() => send()}
                disabled={!input.trim() || streaming}
                aria-label="Send message"
                className="relative shrink-0 w-11 h-11 rounded-2xl text-white flex items-center justify-center active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:saturate-50"
                style={
                  !input.trim() || streaming
                    ? { background: "linear-gradient(135deg, #475569, #334155)" }
                    : {
                        background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
                        boxShadow: "0 6px 16px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
                      }
                }
              >
                {streaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-0.5" strokeWidth={2.4} />}
              </button>
            </div>
            <div className="text-[10px] text-slate-500 text-center mt-1.5 font-medium">
              Powered by SkinInsight's most reliable AI model · Press <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/10 text-[9px] font-bold text-slate-300">Enter</kbd> to send
            </div>
          </div>
        </div>
      )}
    </>
  )
}
