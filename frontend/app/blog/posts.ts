// SEO blog posts. Each post is rendered server-side with Article JSON-LD and
// internal links to the AI scanner. Word counts target 800–1500 for SEO weight.

export type BlogPost = {
  slug: string
  title: string
  description: string
  keywords: string[]
  publishedAt: string // ISO
  updatedAt: string // ISO
  readMinutes: number
  /** Body in lightweight JSON: array of blocks. */
  body: Block[]
  /** FAQ pairs for FAQPage JSON-LD on the post. */
  faq: Array<{ q: string; a: string }>
}

export type Block =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; html: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'callout'; tone: 'tip' | 'warn' | 'info'; html: string }
  | { type: 'quote'; html: string; cite?: string }

const SCAN_LINK =
  '<a href="/#scan" style="color:#a855f7;font-weight:600">free AI skin scan</a>'

export const posts: BlogPost[] = [
  {
    slug: 'how-to-find-your-skin-type',
    title: 'How to Find Your Skin Type — Free AI Test (2026 Guide)',
    description:
      'The most accurate way to identify your skin type — oily, dry, combination, normal or sensitive — using a 10-second AI face scan. Plus the classic blotting-paper test, the bare-face method, and why most quizzes get it wrong.',
    keywords: [
      'skin type test',
      'how to find skin type',
      'free skin type quiz',
      'oily skin test',
      'dry skin test',
      'combination skin',
      'AI skin type detector',
    ],
    publishedAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-28T10:00:00.000Z',
    readMinutes: 6,
    body: [
      {
        type: 'p',
        html: `Knowing your skin type is the single most important decision in skincare — get it wrong, and every product you buy works against you. Use a heavy moisturizer on oily skin and you'll trigger acne. Use an oil-free gel on dry skin and you'll get flaking and irritation. This guide shows you the three most reliable ways to identify your skin type, including a ${SCAN_LINK} that takes 10 seconds.`,
      },
      { type: 'h2', text: 'The 5 skin types (and what they actually mean)' },
      {
        type: 'ul',
        items: [
          '<strong>Oily</strong> — Sebaceous glands produce excess sebum. Visible shine across the T-zone (forehead + nose + chin) within 1–2 hours of cleansing. Pores look enlarged. Prone to blackheads and acne.',
          '<strong>Dry</strong> — Skin produces too little sebum and/or has a damaged moisture barrier. Feels tight after washing. May flake, especially around the nose and cheeks. Pores appear small. Lines and texture more visible.',
          '<strong>Combination</strong> — Oily T-zone, normal-to-dry cheeks. The most common type — roughly 50% of adults.',
          '<strong>Normal</strong> — Balanced sebum, no tightness, no shine, even pore size. Rare past age 25.',
          '<strong>Sensitive</strong> — Not technically a "type" but a parallel condition. Reacts to fragrance, alcohol, sulfates. Can co-exist with any of the above.',
        ],
      },
      { type: 'h2', text: 'Method 1 — AI face scan (most accurate, 10 seconds)' },
      {
        type: 'p',
        html: `The fastest and most objective way is to let computer vision look at your skin. SkinInsight AI uses MediaPipe face tracking and a TensorFlow Lite skin-type classifier to detect oil sheen, pore density, redness and dryness from a single selfie. Open the ${SCAN_LINK}, allow camera access, hold still for ~3 seconds, and you'll get a quantified score for each type — not a vague "you might be combination."`,
      },
      {
        type: 'callout',
        tone: 'tip',
        html: `For best results: <strong>scan 2 hours after cleansing</strong>, in indirect daylight, with no makeup or sunscreen on. The model is trained on bare skin.`,
      },
      { type: 'h2', text: 'Method 2 — The bare-face test (DIY, 1 hour)' },
      {
        type: 'ol',
        items: [
          'Cleanse your face with a gentle, non-foaming cleanser.',
          'Pat dry. Apply nothing — no moisturizer, serum, or SPF.',
          'Wait 60 minutes. Do not touch your face.',
          'Look in the mirror under bright daylight. Press a clean tissue to forehead, nose, both cheeks and chin.',
          'Read the result: shine on tissue from all zones = oily. Shine only from T-zone = combination. No shine but skin feels tight = dry. No shine, no tightness = normal.',
        ],
      },
      { type: 'h2', text: 'Method 3 — The blotting-paper test (quickest physical test)' },
      {
        type: 'p',
        html: `Two hours after cleansing, press a blotting paper firmly on each of the five zones (forehead, nose, both cheeks, chin) for 5 seconds. Hold the paper up to a light. Translucent oil marks from all five = oily. Marks only from T-zone = combination. No translucency anywhere = dry or normal — distinguish by feel.`,
      },
      { type: 'h2', text: 'Why most online quizzes get it wrong' },
      {
        type: 'p',
        html: `Text-based quizzes ask "does your skin feel tight after washing?" — but the answer depends on which cleanser, which water, which climate, and how you interpret "tight." Self-reporting introduces ~30% noise. AI scans bypass this entirely by measuring physical properties of your skin, not your perception of them.`,
      },
      { type: 'h2', text: 'What changes after you know your type' },
      {
        type: 'ul',
        items: [
          '<strong>Cleanser</strong> — gel for oily, cream for dry, micellar water for combination.',
          '<strong>Moisturizer</strong> — gel-cream for oily, ceramide-rich balm for dry.',
          '<strong>Active ingredients</strong> — salicylic acid for oily, hyaluronic acid + squalane for dry, niacinamide for combination.',
          '<strong>SPF</strong> — fluid/spray formulas for oily, mineral cream for dry.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        html: `Skin type can shift with age, hormones, climate, and routine changes. Re-scan every 2–3 months — especially after moving, switching seasons, or starting tretinoin/accutane.`,
      },
    ],
    faq: [
      {
        q: 'Can my skin type change?',
        a: 'Yes. Hormones (puberty, pregnancy, menopause), climate, age, and active ingredients can all shift your type. Most people get drier with age and after starting retinoids.',
      },
      {
        q: 'Is the AI skin type test really free?',
        a: 'Yes — SkinInsight AI is 100% free and requires no signup. The analysis runs on-device in your browser.',
      },
      {
        q: 'Why do I get a different skin type result on different days?',
        a: 'Skin oil production peaks 4–6 hours after cleansing and varies with stress, sleep, diet and humidity. Always test 2 hours after cleansing for consistency.',
      },
    ],
  },
  {
    slug: 'best-routine-for-oily-skin',
    title: 'The Best Skincare Routine for Oily Skin (AI-Personalized, 2026)',
    description:
      'Step-by-step morning and night routine for oily skin, optimized by AI dermatology. Covers cleanser, exfoliant, niacinamide, retinoid, and SPF — with exact frequencies that prevent breakouts without over-drying.',
    keywords: [
      'oily skin routine',
      'best routine for oily skin',
      'skincare for oily skin',
      'how to control oily skin',
      'niacinamide for oily skin',
      'salicylic acid routine',
    ],
    publishedAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-28T10:00:00.000Z',
    readMinutes: 7,
    body: [
      {
        type: 'p',
        html: `Oily skin gets the worst skincare advice on the internet — most articles tell you to "strip the oil" with foaming cleansers and toners full of alcohol. That's exactly what triggers more sebum. Your skin reads the dryness as damage and produces more oil to compensate. The science-backed approach is to gently regulate sebum and unclog pores without disrupting the moisture barrier. Here's the routine that works, plus how to personalize it with a ${SCAN_LINK}.`,
      },
      { type: 'h2', text: 'Morning routine (4 steps, ~3 minutes)' },
      {
        type: 'ol',
        items: [
          '<strong>Gentle gel cleanser</strong> — pH 5.0–5.5. Look for "non-comedogenic" and avoid sulfates (SLS). Examples: CeraVe Foaming Cleanser, La Roche-Posay Effaclar.',
          '<strong>Niacinamide 10% serum</strong> — regulates sebum, minimizes pore appearance, reduces redness. Apply to damp skin.',
          '<strong>Oil-free gel moisturizer</strong> — yes, oily skin still needs moisture. Hyaluronic acid + glycerin, not occlusives. Skipping this is the #1 mistake.',
          '<strong>SPF 30+ fluid or gel</strong> — never cream. Look for "matte finish." UV damages the moisture barrier and worsens oil production.',
        ],
      },
      { type: 'h2', text: 'Night routine (5 steps, ~5 minutes)' },
      {
        type: 'ol',
        items: [
          '<strong>Double cleanse</strong> — micellar water or cleansing oil (yes, oil) to dissolve sunscreen + sebum, followed by your gel cleanser.',
          '<strong>BHA exfoliant 3× per week</strong> — salicylic acid 2%. Penetrates oil to clear pores. Don\'t exfoliate every night.',
          '<strong>Retinoid (3× per week, alternate with BHA)</strong> — adapalene 0.1% (over the counter) or tretinoin 0.025% (Rx). Reduces sebum production over 8–12 weeks.',
          '<strong>Niacinamide serum</strong> on rest nights.',
          '<strong>Lightweight moisturizer</strong> — same as morning, slightly heavier if you used a retinoid.',
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        html: `<strong>Never combine BHA and retinoid in the same evening</strong> — alternate nights. Both increase cell turnover and stacking them causes barrier damage.`,
      },
      { type: 'h2', text: 'What to skip' },
      {
        type: 'ul',
        items: [
          'Alcohol-based toners — they trigger rebound oil production within 90 minutes.',
          'Witch hazel — irritating and ineffective long-term.',
          'Foaming sulfate cleansers — strip the moisture barrier.',
          'Heavy creams with mineral oil or coconut oil — comedogenic.',
          'Daily clay masks — fine 1–2× per week, but daily clay = barrier damage.',
        ],
      },
      { type: 'h2', text: 'Personalize with AI' },
      {
        type: 'p',
        html: `The routine above is the evidence-based starting point. Your specific skin may need adjustments — for example, if your AI scan shows high redness, you'll want to skip the BHA and start with azelaic acid instead. Run a ${SCAN_LINK} to get the exact ingredient list for your skin.`,
      },
      { type: 'h2', text: 'Timeline — what to expect' },
      {
        type: 'ul',
        items: [
          '<strong>Week 1–2</strong>: skin feels less tight, slightly less shiny in the afternoon.',
          '<strong>Week 3–6</strong>: pores look smaller (oil drains, not disappears), fewer new breakouts.',
          '<strong>Week 8–12</strong>: visible reduction in active acne, more even tone, sebum production normalized.',
          '<strong>Month 4+</strong>: re-scan to confirm progress and step down to maintenance frequency.',
        ],
      },
    ],
    faq: [
      {
        q: 'Should oily skin use a moisturizer?',
        a: 'Yes — always. Skipping moisturizer is the #1 mistake people with oily skin make. It triggers more oil production. Use an oil-free gel formula with hyaluronic acid.',
      },
      {
        q: 'How often should I use salicylic acid?',
        a: 'Start with 2× per week and work up to 3–4× as your skin tolerates it. Daily use is too aggressive for most people and damages the barrier.',
      },
      {
        q: 'Is niacinamide better than retinol for oily skin?',
        a: 'They do different things. Niacinamide reduces sebum and pore appearance immediately; retinoids reduce sebum production long-term and fade acne scars. Use both.',
      },
    ],
  },
  {
    slug: 'what-causes-acne',
    title: 'What Causes Acne? AI Dermatology Explained (Hormonal, Diet, Stress)',
    description:
      'The four root causes of acne — sebum, clogged pores, bacteria, and inflammation — and the lifestyle factors that amplify each. Plus how AI face scans pinpoint your dominant cause.',
    keywords: [
      'what causes acne',
      'acne causes',
      'hormonal acne',
      'cystic acne causes',
      'AI acne detection',
      'acne triggers',
    ],
    publishedAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-28T10:00:00.000Z',
    readMinutes: 8,
    body: [
      {
        type: 'p',
        html: `Acne isn't one disease — it's the visible result of four overlapping processes happening inside your pores. Treating the wrong one is why most products fail. This article breaks down each cause, the lifestyle factors that amplify them, and how a ${SCAN_LINK} maps your specific acne pattern to root cause.`,
      },
      { type: 'h2', text: 'The 4 root causes (in order of impact)' },
      { type: 'h3', text: '1. Excess sebum production' },
      {
        type: 'p',
        html: `Sebaceous glands produce oil to lubricate and waterproof skin. When they over-produce — driven by androgens (testosterone), insulin spikes, or stress cortisol — pores fill faster than they can drain. <strong>Treatment</strong>: niacinamide, retinoids, spironolactone (Rx for hormonal cases).`,
      },
      { type: 'h3', text: '2. Hyperkeratinization (dead skin cells clogging pores)' },
      {
        type: 'p',
        html: `Skin cells normally shed and wash away. In acne-prone skin, cells stick together and trap sebum inside the pore — forming the microcomedone that becomes a blackhead, whitehead, or cyst. <strong>Treatment</strong>: BHA (salicylic acid), AHA (glycolic acid), retinoids.`,
      },
      { type: 'h3', text: '3. C. acnes bacteria' },
      {
        type: 'p',
        html: `Cutibacterium acnes lives on everyone's skin but proliferates inside oxygen-deprived clogged pores, releasing inflammatory enzymes. <strong>Treatment</strong>: benzoyl peroxide (most effective, kills bacteria in 2 days), topical clindamycin, or oral antibiotics for severe cases.`,
      },
      { type: 'h3', text: '4. Inflammation' },
      {
        type: 'p',
        html: `The redness, swelling and pain of a pimple are your immune response — not the acne itself. Chronic low-grade inflammation (from diet, stress, poor sleep) makes every breakout worse and longer-lasting. <strong>Treatment</strong>: azelaic acid, niacinamide, omega-3s, anti-inflammatory diet.`,
      },
      { type: 'h2', text: 'Hormonal acne — the pattern to recognize' },
      {
        type: 'ul',
        items: [
          'Concentrated on jawline, chin, and lower cheeks (rarely forehead)',
          'Worsens 7–10 days before menstruation',
          'Deep, painful cysts rather than surface bumps',
          'Often accompanied by oily T-zone, hair thinning at temples, irregular cycles',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        html: `If you have all 4 of the above, ask a doctor about PCOS testing and spironolactone — topicals alone rarely resolve hormonal cystic acne.`,
      },
      { type: 'h2', text: 'Diet — what actually matters' },
      {
        type: 'p',
        html: `A 2023 meta-analysis of 78 studies confirmed two clear dietary triggers: <strong>high-glycemic foods</strong> (white bread, sugar, sweetened drinks) and <strong>dairy — especially skim milk</strong>. Chocolate, fried food, and "greasy food" have weak or no evidence. Vegan diets help only if they replace dairy with low-glycemic alternatives.`,
      },
      { type: 'h2', text: 'Stress and sleep' },
      {
        type: 'p',
        html: `Cortisol triggers sebum production within 24 hours. Sleep under 6 hours doubles inflammatory cytokines the next day. Both factors compound — chronically stressed people see 40% more breakouts than rested controls in clinical trials.`,
      },
      { type: 'h2', text: 'How to find your dominant cause' },
      {
        type: 'p',
        html: `Run a ${SCAN_LINK} — the AI maps lesion type (comedone vs papule vs cyst), distribution, and inflammation level to the most likely root cause and recommends the matching active ingredients. This is the same triage a dermatologist does in a consultation, automated.`,
      },
    ],
    faq: [
      {
        q: 'Does chocolate cause acne?',
        a: 'Not directly. Studies link sugar (high-glycemic foods) and dairy to acne, but cocoa itself is neutral. Dark chocolate (>70%) has no clear effect.',
      },
      {
        q: 'Is my acne hormonal?',
        a: 'Likely yes if it concentrates on jawline + chin, worsens before periods, and shows as deep cysts rather than surface bumps. AI scans flag this pattern automatically.',
      },
      {
        q: 'Why does stress cause breakouts?',
        a: 'Cortisol increases sebum production and dampens immune regulation, allowing C. acnes bacteria to proliferate. Effects appear within 24–48 hours of acute stress.',
      },
    ],
  },
  {
    slug: 'how-to-fix-dark-circles',
    title: 'How to Fix Dark Circles — 7 Evidence-Based Treatments Ranked (2026)',
    description:
      'The 7 actually-effective treatments for dark under-eye circles, ranked by clinical evidence — from caffeine eye creams to PRP and laser. Plus how to identify your dark-circle type with AI.',
    keywords: [
      'dark circles treatment',
      'how to remove dark circles',
      'best eye cream for dark circles',
      'caffeine eye cream',
      'pigmented dark circles',
      'AI dark circle detection',
    ],
    publishedAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-28T10:00:00.000Z',
    readMinutes: 7,
    body: [
      {
        type: 'p',
        html: `"Dark circles" is actually 4 different conditions — pigmented, vascular, structural, and shadow. Each needs a different treatment. Caffeine helps vascular but does nothing for pigmented. Vitamin K helps vascular but worsens dryness. Before buying any eye cream, identify your type. A ${SCAN_LINK} classifies dark circles automatically by analyzing skin tone, blood vessel visibility and orbital shape.`,
      },
      { type: 'h2', text: 'The 4 types — identify yours' },
      {
        type: 'ul',
        items: [
          '<strong>Pigmented (brown)</strong> — Most common in medium-to-deep skin tones. Genetic, sun damage, or post-inflammatory. Treatment: vitamin C, kojic acid, tranexamic acid, retinoids.',
          '<strong>Vascular (blue/purple)</strong> — Visible blood vessels through thin skin. Worsens with allergies, lack of sleep, dehydration. Treatment: caffeine, vitamin K, peptides, sleep + hydration.',
          '<strong>Structural</strong> — Tear trough hollow casts a shadow. Often bone structure or fat-pad loss with age. Treatment: hyaluronic acid filler (only real fix).',
          '<strong>Shadow</strong> — Caused by puffiness or skin laxity. Treatment: cold compress, caffeine, retinoids for laxity, or RF microneedling.',
        ],
      },
      { type: 'h2', text: 'The 7 treatments ranked by evidence' },
      { type: 'h3', text: '1. Sleep + hydration (free, works in 1 night)' },
      {
        type: 'p',
        html: `For vascular and shadow types only. 8 hours of sleep + 2L water reduces visible darkness by ~30% the next morning. Doesn't help pigmented circles.`,
      },
      { type: 'h3', text: '2. SPF 50 daily on under-eye (CRITICAL)' },
      {
        type: 'p',
        html: `Skip this and every other treatment is wasted. UV worsens pigmentation and breaks down collagen. Use a mineral SPF formulated for eyes — physical zinc oxide, no fragrance.`,
      },
      { type: 'h3', text: '3. Vitamin C 10–15% serum' },
      {
        type: 'p',
        html: `Best for pigmented type. L-ascorbic acid is the gold standard. Apply morning under SPF. Results in 8–12 weeks.`,
      },
      { type: 'h3', text: '4. Caffeine eye cream' },
      {
        type: 'p',
        html: `Vasoconstricts visible blood vessels under thin under-eye skin. Effect is real but temporary (4–6 hours). Best for vascular type. Apply morning.`,
      },
      { type: 'h3', text: '5. Retinoid (low % for under-eye)' },
      {
        type: 'p',
        html: `Adapalene 0.025% or retinaldehyde 0.05% — never tretinoin around eyes initially. Builds collagen, fades pigmentation, reduces laxity-shadow. 12+ weeks for visible effect. Apply 2–3× per week, gradually increase.`,
      },
      { type: 'h3', text: '6. Tranexamic acid 3–5% serum' },
      {
        type: 'p',
        html: `Newer ingredient with strong evidence for stubborn pigmentation. Often more effective than vitamin C for genetic dark circles in deep skin tones.`,
      },
      { type: 'h3', text: '7. In-clinic — filler, PRP, or laser' },
      {
        type: 'p',
        html: `For structural (filler), persistent pigmentation (Q-switched laser, $300–800/session), or laxity (RF microneedling). Always start with topicals first.`,
      },
      {
        type: 'callout',
        tone: 'warn',
        html: `<strong>Avoid</strong>: cucumber slices (no evidence), tea bags (caffeine doesn't penetrate from a teabag), and any product claiming to "remove" dark circles in 7 days.`,
      },
    ],
    faq: [
      {
        q: 'Why do I have dark circles even after sleeping 9 hours?',
        a: 'Likely you have pigmented or structural dark circles, not vascular. Sleep only fixes the vascular type. Identify yours with an AI scan.',
      },
      {
        q: 'Are dark circles genetic?',
        a: 'Pigmented and structural dark circles are heavily genetic, especially in South Asian, Mediterranean and African skin tones. They can be reduced but rarely fully eliminated.',
      },
      {
        q: 'How long until eye cream works?',
        a: 'Caffeine: 4–6 hours (temporary). Vitamin C: 8–12 weeks. Retinoid: 12+ weeks. Tranexamic acid: 8–10 weeks.',
      },
    ],
  },
  {
    slug: 'combination-skin-routine',
    title: 'Combination Skin Routine — Treat Both Zones Without Compromise',
    description:
      'How to build a skincare routine for combination skin — oily T-zone and dry cheeks — without buying two of every product. Includes the multi-masking technique and zone-specific actives.',
    keywords: [
      'combination skin routine',
      'how to treat combination skin',
      'multi-masking',
      'best moisturizer combination skin',
      'AI skin analysis',
    ],
    publishedAt: '2026-04-15T10:00:00.000Z',
    updatedAt: '2026-04-28T10:00:00.000Z',
    readMinutes: 6,
    body: [
      {
        type: 'p',
        html: `Combination skin is the most common type — about half of adults — but the worst-served by skincare marketing, which sells you separate "oily" and "dry" lines. The reality: you need <em>one</em> balanced base routine, with zone-specific actives applied only where they're needed. Here's how to do it without buying eight products. Run a ${SCAN_LINK} first to see exactly where your oily and dry zones are.`,
      },
      { type: 'h2', text: 'The 3-product base routine (universal)' },
      {
        type: 'ol',
        items: [
          '<strong>Cleanser</strong>: low-pH gel-cream (CeraVe Hydrating Cleanser, La Roche-Posay Toleriane). Not foaming, not stripping.',
          '<strong>Lightweight lotion moisturizer</strong>: glycerin + ceramides, no occlusives. Apply all over face.',
          '<strong>SPF 30 fluid</strong>: matte but hydrating finish — Beauty of Joseon Relief Sun, La Roche-Posay Anthelios UVMune.',
        ],
      },
      { type: 'h2', text: 'Zone-specific actives' },
      { type: 'h3', text: 'T-zone (forehead + nose + chin)' },
      {
        type: 'ul',
        items: [
          'Niacinamide 5–10% — every morning (regulates sebum)',
          'Salicylic acid 2% — 2–3 nights/week (clears pores)',
          'Optional retinoid — 2 nights/week, gradually increase',
        ],
      },
      { type: 'h3', text: 'Cheeks + perimeter' },
      {
        type: 'ul',
        items: [
          'Hyaluronic acid serum — every morning + night (hydration)',
          'Ceramide cream — nights, layered over moisturizer (barrier repair)',
          'Optional centella asiatica or panthenol — for redness',
        ],
      },
      { type: 'h2', text: 'The multi-masking technique (1× per week)' },
      {
        type: 'p',
        html: `Apply a clay mask (kaolin or bentonite) only on the T-zone, and a hydrating sheet/cream mask on the cheeks. Leave both on 10 minutes, rinse the clay first, leave the hydrator on. This is the cheat code for combination skin.`,
      },
      {
        type: 'callout',
        tone: 'tip',
        html: `<strong>Don't</strong> apply the same product to both zones if it's targeted at one. A heavy ceramide cream on your T-zone causes congestion. A salicylic acid serum on your cheeks causes peeling.`,
      },
      { type: 'h2', text: 'Seasonal adjustments' },
      {
        type: 'ul',
        items: [
          '<strong>Summer</strong>: drop retinoid frequency, switch SPF to gel, add niacinamide every night.',
          '<strong>Winter</strong>: add a richer night cream on cheeks only, reduce BHA to 1× week, layer humectants.',
        ],
      },
      { type: 'h2', text: 'When combination becomes oily or dry' },
      {
        type: 'p',
        html: `Skin shifts. Hormonal changes, climate moves, age (most people get drier past 35) all matter. Re-scan every 2–3 months — if your AI report shows the dry zones expanding, it's time to phase out the BHA and add an oil cleanser.`,
      },
    ],
    faq: [
      {
        q: 'Can I use the same moisturizer on both zones?',
        a: 'Yes — use a lightweight gel-lotion as your base everywhere. Then layer a richer cream only on the dry zones at night.',
      },
      {
        q: 'Do I really need two cleansers?',
        a: 'No. One pH-balanced gel-cream cleanser works for both zones. Avoid foaming sulfate cleansers regardless.',
      },
      {
        q: 'Is combination skin permanent?',
        a: 'No. Most people drift toward oily in their 20s and toward dry past 35. Re-evaluate your skin type every 2–3 months.',
      },
    ],
  },
]

export const postBySlug = (slug: string): BlogPost | undefined =>
  posts.find((p) => p.slug === slug)
