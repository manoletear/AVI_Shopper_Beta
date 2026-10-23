'use client'

import { useEffect, useState } from 'react'
import { Check, GitMerge, Loader2, X } from 'lucide-react'

interface ReviewRow {
  id: string
  confidence: number
  reason: string
  listing: { rawName: string; storeName: string; price: number | null }
  suggested: { id: string; name: string } | null
}

interface ProductRow {
  id: string
  name: string
  brand: string | null
  category: string
  variant: string | null
  sizeAmount: number | null
  sizeUnit: string | null
  packCount: number
  soldByWeight: boolean
  ean: string | null
  listings: Array<{ id: string; storeName: string; rawName: string; price: number | null; matchStatus: string }>
  substitutesFrom: Array<{ reason: string; to: { id: string; name: string } }>
}

function formatSize(product: ProductRow): string {
  if (product.soldByWeight) return 'se vende por peso'
  if (product.packCount > 1 && product.sizeAmount && product.sizeUnit) {
    const each = product.sizeUnit === 'ml' ? `${product.sizeAmount / 1000} L` : product.sizeUnit === 'g' ? `${product.sizeAmount} g` : `${product.sizeAmount} un`
    return `${product.packCount} x ${each}`
  }
  if (product.sizeUnit === 'ml' && product.sizeAmount) return `${product.sizeAmount / 1000} L`
  if (product.sizeUnit === 'g' && product.sizeAmount) return product.sizeAmount >= 1000 ? `${product.sizeAmount / 1000} kg` : `${product.sizeAmount} g`
  if (product.packCount > 1) return `${product.packCount} un`
  return 'sin formato'
}

export default function CatalogoPage() {
  const [pending, setPending] = useState<ReviewRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    const response = await fetch('/api/admin/catalog')
    const payload = await response.json()
    if (!payload.success) {
      setError(payload.error?.message || 'No pude cargar el catálogo')
      setPending([])
      setProducts([])
      return
    }
    setError('')
    setPending(payload.data.pending || [])
    setProducts(payload.data.products || [])
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  async function act(reviewId: string, action: 'confirm' | 'reject' | 'merge') {
    setBusy(reviewId + action)
    setError('')
    const response = await fetch('/api/admin/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reviewId,
        canonicalId: action === 'merge' ? mergeTarget[reviewId] : undefined,
      }),
    })
    const payload = await response.json()
    if (!payload.success) {
      setError(payload.error?.message || 'No pude guardar')
      setBusy('')
      return
    }
    await load()
    setBusy('')
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <p className="text-xs font-medium text-indigo-600">AVI</p>
          <h1 className="text-xl font-semibold text-slate-900">Catálogo de productos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Confirma si la ficha de la tienda es el mismo producto. Un sustituto no se fusiona.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

        {!loading && pending.length === 0 && !error && (
          <p className="text-sm text-slate-500 bg-white border rounded-xl px-4 py-3">No hay fichas pendientes.</p>
        )}

        {pending.map((review) => (
          <article key={review.id} className="bg-white border rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-400">{review.listing.storeName}</p>
              <h2 className="font-medium text-slate-900">{review.listing.rawName}</h2>
              <p className="text-sm text-slate-600 mt-1">{review.reason}</p>
              <p className="text-xs text-amber-700 mt-1">Confianza {Math.round(review.confidence * 100)}%</p>
              {review.suggested && (
                <p className="text-sm text-slate-700 mt-2">Sugerencia: <span className="font-medium">{review.suggested.name}</span></p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => act(review.id, 'confirm')}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Confirmar
              </button>
              <button
                onClick={() => act(review.id, 'reject')}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Rechazar
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={mergeTarget[review.id] || ''}
                onChange={(event) => setMergeTarget((prev) => ({ ...prev, [review.id]: event.target.value }))}
                className="rounded-lg border px-2 py-2 text-sm text-slate-800"
              >
                <option value="">Fusionar con…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
              <button
                onClick={() => act(review.id, 'merge')}
                disabled={Boolean(busy) || !mergeTarget[review.id]}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <GitMerge className="h-4 w-4" /> Fusionar
              </button>
            </div>
          </article>
        ))}

        {!loading && products.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700">Productos canónicos</h2>
            {products.map((product) => (
              <div key={product.id} className="bg-white border rounded-xl px-4 py-3">
                <p className="font-medium text-slate-900">{product.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {[product.brand, product.variant, formatSize(product), product.ean ? `EAN ${product.ean}` : ''].filter(Boolean).join(' · ')}
                </p>
                {product.listings.length > 0 && (
                  <p className="text-xs text-slate-600 mt-1">
                    {product.listings.map((listing) => `${listing.storeName}: ${listing.rawName}`).join(' · ')}
                  </p>
                )}
                {product.substitutesFrom.length > 0 && (
                  <p className="text-xs text-teal-700 mt-1">
                    Sustitutos: {product.substitutesFrom.map((item) => `${item.to.name} (${item.reason})`).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
