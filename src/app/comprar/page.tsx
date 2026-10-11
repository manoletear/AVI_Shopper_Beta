'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { ShoppingCart, Check, Loader2, ArrowLeft } from 'lucide-react'

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

const STORES: Record<string, { name: string; search: (q: string) => string; cart: string }> = {
  lider: { name: 'Lider', search: (q) => `https://super.lider.cl/search?q=${encodeURIComponent(q)}`, cart: 'https://super.lider.cl/cart' },
  jumbo: { name: 'Jumbo', search: (q) => `https://www.jumbo.cl/search?ft=${encodeURIComponent(q)}`, cart: 'https://www.jumbo.cl/checkout' },
  unimarc: { name: 'Unimarc', search: (q) => `https://www.unimarc.cl/search?q=${encodeURIComponent(q)}`, cart: 'https://www.unimarc.cl/checkout' },
  tottus: { name: 'Tottus', search: (q) => `https://www.tottus.cl/tottus-cl/search?Ntt=${encodeURIComponent(q)}`, cart: 'https://www.tottus.cl/tottus-cl/checkout' },
}

type Phase = 'loading' | 'ready' | 'buying' | 'waiting' | 'done'

export default function ComprarPage() {
  const { data: session } = useSession()
  const [phase, setPhase] = useState<Phase>('loading')
  const [list, setList] = useState<ShoppingList | null>(null)
  const [store, setStore] = useState('lider')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [message, setMessage] = useState('AVI preparando tu compra...')
  const tabRef = useRef<Window | null>(null)

  useEffect(() => {
    if (!session) return
    // AVI auto-selects the list with most pending items
    fetch('/api/shopping-lists')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !d.data?.length) {
          setMessage('No tienes listas. Crea una en "Listas" primero.')
          return
        }
        // Pick list with most unchecked items
        const best = d.data.reduce((a: any, b: any) => {
          const aP = (a.items || []).filter((i: any) => !i.checked).length
          const bP = (b.items || []).filter((i: any) => !i.checked).length
          return bP > aP ? b : a
        })
        const pending = (best.items || []).filter((i: any) => !i.checked)
        if (pending.length === 0) {
          setMessage('Todas tus listas estan completas. Agrega productos primero.')
          return
        }
        setList(best)
        setItems(pending)
        setPhase('ready')
        setMessage(`AVI encontro "${best.name}" con ${pending.length} productos. Toca para comprar.`)
      })
      .catch(() => setMessage('Error cargando listas.'))
  }, [session])

  const startBuying = () => {
    if (items.length === 0) return
    setPhase('buying')
    setCurrentIdx(0)
    openProduct(0)
  }

  const openProduct = (idx: number) => {
    const item = items[idx]
    const storeConfig = STORES[store]
    const url = storeConfig.search(item.name)
    setMessage(`Abriendo: ${item.name}`)
    setPhase('waiting')

    if (tabRef.current && !tabRef.current.closed) {
      tabRef.current.location.href = url
      tabRef.current.focus()
    } else {
      tabRef.current = window.open(url, '_blank')
    }
  }

  const productAdded = () => {
    const next = currentIdx + 1
    if (next < items.length) {
      setCurrentIdx(next)
      openProduct(next)
    } else {
      // All done — open cart
      setPhase('done')
      setMessage(`Listo! ${items.length} productos agregados. AVI abrio el carrito.`)
      const storeConfig = STORES[store]
      if (tabRef.current && !tabRef.current.closed) {
        tabRef.current.location.href = storeConfig.cart
        tabRef.current.focus()
      } else {
        window.open(storeConfig.cart, '_blank')
      }
    }
  }

  const storeName = STORES[store]?.name || 'Lider'

  return (
    <div className="avi-page min-h-screen flex flex-col">
      <header className="avi-header flex-shrink-0">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400"><ArrowLeft className="h-5 w-5" /></a>
          <img src="/avi-icon.svg" alt="" className="w-8 h-8 rounded-lg" />
          <h1 className="text-lg font-bold">AVI Comprar</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* AVI Avatar + Status */}
          <div className="text-center mb-6">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <img src="/avi-icon.svg" alt="" className="w-20 h-20 rounded-2xl" />
              {(phase === 'loading' || phase === 'buying' || phase === 'waiting') && (
                <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400 border-t-transparent animate-spin" />
              )}
              {phase === 'done' && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 font-medium">{message}</p>
          </div>

          {/* Store selector */}
          {phase === 'ready' && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 text-center mb-2">Supermercado:</p>
              <div className="flex gap-2 justify-center">
                {Object.entries(STORES).map(([key, s]) => (
                  <button key={key} onClick={() => setStore(key)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${store === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product list */}
          {items.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2 font-medium">{list?.name} · {storeName}</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {items.map((item, i) => (
                  <div key={item.id} className={`flex items-center gap-2 py-1.5 text-sm ${
                    i < currentIdx && phase !== 'ready' ? 'text-green-600' :
                    i === currentIdx && (phase === 'waiting' || phase === 'buying') ? 'text-indigo-600 font-semibold' :
                    'text-gray-400'
                  }`}>
                    {i < currentIdx && phase !== 'ready' ? (
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : i === currentIdx && (phase === 'waiting' || phase === 'buying') ? (
                      <Loader2 className="h-4 w-4 text-indigo-500 animate-spin flex-shrink-0" />
                    ) : phase === 'done' ? (
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                      </div>
                    )}
                    <span>{item.name}</span>
                    {item.quantity > 1 && <span className="text-xs text-gray-300">x{item.quantity}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          {phase === 'ready' && (
            <button onClick={startBuying}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-base active:scale-[0.97] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
              <ShoppingCart className="h-5 w-5" />
              Comprar {items.length} productos en {storeName}
            </button>
          )}

          {phase === 'waiting' && (
            <div className="space-y-2">
              <p className="text-center text-xs text-amber-600 font-medium">
                Agrega "{items[currentIdx]?.name}" en {storeName} y vuelve
              </p>
              <button onClick={productAdded}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-base active:scale-[0.97] transition-transform flex items-center justify-center gap-2">
                {currentIdx < items.length - 1 ? (
                  <>Listo — siguiente ({currentIdx + 2}/{items.length})</>
                ) : (
                  <><ShoppingCart className="h-5 w-5" /> Listo — ir a pagar</>
                )}
              </button>
            </div>
          )}

          {phase === 'done' && (
            <div className="space-y-3">
              <button onClick={() => window.open(STORES[store].cart, '_blank')}
                className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-base active:scale-[0.97] transition-transform flex items-center justify-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Abrir carrito de {storeName}
              </button>
              <button onClick={() => { setPhase('ready'); setCurrentIdx(0) }}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-medium text-sm">
                Comprar en otro supermercado
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
