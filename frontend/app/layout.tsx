import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://skininsightai.app'
const SITE_NAME = 'SkinInsight AI'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SkinInsight AI — Free AI Skin Analysis, Acne & Skin Type Test Online',
    template: '%s | SkinInsight AI',
  },
  description:
    'Free AI skin analysis online. Take or upload a selfie and get an instant report on skin type, acne, pigmentation, redness, dark circles, oiliness and dryness — plus a personalized skincare routine, diet plan and product recommendations. Works on mobile and desktop, no signup required.',
  applicationName: SITE_NAME,
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'AI skin analysis',
    'skin analysis online',
    'free skin test',
    'skin type quiz',
    'acne detection AI',
    'pigmentation analysis',
    'dark circle detection',
    'face scan app',
    'AI dermatology',
    'personalized skincare routine',
    'skincare AI',
    'skin score',
    'oily skin test',
    'dry skin test',
    'AI face scanner',
    'skin health checker',
  ],
  authors: [{ name: 'SkinInsight AI' }],
  creator: 'SkinInsight AI',
  publisher: 'SkinInsight AI',
  category: 'health',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'SkinInsight AI — Free AI Skin Analysis & Personalized Skincare Routine',
    description:
      'Scan your face in 10 seconds. Get a detailed AI report on skin type, acne, pigmentation, redness, dark circles and dryness — with a routine tailored to you. Free, on-device, no signup.',
    url: SITE_URL,
    locale: 'en_US',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'SkinInsight AI — Free AI-Powered Skin Analysis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SkinInsight AI — Free AI Skin Analysis Online',
    description:
      'Scan your face in 10s. AI report on skin type, acne, pigmentation, redness, dark circles + a personalized routine. Free.',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SkinInsight AI',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/light.png', media: '(prefers-color-scheme: light)' },
      { url: '/dark.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
    shortcut: '/icon.svg',
  },
  verification: {
    google: 'vkR60qm22JtjBdjEMINmNgzfwRm8JyoWpa1DNs4RUyM',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#org`,
      name: SITE_NAME,
      alternateName: [
        'Skin Insight AI',
        'SkinInsight',
        'Skin Insight',
        'skininsightai',
        'skininsightai.app',
        'Skin Insight App',
        'Skin Score',
        'SkinScore',
      ],
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
        width: 512,
        height: 512,
      },
      image: `${SITE_URL}/api/og`,
      description:
        'SkinInsight AI is a free AI-powered skin analysis web app that detects skin type, acne, pigmentation, redness, dark circles and dryness from a selfie, then generates a personalized skincare routine.',
      slogan: 'Your skin, decoded in 30 seconds.',
      foundingDate: '2025-01-01',
      sameAs: [
        'https://skin-score.app',
        `${SITE_URL}/blog`,
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: [
        'Skin Insight AI',
        'SkinInsight',
        'Skin Insight',
        'skininsightai',
        'Skin Insight App',
      ],
      description:
        'Free AI skin analysis online. Scan your face, get an instant report on skin type, acne, dark circles and dryness — plus a personalized skincare routine.',
      publisher: { '@id': `${SITE_URL}#org` },
      inLanguage: 'en',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description:
        'AI-powered skin analysis web app: skin type detection, acne, pigmentation, redness, dark circle and dryness scoring with personalized skincare routines.',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Any (Web)',
      browserRequirements: 'Requires JavaScript and a modern browser with camera access.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '128',
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Is the AI skin analysis really free?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. SkinInsight AI is 100% free. You can scan your face, get a detailed skin report and a personalized routine without paying or creating an account.',
          },
        },
        {
          '@type': 'Question',
          name: 'What does the skin scan detect?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The scanner detects skin type (oily, dry, combination, normal), acne severity, pigmentation, redness, dark circles, dryness and overall skin quality using on-device computer vision.',
          },
        },
        {
          '@type': 'Question',
          name: 'Are my photos uploaded anywhere?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Face tracking and analysis run on-device in your browser using MediaPipe. Photos are not stored on a server unless you explicitly save a scan to your account.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does it work on mobile?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. SkinInsight AI is fully optimized for mobile browsers (iOS Safari and Android Chrome) as well as desktop. You can install it as a PWA for an app-like experience.',
          },
        },
      ],
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="canonical" href={SITE_URL} />
        <Script
          id="ld-json-site"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
