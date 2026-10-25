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

interface CartLine {
  query: string
  quantity: number
  added: boolean
  matchedName?: string
  price?: number
  lineTotal?: number
  productUrl?: string
  reason?: string
}

interface AutoCart {
  status: 'ready' | 'running' | 'needs_setup' | 'unsupported' | 'failed'
  mode: string
  store: string
  itemsAdded: number
  itemsFailed: string[]
  items: CartLine[]
  totalEstimated: number
  cartUrl: string
  liveUrl: string | null
  jobId: string | null
  message: string
  needsKey: boolean
  keyHint?: string
  handoff: string
}

const STORES: Record<string, { name: string; search: (q: string) => string; cart: string }> = {
  jumbo: { name: 'Jumbo', search: (q) => `https://www.jumbo.cl/busqueda?ft=${encodeURIComponent(q)}`, cart: 'https://www.jumbo.cl/mi-carro' },
  unimarc: { name: 'Unimarc', search: (q) => `https://www.unimarc.cl/search?q=${encodeURIComponent(q)}`, cart: 'https://www.unimarc.cl/checkout/#/cart' },
  tottus: { name: 'Tottus', search: (q) => `https://www.tottus.cl/tottus-cl/search?Ntt=${encodeURIComponent(q)}`, cart: 'https://www.tottus.cl/tottus-cl/checkout' },
  lider: { name: 'Lider', search: (q) => `https://super.lider.cl/search?q=${encodeURIComponent(q)}`, cart: 'https://super.lider.cl/cart' },
}

type Phase = 'loading' | 'ready' | 'auto' | 'auto-done' | 'buying' | 'waiting' | 'done'

function pesos(value: number) {
  return `$${Math.round(value).toLocaleString('es-CL')}`
}

export default function ComprarPage() {
  const { data: session } = useSession()
  const [phase, setPhase] = useState<Phase>('loading')
  const [list, setList] = useState<ShoppingList | null>(null)
  const [store, setStore] = useState('jumbo')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [message, setMessage] = useState('AVI preparando tu compra...')
  const [autoCart, setAutoCart] = useState<AutoCart | null>(null)
  const tabRef = useRef<Window | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (!session) return
    fetch('/api/shopping-lists')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !d.data?.length) {
          setMessage('No tienes listas. Crea una en "Listas" primero.')
          return
        }
        const best = d.data.reduce((a: ShoppingList, b: ShoppingList) => {
          const aP = (a.items || []).filter((i: ShoppingItem) => !i.checked).length
          const bP = (b.items || []).filter((i: ShoppingItem) => !i.checked).length
          return bP > aP ? b : a
        })
        const pending = (best.items || []).filter((i: ShoppingItem) => !i.checked)
        if (pending.length === 0) {
          setMessage('Todas tus listas estan completas. Agrega productos primero.')
          return
        }
        setList(best)
        setItems(pending)
        setPhase('ready')
        setMessage(`AVI encontro "${best.name}" con ${pending.length} productos.`)
      })
      .catch(() => setMessage('Error cargando listas.'))
  }, [session])

  const applyAuto = (data: AutoCart) => {
    setAutoCart(data)
    setMessage(data.message)
    if (data.status === 'running' && data.jobId) {
      setPhase('auto')
      return
    }
    setPhase('auto-done')
  }

  const startAuto = async () => {
    if (!list || items.length === 0) return
    setPhase('auto')
    setAutoCart(null)
    const storeConfig = STORES[store]
    setMessage(`AVI está armando el carrito en ${storeConfig?.name || store}. No va a pagar.`)
    try {
      const res = await fetch('/api/checkout/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeSlug: store,
          items: items.map((item) => ({ productName: item.name, quantity: item.quantity })),
        }),
      })
      const body = await res.json()
      if (!body.success) {
        setMessage(body.error?.message || 'No pude armar el carrito.')
        setPhase('ready')
        return
      }
      const data = body.data as AutoCart
      applyAuto(data)
      if (data.status === 'running' && data.jobId) {
        if (pollRef.current) window.clearInterval(pollRef.current)
        pollRef.current = window.setInterval(async () => {
          const poll = await fetch(`/api/checkout/auto/${data.jobId}`)
          const pollBody = await poll.json()
          if (!pollBody.success) return
          const next = pollBody.data
          if (next.status === 'running') {
            setMessage(next.message)
            return
          }
          if (pollRef.current) window.clearInterval(pollRef.current)
          setAutoCart((current) => current ? {
            ...current,
            status: next.status,
            liveUrl: next.liveUrl || current.liveUrl,
            message: next.message,
            totalEstimated: next.totalEstimated ?? current.totalEstimated,
          } : current)
          setMessage(next.message)
          setPhase('auto-done')
        }, 5000)
      }
    } catch {
      setMessage('Se cortó la conexión. Prueba de nuevo o agrégalos uno por uno.')
      setPhase('ready')
    }
  }

  const startBuying = () => {
    if (items.length === 0) return
    setPhase('buying')
    setCurrentIdx(0)
    openProduct(0)
  }

  const openProduct = (idx: number) => {
    const item = items[idx]
    const storeConfig = STORES[store]
    if (!item || !storeConfig) return
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
      setPhase('done')
      const storeConfig = STORES[store]
      if (!storeConfig) return
      setMessage(`Listo. AVI abrió el carrito de ${storeConfig.name}. El pago lo haces tú.`)
      if (tabRef.current && !tabRef.current.closed) {
        tabRef.current.location.href = storeConfig.cart
        tabRef.current.focus()
      } else {
        window.open(storeConfig.cart, '_blank')
      }
    }
  }

  const recordBought = async () => {
    if (!autoCart) return
    const lines = autoCart.items.filter((item) => item.added)
    if (lines.length === 0) return
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: lines.map((item) => ({
          productName: item.matchedName || item.query,
          quantity: item.quantity,
          price: item.lineTotal || item.price,
          storeSlug: store,
          storeName: STORES[store]?.name || store,
          source: 'avi-cart',
        })),
      }),
    })
    const body = await res.json()
    setMessage(body.success
      ? 'Listo. Anoté la compra para estimar cuándo se acaba. AVI no pagó.'
      : 'No pude anotar la compra. Puedes marcarla en la lista.')
  }

  const storeName = STORES[store]?.name || 'Jumbo'
  const openCart = phase === 'done' && !autoCart
    ? STORES[store]?.cart
    : autoCart && (autoCart.status === 'ready' || autoCart.liveUrl)
      ? (autoCart.liveUrl || autoCart.cartUrl)
      : null

  return (
    <div className="avi-page min-h-screen flex flex-col">
      <header className="avi-header flex-shrink-0">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400"><ArrowLeft className="h-5 w-5" /></a>
          <img src="/avi-icon.svg" alt="" className="w-8 h-8 rounded-lg" />
          <h1 className="text-lg font-bold">AVI Comprar</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <img src="/avi-icon.svg" alt="" className="w-20 h-20 rounded-2xl" />
              {(phase === 'loading' || phase === 'buying' || phase === 'waiting' || phase === 'auto') && (
                <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400 border-t-transparent animate-spin" />
              )}
              {(phase === 'done' || phase === 'auto-done') && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 font-medium">{message}</p>
          </div>

          {phase === 'ready' && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 text-center mb-2">Supermercado:</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {Object.entries(STORES).map(([key, s]) => (
                  <button key={key} onClick={() => setStore(key)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${store === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.length > 0 && phase !== 'auto-done' && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2 font-medium">{list?.name} · {storeName}</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {items.map((item, i) => (
                  <div key={item.id} className={`flex items-center gap-2 py-1.5 text-sm ${
                    i < currentIdx && phase !== 'ready' && phase !== 'auto' ? 'text-green-600' :
                    i === currentIdx && (phase === 'waiting' || phase === 'buying') ? 'text-indigo-600 font-semibold' :
                    'text-gray-400'
                  }`}>
                    {i < currentIdx && phase !== 'ready' && phase !== 'auto' ? (
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

          {phase === 'auto-done' && autoCart && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2 font-medium">
                {autoCart.store}
                {autoCart.totalEstimated > 0 ? ` · ${pesos(autoCart.totalEstimated)}` : ''}
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(autoCart.items.length ? autoCart.items : items.map((item): CartLine => ({
                  query: item.name, quantity: item.quantity, added: false,
                }))).map((item, i) => (
                  <div key={`${item.query}-${i}`} className={`flex items-center gap-2 py-1.5 text-sm ${item.added ? 'text-green-700' : 'text-gray-500'}`}>
                    {item.added ? <Check className="h-4 w-4 text-green-500 flex-shrink-0" /> : <div className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0" />}
                    <span className="flex-1">{item.matchedName || item.query}</span>
                    {item.lineTotal ? <span className="text-xs text-gray-400">{pesos(item.lineTotal)}</span> : null}
                  </div>
                ))}
              </div>
              {autoCart.needsKey && autoCart.keyHint && (
                <p className="text-xs text-amber-700 mt-3 leading-relaxed">{autoCart.keyHint}</p>
              )}
              {autoCart.handoff === 'extension' && (
                <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                  Si tienes la extensión de AVI, el carrito aparece al abrir el link. El pago lo haces tú en Jumbo.
                </p>
              )}
            </div>
          )}

          {phase === 'ready' && (
            <div className="space-y-2">
              <button onClick={startAuto}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-base active:scale-[0.97] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                <ShoppingCart className="h-5 w-5" />
                AVI arma el carrito en {storeName}
              </button>
              <button onClick={startBuying}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-medium text-sm">
                Agregar uno por uno
              </button>
            </div>
          )}

          {phase === 'auto' && (
            <p className="text-center text-xs text-indigo-600">Revisando el carrito cada 5 segundos. AVI no paga.</p>
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
                  <><ShoppingCart className="h-5 w-5" /> Listo — ver carrito</>
                )}
              </button>
            </div>
          )}

          {(phase === 'done' || phase === 'auto-done') && (
            <div className="space-y-3">
              {openCart && (
                <a href={openCart} target="_blank" rel="noopener noreferrer"
                  className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-base active:scale-[0.97] transition-transform flex items-center justify-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Abrir carrito para pagar
                </a>
              )}
              {autoCart?.status === 'ready' && autoCart.itemsAdded > 0 && (
                <button onClick={recordBought}
                  className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-medium text-sm">
                  Ya lo compré
                </button>
              )}
              <button onClick={() => { setPhase('ready'); setCurrentIdx(0); setAutoCart(null) }}
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
