'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  ShoppingCart, ListChecks, DollarSign, Heart, Store,
  ArrowRight, LogOut, Settings, AlertCircle, TrendingUp,
  Wallet, Package,
} from 'lucide-react'

interface DashboardData {
  listsCount: number
  itemsCount: number
  alertsCount: number
  healthScore: number | null
  budgetSpent: number | null
  budgetTotal: number | null
}

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

      const fetches = [
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
          if (d.success && d.data.length > 0) {
            results.budgetSpent = d.data[0].spent
            results.budgetTotal = d.data[0].amount
          }
        }).catch(() => {}),
      ]

      await Promise.all(fetches)
      setData(results)
    }

    load()
  }, [session])

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-7 w-7 text-blue-600" />
            <span className="text-xl font-bold text-blue-600">AVI</span>
            <span className="text-lg font-semibold">Shopper</span>
          </div>
          <div className="flex items-center space-x-3">
            <a href="/configuracion/cuentas" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <Settings className="h-5 w-5" />
            </a>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center space-x-1 text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Hola, {userName}</h1>
          <p className="text-gray-500 mt-1">¿Qué quieres hacer hoy?</p>
        </div>

        {/* Stats Cards */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center space-x-2 mb-1">
                <Package className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-gray-500">Listas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.listsCount}</p>
              <p className="text-xs text-gray-400">{data.itemsCount} productos</p>
            </div>

            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center space-x-2 mb-1">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-xs text-gray-500">Salud</span>
              </div>
              <p className={`text-2xl font-bold ${
                data.healthScore === null ? 'text-gray-300' :
                data.healthScore >= 75 ? 'text-green-600' :
                data.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {data.healthScore ?? '—'}
              </p>
              <p className="text-xs text-gray-400">score /100</p>
            </div>

            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center space-x-2 mb-1">
                <Wallet className="h-4 w-4 text-green-500" />
                <span className="text-xs text-gray-500">Presupuesto</span>
              </div>
              {data.budgetTotal ? (
                <>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round((data.budgetSpent! / data.budgetTotal) * 100)}%
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatCLP(data.budgetSpent!)} / {formatCLP(data.budgetTotal)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-300">—</p>
                  <p className="text-xs text-gray-400">sin presupuesto</p>
                </>
              )}
            </div>

            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center space-x-2 mb-1">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-gray-500">Alertas</span>
              </div>
              <p className={`text-2xl font-bold ${data.alertsCount > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                {data.alertsCount}
              </p>
              <p className="text-xs text-gray-400">sin leer</p>
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {[
            { href: '/listas', label: 'Mis Listas', description: 'Crea y gestiona listas de compras familiares', icon: ListChecks, color: 'bg-purple-100 text-purple-600' },
            { href: '/demo', label: 'Comparar Precios', description: 'Compara precios en 4 supermercados', icon: DollarSign, color: 'bg-green-100 text-green-600' },
            { href: '/salud', label: 'Mi Salud', description: 'Analisis nutricional y recomendaciones', icon: Heart, color: 'bg-red-100 text-red-600' },
            { href: '/configuracion/cuentas', label: 'Supermercados', description: 'Vincula tus cuentas de supermercados', icon: Store, color: 'bg-orange-100 text-orange-600' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <a
                key={item.href}
                href={item.href}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-lg ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mt-3">{item.label}</h3>
                <p className="text-sm text-gray-500 mt-1">{item.description}</p>
              </a>
            )
          })}
        </div>

        {/* Demo Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">Demo Interactiva</h3>
                <p className="text-sm text-blue-700 mt-0.5">
                  Prueba la comparacion de precios y optimizacion IA
                </p>
              </div>
            </div>
            <a href="/demo" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex-shrink-0">
              Probar
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
