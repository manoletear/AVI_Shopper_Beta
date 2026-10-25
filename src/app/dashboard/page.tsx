'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  ShoppingCart, ListChecks, Heart, Store, Users, Home,
  ArrowRight, ChevronRight, CreditCard,
  Wallet, Package, User, Bot, MessageCircle,
  Repeat, Zap,
} from 'lucide-react'
import OnboardingWizard from '@/components/OnboardingWizard'
import ProgressiveBanner from '@/components/onboarding/ProgressiveBanner'

interface DashboardData {
  listsCount: number
  itemsCount: number
  alertsCount: number
  healthScore: number | null
  budgetSpent: number | null
  budgetTotal: number | null
}

const CATEGORIES = [
  { href: '/comprar', label: 'Comprar', emoji: '🛒', bg: 'bg-indigo-100' },
  { href: '/comparar', label: 'Mejor Precio', emoji: '⚡', bg: 'bg-amber-100' },
  { href: '/listas', label: 'Listas', emoji: '📋', bg: 'bg-indigo-50' },
  { href: '/reposicion', label: 'Reponer', emoji: '📦', bg: 'bg-teal-100' },
  { href: '/salud', label: 'Salud', emoji: '💚', bg: 'bg-green-100' },
  { href: '/familia', label: 'Familia', emoji: '👨‍👩‍👧', bg: 'bg-violet-100' },
  { href: '/presupuesto', label: 'Gastos', emoji: '💰', bg: 'bg-emerald-100' },
  { href: '/historial', label: 'Historial', emoji: '🧾', bg: 'bg-slate-100' },
]

const STORE_DEALS = [
  {
    store: 'Tottus',
    banner: '',
    color: '#2D5F2D',
    emoji: '🥛🧀',
    product: 'Leche Soprole $750',
    discount: 'Cyber Monday 44% dcto',
    price: 'Cyber Tottus',
    href: '/comparar?q=Leche+Soprole%2C+Queso+Gauda%2C+Yogurt',
  },
  {
    store: 'Tottus',
    banner: '',
    color: '#2D5F2D',
    emoji: '🥩🔥',
    product: 'Carnes desde $12.490/kg',
    discount: 'Cyber Monday 27% dcto',
    price: 'Cyber Tottus',
    href: '/comparar?q=Lomo+liso%2C+Filete%2C+Carne+vacuno',
  },
  {
    store: 'Unimarc',
    banner: '',
    color: '#6B21A8',
    emoji: '🫒🍳',
    product: 'Aceite Chef 1L $2.490',
    discount: '20% dcto adicional Unipay',
    price: 'Club Unimarc',
    href: '/comparar?q=Aceite+Chef%2C+Aceite+vegetal+1L',
  },
  {
    store: 'Unimarc',
    banner: '',
    color: '#6B21A8',
    emoji: '🥛🧈',
    product: 'Lacteos y Quesos hasta 30%',
    discount: 'Frutas desde $990/kg',
    price: 'Exclusivo online',
    href: '/comparar?q=Leche%2C+Queso+gauda%2C+Yogurt%2C+Huevos',
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || ''
  const [data, setData] = useState<DashboardData | null>(null)
  const [promoIndex, setPromoIndex] = useState(0)
  const [showWzp, setShowWzp] = useState(false)
  const [upcomingEvents, setUpcomingEvents] = useState<Array<{ id: string; name: string; type: string; daysUntil: number; suggestedProducts: string[] }>>([])
  const [replenishment, setReplenishment] = useState<Array<{ id: string; title: string; message: string }>>([])

  useEffect(() => {
    if (!session) return
    fetch('/api/onboarding').then((response) => response.json()).then((body) => {
      if (body?.success && body.data?.needsOnboarding) router.replace('/onboarding')
    }).catch(() => {})
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
          if (d.success) {
            results.alertsCount = d.data.filter((a: any) => !a.read).length
            setReplenishment(d.data.filter((a: any) => a.type === 'replenishment' && !a.read).slice(0, 2))
          }
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
  }, [session, router])

  useEffect(() => {
    const timer = setInterval(() => setPromoIndex((i) => (i + 1) % STORE_DEALS.length), 5000)
    return () => clearInterval(timer)
  }, [])

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  const budgetPct = data?.budgetTotal ? Math.round((data.budgetSpent! / data.budgetTotal) * 100) : 0
  const promo = STORE_DEALS[promoIndex]
  const nextReplenishment = replenishment[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos dias' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="avi-page pb-20">
      <main className="max-w-lg mx-auto px-4">
        {/* Greeting + WhatsApp */}
        <div className="pt-5 pb-2 flex items-end justify-between">
          <div>
            <p className="text-sm text-gray-500">{greeting},</p>
            <h1 className="text-xl font-bold text-gray-900">{userName}</h1>
          </div>
          <button
            onClick={() => setShowWzp(!showWzp)}
            className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            AVI en WZP
          </button>
        </div>

        {showWzp && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 border border-green-200">
            <p className="text-sm font-semibold text-gray-900 mb-2">AVI en tu grupo familiar</p>
            <div className="space-y-3">
              <a
                href="https://wa.me/56994893097?text=Hola%20AVI"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-[#25D366] text-white rounded-xl active:scale-[0.98] transition-transform"
              >
                <MessageCircle className="h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">Chatear con AVI 1 a 1</p>
                  <p className="text-[10px] opacity-80">Habla directo con AVI por WhatsApp</p>
                </div>
              </a>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-700 mb-1.5">Agregar AVI a tu grupo familiar:</p>
                <ol className="text-[11px] text-gray-500 space-y-1">
                  <li>1. Abre tu grupo familiar en WhatsApp</li>
                  <li>2. Toca "Agregar participante"</li>
                  <li>3. Agrega el numero: <span className="font-bold text-gray-700">+56 9 9489 3097</span></li>
                  <li>4. AVI se presentara automaticamente</li>
                </ol>
                <p className="text-[10px] text-gray-400 mt-2">Todos los miembros del grupo podran hablar con AVI</p>
              </div>
            </div>
          </div>
        )}

        {nextReplenishment && (
          <a href="/reposicion" className="block bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
            <p className="text-sm font-semibold text-amber-900">{nextReplenishment.title}</p>
            <p className="text-xs text-amber-800 mt-1">{nextReplenishment.message}</p>
          </a>
        )}

        {/* AVI Search Bar — links to cart-assistant (the AI agent) */}
        <a href="/cart-assistant" className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 mb-5 shadow-sm active:scale-[0.98] transition-transform border border-indigo-100">
          <img src="/avi-icon.svg" alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-400">Habla con AVI...</p>
            <p className="text-[10px] text-gray-300">Arma listas, busca productos, compara precios</p>
          </div>
          <Bot className="h-4 w-4 text-gray-300" />
        </a>

        {/* Stats Row — between AVI bar and banner */}
        {data && (
          <div className="grid grid-cols-3 gap-2 mb-4">
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

        {/* Promo Banner */}
        {promo && <a href={promo.href} className="block mb-4 active:scale-[0.98] transition-transform relative z-10">
          {promo.banner ? (
            <div className="rounded-2xl shadow-md overflow-hidden" style={{ backgroundColor: promo.color, minHeight: 120 }}>
              <img
                src={promo.banner}
                alt={`${promo.store} — ${promo.product}`}
                className="w-full block"
                loading="eager"
              />
            </div>
          ) : (
            <div className="rounded-2xl shadow-md text-white overflow-hidden" style={{ backgroundColor: promo.color }}>
              <div className="p-5 min-h-[120px] flex justify-between items-start" style={{ background: `linear-gradient(135deg, ${promo.color}, ${promo.color}dd)` }}>
                <div>
                  <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full">{promo.store}</span>
                  <h2 className="text-xl font-bold mt-2">{promo.product}</h2>
                  <p className="text-sm text-white/80 mt-0.5">{promo.discount}</p>
                  <p className="text-xs text-white/60 mt-1">{promo.price}</p>
                </div>
                <span className="text-4xl">{promo.emoji}</span>
              </div>
            </div>
          )}
          <div className="flex justify-center gap-1.5 mt-2.5">
            {STORE_DEALS.map((deal, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); setPromoIndex(i) }}
                className={`w-2 h-2 rounded-full transition-all ${i === promoIndex ? 'w-5' : ''}`}
                style={{ backgroundColor: i === promoIndex ? deal.color : '#D1D5DB' }}
              />
            ))}
          </div>
        </a>}

        {/* Category Icons */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {CATEGORIES.map((cat) => (
            <a key={cat.href} href={cat.href} className="flex flex-col items-center gap-1 py-1 group">
              <div className={`w-14 h-14 ${cat.bg} rounded-full flex items-center justify-center group-active:scale-90 transition-transform`}>
                <span className="text-2xl">{cat.emoji}</span>
              </div>
              <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">{cat.label}</span>
            </a>
          ))}
        </div>

        <ProgressiveBanner />
        <OnboardingWizard />

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
                className="rounded-2xl min-w-[150px] shadow-sm flex-shrink-0 active:scale-95 transition-transform overflow-hidden"
                style={{ backgroundColor: deal.color }}
              >
                <div className="px-3 pt-3 text-center">
                  <span className="text-3xl">{deal.emoji}</span>
                </div>
                <div className="p-3 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{deal.store}</p>
                  <p className="text-sm font-bold mt-0.5">{deal.product}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">{deal.discount}</p>
                  <p className="text-xs font-bold mt-1 opacity-90">{deal.price}</p>
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
              { href: '/configuracion/pagos', label: 'Pagos', sub: 'Tarjetas y metodos', icon: CreditCard },
              { href: '/historial', label: 'Historial', sub: 'Compras pasadas', icon: ShoppingCart },
              { href: '/familia', label: 'Mi familia', sub: 'Miembros y alergenos', icon: Users },
              { href: '/configuracion/hogar', label: 'Mi hogar', sub: 'Dirección, tiendas y preferencias', icon: Home },
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

      </main>
    </div>
  )
}
