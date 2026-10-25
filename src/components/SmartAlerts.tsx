'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { X, ShoppingCart, Users, CreditCard, Bell, Heart, Store, ArrowRight, AlertTriangle } from 'lucide-react'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: typeof ShoppingCart
  href: string
  check: () => Promise<boolean>
  priority: number
}

interface SmartAlert {
  id: string
  type: 'onboarding' | 'health' | 'budget' | 'tip'
  title: string
  message: string
  action?: { label: string; href: string }
  dismissable: boolean
  color: string
}

export default function SmartAlerts() {
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<SmartAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [sessionStart] = useState(Date.now())
  const [minutesActive, setMinutesActive] = useState(0)

  // Rastrear tiempo activo
  useEffect(() => {
    const interval = setInterval(() => {
      setMinutesActive(Math.floor((Date.now() - sessionStart) / 60000))
    }, 30000)
    return () => clearInterval(interval)
  }, [sessionStart])

  // Cargar estado de onboarding y generar alertas
  useEffect(() => {
    if (!session) return

    // Recuperar dismissed del localStorage
    try {
      const saved = localStorage.getItem('avi_dismissed_alerts')
      if (saved) setDismissed(new Set(JSON.parse(saved)))
    } catch {}

    checkOnboarding()
  }, [session])

  // Alertas basadas en tiempo
  useEffect(() => {
    if (!session) return

    const timeAlerts: SmartAlert[] = []

    if (minutesActive >= 2 && !dismissed.has('time-supermercados')) {
      timeAlerts.push({
        id: 'time-supermercados',
        type: 'onboarding',
        title: '¿Ya vinculaste tus supermercados?',
        message: 'Vincula tus cuentas de Jumbo, Lider o Unimarc para que AVI arme tu carrito automaticamente.',
        action: { label: 'Vincular ahora', href: '/configuracion/cuentas' },
        dismissable: true,
        color: 'orange',
      })
    }

    if (minutesActive >= 5 && !dismissed.has('time-familia')) {
      timeAlerts.push({
        id: 'time-familia',
        type: 'onboarding',
        title: 'Configura tu familia',
        message: 'Agrega a los miembros de tu hogar (incluye mascotas) para que AVI cuide la nutricion y alergias de cada uno.',
        action: { label: 'Configurar familia', href: '/familia' },
        dismissable: true,
        color: 'indigo',
      })
    }

    if (minutesActive >= 8 && !dismissed.has('time-presupuesto')) {
      timeAlerts.push({
        id: 'time-presupuesto',
        type: 'budget',
        title: '¿Cuanto quieres gastar al mes?',
        message: 'Define tu presupuesto y AVI controlara que no te pases. Si estas dentro del limite, AVI compra automaticamente.',
        action: { label: 'Definir presupuesto', href: '/presupuesto' },
        dismissable: true,
        color: 'teal',
      })
    }

    if (timeAlerts.length > 0) {
      setAlerts((prev) => {
        const existingIds = new Set(prev.map((a) => a.id))
        const newAlerts = timeAlerts.filter((a) => !existingIds.has(a.id) && !dismissed.has(a.id))
        return [...prev, ...newAlerts]
      })
    }
  }, [minutesActive, dismissed, session])

  const checkOnboarding = async () => {
    const newAlerts: SmartAlert[] = []

    // Check perfil nutricional
    try {
      const res = await fetch('/api/users/preferences')
      const data = await res.json()
      if (data.success) {
        const prefs = data.data
        if (!prefs || (!prefs.dietType && (!prefs.allergies || prefs.allergies.length === 0))) {
          if (!dismissed.has('onboard-perfil')) {
            newAlerts.push({
              id: 'onboard-perfil',
              type: 'onboarding',
              title: '¡Completa tu perfil nutricional!',
              message: 'AVI necesita saber si alguien en tu familia tiene alergias o restricciones alimentarias para protegerlos.',
              action: { label: 'Completar perfil', href: '/perfil' },
              dismissable: true,
              color: 'rose',
            })
          }
        }
      }
    } catch {}

    // Check familia
    try {
      const res = await fetch('/api/family')
      const data = await res.json()
      if (data.success && !data.data.family) {
        if (!dismissed.has('onboard-familia')) {
          newAlerts.push({
            id: 'onboard-familia',
            type: 'onboarding',
            title: '¡Configura tu grupo familiar!',
            message: 'Agrega a tu familia y mascotas para que AVI proteja a cada uno de alergenos y cuide su nutricion.',
            action: { label: 'Configurar familia', href: '/familia' },
            dismissable: true,
            color: 'indigo',
          })
        }
      }
    } catch {}

    // Check cuentas de supermercados
    try {
      const res = await fetch('/api/users/store-accounts')
      const data = await res.json()
      if (data.success && (!data.data || data.data.length === 0)) {
        if (!dismissed.has('onboard-stores')) {
          newAlerts.push({
            id: 'onboard-stores',
            type: 'onboarding',
            title: 'Vincula tu primer supermercado',
            message: 'Para que AVI arme tu carrito y compre por ti, necesita acceso a tu cuenta del super.',
            action: { label: 'Vincular cuenta', href: '/configuracion/cuentas' },
            dismissable: true,
            color: 'orange',
          })
        }
      }
    } catch {}

    // Check presupuesto
    try {
      const res = await fetch('/api/budgets?current=true')
      const data = await res.json()
      if (data.success && !data.data) {
        if (!dismissed.has('onboard-budget')) {
          newAlerts.push({
            id: 'onboard-budget',
            type: 'budget',
            title: 'Define tu presupuesto mensual',
            message: 'Con un presupuesto definido, AVI controla tus gastos y puede comprar automaticamente si estas dentro del limite.',
            action: { label: 'Crear presupuesto', href: '/presupuesto' },
            dismissable: true,
            color: 'teal',
          })
        }
      }
    } catch {}

    setAlerts((prev) => [...prev, ...newAlerts])
  }

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem('avi_dismissed_alerts', JSON.stringify([...next])) } catch {}
      return next
    })
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id))

  if (visibleAlerts.length === 0) return null

  const COLORS: Record<string, { bg: string; border: string; icon: string }> = {
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-500' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-500' },
    teal: { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-500' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-500' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500' },
  }

  const ICONS: Record<string, typeof ShoppingCart> = {
    onboarding: Bell,
    health: Heart,
    budget: CreditCard,
    tip: AlertTriangle,
  }

  return (
    <div className="space-y-2 mb-4">
      {visibleAlerts.slice(0, 2).map((alert) => {
        const colors = COLORS[alert.color] || COLORS.blue
        if (!colors) return null
        const Icon = ICONS[alert.type] || Bell

        return (
          <div
            key={alert.id}
            className={`${colors.bg} ${colors.border} border rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top`}
          >
            <div className={`${colors.icon} mt-0.5 flex-shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{alert.message}</p>
              {alert.action && (
                <a
                  href={alert.action.href}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 mt-2 hover:text-blue-700"
                >
                  {alert.action.label}
                  <ArrowRight className="h-3 w-3" />
                </a>
              )}
            </div>
            {alert.dismissable && (
              <button onClick={() => dismiss(alert.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
