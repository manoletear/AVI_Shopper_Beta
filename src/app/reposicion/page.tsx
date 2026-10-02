'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Clock, AlertTriangle, Check, Plus,
  ShoppingCart, Package, Calendar, RefreshCw,
  Settings, Loader2, TrendingUp, DollarSign,
  ListChecks, ArrowRight,
} from 'lucide-react'

interface Alert {
  productName: string
  category: string
  urgency: 'add_now' | 'add_soon' | 'monitor'
  message: string
  estimatedRunOutDate: string
  daysUntilEmpty: number
  suggestedQuantity: number
}

interface Plan {
  monthTarget: string
  alerts: Alert[]
  summary: { addNow: number; addSoon: number; monitoring: number }
}

const URGENCY_CONFIG = {
  add_now: { label: 'Agregar ahora', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: AlertTriangle },
  add_soon: { label: 'Agregar pronto', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: Clock },
  monitor: { label: 'Monitorear', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', icon: TrendingUp },
}

export default function ReposicionPage() {
  const { data: session } = useSession()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addedItems, setAddedItems] = useState<string[]>([])
  const [error, setError] = useState('')

  const fetchPlan = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/replenishment?mode=plan')
      const data = await res.json()
      if (data.success) setPlan(data.data)
      else setError(data.error?.message || 'Error al cargar')
    } catch { setError('Error de conexion') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (session) fetchPlan() }, [session])

  const autoAdd = async (urgency: 'add_now' | 'add_soon') => {
    setAdding(true)
    try {
      const res = await fetch('/api/replenishment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgency }),
      })
      const data = await res.json()
      if (data.success) {
        setAddedItems(data.data.addedItems)
        setTimeout(() => setAddedItems([]), 5000)
      }
    } catch {}
    setAdding(false)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })

  return (
    <div className="avi-page min-h-screen pb-20">
      <header className="avi-header">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <Package className="h-6 w-6 text-purple-600" />
            <h1 className="text-lg font-semibold">Reposicion Inteligente</h1>
          </div>
          <button onClick={fetchPlan} disabled={loading} className="p-2 text-gray-400 hover:text-gray-600">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Info */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start space-x-3">
          <Calendar className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-purple-800 font-medium">
              AVI analiza tu historial de compras para predecir que se va a acabar
            </p>
            <p className="text-xs text-purple-600 mt-0.5">
              Basado en la frecuencia de compra de cada producto, AVI te avisa antes de que se acabe
              y puede agregarlo automaticamente a tu lista del mes.
            </p>
          </div>
        </div>

        {loading && !plan ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Analizando tu historial...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
        ) : plan ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="avi-card p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{plan.summary.addNow}</p>
                <p className="text-xs text-gray-500">Se acabaron</p>
              </div>
              <div className="avi-card p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{plan.summary.addSoon}</p>
                <p className="text-xs text-gray-500">Por acabarse</p>
              </div>
              <div className="avi-card p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{plan.summary.monitoring}</p>
                <p className="text-xs text-gray-500">Monitoreando</p>
              </div>
            </div>

            {/* Auto-add button */}
            {(plan.summary.addNow > 0 || plan.summary.addSoon > 0) && (
              <div className="flex space-x-2">
                {plan.summary.addNow > 0 && (
                  <button
                    onClick={() => autoAdd('add_now')}
                    disabled={adding}
                    className="flex-1 bg-red-600 text-white py-3 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                    <span>Agregar {plan.summary.addNow} urgente{plan.summary.addNow > 1 ? 's' : ''} a mi lista</span>
                  </button>
                )}
                {plan.summary.addSoon > 0 && (
                  <button
                    onClick={() => autoAdd('add_soon')}
                    disabled={adding}
                    className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span>Agregar todos a lista</span>
                  </button>
                )}
              </div>
            )}

            {/* Added confirmation */}
            {addedItems.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-700">
                    {addedItems.length} producto{addedItems.length > 1 ? 's' : ''} agregado{addedItems.length > 1 ? 's' : ''} a tu lista
                  </p>
                </div>
                <p className="text-xs text-green-600 mb-3">{addedItems.join(', ')}</p>
                <div className="flex gap-2">
                  <a
                    href="/listas"
                    className="flex items-center gap-1.5 text-sm font-medium py-2 px-3 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    <ListChecks className="h-4 w-4" />
                    Ver mi lista
                  </a>
                  <a
                    href={`/cart-assistant?products=${encodeURIComponent(addedItems.join(', '))}`}
                    className="flex items-center gap-1.5 text-sm font-medium py-2 px-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Comprar ahora
                  </a>
                </div>
              </div>
            )}

            {/* Alert list */}
            {plan.alerts.length > 0 ? (
              <div className="space-y-3">
                {plan.alerts.map((alert, i) => {
                  const config = URGENCY_CONFIG[alert.urgency]
                  const Icon = config.icon
                  return (
                    <div key={i} className={`${config.bg} ${config.border} border rounded-xl p-4`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Icon className={`h-5 w-5 ${config.text} flex-shrink-0 mt-0.5`} />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium text-sm text-gray-900 capitalize">{alert.productName}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${config.badge}`}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                            <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                              <span>Cantidad sugerida: {alert.suggestedQuantity}</span>
                              <span>·</span>
                              <span>
                                {alert.daysUntilEmpty <= 0
                                  ? 'Probablemente vacio'
                                  : `Se acaba ~${formatDate(alert.estimatedRunOutDate)}`}
                              </span>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <a
                                href={`/cart-assistant?products=${encodeURIComponent(alert.productName)}`}
                                className="flex items-center gap-1 text-xs font-medium py-1.5 px-2.5 rounded-lg bg-white/80 border border-gray-200 text-gray-700 hover:bg-white hover:border-blue-300 hover:text-blue-700 transition-colors"
                              >
                                <ShoppingCart className="h-3 w-3" />
                                Comprar
                              </a>
                              <a
                                href={`/comparar?q=${encodeURIComponent(alert.productName)}`}
                                className="flex items-center gap-1 text-xs font-medium py-1.5 px-2.5 rounded-lg bg-white/80 border border-gray-200 text-gray-700 hover:bg-white hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                              >
                                <DollarSign className="h-3 w-3" />
                                Comparar
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="avi-card p-8 text-center">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">AVI esta aprendiendo tus patrones</p>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                  Registra compras para que AVI prediga cuando se acaban tus productos.
                  Dile a AVI: "compre leche en Jumbo por $1.200"
                </p>
                <div className="flex flex-col gap-2 max-w-xs mx-auto">
                  <a href="/avi" className="avi-btn-primary text-sm flex items-center justify-center gap-2">
                    Hablar con AVI
                  </a>
                  <a href="/listas" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Crear una lista de compras
                  </a>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
