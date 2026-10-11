'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ShoppingCart, ExternalLink, Check, Loader2, ArrowRight, Copy } from 'lucide-react'

interface ShoppingItem {
  id: string
  name: string
  quantity: number
  checked: boolean
}

interface ShoppingList {
  id: string
  name: string
  items: ShoppingItem[]
}

const STORE_URLS: Record<string, { name: string; search: (q: string) => string; cart: string; color: string }> = {
  lider: { name: 'Lider', search: (q) => `https://super.lider.cl/search?q=${encodeURIComponent(q)}`, cart: 'https://super.lider.cl/cart', color: 'bg-blue-600' },
  jumbo: { name: 'Jumbo', search: (q) => `https://www.jumbo.cl/search?ft=${encodeURIComponent(q)}`, cart: 'https://www.jumbo.cl/checkout', color: 'bg-green-600' },
  unimarc: { name: 'Unimarc', search: (q) => `https://www.unimarc.cl/search?q=${encodeURIComponent(q)}`, cart: 'https://www.unimarc.cl/checkout', color: 'bg-orange-500' },
  tottus: { name: 'Tottus', search: (q) => `https://www.tottus.cl/tottus-cl/search?Ntt=${encodeURIComponent(q)}`, cart: 'https://www.tottus.cl/tottus-cl/checkout', color: 'bg-teal-600' },
}

export default function ComprarPage() {
  const { data: session } = useSession()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null)
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [addedCount, setAddedCount] = useState(0)

  useEffect(() => {
    if (!session) return
    fetch('/api/shopping-lists')
      .then((r) => r.json())
      .then((d) => { if (d.success) setLists(d.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  const pendingItems = selectedList?.items.filter((i) => !i.checked) || []

  const startBuying = () => {
    if (!selectedStore || pendingItems.length === 0) return
    setCurrentIdx(0)
    setAddedCount(0)
    const store = STORE_URLS[selectedStore]
    window.open(store.search(pendingItems[0].name), '_blank')
  }

  const nextProduct = () => {
    const next = currentIdx + 1
    setAddedCount((c) => c + 1)
    if (next < pendingItems.length) {
      setCurrentIdx(next)
      const store = STORE_URLS[selectedStore!]
      window.open(store.search(pendingItems[next].name), '_blank')
    } else {
      setCurrentIdx(-2)
      setAddedCount((c) => c + 1)
      const store = STORE_URLS[selectedStore!]
      window.open(store.cart, '_blank')
    }
  }

  if (loading) return (
    <div className="avi-page flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
    </div>
  )

  return (
    <div className="avi-page min-h-screen pb-20">
      <header className="avi-header">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ShoppingCart className="h-5 w-5" />
          </a>
          <img src="/avi-icon.svg" alt="" className="w-8 h-8 rounded-lg" />
          <h1 className="text-lg font-bold">Comprar ahora</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Step 1: Elegir lista */}
        {!selectedList && (
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">1. Elige tu lista</h2>
            {lists.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                <p className="text-gray-500">No tienes listas. Crea una primero.</p>
                <a href="/listas" className="mt-3 inline-block text-indigo-600 font-medium text-sm">Ir a Listas</a>
              </div>
            ) : (
              <div className="space-y-2">
                {lists.map((list) => {
                  const pending = list.items?.filter((i) => !i.checked).length || 0
                  if (pending === 0) return null
                  return (
                    <button key={list.id} onClick={() => setSelectedList(list)}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm text-left active:scale-[0.98] transition-transform">
                      <p className="font-semibold text-gray-900">{list.name}</p>
                      <p className="text-sm text-gray-400">{pending} productos pendientes</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Elegir supermercado */}
        {selectedList && !selectedStore && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">2. Elige supermercado</h2>
              <button onClick={() => setSelectedList(null)} className="text-sm text-indigo-600">Cambiar lista</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Lista: <strong>{selectedList.name}</strong> ({pendingItems.length} productos)</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(STORE_URLS).map(([key, store]) => (
                <button key={key} onClick={() => setSelectedStore(key)}
                  className={`${store.color} text-white rounded-2xl p-5 text-center shadow-md active:scale-95 transition-transform`}>
                  <p className="text-2xl font-black">{store.name[0]}</p>
                  <p className="text-sm font-semibold mt-1">{store.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Comprar producto por producto */}
        {selectedStore && currentIdx === -1 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">3. AVI abre cada producto</h2>
              <button onClick={() => setSelectedStore(null)} className="text-sm text-indigo-600">Cambiar super</button>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <p className="text-sm text-gray-500 mb-3">
                AVI va a abrir <strong>{STORE_URLS[selectedStore].name}</strong> con cada producto.
                Tu agregas al carrito y vuelves aqui.
              </p>
              <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto">
                {pendingItems.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2 py-1 text-sm">
                    <span className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-400">{i + 1}</span>
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                ))}
              </div>
              <button onClick={startBuying}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Empezar a comprar ({pendingItems.length} productos)
              </button>
            </div>
          </div>
        )}

        {/* Buying in progress */}
        {selectedStore && currentIdx >= 0 && (
          <div>
            <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
              <img src="/avi-icon.svg" alt="" className="w-14 h-14 rounded-xl mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900">
                Producto {currentIdx + 1} de {pendingItems.length}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                <strong>{pendingItems[currentIdx].name}</strong>
              </p>
              <p className="text-xs text-amber-600 mt-2">
                Agrega el producto en {STORE_URLS[selectedStore].name} y vuelve aqui
              </p>

              <div className="mt-5 space-y-2">
                <button onClick={nextProduct}
                  className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                  {currentIdx < pendingItems.length - 1 ? (
                    <><ArrowRight className="h-4 w-4" /> Ya agregue — siguiente</>
                  ) : (
                    <><ShoppingCart className="h-4 w-4" /> Ya agregue — ir al carrito</>
                  )}
                </button>
              </div>

              <div className="mt-4 space-y-1">
                {pendingItems.map((item, i) => (
                  <div key={item.id} className={`flex items-center gap-2 text-xs py-0.5 ${i < currentIdx ? 'text-green-600' : i === currentIdx ? 'text-indigo-600 font-medium' : 'text-gray-300'}`}>
                    {i < currentIdx ? <Check className="h-3 w-3" /> : i === currentIdx ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="w-3" />}
                    {item.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {currentIdx === -2 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Compra lista!</h3>
            <p className="text-sm text-gray-500 mt-1">
              {addedCount} productos enviados a {STORE_URLS[selectedStore!].name}. AVI abrio el carrito para que pagues.
            </p>
            <button onClick={() => { setSelectedList(null); setSelectedStore(null); setCurrentIdx(-1) }}
              className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm active:scale-[0.98]">
              Nueva compra
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
