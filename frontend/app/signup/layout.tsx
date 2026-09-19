import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign up — Free AI Skin Analysis Account',
  description: 'Create a free SkinInsight AI account to save your scans, track skin progress and get a personalized routine.',
  alternates: { canonical: '/signup' },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
