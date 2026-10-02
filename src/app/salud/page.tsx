'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Heart, AlertTriangle, AlertCircle, Info,
  TrendingUp, TrendingDown, Minus, ShieldCheck, Apple,
  Settings, RefreshCw, ShoppingCart, DollarSign, Plus,
  Check, User,
} from 'lucide-react'

interface HealthAlert {
  type: string
  severity: 'info' | 'warn' | 'critical'
  title: string
  message: string
  products: string[]
  alternatives: Array<{
    currentProduct: string
    suggestedProduct: string
    reason: string
    nutritionBenefit: string
  }>
}

interface Prediction {
  product: string
  avgQuantityPerWeek: number
  nextPurchaseDate: string
  confidence: number
}

interface HealthReport {
  overallScore: number
  alerts: HealthAlert[]
  predictions: Prediction[]
  weeklyTrend: 'improving' | 'stable' | 'declining'
  recommendations: string[]
}

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  warn: { icon: AlertCircle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
}

export default function SaludPage() {
  const { data: session } = useSession()
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addedToList, setAddedToList] = useState<Set<string>>(new Set())

  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/health?mode=report')
      const data = await res.json()
      if (data.success) {
        setReport(data.data)
      } else {
        setError(data.error?.message || 'Error al cargar reporte')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) fetchReport()
  }, [session])

  const addToCart = (productName: string) => {
    window.location.href = `/cart-assistant?products=${encodeURIComponent(productName)}`
  }

  const comparePrice = (productName: string) => {
    window.location.href = `/comparar?q=${encodeURIComponent(productName)}`
  }

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 75) return 'bg-green-500'
    if (score >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const TrendIcon = report?.weeklyTrend === 'improving' ? TrendingUp
    : report?.weeklyTrend === 'declining' ? TrendingDown
    : Minus

  const trendColor = report?.weeklyTrend === 'improving' ? 'text-green-600'
    : report?.weeklyTrend === 'declining' ? 'text-red-600'
    : 'text-gray-500'

  return (
    <div className="avi-page min-h-screen pb-20">
      {/* Header */}
      <header className="avi-header">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <Heart className="h-6 w-6 text-red-500" />
            <h1 className="text-lg font-semibold">Mi Salud</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={fetchReport} disabled={loading} className="p-2 text-gray-400 hover:text-gray-600">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <a href="/configuracion/cuentas" className="text-gray-400 hover:text-gray-600">
              <Settings className="h-5 w-5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading && !report ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Heart className="h-8 w-8 text-red-400 animate-pulse mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Analizando tu salud...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        ) : report ? (
          <div className="space-y-6">
            {/* Score Card */}
            <div className="avi-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Score de Salud</p>
                  <div className="flex items-end space-x-2 mt-1">
                    <span className={`text-4xl font-bold ${getScoreColor(report.overallScore)}`}>
                      {report.overallScore}
                    </span>
                    <span className="text-gray-400 text-lg mb-1">/100</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-center space-x-1 ${trendColor}`}>
                    <TrendIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {report.weeklyTrend === 'improving' ? 'Mejorando'
                        : report.weeklyTrend === 'declining' ? 'Bajando'
                        : 'Estable'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">vs semana anterior</p>
                </div>
              </div>
              {/* Score bar */}
              <div className="mt-4 bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${getScoreBg(report.overallScore)} transition-all`}
                  style={{ width: `${report.overallScore}%` }}
                />
              </div>
            </div>

            {/* Alerts */}
            {report.alerts.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Alertas ({report.alerts.length})
                </h2>
                {report.alerts.map((alert, idx) => {
                  const config = SEVERITY_CONFIG[alert.severity]
                  const Icon = config.icon
                  return (
                    <div key={idx} className={`${config.bg} ${config.border} border rounded-xl p-4`}>
                      <div className="flex items-start space-x-3">
                        <Icon className={`h-5 w-5 ${config.text} flex-shrink-0 mt-0.5`} />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className={`font-medium text-sm ${config.text}`}>{alert.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${config.badge}`}>
                              {alert.severity === 'critical' ? 'Critico' : alert.severity === 'warn' ? 'Atencion' : 'Info'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{alert.message}</p>

                          {alert.products.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {alert.products.map((p, i) => (
                                <span key={i} className="text-xs bg-white/70 px-2 py-0.5 rounded border">
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}

                          {alert.alternatives.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium text-gray-500">Alternativas:</p>
                              {alert.alternatives.map((alt, i) => (
                                <div key={i} className="bg-white/50 rounded-lg p-2.5 text-xs">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-gray-500 line-through">{alt.currentProduct}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="font-medium text-gray-800">{alt.suggestedProduct}</span>
                                    <span className="text-green-600 font-medium">{alt.nutritionBenefit}</span>
                                  </div>
                                  <p className="text-gray-500 mt-0.5">{alt.reason}</p>
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => addToCart(alt.suggestedProduct)}
                                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                                    >
                                      <ShoppingCart className="h-3 w-3" />
                                      Comprar alternativa
                                    </button>
                                    <button
                                      onClick={() => comparePrice(alt.suggestedProduct)}
                                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium"
                                    >
                                      <DollarSign className="h-3 w-3" />
                                      Ver precios
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div className="avi-card p-5">
                <div className="flex items-center space-x-2 mb-3">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <h2 className="text-sm font-semibold text-gray-700">Recomendaciones</h2>
                </div>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span className="text-sm text-gray-600">{rec}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/perfil"
                  className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <User className="h-4 w-4" />
                  Ajustar perfil nutricional
                </a>
              </div>
            )}

            {/* Predictions */}
            {report.predictions.length > 0 && (
              <div className="avi-card p-5">
                <div className="flex items-center space-x-2 mb-3">
                  <Apple className="h-5 w-5 text-orange-500" />
                  <h2 className="text-sm font-semibold text-gray-700">Prediccion de Consumo</h2>
                </div>
                <div className="divide-y">
                  {report.predictions.slice(0, 8).map((pred, i) => {
                    const daysUntil = Math.ceil((new Date(pred.nextPurchaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    const isUrgent = daysUntil <= 3
                    return (
                      <div key={i} className="py-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800">{pred.product}</p>
                          <p className="text-xs text-gray-400">
                            ~{pred.avgQuantityPerWeek}/semana · {Math.round(pred.confidence * 100)}% confianza
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className={`text-sm font-medium ${isUrgent ? 'text-red-600' : 'text-gray-700'}`}>
                              {new Date(pred.nextPurchaseDate).toLocaleDateString('es-CL', {
                                day: 'numeric', month: 'short',
                              })}
                            </p>
                            {isUrgent && <p className="text-[10px] text-red-500 font-medium">Pronto</p>}
                          </div>
                          <button
                            onClick={() => addToCart(pred.product)}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="Comprar"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {report.alerts.length === 0 && report.predictions.length === 0 && (
              <div className="avi-card p-6 text-center">
                <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-700">AVI necesita datos para analizar tu salud</p>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                  Registra compras con AVI para que analice la nutricion de tu familia.
                </p>
                <div className="flex flex-col gap-2 max-w-xs mx-auto">
                  <a href="/avi" className="avi-btn-primary text-sm flex items-center justify-center gap-2">
                    <Heart className="h-4 w-4" /> Hablar con AVI
                  </a>
                  <a href="/perfil" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Configurar perfil nutricional
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
