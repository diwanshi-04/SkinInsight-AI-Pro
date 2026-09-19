import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — Free Forever for Skin Analysis',
  description:
    'SkinInsight AI is free forever for unlimited skin analyses. See pricing details for premium features like progress history, advanced reports and AI dermatologist chat.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — SkinInsight AI',
    description: 'Free forever for AI skin analysis. See premium features and plans.',
    url: '/pricing',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
