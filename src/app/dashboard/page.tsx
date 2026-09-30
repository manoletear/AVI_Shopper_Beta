'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  ShoppingCart, ListChecks, DollarSign, Heart, Store,
  ArrowRight, LogOut, Settings, AlertCircle,
  Wallet, Package, User, Bot, Bell, TrendingUp,
} from 'lucide-react'

interface DashboardData {
  listsCount: number
  itemsCount: number
  alertsCount: number
  healthScore: number | null
  budgetSpent: number | null
  budgetTotal: number | null
}

const NAV_ITEMS = [
  { href: '/avi', label: 'Hablar con AVI', description: 'Dile que necesitas', icon: Bot, gradient: 'from-blue-500 to-indigo-600', iconBg: 'bg-blue-500' },
  { href: '/comparar', label: 'Comparar Precios', description: '4 supermercados en vivo', icon: DollarSign, gradient: 'from-emerald-500 to-teal-600', iconBg: 'bg-emerald-500' },
  { href: '/listas', label: 'Mis Listas', description: 'Listas familiares', icon: ListChecks, gradient: 'from-purple-500 to-violet-600', iconBg: 'bg-purple-500' },
  { href: '/reposicion', label: 'Reposicion', description: 'Que se esta acabando', icon: Package, gradient: 'from-orange-500 to-red-500', iconBg: 'bg-orange-500' },
  { href: '/salud', label: 'Mi Salud', description: 'Nutricion y alertas', icon: Heart, gradient: 'from-rose-500 to-pink-600', iconBg: 'bg-rose-500' },
  { href: '/perfil', label: 'Perfil Nutricional', description: 'Dieta y alergias', icon: User, gradient: 'from-indigo-500 to-purple-600', iconBg: 'bg-indigo-500' },
  { href: '/presupuesto', label: 'Presupuesto', description: 'Control de gastos', icon: Wallet, gradient: 'from-teal-500 to-cyan-600', iconBg: 'bg-teal-500' },
  { href: '/configuracion/cuentas', label: 'Supermercados', description: 'Vincular cuentas', icon: Store, gradient: 'from-amber-500 to-orange-600', iconBg: 'bg-amber-500' },
]

export default function DashboardPage() {
  const { data: session } = useSession()
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Usuario'
  const [data, setData] = useState<DashboardData | null>(null)

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

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  const budgetPct = data?.budgetTotal ? Math.round((data.budgetSpent! / data.budgetTotal) * 100) : 0

  return (
    <div className="avi-page">
      {/* Header */}
      <header className="avi-header">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AVI</span>
              <span className="text-lg font-semibold text-gray-800 ml-1">Shopper</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {data && data.alertsCount > 0 && (
              <a href="/salud" className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">{data.alertsCount}</span>
              </a>
            )}
            <a href="/configuracion/cuentas" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50">
              <Settings className="h-5 w-5" />
            </a>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50/50 transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Hola, <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{userName}</span>
          </h1>
          <p className="text-gray-500 mt-0.5">¿Que quieres hacer hoy?</p>
        </div>

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="avi-card p-4">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Package className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <span className="text-xs text-gray-500">Listas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.listsCount}</p>
              <p className="text-xs text-gray-400">{data.itemsCount} productos</p>
            </div>

            <div className="avi-card p-4">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-6 h-6 bg-rose-100 rounded-lg flex items-center justify-center">
                  <Heart className="h-3.5 w-3.5 text-rose-600" />
                </div>
                <span className="text-xs text-gray-500">Salud</span>
              </div>
              <p className={`text-2xl font-bold ${
                data.healthScore === null ? 'text-gray-300' :
                data.healthScore >= 75 ? 'text-emerald-600' :
                data.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {data.healthScore ?? '—'}
              </p>
              <p className="text-xs text-gray-400">score /100</p>
            </div>

            <div className="avi-card p-4">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-6 h-6 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Wallet className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <span className="text-xs text-gray-500">Presupuesto</span>
              </div>
              {data.budgetTotal ? (
                <>
                  <p className="text-2xl font-bold text-gray-900">{budgetPct}%</p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                    <div className={`h-1.5 rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, budgetPct)}%` }} />
                  </div>
                </>
              ) : (
                <p className="text-2xl font-bold text-gray-300">—</p>
              )}
            </div>

            <div className="avi-card p-4">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <span className="text-xs text-gray-500">Alertas</span>
              </div>
              <p className={`text-2xl font-bold ${data.alertsCount > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                {data.alertsCount}
              </p>
              <p className="text-xs text-gray-400">sin leer</p>
            </div>
          </div>
        )}

        {/* Action Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon
            const isMain = i < 2
            return (
              <a
                key={item.href}
                href={item.href}
                className={`avi-card-interactive p-4 group ${isMain ? 'sm:col-span-2 lg:col-span-2' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 ${item.iconBg} rounded-xl flex items-center justify-center shadow-sm`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mt-3">{item.label}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
              </a>
            )
          })}
        </div>
      </main>
    </div>
  )
}
