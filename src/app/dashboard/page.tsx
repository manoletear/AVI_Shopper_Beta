'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  ShoppingCart, ListChecks, DollarSign, Heart, Store, Users,
  ArrowRight, Settings, ChevronRight,
  Wallet, Package, User, Bot, Bell, MessageCircle,
  Repeat,
} from 'lucide-react'
import OnboardingWizard from '@/components/OnboardingWizard'

interface DashboardData {
  listsCount: number
  itemsCount: number
  alertsCount: number
  healthScore: number | null
  budgetSpent: number | null
  budgetTotal: number | null
}

const CATEGORIES = [
  { href: '/cart-assistant', label: 'Comprar', icon: ShoppingCart },
  { href: '/comparar', label: 'Precios', icon: DollarSign },
  { href: '/listas', label: 'Listas', icon: ListChecks },
  { href: '/avi', label: 'AVI', icon: Bot },
  { href: '/reposicion', label: 'Reponer', icon: Repeat },
  { href: '/salud', label: 'Salud', icon: Heart },
  { href: '/familia', label: 'Familia', icon: Users },
  { href: '/presupuesto', label: 'Gastos', icon: Wallet },
]

const STORE_DEALS = [
  {
    store: 'Jumbo',
    bg: 'bg-gradient-to-br from-[#006B3F] to-[#004D2C]',
    product: 'Frutas y Verduras',
    discount: 'Hasta 40% dcto',
    emoji: '🥬🍎🥑',
    price: 'Desde $990/kg',
    href: '/comparar?q=Palta%2C+Tomate%2C+Lechuga%2C+Manzana',
  },
  {
    store: 'Lider',
    bg: 'bg-gradient-to-br from-[#0032A0] to-[#001F6B]',
    product: 'Carnes Frescas',
    discount: 'Precios bajos siempre',
    emoji: '🥩🍗🥓',
    price: 'Pollo $2.490/kg',
    href: '/comparar?q=Pollo+entero%2C+Carne+molida%2C+Pechuga+pollo',
  },
  {
    store: 'Unimarc',
    bg: 'bg-gradient-to-br from-[#E8590C] to-[#C44708]',
    product: 'Lacteos del Dia',
    discount: '30% con tarjeta Unimarc',
    emoji: '🥛🧀🧈',
    price: 'Leche $890/lt',
    href: '/comparar?q=Leche%2C+Yogurt%2C+Queso%2C+Mantequilla',
  },
  {
    store: 'Tottus',
    bg: 'bg-gradient-to-br from-[#00695C] to-[#004D40]',
    product: 'Limpieza Total',
    discount: '3x2 seleccion',
    emoji: '🧴🧹🧽',
    price: 'Detergente $3.990',
    href: '/comparar?q=Detergente%2C+Cloro%2C+Lavalozas%2C+Papel+higienico',
  },
]

export default function DashboardPage() {
  const { data: session } = useSession()
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || ''
  const [data, setData] = useState<DashboardData | null>(null)
  const [promoIndex, setPromoIndex] = useState(0)
  const [upcomingEvents, setUpcomingEvents] = useState<Array<{ id: string; name: string; type: string; daysUntil: number; suggestedProducts: string[] }>>([])

  useEffect(() => {
    if (!session) return
    const load = async () => {
      const results: DashboardData = {
        listsCount: 0, itemsCount: 0, alertsCount: 0,
        healthScore: null, budgetSpent: null, budgetTotal: null,
      }
      await Promise.all([
        fetch('/api/shopping-lists').then(r => r.json()).then(d => {
          if (d.success) {
            results.listsCount = d.data.length
            results.itemsCount = d.data.reduce((s: number, l: any) => s + (l.items?.length || 0), 0)
          }
        }).catch(() => {}),
        fetch('/api/alerts').then(r => r.json()).then(d => {
          if (d.success) results.alertsCount = d.data.filter((a: any) => !a.read).length
        }).catch(() => {}),
        fetch('/api/health?mode=report').then(r => r.json()).then(d => {
          if (d.success) results.healthScore = d.data.overallScore
        }).catch(() => {}),
        fetch('/api/budgets?current=true').then(r => r.json()).then(d => {
          if (d.success && d.data) {
            results.budgetSpent = d.data.spent
            results.budgetTotal = d.data.amount
          }
        }).catch(() => {}),
      ])
      setData(results)
    }
    load()

    fetch('/api/events?days=21').then(r => r.json()).then(d => {
      if (d.success && d.data.events) setUpcomingEvents(d.data.events.slice(0, 3))
    }).catch(() => {})
  }, [session])

  useEffect(() => {
    const timer = setInterval(() => setPromoIndex((i) => (i + 1) % STORE_DEALS.length), 5000)
    return () => clearInterval(timer)
  }, [])

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  const budgetPct = data?.budgetTotal ? Math.round((data.budgetSpent! / data.budgetTotal) * 100) : 0
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos dias' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="avi-page pb-20">
      {/* Header */}
      <header className="avi-header">
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center overflow-hidden">
              <img src="/avi-icon.svg" alt="" className="w-7 h-7" />
            </div>
            <span className="text-base font-bold text-indigo-700">AVI</span>
          </div>
          <div className="flex items-center gap-1">
            {data && data.alertsCount > 0 && (
              <a href="/salud" className="relative p-2 text-gray-500">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </a>
            )}
            <a href="/configuracion/cuentas" className="p-2 text-gray-400"><Settings className="h-5 w-5" /></a>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4">
        {/* Greeting */}
        <div className="pt-4 pb-2">
          <p className="text-sm text-gray-500">{greeting},</p>
          <h1 className="text-xl font-bold text-gray-900">{userName}</h1>
        </div>

        {/* AVI Search Bar — links to cart-assistant (the AI agent) */}
        <a href="/cart-assistant" className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 mb-5 shadow-sm active:scale-[0.98] transition-transform border border-indigo-100">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src="/avi-icon.svg" alt="" className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-400">Habla con AVI...</p>
            <p className="text-[10px] text-gray-300">Arma listas, busca productos, compara precios</p>
          </div>
          <Bot className="h-4 w-4 text-gray-300" />
        </a>

        {/* Promo Banner — Supermarket ads */}
        <a href={STORE_DEALS[promoIndex].href} className="block mb-4">
          <div className={`${STORE_DEALS[promoIndex].bg} rounded-2xl p-5 text-white relative overflow-hidden min-h-[130px]`}>
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full">
                  {STORE_DEALS[promoIndex].store}
                </span>
                <h2 className="text-xl font-bold mt-2.5">{STORE_DEALS[promoIndex].product}</h2>
                <p className="text-sm text-white/80 mt-0.5">{STORE_DEALS[promoIndex].discount}</p>
                <p className="text-xs text-white/60 mt-1 font-medium">{STORE_DEALS[promoIndex].price}</p>
              </div>
              <span className="text-4xl mt-1">{STORE_DEALS[promoIndex].emoji}</span>
            </div>
          </div>
          <div className="flex justify-center gap-1.5 mt-2">
            {STORE_DEALS.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === promoIndex ? 'bg-indigo-600' : 'bg-gray-300'}`} />
            ))}
          </div>
        </a>

        {/* Category Icons */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <a key={cat.href} href={cat.href} className="flex flex-col items-center gap-1 py-2 group">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform border border-slate-100">
                  <Icon className="h-5 w-5 text-slate-700 stroke-[1.5]" />
                </div>
                <span className="text-[11px] font-medium text-gray-500">{cat.label}</span>
              </a>
            )
          })}
        </div>

        {/* Onboarding */}
        <OnboardingWizard />

        {/* Stats Row */}
        {data && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <a href="/listas" className="bg-white rounded-2xl p-3 text-center shadow-sm active:scale-95 transition-transform">
              <p className="text-lg font-bold text-gray-900">{data.listsCount}</p>
              <p className="text-[10px] text-gray-400 font-medium">LISTAS</p>
            </a>
            <a href="/salud" className="bg-white rounded-2xl p-3 text-center shadow-sm active:scale-95 transition-transform">
              <p className={`text-lg font-bold ${
                data.healthScore === null ? 'text-gray-300' :
                data.healthScore >= 75 ? 'text-emerald-600' :
                data.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {data.healthScore ?? '—'}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">SALUD</p>
            </a>
            <a href="/presupuesto" className="bg-white rounded-2xl p-3 text-center shadow-sm active:scale-95 transition-transform">
              {data.budgetTotal ? (
                <>
                  <p className="text-lg font-bold text-gray-900">{budgetPct}%</p>
                  <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                    <div className={`h-1 rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, budgetPct)}%` }} />
                  </div>
                </>
              ) : (
                <p className="text-lg font-bold text-gray-300">—</p>
              )}
              <p className="text-[10px] text-gray-400 font-medium">GASTO</p>
            </a>
          </div>
        )}

        {/* Upcoming Events — Proactive reminders */}
        {upcomingEvents.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Preparate con tiempo</h2>
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <a
                  key={event.id}
                  href={`/cart-assistant?products=${encodeURIComponent(event.suggestedProducts.join(', '))}`}
                  className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    event.daysUntil <= 3 ? 'bg-red-100' :
                    event.daysUntil <= 7 ? 'bg-amber-100' : 'bg-indigo-100'
                  }`}>
                    <span className="text-lg">
                      {event.type === 'national_holiday' ? '🇨🇱' :
                       event.type === 'family' ? '🎂' :
                       event.type === 'religious' ? '⛪' :
                       event.type === 'seasonal' ? '📅' : '🎉'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{event.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {event.daysUntil === 0 ? 'Hoy' :
                       event.daysUntil === 1 ? 'Manana' :
                       `En ${event.daysUntil} dias`} · {event.suggestedProducts.length} productos sugeridos
                    </p>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                    event.daysUntil <= 3 ? 'bg-red-100 text-red-700' :
                    event.daysUntil <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    {event.daysUntil <= 0 ? 'Hoy' : `${event.daysUntil}d`}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Supermarket Deals — Ad spaces */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">Ofertas del dia</h2>
            <a href="/comparar" className="text-xs font-medium text-gray-400 flex items-center gap-0.5">
              Ver mas <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
            {STORE_DEALS.map((deal) => (
              <a
                key={deal.store}
                href={deal.href}
                className="bg-white rounded-2xl min-w-[150px] shadow-sm flex-shrink-0 active:scale-95 transition-transform overflow-hidden"
              >
                <div className={`${deal.bg} px-3 py-3 text-center`}>
                  <span className="text-3xl">{deal.emoji}</span>
                </div>
                <div className="p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{deal.store}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{deal.product}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{deal.discount}</p>
                  <p className="text-xs font-bold text-indigo-600 mt-1">{deal.price}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Services */}
        <div className="mb-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Servicios</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/perfil', label: 'Mi perfil', sub: 'Dieta y alergias', icon: User },
              { href: '/configuracion/cuentas', label: 'Supermercados', sub: 'Vincular cuentas', icon: Store },
              { href: '/reposicion', label: 'Reposicion', sub: 'Lo que se acaba', icon: Package },
              { href: '/familia', label: 'Mi familia', sub: 'Miembros y alergenos', icon: Users },
            ].map((svc) => {
              const Icon = svc.icon
              return (
                <a key={svc.href} href={svc.href}
                  className="bg-white rounded-2xl p-3.5 shadow-sm flex items-start gap-3 active:scale-[0.97] transition-transform">
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-gray-500 stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{svc.label}</p>
                    <p className="text-[10px] text-gray-400">{svc.sub}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {/* WhatsApp — Add AVI to family group */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">AVI en tu grupo familiar</p>
              <p className="text-[10px] text-gray-400">Agrega a AVI a tu grupo de WhatsApp y gestiona compras en familia</p>
            </div>
          </div>
          <a
            href="https://wa.me/56XXXXXXXXXX?text=Hola%20AVI%2C%20te%20agrego%20al%20grupo%20familiar"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-2.5 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            <MessageCircle className="h-4 w-4" />
            Agregar AVI al grupo
          </a>
        </div>
      </main>
    </div>
  )
}
