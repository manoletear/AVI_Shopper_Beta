'use client'

import { useState, useEffect } from 'react'
import {
  User, Users, Wallet, ShoppingCart, Check, ArrowRight,
  X, Heart, Baby, Dog,
} from 'lucide-react'

interface OnboardingStep {
  key: string
  title: string
  description: string
  icon: typeof User
  href: string
  color: string
}

const STEPS: OnboardingStep[] = [
  { key: 'profile', title: 'Tu perfil nutricional', description: 'Alergias, dieta, objetivos', icon: Heart, href: '/perfil', color: 'text-rose-600' },
  { key: 'family', title: 'Tu familia', description: 'Invita miembros, agrega hijos y mascotas', icon: Users, href: '/familia', color: 'text-purple-600' },
  { key: 'budget', title: 'Tu presupuesto', description: 'Control de gastos mensual', icon: Wallet, href: '/presupuesto', color: 'text-teal-600' },
  { key: 'list', title: 'Primera lista', description: 'Crea o importa tu lista de compras', icon: ShoppingCart, href: '/listas', color: 'text-blue-600' },
]

export default function OnboardingWizard() {
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [dismissed, setDismissed] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      const status: Record<string, boolean> = {}

      try {
        const [prefsRes, familyRes, budgetRes, listsRes] = await Promise.all([
          fetch('/api/users/preferences').then((r) => r.json()).catch(() => null),
          fetch('/api/family').then((r) => r.json()).catch(() => null),
          fetch('/api/budgets?current=true').then((r) => r.json()).catch(() => null),
          fetch('/api/shopping-lists').then((r) => r.json()).catch(() => null),
        ])

        status.profile = !!(prefsRes?.success && prefsRes?.data?.dietType)
        if (familyRes?.success && familyRes?.data?.family) {
          const members = familyRes.data.family.members || []
          let confirmed = false
          try { confirmed = localStorage.getItem('avi-family-confirmed') === 'true' } catch {}
          status.family = members.length >= 2 || confirmed
        }
        status.budget = !!(budgetRes?.success && budgetRes?.data)
        status.list = !!(listsRes?.success && listsRes?.data?.length > 0)
      } catch {}

      setCompleted(status)
      setChecking(false)

      try {
        const stored = localStorage.getItem('avi-onboarding-dismissed')
        if (stored === 'true') setDismissed(true)
      } catch {}
    }
    check()
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem('avi-onboarding-dismissed', 'true') } catch {}
  }

  const completedCount = Object.values(completed).filter(Boolean).length
  const allDone = completedCount === STEPS.length

  if (checking || dismissed || allDone) return null

  return (
    <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-900">Configura AVI en 4 pasos</h3>
          <p className="text-xs text-gray-500 mt-0.5">{completedCount}/4 completados</p>
        </div>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="w-full bg-white rounded-full h-2 mb-4">
        <div
          className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
          style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {STEPS.map((step) => {
          const Icon = step.icon
          const done = completed[step.key]

          return (
            <a
              key={step.key}
              href={step.href}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                done
                  ? 'bg-white/50 opacity-60'
                  : 'bg-white hover:bg-blue-50 border border-transparent hover:border-blue-200'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                done ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {done ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Icon className={`h-4 w-4 ${step.color}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-400">{step.description}</p>
              </div>
              {!done && <ArrowRight className="h-4 w-4 text-gray-300" />}
            </a>
          )
        })}
      </div>
    </div>
  )
}
