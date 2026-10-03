'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  ShoppingCart, ListChecks, DollarSign, Heart, Store, Users,
  ArrowRight, LogOut, Settings, Search, ChevronRight,
  Wallet, Package, User, Bot, Bell, MessageCircle,
  Repeat, Sparkles, Camera, TrendingDown,
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
  { href: '/cart-assistant', label: 'Comprar', icon: ShoppingCart, color: 'bg-gray-900' },
  { href: '/comparar', label: 'Precios', icon: DollarSign, color: 'bg-gray-700' },
  { href: '/listas', label: 'Listas', icon: ListChecks, color: 'bg-gray-700' },
  { href: '/avi', label: 'AVI', icon: Bot, color: 'bg-gray-700' },
  { href: '/reposicion', label: 'Reponer', icon: Package, color: 'bg-gray-700' },
  { href: '/salud', label: 'Salud', icon: Heart, color: 'bg-gray-700' },
  { href: '/familia', label: 'Familia', icon: Users, color: 'bg-gray-700' },
  { href: '/presupuesto', label: 'Gastos', icon: Wallet, color: 'bg-gray-700' },
]

const PROMO_BANNERS = [
  { store: 'Jumbo', bg: 'bg-green-700', text: 'Ofertas de la semana', sub: 'Hasta 40% en frutas y verduras', href: '/comparar' },
  { store: 'Lider', bg: 'bg-red-700', text: 'Precios bajos siempre', sub: 'Compara y ahorra con AVI', href: '/comparar' },
  { store: 'Tottus', bg: 'bg-teal-700', text: 'Dias Tottus', sub: 'Descuentos en limpieza y hogar', href: '/comparar' },
]

const QUICK_LISTS = [
  { label: 'Asado', emoji: '🔥' },
  { label: 'Desayuno', emoji: '☀️' },
  { label: 'Limpieza', emoji: '🧹' },
  { label: 'Bebe', emoji: '👶' },
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
    const timer = setInterval(() => {
      setPromoIndex((i) => (i + 1) % PROMO_BANNERS.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  const budgetPct = data?.budgetTotal ? Math.round((data.budgetSpent! / data.budgetTotal) * 100) : 0
  const greeting = new Date().getHours() < 12 ? 'Buenos dias' : new Date().getHours() < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="avi-page pb-20">
      {/* Header */}
      <header className="avi-header">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center overflow-hidden">
              <img src="/avi-icon.svg" alt="" className="w-6 h-6" />
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
            <a href="/configuracion/cuentas" className="p-2 text-gray-400">
              <Settings className="h-5 w-5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4">
        {/* Greeting + Search */}
        <div className="pt-4 pb-3">
          <p className="text-sm text-gray-500">{greeting},</p>
          <h1 className="text-xl font-bold text-gray-900">{userName}</h1>
        </div>

        {/* Search bar */}
        <a href="/cart-assistant" className="flex items-center gap-3 bg-gray-100 rounded-full px-4 py-3 mb-5">
          <Search className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-400 flex-1">Buscar productos...</span>
          <Camera className="h-4 w-4 text-gray-400" />
        </a>

        {/* Promo Banner — Ad space */}
        <a href={PROMO_BANNERS[promoIndex].href} className="block mb-5">
          <div className={`${PROMO_BANNERS[promoIndex].bg} rounded-2xl p-5 text-white relative overflow-hidden`}>
            <div className="relative z-10">
              <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">
                {PROMO_BANNERS[promoIndex].store}
              </span>
              <h2 className="text-lg font-bold mt-2">{PROMO_BANNERS[promoIndex].text}</h2>
              <p className="text-sm text-white/80 mt-0.5">{PROMO_BANNERS[promoIndex].sub}</p>
            </div>
            <div className="absolute right-4 bottom-0 opacity-10">
              <ShoppingCart className="h-24 w-24" />
            </div>
          </div>
          {/* Dots */}
          <div className="flex justify-center gap-1.5 mt-2">
            {PROMO_BANNERS.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === promoIndex ? 'bg-gray-900' : 'bg-gray-300'}`} />
            ))}
          </div>
        </a>

        {/* Category Icons */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <a key={cat.href} href={cat.href} className="flex flex-col items-center gap-1.5 group">
                <div className={`w-12 h-12 ${cat.color} rounded-2xl flex items-center justify-center group-active:scale-95 transition-transform`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-gray-600">{cat.label}</span>
              </a>
            )
          })}
        </div>

        {/* Onboarding */}
        <OnboardingWizard />

        {/* Quick Lists */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Listas rapidas</h2>
            <a href="/listas" className="text-xs font-medium text-gray-500 flex items-center gap-0.5">
              Ver todas <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {QUICK_LISTS.map((ql) => (
              <a
                key={ql.label}
                href={`/cart-assistant?products=${encodeURIComponent(ql.label === 'Asado' ? 'Carbon, Carne, Longanizas, Pan, Tomate, Palta, Bebidas' : ql.label === 'Desayuno' ? 'Leche, Pan, Huevos, Cafe, Mantequilla, Mermelada' : ql.label === 'Limpieza' ? 'Detergente, Cloro, Lavalozas, Papel higienico, Esponja' : 'Panales, Toallitas, Formula, Compotas')}`}
                className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-sm whitespace-nowrap active:scale-95 transition-transform"
              >
                <span className="text-sm">{ql.emoji}</span>
                <span className="text-sm font-medium text-gray-800">{ql.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        {data && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            <a href="/listas" className="bg-white rounded-2xl p-3.5 text-center shadow-sm active:scale-95 transition-transform">
              <p className="text-xl font-bold text-gray-900">{data.listsCount}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">LISTAS</p>
            </a>
            <a href="/salud" className="bg-white rounded-2xl p-3.5 text-center shadow-sm active:scale-95 transition-transform">
              <p className={`text-xl font-bold ${
                data.healthScore === null ? 'text-gray-300' :
                data.healthScore >= 75 ? 'text-emerald-600' :
                data.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {data.healthScore ?? '—'}
              </p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">SALUD</p>
            </a>
            <a href="/presupuesto" className="bg-white rounded-2xl p-3.5 text-center shadow-sm active:scale-95 transition-transform">
              {data.budgetTotal ? (
                <>
                  <p className="text-xl font-bold text-gray-900">{budgetPct}%</p>
                  <div className="w-full bg-gray-100 rounded-full h-1 mt-1.5">
                    <div className={`h-1 rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, budgetPct)}%` }} />
                  </div>
                </>
              ) : (
                <p className="text-xl font-bold text-gray-300">—</p>
              )}
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">GASTO</p>
            </a>
          </div>
        )}

        {/* Supermarket Deals — Ad placeholders */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Ofertas del dia</h2>
            <a href="/comparar" className="text-xs font-medium text-gray-500 flex items-center gap-0.5">
              Ver mas <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {[
              { store: 'Jumbo', color: 'border-green-200', tag: 'bg-green-100 text-green-800', product: 'Frutas y Verduras', discount: 'Hasta 40% dcto', img: '🥬' },
              { store: 'Lider', color: 'border-red-200', tag: 'bg-red-100 text-red-800', product: 'Carnes y Pollo', discount: '2x1 seleccionados', img: '🥩' },
              { store: 'Unimarc', color: 'border-orange-200', tag: 'bg-orange-100 text-orange-800', product: 'Lacteos', discount: '30% con tarjeta', img: '🥛' },
              { store: 'Tottus', color: 'border-teal-200', tag: 'bg-teal-100 text-teal-800', product: 'Limpieza', discount: '3x2 toda la linea', img: '🧴' },
            ].map((deal) => (
              <a
                key={deal.store}
                href={`/comparar?q=${encodeURIComponent(deal.product)}`}
                className={`bg-white rounded-2xl p-4 min-w-[160px] border ${deal.color} shadow-sm flex-shrink-0 active:scale-95 transition-transform`}
              >
                <span className="text-3xl">{deal.img}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 inline-block ${deal.tag}`}>
                  {deal.store}
                </span>
                <p className="text-sm font-semibold text-gray-900 mt-1.5">{deal.product}</p>
                <p className="text-xs text-gray-500">{deal.discount}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-3">Servicios</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/perfil', label: 'Mi perfil', sub: 'Dieta y alergias', icon: User, iconColor: 'text-gray-600' },
              { href: '/configuracion/cuentas', label: 'Supermercados', sub: 'Vincular cuentas', icon: Store, iconColor: 'text-gray-600' },
              { href: '/reposicion', label: 'Reposicion', sub: 'Lo que se acaba', icon: Repeat, iconColor: 'text-gray-600' },
              { href: '/familia', label: 'Mi familia', sub: 'Miembros y alergenos', icon: Users, iconColor: 'text-gray-600' },
            ].map((svc) => {
              const Icon = svc.icon
              return (
                <a key={svc.href} href={svc.href}
                  className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3 active:scale-[0.97] transition-transform">
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className={`h-4 w-4 ${svc.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{svc.label}</p>
                    <p className="text-[11px] text-gray-400">{svc.sub}</p>
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
          className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm mb-6 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">AVI en WhatsApp</p>
            <p className="text-[11px] text-gray-400">Compras rapidas desde tu chat</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </a>
      </main>
    </div>
  )
}
