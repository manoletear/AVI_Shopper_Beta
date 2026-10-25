'use client'

import { useSearchParams } from 'next/navigation'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'
import BasicOnboarding from '@/components/onboarding/BasicOnboarding'

export default function OnboardingEntry() {
  const params = useSearchParams()
  if (params.get('flujo') === 'completo' || params.get('paso')) return <OnboardingFlow />
  return <BasicOnboarding editing={params.get('editar') === '1'} />
}
