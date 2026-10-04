'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, ShoppingCart, Calendar, Store, TrendingUp,
  Loader2, Package, DollarSign, Repeat,
} from 'lucide-react'

interface Purchase {
  id: string
  productName: string
  brand: string | null
  storeName: string | null
  storeSlug: string | null
  price: number | null
  quantity: number
  source: string
  purchasedAt: string
}

interface MonthGroup {
  label: string
  purchases: Purchase[]
  total: number
}

export default function HistorialPage() {
  const { data: session } = useSession()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetch('/api/purchases')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPurchases(d.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  const STORE_COLORS: Record<string, string> = {
    jumbo: 'bg-green-100 text-green-700',
    lider: 'bg-blue-100 text-blue-700',
    unimarc: 'bg-orange-100 text-orange-700',
    tottus: 'bg-teal-100 text-teal-700',
  }

  // Group by month
  const grouped: MonthGroup[] = []
  const monthMap = new Map<string, Purchase[]>()
  for (const p of purchases) {
    const d = new Date(p.purchasedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const arr = monthMap.get(key) || []
    arr.push(p)
    monthMap.set(key, arr)
  }
  for (const [key, items] of Array.from(monthMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))) {
    const [y, m] = key.split('-')
    const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    grouped.push({ label, purchases: items, total: items.reduce((s, p) => s + (p.price || 0) * p.quantity, 0) })
  }

  const totalSpent = purchases.reduce((s, p) => s + (p.price || 0) * p.quantity, 0)
  const uniqueProducts = new Set(purchases.map((p) => p.productName)).size
  const favoriteStore = purchases.length > 0
    ? Object.entries(purchases.reduce((acc, p) => { acc[p.storeName || 'Otro'] = (acc[p.storeName || 'Otro'] || 0) + 1; return acc }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null

  if (loading) return (
    <div className="avi-page flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
    </div>
  )

  return (
    <div className="avi-page min-h-screen pb-20">
      <header className="avi-header">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></a>
          <Calendar className="h-6 w-6 text-indigo-600" />
          <h1 className="text-lg font-semibold">Historial de Compras</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        {purchases.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl p-3.5 text-center shadow-sm">
              <p className="text-lg font-bold text-gray-900">{formatCLP(totalSpent)}</p>
              <p className="text-[10px] text-gray-400 font-medium">TOTAL GASTADO</p>
            </div>
            <div className="bg-white rounded-2xl p-3.5 text-center shadow-sm">
              <p className="text-lg font-bold text-gray-900">{uniqueProducts}</p>
              <p className="text-[10px] text-gray-400 font-medium">PRODUCTOS</p>
            </div>
            <div className="bg-white rounded-2xl p-3.5 text-center shadow-sm">
              <p className="text-lg font-bold text-indigo-600">{favoriteStore || '—'}</p>
              <p className="text-[10px] text-gray-400 font-medium">FAVORITO</p>
            </div>
          </div>
        )}

        {/* Purchase list by month */}
        {grouped.length > 0 ? (
          grouped.map((group) => (
            <div key={group.label}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-900 capitalize">{group.label}</h2>
                <span className="text-xs text-gray-400 font-medium">{formatCLP(group.total)}</span>
              </div>
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
                {group.purchases.map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.productName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.storeName && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STORE_COLORS[p.storeSlug || ''] || 'bg-gray-100 text-gray-500'}`}>
                            {p.storeName}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {new Date(p.purchasedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                        </span>
                        {p.quantity > 1 && <span className="text-[10px] text-gray-400">x{p.quantity}</span>}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {p.price ? formatCLP(p.price * p.quantity) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="avi-card p-8 text-center">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin compras registradas</p>
            <p className="text-sm text-gray-400 mt-1">
              Dile a AVI: "compre leche en Jumbo por $1.200" o usa el comparador para registrar compras.
            </p>
            <a href="/avi" className="inline-block mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-700">
              Hablar con AVI
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
