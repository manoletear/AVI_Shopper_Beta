import { Suspense } from 'react'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F8FAFC] px-4 py-10 text-sm text-slate-500">Cargando tu hogar…</main>}>
      <OnboardingFlow />
    </Suspense>
  )
}
