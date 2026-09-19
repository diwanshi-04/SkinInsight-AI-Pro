import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'SkinInsight AI — Free AI Skin Analysis'
export const contentType = 'image/png'
export const size = { width: 1200, height: 630 }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title =
    searchParams.get('title') ||
    'Free AI Skin Analysis'
  const subtitle =
    searchParams.get('subtitle') ||
    'Scan your face. Get a personalized skincare report in 10 seconds.'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background:
            'linear-gradient(135deg, #0a0a0a 0%, #1a0d2e 45%, #2d1b69 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Ambient glow blob */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(168,85,247,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -150,
            left: -150,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(244,114,182,0.35) 0%, rgba(244,114,182,0) 70%)',
            display: 'flex',
          }}
        />

        {/* Top: brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background:
                'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            S
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            SkinInsight AI
          </div>
        </div>

        {/* Center: title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 20px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              alignSelf: 'flex-start',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: '#e9d5ff',
            }}
          >
            ✨ AI Dermatology
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2.5,
              maxWidth: 1000,
              backgroundImage:
                'linear-gradient(135deg, #ffffff 0%, #e9d5ff 50%, #fbcfe8 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.3,
              color: 'rgba(255,255,255,0.75)',
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Bottom: trust badges */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            zIndex: 1,
          }}
        >
          {[
            '100% Free',
            'On-device AI',
            'No signup',
            '10-second scan',
          ].map((b) => (
            <div
              key={b}
              style={{
                padding: '12px 24px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {b}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
