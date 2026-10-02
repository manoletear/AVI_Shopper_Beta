'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft, ShoppingCart, Send, Loader2, Minus, Plus,
  Pencil, Trash2, ExternalLink, AlertTriangle, Heart,
  Camera,
} from 'lucide-react'

interface CartProduct {
  name: string
  brand: string
  store: string
  storeSlug: string
  price: number
  listPrice?: number
  imageUrl?: string
  quantity: number
  url?: string
  nutriscoreGrade?: string
  allergenWarning?: string
}

function CartAssistantInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [buildingCart, setBuildingCart] = useState(false)
  const [cartItems, setCartItems] = useState<CartProduct[]>([])
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; text: string }>>([])
  const [phase, setPhase] = useState<'chat' | 'cart'>('chat')
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const autoSentRef = useRef(false)
  const [importingImage, setImportingImage] = useState(false)

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  const totalPrice = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    setChatMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      // Extraer productos del mensaje
      const products = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)

      if (products.length > 0) {
        setBuildingCart(true)
        setChatMessages((prev) => [...prev, { role: 'avi', text: `Buscando ${products.length} producto${products.length > 1 ? 's' : ''} en los mejores precios...` }])

        const newItems: CartProduct[] = []

        for (const product of products) {
          try {
            const res = await fetch(`/api/prices?q=${encodeURIComponent(product)}`)
            const data = await res.json()

            if (data.success && data.data.cheapest) {
              const c = data.data.cheapest
              newItems.push({
                name: c.name || product,
                brand: c.brand || '',
                store: c.store || 'Jumbo',
                storeSlug: (c.store || 'jumbo').toLowerCase(),
                price: c.price,
                listPrice: c.listPrice,
                imageUrl: c.imageUrl,
                quantity: 1,
                url: c.url,
              })
            } else {
              // Producto no encontrado — agregar sin precio
              newItems.push({
                name: product,
                brand: '',
                store: 'Por buscar',
                storeSlug: '',
                price: 0,
                quantity: 1,
              })
            }
          } catch {
            newItems.push({
              name: product,
              brand: '',
              store: 'Por buscar',
              storeSlug: '',
              price: 0,
              quantity: 1,
            })
          }
        }

        setCartItems((prev) => [...prev, ...newItems])
        setBuildingCart(false)
        setPhase('cart')

        const found = newItems.filter((i) => i.price > 0).length
        const total = newItems.reduce((s, i) => s + i.price * i.quantity, 0)
        setChatMessages((prev) => [...prev, {
          role: 'avi',
          text: `Listo! Encontre ${found} de ${products.length} productos. Total estimado: ${formatCLP(total)}. Revisa tu carrito abajo.`,
        }])
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: 'avi', text: 'Error buscando productos' }])
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  useEffect(() => {
    const products = searchParams.get('products')
    if (products && !autoSentRef.current) {
      autoSentRef.current = true
      sendMessage(products)
    }
  }, [searchParams])

  const importFromImage = async (file: File) => {
    setImportingImage(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/import-list', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success && data.data.products.length > 0) {
        const products = data.data.products.map((p: any) => p.name).join(', ')
        sendMessage(products)
      } else {
        setChatMessages((prev) => [...prev, { role: 'avi', text: 'No encontre productos en la imagen. Intenta con otra foto o escribe tu lista.' }])
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: 'avi', text: 'Error al procesar la imagen.' }])
    }
    setImportingImage(false)
  }

  const updateQuantity = (idx: number, delta: number) => {
    setCartItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      const newQty = Math.max(0, item.quantity + delta)
      return newQty === 0 ? item : { ...item, quantity: newQty }
    }))
  }

  const removeItem = (idx: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const checkout = () => {
    // Agrupar por tienda y abrir links
    const byStore = new Map<string, CartProduct[]>()
    for (const item of cartItems) {
      if (!item.url && !item.storeSlug) continue
      const key = item.storeSlug || 'jumbo'
      const arr = byStore.get(key) || []
      arr.push(item)
      byStore.set(key, arr)
    }

    const searchUrls: Record<string, (q: string) => string> = {
      jumbo: (q) => `https://www.jumbo.cl/search?ft=${encodeURIComponent(q)}`,
      lider: (q) => `https://super.lider.cl/search?q=${encodeURIComponent(q)}`,
      unimarc: (q) => `https://www.unimarc.cl/buscar?q=${encodeURIComponent(q)}`,
      'santa isabel': (q) => `https://www.santaisabel.cl/search?ft=${encodeURIComponent(q)}`,
      tottus: (q) => `https://www.tottus.cl/search?Ntt=${encodeURIComponent(q)}`,
    }

    for (const [slug, items] of byStore) {
      for (const item of items) {
        const url = item.url || searchUrls[slug]?.(item.name) || searchUrls.jumbo(item.name)
        window.open(url, '_blank')
      }
    }
  }

  const STORE_COLORS: Record<string, string> = {
    Jumbo: 'bg-green-100 text-green-700',
    Lider: 'bg-red-100 text-red-700',
    Unimarc: 'bg-orange-100 text-orange-700',
    'Santa Isabel': 'bg-blue-100 text-blue-700',
    Tottus: 'bg-teal-100 text-teal-700',
    'Por buscar': 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="avi-page flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="avi-header flex-shrink-0">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center overflow-hidden">
              <img src="/avi-icon.svg" alt="" className="w-6 h-6" />
            </div>
            <div>
              <span className="text-sm font-semibold">Cart Assistant</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1.5 font-medium">Beta</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4">

          {/* Chat messages */}
          {chatMessages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                <img src="/avi-icon.svg" alt="" className="w-12 h-12" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Cart Assistant</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                Dime que necesitas y AVI arma tu carrito con los mejores precios de 4 supermercados.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  'Leche, huevos, pan, cafe, mantequilla',
                  'Lo que necesito para un asado',
                  'Productos de limpieza para la casa',
                ].map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="block w-full text-left text-sm px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div key={i} className={`mb-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
              <span className={`inline-block text-sm px-4 py-2 rounded-2xl max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
              }`}>
                {msg.text}
              </span>
            </div>
          ))}

          {buildingCart && (
            <div className="flex items-center gap-2 text-sm text-purple-600 mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-medium">Armando tu carrito...</span>
            </div>
          )}

          {/* Cart Items */}
          {cartItems.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Tu carrito</h3>

              <div className="space-y-2">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="avi-card p-3 flex gap-3">
                    {/* Image */}
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingCart className="h-5 w-5 text-gray-300" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          {item.price > 0 && (
                            <span className="text-sm font-bold text-gray-900">{formatCLP(item.price)}</span>
                          )}
                          {item.listPrice && item.listPrice > item.price && (
                            <span className="text-xs text-gray-400 line-through ml-1">{formatCLP(item.listPrice)}</span>
                          )}
                        </div>
                        <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 p-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-800 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STORE_COLORS[item.store] || 'bg-gray-100 text-gray-500'}`}>
                          {item.store}
                        </span>
                        {item.brand && <span className="text-[10px] text-gray-400">{item.brand}</span>}
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateQuantity(idx, -1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Add all to cart button OR input */}
      <div className="flex-shrink-0 bg-white/90 backdrop-blur-md border-t border-gray-100 pb-20 sm:pb-4">
        <div className="max-w-lg mx-auto px-4 py-3">
          {cartItems.length > 0 && (
            <button onClick={checkout}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors mb-3">
              <ShoppingCart className="h-4 w-4" />
              Agregar todo al carrito · {formatCLP(totalPrice)}
            </button>
          )}

          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={loading || importingImage}
              className="w-11 h-11 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center hover:bg-purple-50 hover:text-purple-600 disabled:opacity-40 flex-shrink-0 transition-colors"
            >
              {importingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importFromImage(file)
                e.target.value = ''
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text')
                if (pasted.includes('\n') || pasted.includes('\r')) {
                  e.preventDefault()
                  const products = pasted.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean).join(', ')
                  sendMessage(products)
                }
              }}
              placeholder="Escribe, pega o sube foto..."
              className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-sm border-0 focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border focus:border-blue-200 placeholder:text-gray-400"
              disabled={loading}
            />
            <button type="submit" disabled={!input.trim() || loading}
              className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center disabled:opacity-40 flex-shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function CartAssistantPage() {
  return (
    <Suspense>
      <CartAssistantInner />
    </Suspense>
  )
}
