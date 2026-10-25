'use client'

import { useEffect, useState } from 'react'

interface ProgressiveCard {
  showReminder: boolean
  completeness: number
  pending: string[]
}

export default function ProgressiveBanner() {
  const [card, setCard] = useState<ProgressiveCard | null>(null)

  useEffect(() => {
    fetch('/api/onboarding/progressive')
      .then((response) => response.json())
      .then((body) => {
        if (body?.success) setCard(body.data)
      })
      .catch(() => {})
  }, [])

  if (!card?.showReminder) return null
  const left = card.pending.length

  return (
    <a href="/onboarding/perfil" className="mb-5 block rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#0F172A]">Afina tu hogar</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {card.completeness}% listo · {left === 1 ? 'falta 1 dato' : `faltan ${left} datos`} para que el carro calce mejor
          </p>
        </div>
        <span className="rounded-full bg-[#F59E0B] px-2.5 py-1 text-[11px] font-bold text-white">Completar</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${card.completeness}%` }} />
      </div>
    </a>
  )
}
