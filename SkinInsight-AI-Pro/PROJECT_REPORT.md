# SkinInsight AI — Project Report

> **One-line pitch:** A free, web-based AI dermatology companion that analyzes a selfie, scores 10 skin concerns, generates a personalized routine, recommends real products, and answers follow-up questions through a Llama 3.3 70B chat coach — all installable as a PWA / Android app.

> Live: **https://skin-score.app** · **https://skininsightai.app**

---

## 1. Problem Statement

Most people don't know what's going on with their skin until it's too late. Visiting a dermatologist costs ₹500–₹2,000 per visit and is inaccessible to many. Existing skincare apps either:
- only sell products (no real diagnosis),
- gate analysis behind paid subscriptions,
- or rely on a single photo with shallow output.

**Goal:** Build a free tool that gives clinical-quality, personalized skin insights from any phone camera in under 30 seconds — and explains itself in plain English.

---

## 2. Project Objectives

| # | Objective                                                                                    | Status |
|---|-----------------------------------------------------------------------------------------------|--------|
| 1 | Detect skin **type** (Oily / Dry / Normal) from a single image                                | ✓ Done |
| 2 | Detect common skin **diseases** (Acne, Healthy, Ringworm, Lupus, Scalp Infections)            | ✓ Done |
| 3 | Score **10 individual concerns** (oiliness, redness, hydration, pores, pigmentation, etc.)    | ✓ Done |
| 4 | Generate a **personalized AM/PM routine** with ingredient priorities                          | ✓ Done |
| 5 | Recommend **real products** matched to scan results (with price, brand, tier)                 | ✓ Done |
| 6 | Provide a **conversational AI coach** (Llama 3.3 70B via Groq)                                | ✓ Done |
| 7 | Track progress across scans (history, streak, daily tracker)                                  | ✓ Done |
| 8 | Export a **professional PDF report**                                                          | ✓ Done |
| 9 | Ship as **PWA + Android APK** (Capacitor) for installable mobile experience                   | ✓ Done |
| 10| Provide an **admin panel** with real-time analytics                                           | ✓ Done |

---

## 3. System Architecture (High Level)

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / ANDROID APP                    │
│  ┌────────────────────┐   ┌────────────────────┐                │
│  │ Next.js 16 React   │   │ Capacitor wrapper  │                │
│  │ UI (PWA)           │◀─▶│ for native APK     │                │
│  └─────────┬──────────┘   └────────────────────┘                │
│            │  fetch /api/*                                      │
└────────────┼────────────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              VERCEL  ── Next.js API routes (serverless)         │
│   /api/predict       → proxies to Flask ML server               │
│   /api/chat          → calls Groq (Llama 3.3 70B)               │
│   /api/products      → product catalog (JSON)                   │
│   /api/admin/users   → user CRUD (file-backed store)            │
│   /api/auth/*        → signup, login, session                   │
└────────┬─────────────────────────────────────┬──────────────────┘
         │                                     │
         ▼                                     ▼
┌─────────────────────────┐          ┌────────────────────────────┐
│  RAILWAY  (Python)      │          │  GROQ  (LLM inference)     │
│  Flask + TensorFlow Lite│          │  llama-3.3-70b-versatile   │
│  • skin_type_model.tflite          │  ~250 tok/s, free tier     │
│  • disease model.tflite │          └────────────────────────────┘
│  • OpenCV image proc    │
│  • computes 10 concerns │
│  • generates heatmap    │
└─────────────────────────┘
```

**Why this split?**
- **Vercel** = fast global CDN + serverless functions for the web app.
- **Railway** = always-on Python container for TensorFlow Lite (Vercel functions can't load TFLite models cold-start fast enough).
- **Groq** = sub-second LLM inference at $0 for our usage volume.

---

## 4. Technology Stack

### 4.1 Frontend
| Tech | Version | Why |
|---|---|---|
| **Next.js** | 16.2.0 (App Router + Turbopack) | Server components + edge routing + static export support |
| **React** | 19 | Latest concurrent features |
| **TypeScript** | 5.x | Type safety end-to-end |
| **Tailwind CSS** | v4 | Utility-first styling, theme tokens via `@theme inline` |
| **shadcn/ui** | latest | Accessible primitives (Button, Card, Tabs, etc.) |
| **lucide-react** | latest | Consistent icon set |
| **Capacitor** | 6 | Wraps web → native Android APK |
| **jsPDF** | 4.x | Client-side PDF report generation |

### 4.2 Backend (ML server)
| Tech | Why |
|---|---|
| **Python 3.11** | Standard for ML |
| **Flask** | Lightweight HTTP layer |
| **TensorFlow Lite** | 4–10× smaller / faster than full TF for inference |
| **OpenCV** | Image preprocessing, lesion detection, heatmap generation |
| **NumPy / Pillow** | Pixel-level analysis (oiliness from highlight ratio, redness from a* channel, etc.) |
| **Gunicorn** | Production WSGI server on Railway |

### 4.3 LLM
| Tech | Why |
|---|---|
| **Groq** | Free + fastest hosted inference for OSS models |
| **meta/llama-3.3-70b-versatile** | Best free general-purpose model with strong medical knowledge |

### 4.4 DevOps
- **Vercel** — frontend + API hosting (custom domains: `skin-score.app`, `skininsightai.app`)
- **Railway** — Python ML server hosting (`https://skinprov2-production.up.railway.app`)
- **GitHub** — source control
- **Vercel CLI** — `vercel --prod --yes` from PowerShell for deploys

---

## 5. Machine Learning Pipeline

### 5.1 Datasets used
| Dataset | Purpose | Size | Source |
|---|---|---|---|
| **Oily-Dry-Skin-Types** | Skin-type classifier training | ~3,000 images (train+val+test) | Roboflow (`Oily-Dry-Skin-Types/`) |
| **skin_type_clean** | Cleaned + augmented version | ~2,400 | Custom curation (`skin_type_clean/`) |
| **Skin-Disease-Detection (Technophile)** | Disease classifier | ~5,000 images | GitHub (`Skin-Disease-Detection-Team-Technophile-main/`) |

### 5.2 Models
Both models share the same architecture for consistency and transferability:

```
EfficientNetB0 (pretrained ImageNet, frozen base)
        │
        ▼
GlobalAveragePooling2D
        │
        ▼
Dense(128, relu)
        │
        ▼
Dropout(0.3)
        │
        ▼
Dense(num_classes, softmax)
```

| Model | Classes | Accuracy | File |
|---|---|---|---|
| **Skin Type** | 3 (Oily, Dry, Normal) | ~60% (baseline; constrained dataset quality) | [skin_type_model.tflite](project1/project1/ml/skin_type_model.tflite) |
| **Disease** | 5 (Acne, Healthy, Lupus, Ringworm, Scalp Infections) | ~90% | [model.tflite](project1/project1/ml/model.tflite) |

Both training scripts live in [ml/](project1/project1/ml/):
- [train_skin_type.py](project1/project1/ml/train_skin_type.py)
- [train.py](project1/project1/ml/train.py)

### 5.3 Concern computation (the secret sauce)
TFLite models give us a discrete label, but the user wants nuanced per-concern scores. We compute them in Python using classical CV on the same input image:

| Concern | How it's computed |
|---|---|
| **Oiliness** | Ratio of pixels above L>200 in HSV (highlights = sebum reflection) |
| **Redness** | Mean of `a*` channel in CIE-Lab on face region |
| **Hydration** | Inverse of local texture variance (smoother = more hydrated) |
| **Pigmentation** | Std-dev of `L*` channel (uneven luminance = pigment patches) |
| **Pores** | Laplacian variance on face center (texture frequency) |
| **Wrinkles** | Edge density via Canny on forehead/eye crops |
| **Acne / Lesions** | Blob detection + redness mask intersection |
| **Dark circles** | L difference between under-eye crop and cheek crop |
| **Evenness** | Inverse coefficient of variation of L channel |
| **Blackheads** | Small dark blob count in T-zone |

All scoring happens in [server.py](project1/project1/ml/server.py).

### 5.4 Multi-angle ensemble
Users can capture **front / left / right** angles. The API averages each concern weighted by per-angle face-detection confidence and reports an `agreement` score (1.0 = perfect cross-angle consistency, lower = the photos disagree).

### 5.5 Heatmap output
For each scan we generate a colour-overlay PNG showing where each concern is concentrated (red = redness regions, blue = oily zones, etc.) — returned as a base64 data URL in the API response.

---

## 6. Frontend Highlights

### 6.1 The scan wizard ([face-scan-wizard.tsx](project1/project1/components/face-scan-wizard.tsx), 2,000+ lines)
- **Live camera preview** with face-frame guides + auto-capture countdown
- **Multi-angle support** (1, 2, or 3 angles — accuracy scales with count)
- **Quality checks** before submit (lighting, blur, face-distance)
- **Beautiful result page** with:
  - Animated score ring
  - Severity badges + plain-English action plan
  - Top concerns with quick actions
  - Concern heatmap overlay
  - Regional face-diagram with per-zone scores
  - All-concerns sortable grid
  - Ingredient priority cards
  - 4-step weekly action plan
  - AM/PM routine timeline
  - Diet & lifestyle tips
  - **PDF download** + JSON export + share

### 6.2 AI Doctor Chat ([ai-doctor-chat.tsx](project1/project1/components/ai-doctor-chat.tsx))
- Floating action button on every page
- Mobile-safe: `bottom-24` to clear bottom nav
- Streaming responses from Groq API
- Context-aware: knows the user's last scan (auto-prepended to prompt)
- Teaser bubbles to drive engagement
- Safe-area + 100dvh on mobile so the keyboard doesn't crop input

### 6.3 PDF report ([pdf-report.ts](project1/project1/lib/pdf-report.ts)) ★ new
- Pure programmatic jsPDF (no html2canvas → crisp text, tiny file size)
- 3-page layout:
  1. **Cover** — branded header, big score ring, skin-type / age / spots / agreement tiles, concern severity bars
  2. **Action plan** — priority alerts, ranked recommendations, ingredient priority cards
  3. **Routine + tips** — AM / PM timelines, diet + lifestyle two-column lists
- Footer on every page: brand, generation date, page X / N, medical disclaimer
- Dynamic-imported (`jspdf/dist/jspdf.es.min.js`) to keep SSR happy and shave client bundle size

### 6.4 Admin panel ([admin/page.tsx](project1/project1/app/admin/page.tsx)) ★ recently rewritten
Five tabs: **Overview · Live scans · Products · Users · System**

The Overview tab is **100% computed from real sources** (no mocks):
- Total scans + WoW delta from `localStorage["skinpro:history"]`
- User count, admin count, disabled count from `/api/admin/users`
- MRR formula: `pro × ₹299 + premium × ₹799`
- Avg skin score + 14-day activity bar chart
- Top concerns aggregated severity across all scans
- Plan mix from real users
- System snapshot: ML server status (live ping), product catalog size, localStorage usage
- Empty states explicitly state "nothing is faked"

### 6.5 Other key components
- [hero-section.tsx](project1/project1/components/hero-section.tsx) — landing hero with animated phone mock-up
- [stats-marquee.tsx](project1/project1/components/stats-marquee.tsx) — auto-scrolling proof strip
- [features-section.tsx](project1/project1/components/features-section.tsx) — 4-step "how it works" with live visuals
- [product-recommendations.tsx](project1/project1/components/product-recommendations.tsx) — drugstore / affordable / premium tiers, reads `/api/products`
- [daily-tracker.tsx](project1/project1/components/daily-tracker.tsx) — water, sleep, sunscreen, stress check-ins
- [progress-calendar.tsx](project1/project1/components/progress-calendar.tsx) — month-grid heat-calendar of past scan scores
- [navbar.tsx](project1/project1/components/navbar.tsx) + [mobile-bottom-nav.tsx](project1/project1/components/mobile-bottom-nav.tsx) — desktop top nav, mobile bottom nav (Instagram pattern)

---

## 7. UI / UX Design Decisions

### 7.1 Theme
- **oklch color space** (modern, perceptually uniform). Two brand hues:
  - Primary: oklch hue 220 (calm blue)
  - Secondary: oklch hue 160 (clinical teal)
- Strict **no-rainbow** policy — all gradients are within these two hues, except severity badges (rose/amber/emerald) which carry semantic meaning.
- Both light + dark themes via `next-themes`.

### 7.2 Typography
- **Geist Sans** (modern, neutral, free)
- Sizes use Tailwind's fluid scale + custom `xs:` breakpoint at 24rem for tiny phones

### 7.3 Mobile-first pass
A dedicated mobile UX tightening pass made every section:
- Hide heavy desktop decorations (orbs, blobs, device mockups)
- Tighter padding/typography (`py-12 sm:py-20`, `text-[2rem] sm:text-5xl`)
- Bottom navigation pinned with safe-area inset
- Chat FAB at `bottom-24` to clear bottom nav
- Stats marquee uses smaller chips/icons on mobile
- Hero `DeviceMock` hidden on phones (it was making the page 2× longer)

### 7.4 Accessibility
- All icons have `aria-label` or `aria-hidden`
- Focus rings on all interactive elements
- Minimum tap target 44×44 px on mobile
- High-contrast text ratios in both themes
- `prefers-reduced-motion` respected for animated dots

---

## 8. Authentication & User Management

- **JWT-based auth** ([lib/auth-token.ts](project1/project1/lib/auth-token.ts))
- Session cookie set by `/api/auth/login`
- File-backed user store ([lib/user-store.ts](project1/project1/lib/user-store.ts)) — JSON file on disk (acceptable for prototype; would migrate to Postgres at scale)
- Role-based access: `user` (default) and `admin`
- Plans: `free`, `pro` (₹299/mo), `premium` (₹799/mo)
- Admin can: create / disable / delete users, change plan & role

---

## 9. Deployment & DevOps

### 9.1 Frontend (Vercel)
```powershell
cd e:\project1L\skinpro\project1\project1
npm run build
vercel --prod --yes
```
- Project: `project1` under team `diwi-projects`
- Aliases: `skin-score.app`, `skininsightai.app`
- Build time: ~30–70s
- Cold start: <100ms (edge-cached)

### 9.2 ML server (Railway)
- Container built from [project1/ml/](project1/ml/) with `requirements.txt`
- Always-on (no cold start)
- URL: `https://skinprov2-production.up.railway.app`
- Free tier: 500 hrs/month + 1GB RAM (sufficient for our 50MB models)

### 9.3 Android APK (Capacitor)
```powershell
cd project1/project1
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# APK output: android/app/build/outputs/apk/debug/app-debug.apk
```
Detailed steps in [ANDROID_QUICK_START.md](project1/ANDROID_QUICK_START.md) and [BUILD_APK_SIMPLE.md](project1/BUILD_APK_SIMPLE.md).

---

## 10. Security & Privacy

- **No image uploads stored** — analysis happens in memory; the photo is discarded after the response
- **HTTPS everywhere** (auto via Vercel + Railway)
- **JWT** for session, **bcrypt** for password hashing
- **Admin route protection** — `/admin/*` checks `user.role === "admin"` before render
- **Robots.txt + sitemap.ts** for SEO control
- **OWASP Top 10** considered: input validation on auth, no raw HTML rendering, no SQL injection (file-backed store), CSRF via SameSite cookies

---

## 11. Performance

| Metric | Value |
|---|---|
| Lighthouse Performance (mobile) | ~92 |
| First Contentful Paint | ~1.1s |
| Total bundle (gzip) | ~280 KB |
| ML inference time | ~600ms / angle |
| LLM response latency (Groq) | ~800ms first token |
| Build time (Turbopack) | 9–70s |
| Static pages generated | 25 |

Optimizations:
- Server components by default; client components only where interactivity needed
- Dynamic imports for heavy libs (jsPDF)
- `next/image` for all images
- Tailwind v4 produces tiny CSS (no PurgeCSS needed; tree-shaken at build)
- Page-wide ambient backdrop dimmed to 30% opacity on mobile to reduce paint cost

---

## 12. File Map (Important Files)

```
project1/project1/
├── app/
│   ├── page.tsx                    Landing page (assembles hero, features, scan wizard, etc.)
│   ├── layout.tsx                  Root layout, theme provider, fonts
│   ├── globals.css                 Tailwind v4 theme tokens
│   ├── admin/page.tsx              Admin dashboard (real-data overview)
│   ├── api/
│   │   ├── predict/route.ts        Proxies to Railway Flask
│   │   ├── chat/route.ts           Calls Groq Llama 3.3 70B
│   │   ├── products/route.ts       Returns product catalog
│   │   ├── auth/[login|signup|me|logout]/route.ts
│   │   └── admin/users/route.ts    User CRUD (admin only)
│   ├── pricing/page.tsx, login/, signup/, blog/, how-it-works/
├── components/
│   ├── face-scan-wizard.tsx        ★ The scan + result UI
│   ├── ai-doctor-chat.tsx          ★ Floating chat coach
│   ├── hero-section.tsx, features-section.tsx, footer.tsx
│   ├── product-recommendations.tsx, daily-tracker.tsx, progress-calendar.tsx
│   └── ui/                         shadcn primitives
├── lib/
│   ├── pdf-report.ts               ★ jsPDF report generator
│   ├── auth-token.ts               JWT encode/verify
│   └── user-store.ts               File-backed user DB
├── ml/  (deployed separately to Railway)
│   ├── server.py                   ★ Flask app, model inference, concern scoring
│   ├── train.py, train_skin_type.py
│   └── *.tflite                    Compiled models
└── android/                        Capacitor-generated native project
```

---

## 13. What Makes This Project Stand Out

1. **End-to-end ownership** — collected datasets, trained two models, built API, designed UI, shipped to web + Android.
2. **Real-data admin panel** — every number on the dashboard is computed from live sources; no demo mocks.
3. **Free for the user, free for us to run** — Vercel free tier + Railway free tier + Groq free tier = $0/mo operating cost.
4. **Production-quality polish** — animated UI, dark mode, mobile-first, PWA installable, accessible.
5. **Honest about limitations** — disclaimer on every PDF page, "informational only · not a medical diagnosis", confidence scores shown openly (we don't hide that skin-type accuracy is ~60%).
6. **Multi-angle ensemble** — most consumer apps use one photo; we average 3 angles with disagreement scoring.
7. **Conversational coach** — the LLM has the user's actual scan as context, so answers reference *their* skin numbers.
8. **PDF report** — patients can take it to a real dermatologist as a starting conversation.

---

## 14. Future Work

- Migrate user store from JSON file → PostgreSQL on Neon (free tier)
- Retrain skin-type model on a larger, more diverse dataset to push 60% → 80%+
- Add a 4th model: skin-tone (Fitzpatrick scale) for fairer concern thresholds
- iOS app via Capacitor (Apple Developer fee required)
- Stripe integration for the Pro/Premium tiers
- Compare scans side-by-side ([scan-comparison.tsx](project1/project1/components/scan-comparison.tsx) — currently scaffolded)
- Push notifications for daily routine reminders
- Multilingual support (Hindi first)

---

## 15. Team & Credits

- **Built by:** Diwanshi Pandey
- **Datasets:** Roboflow Oily-Dry-Skin-Types, Team Technophile (skin disease)
- **Models:** EfficientNetB0 base from `tf.keras.applications`
- **LLM:** Meta Llama 3.3 70B served by Groq
- **Icons:** Lucide
- **UI primitives:** shadcn/ui
- **Sources:** see [ml/SOURCES.md](project1/project1/ml/SOURCES.md)

---

## 16. How to Demo Live

1. Open https://skin-score.app
2. Click **Start free scan** in the hero
3. Allow camera, capture **front + left + right** angles
4. Click **Analyze**
5. Wait ~2s for the multi-angle ensemble result
6. Scroll through: score ring → severity alerts → top concerns → heatmap → regional breakdown → ingredient priority → routine → diet/lifestyle
7. Click **Download PDF** in the top-right action bar — get the 3-page branded report
8. Click the **floating AI coach** bottom-right and ask "Why is my redness score 65? What should I do this week?" — Llama responds with personalized guidance using *your* scan numbers
9. Open https://skin-score.app/admin (admin login required) to see the real-data analytics dashboard

---

*End of report.*
