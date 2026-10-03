'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Wallet, Plus, TrendingUp, TrendingDown,
  AlertCircle, Check, Settings, Loader2, Calendar,
  Trash2, Pencil, DollarSign, ShoppingCart, X,
  Bot, Sparkles,
} from 'lucide-react'

interface Budget {
  id: string
  period: string
  amount: number
  spent: number
  startDate: string
  endDate: string
}

export default function PresupuestoPage() {
  const { data: session } = useSession()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [currentBudget, setCurrentBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  const [newPeriod, setNewPeriod] = useState('monthly')
  const [newAmount, setNewAmount] = useState('')
  const [aviSuggestion, setAviSuggestion] = useState<{ amount: number; reason: string; avgSpent: number; months: number } | null>(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch('/api/budgets').then((r) => r.json()),
      fetch('/api/budgets?current=true').then((r) => r.json()),
    ])
      .then(([allData, currentData]) => {
        if (allData.success) {
          setBudgets(allData.data || [])
          // Calculate AVI suggestion from history
          const monthlyBudgets = (allData.data || []).filter((b: Budget) => b.period === 'monthly' && b.spent > 0)
          if (monthlyBudgets.length > 0) {
            const totalSpent = monthlyBudgets.reduce((s: number, b: Budget) => s + b.spent, 0)
            const avgSpent = Math.round(totalSpent / monthlyBudgets.length)
            const suggested = Math.round(avgSpent * 1.1 / 1000) * 1000
            setAviSuggestion({
              amount: suggested,
              avgSpent,
              months: monthlyBudgets.length,
              reason: avgSpent > 0
                ? `Basado en ${monthlyBudgets.length} mes${monthlyBudgets.length > 1 ? 'es' : ''}, gastas ~${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(avgSpent)}/mes. Te sugiero ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(suggested)} (10% margen).`
                : '',
            })
          }
        }
        if (currentData.success && currentData.data) setCurrentBudget(currentData.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  const createBudget = async () => {
    const amount = parseInt(newAmount)
    if (!amount || amount <= 0) return
    setCreating(true)

    const now = new Date()
    const startDate = now.toISOString()
    const endDate = new Date(
      newPeriod === 'weekly'
        ? now.getTime() + 7 * 24 * 60 * 60 * 1000
        : new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime()
    ).toISOString()

    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: newPeriod, amount, startDate, endDate }),
      })
      const data = await res.json()
      if (data.success) {
        const budget = data.data
        setBudgets((prev) => [budget, ...prev])
        setCurrentBudget(budget)
        setShowCreate(false)
        setNewAmount('')
      }
    } catch {}
    setCreating(false)
  }

  const [editing, setEditing] = useState(false)
  const [editAmount, setEditAmount] = useState('')

  const deleteBudget = async (id: string) => {
    try {
      await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
      setBudgets((prev) => prev.filter((b) => b.id !== id))
      if (currentBudget?.id === id) setCurrentBudget(null)
    } catch {}
  }

  const updateBudget = async () => {
    if (!currentBudget || !editAmount) return
    const amount = parseInt(editAmount)
    if (!amount || amount <= 0) return
    try {
      const res = await fetch(`/api/budgets/${currentBudget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (data.success) {
        setCurrentBudget({ ...currentBudget, amount })
        setBudgets((prev) => prev.map((b) => b.id === currentBudget.id ? { ...b, amount } : b))
        setEditing(false)
      }
    } catch {}
  }

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 70) return 'bg-amber-500'
    return 'bg-green-500'
  }

  const getProgressTextColor = (pct: number) => {
    if (pct >= 90) return 'text-red-600'
    if (pct >= 70) return 'text-amber-600'
    return 'text-green-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Wallet className="h-8 w-8 text-green-500 animate-pulse" />
      </div>
    )
  }

  const pct = currentBudget ? Math.min(100, Math.round((currentBudget.spent / currentBudget.amount) * 100)) : 0
  const remaining = currentBudget ? currentBudget.amount - currentBudget.spent : 0
  const daysLeft = currentBudget
    ? Math.max(0, Math.ceil((new Date(currentBudget.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0
  const dailyBudget = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0

  return (
    <div className="avi-page min-h-screen pb-20">
      <header className="avi-header">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <Wallet className="h-6 w-6 text-green-600" />
            <h1 className="text-lg font-semibold">Presupuesto</h1>
          </div>
          <a href="/configuracion/cuentas" className="text-gray-400 hover:text-gray-600">
            <Settings className="h-5 w-5" />
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Current Budget */}
        {currentBudget ? (
          <div className="avi-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">Presupuesto {currentBudget.period === 'monthly' ? 'mensual' : 'semanal'}</p>
                {editing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg text-gray-400">$</span>
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-32 text-2xl font-bold border-b-2 border-green-500 focus:outline-none bg-transparent"
                      autoFocus
                    />
                    <button onClick={updateBudget} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(false)} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold text-gray-900">{formatCLP(currentBudget.amount)}</p>
                    <button
                      onClick={() => { setEditAmount(String(currentBudget.amount)); setEditing(true) }}
                      className="p-1 text-gray-300 hover:text-gray-600"
                      title="Editar monto"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={`${getProgressTextColor(pct)}`}>
                  <p className="text-3xl font-bold">{pct}%</p>
                  <p className="text-xs">usado</p>
                </div>
                <button
                  onClick={() => deleteBudget(currentBudget.id)}
                  className="mt-2 text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="bg-gray-200 rounded-full h-3 mb-4">
              <div
                className={`h-3 rounded-full transition-all ${getProgressColor(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">Gastado</p>
                <p className="text-sm font-semibold text-gray-900">{formatCLP(currentBudget.spent)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Disponible</p>
                <p className={`text-sm font-semibold ${remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCLP(remaining)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Por dia</p>
                <p className="text-sm font-semibold text-gray-900">
                  {dailyBudget > 0 ? formatCLP(dailyBudget) : '—'}
                </p>
              </div>
            </div>

            {/* Days left */}
            <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {daysLeft} dia{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''} ·
                Termina {new Date(currentBudget.endDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
              </span>
            </div>

            {/* AVI Insight */}
            <div className="mt-4 bg-indigo-50 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-700">Insight de AVI</span>
              </div>
              <p className="text-xs text-indigo-600">
                {pct < 50 && daysLeft < 15
                  ? `Vas bien. Llevas ${pct}% con ${daysLeft} dias restantes. Puedes gastar ~${formatCLP(dailyBudget)}/dia sin pasarte.`
                  : pct < 70
                  ? `Ritmo saludable. Te quedan ${formatCLP(remaining)} para ${daysLeft} dias (${formatCLP(dailyBudget)}/dia).`
                  : pct < 90
                  ? `Ojo: llevas ${pct}%. Compara precios en AVI antes de tu proxima compra para no pasarte.`
                  : `Alerta: ${pct}% usado. Quedan solo ${formatCLP(remaining)}. Considera posponer compras no urgentes.`
                }
              </p>
              {budgets.length >= 2 && aviSuggestion && (
                <p className="text-[10px] text-indigo-400 mt-1">
                  Promedio historico: {formatCLP(aviSuggestion.avgSpent)}/mes ({aviSuggestion.months} meses)
                </p>
              )}
            </div>

            {/* Warnings */}
            {pct >= 90 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700">
                    Estas al {pct}% de tu presupuesto. Compara precios para ahorrar.
                  </p>
                </div>
                <a
                  href="/comparar"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
                >
                  <DollarSign className="h-3 w-3" />
                  Comparar precios antes de comprar
                </a>
              </div>
            )}
            {pct >= 70 && pct < 90 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    Llevas el {pct}% del presupuesto. Te quedan {formatCLP(remaining)} para {daysLeft} dias.
                  </p>
                </div>
                <a
                  href="/comparar"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  <DollarSign className="h-3 w-3" />
                  Comparar precios para ahorrar
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="avi-card p-8 text-center">
            <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No tienes presupuesto activo</p>
            <p className="text-sm text-gray-400 mt-1">Crea uno para controlar tus gastos</p>
          </div>
        )}

        {/* Create Budget */}
        {showCreate ? (
          <div className="avi-card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Nuevo Presupuesto</h3>

            {/* AVI Suggestion */}
            {aviSuggestion && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-indigo-900">AVI sugiere: {formatCLP(aviSuggestion.amount)}/mes</p>
                    <p className="text-xs text-indigo-700 mt-0.5">{aviSuggestion.reason}</p>
                    <button
                      onClick={() => { setNewAmount(String(aviSuggestion.amount)); setNewPeriod('monthly') }}
                      className="mt-2 text-xs font-bold text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition-colors active:scale-95"
                    >
                      Usar esta sugerencia
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!aviSuggestion && budgets.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 font-medium">AVI aprendera tu patron de gasto</p>
                    <p className="text-xs text-gray-500 mt-0.5">Despues de tu primer mes, AVI te sugerira el monto ideal basado en tus compras reales.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
                <div className="flex space-x-2">
                  {[
                    { value: 'weekly', label: 'Semanal' },
                    { value: 'monthly', label: 'Mensual' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setNewPeriod(opt.value)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                        newPeriod === opt.value
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (CLP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="80000"
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {newAmount && parseInt(newAmount) > 0
                    ? `${formatCLP(Math.round(parseInt(newAmount) / (newPeriod === 'weekly' ? 7 : 30)))}/dia`
                    : ''}
                </p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={createBudget}
                  disabled={creating || !newAmount || parseInt(newAmount) <= 0}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-1"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>Crear</span>
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center space-x-2 bg-white border-2 border-dashed border-gray-300 rounded-xl py-4 text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium">{currentBudget ? 'Crear nuevo presupuesto' : 'Crear presupuesto'}</span>
          </button>
        )}

        {/* History */}
        {budgets.length > 0 && (
          <div className="avi-card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Historial</h3>
            <div className="divide-y">
              {budgets.slice(0, 6).map((b) => {
                const bPct = Math.round((b.spent / b.amount) * 100)
                const isOver = b.spent > b.amount
                return (
                  <div key={b.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {b.period === 'monthly' ? 'Mensual' : 'Semanal'} — {formatCLP(b.amount)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(b.startDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} -
                        {' '}{new Date(b.endDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-1">
                        {isOver ? (
                          <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                        )}
                        <span className={`text-sm font-semibold ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                          {bPct}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{formatCLP(b.spent)} gastado</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
