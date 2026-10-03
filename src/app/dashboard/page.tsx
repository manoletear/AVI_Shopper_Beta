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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Jumbo_Logo.svg/200px-Jumbo_Logo.svg.png',
    bg: 'bg-[#006B3F]',
    product: 'Frutas y Verduras',
    discount: 'Hasta 40% dcto',
    href: '/comparar?q=Frutas%2C+Verduras%2C+Palta%2C+Tomate%2C+Lechuga',
  },
  {
    store: 'Lider',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/L%C3%ADder_logo.svg/200px-L%C3%ADder_logo.svg.png',
    bg: 'bg-[#0032A0]',
    product: 'Carnes y Pollo',
    discount: 'Precios bajos',
    href: '/comparar?q=Pollo+entero%2C+Carne+molida%2C+Pechuga+pollo',
  },
  {
    store: 'Unimarc',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Unimarc_logo.svg/200px-Unimarc_logo.svg.png',
    bg: 'bg-[#E8590C]',
    product: 'Lacteos',
    discount: '30% con tarjeta',
    href: '/comparar?q=Leche%2C+Yogurt%2C+Queso%2C+Mantequilla',
  },
  {
    store: 'Tottus',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Tottus_logo.svg/200px-Tottus_logo.svg.png',
    bg: 'bg-[#00695C]',
    product: 'Limpieza',
    discount: '3x2 seleccion',
    href: '/comparar?q=Detergente%2C+Cloro%2C+Lavalozas%2C+Papel+higienico',
  },
]

export default function DashboardPage() {
  const { data: session } = useSession()
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || ''
  const [data, setData] = useState<DashboardData | null>(null)
  const [promoIndex, setPromoIndex] = useState(0)

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
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center overflow-hidden">
              <img src="/avi-icon.svg" alt="" className="w-7 h-7" />
            </div>
            <span className="text-base font-bold text-gray-900">AVI</span>
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
        <a href="/cart-assistant" className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 mb-5 shadow-sm active:scale-[0.98] transition-transform">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src="/avi-icon.svg" alt="" className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-400">Habla con AVI...</p>
            <p className="text-[10px] text-gray-300">Arma listas, busca productos, compara precios</p>
          </div>
          <Bot className="h-4 w-4 text-gray-300" />
        </a>

        {/* Promo Banner — Supermarket ads with real branding */}
        <a href={STORE_DEALS[promoIndex].href} className="block mb-4">
          <div className={`${STORE_DEALS[promoIndex].bg} rounded-2xl p-5 text-white relative overflow-hidden min-h-[120px]`}>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={STORE_DEALS[promoIndex].logo}
                  alt={STORE_DEALS[promoIndex].store}
                  className="h-5 brightness-0 invert"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">
                  {STORE_DEALS[promoIndex].store}
                </span>
              </div>
              <h2 className="text-lg font-bold">{STORE_DEALS[promoIndex].product}</h2>
              <p className="text-sm text-white/80">{STORE_DEALS[promoIndex].discount}</p>
            </div>
          </div>
          <div className="flex justify-center gap-1.5 mt-2">
            {STORE_DEALS.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === promoIndex ? 'bg-gray-900' : 'bg-gray-300'}`} />
            ))}
          </div>
        </a>

        {/* Category Icons */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <a key={cat.href} href={cat.href} className="flex flex-col items-center gap-1 py-2 group">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform">
                  <Icon className="h-5 w-5 text-gray-700 stroke-[1.5]" />
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
                className="bg-white rounded-2xl p-3.5 min-w-[140px] shadow-sm flex-shrink-0 active:scale-95 transition-transform"
              >
                <img
                  src={deal.logo}
                  alt={deal.store}
                  className="h-4 mb-2 object-contain"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement
                    el.style.display = 'none'
                    el.parentElement!.querySelector('.fallback')?.classList.remove('hidden')
                  }}
                />
                <span className="fallback hidden text-xs font-bold text-gray-700">{deal.store}</span>
                <p className="text-sm font-semibold text-gray-900">{deal.product}</p>
                <p className="text-[11px] text-gray-400">{deal.discount}</p>
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

        {/* WhatsApp */}
        <a
          href="https://wa.me/56XXXXXXXXXX?text=Hola%20AVI"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm mb-4 active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">AVI en WhatsApp</p>
            <p className="text-[10px] text-gray-400">Compras rapidas desde tu chat</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </a>
      </main>
    </div>
  )
}
