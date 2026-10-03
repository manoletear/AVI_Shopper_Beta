'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Send, Loader2, Camera, DollarSign,
  ShoppingCart, X, Check, Trash2, Plus,
} from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'avi'
  text: string
}

function CartAssistantInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [importingImage, setImportingImage] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const autoSentRef = useRef(false)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const p = searchParams.get('products')
    if (p && !autoSentRef.current) {
      autoSentRef.current = true
      sendMessage(p)
    }
  }, [searchParams])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/cart-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })
      const data = await res.json()

      if (data.success) {
        const aviMsg: ChatMessage = { role: 'avi', text: data.data.reply }
        setMessages((prev) => [...prev, aviMsg])

        if (data.data.products && Array.isArray(data.data.products)) {
          setProducts(data.data.products)
        }
      } else {
        setMessages((prev) => [...prev, { role: 'avi', text: 'Error al procesar. Intenta de nuevo.' }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'avi', text: 'Error de conexion.' }])
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  const importFromImage = async (file: File) => {
    setImportingImage(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/import-list', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success && data.data.products.length > 0) {
        const names = data.data.products.map((p: any) => p.name)
        setProducts(names)
        setMessages((prev) => [...prev, {
          role: 'avi',
          text: `Encontre ${names.length} productos en la imagen. Revisa la lista abajo y cuando estes listo, comparamos precios.`,
        }])
      } else {
        setMessages((prev) => [...prev, { role: 'avi', text: 'No encontre productos en la imagen.' }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'avi', text: 'Error al procesar la imagen.' }])
    }
    setImportingImage(false)
  }

  const removeProduct = (idx: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== idx))
  }

  const goToCompare = () => {
    if (products.length === 0) return
    window.location.href = `/comparar?q=${encodeURIComponent(products.join(', '))}`
  }

  const goToBuy = () => {
    if (products.length === 0) return
    const byStore = products.join(', ')
    window.location.href = `/comparar?q=${encodeURIComponent(byStore)}`
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
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center overflow-hidden">
              <img src="/avi-icon.svg" alt="" className="w-6 h-6" />
            </div>
            <div>
              <span className="text-sm font-bold">AVI</span>
              <span className="text-xs text-gray-400 ml-1.5">Asistente de compras</span>
            </div>
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                <img src="/avi-icon.svg" alt="" className="w-12 h-12" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">¿Que necesitas comprar?</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                Dime que necesitas y te ayudo a armar la lista. Luego comparamos precios en 5 supermercados.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  'Necesito hacer un asado para 10 personas',
                  'Armar la despensa del mes para mi familia',
                  'Cumpleanos de mi hijo de 5 anos',
                ].map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="block w-full text-left text-sm px-4 py-2.5 bg-white rounded-xl text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className={`mb-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
              {msg.role === 'avi' && (
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden">
                    <img src="/avi-icon.svg" alt="" className="w-4 h-4" />
                  </div>
                  <span className="inline-block text-sm px-4 py-2.5 rounded-2xl rounded-bl-md bg-white shadow-sm text-gray-800 max-w-[85%]">
                    {msg.text}
                  </span>
                </div>
              )}
              {msg.role === 'user' && (
                <span className="inline-block text-sm px-4 py-2.5 rounded-2xl rounded-br-md bg-black text-white max-w-[85%]">
                  {msg.text}
                </span>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2 mb-3">
              <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden">
                <img src="/avi-icon.svg" alt="" className="w-4 h-4" />
              </div>
              <div className="bg-white shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Product list generated by AVI */}
          {products.length > 0 && (
            <div className="mt-4 mb-4">
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">Tu lista ({products.length})</h3>
                  <button onClick={() => setProducts([])} className="text-xs text-gray-400 hover:text-gray-600">Limpiar</button>
                </div>

                <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto">
                  {products.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-400">{i + 1}</span>
                        <span className="text-sm text-gray-800">{p}</span>
                      </div>
                      <button onClick={() => removeProduct(i)} className="text-gray-300 hover:text-red-500 p-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={goToCompare}
                    className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
                  >
                    <DollarSign className="h-4 w-4" />
                    Comparar precios
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 pb-20 sm:pb-4">
        <div className="max-w-lg mx-auto px-4 py-3">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={loading || importingImage}
              className="w-11 h-11 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center hover:bg-gray-200 disabled:opacity-40 flex-shrink-0 transition-colors"
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
                  const items = pasted.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean)
                  setProducts((prev) => [...prev, ...items])
                  setMessages((prev) => [...prev, {
                    role: 'avi',
                    text: `Agregue ${items.length} productos a tu lista. Revisa abajo y cuando estes listo, comparamos precios.`,
                  }])
                }
              }}
              placeholder="Dime que necesitas..."
              className="flex-1 px-4 py-3 bg-gray-100 rounded-full text-sm focus:ring-2 focus:ring-black/10 focus:bg-white placeholder:text-gray-400 transition-all"
              disabled={loading}
            />
            <button type="submit" disabled={!input.trim() || loading}
              className="w-11 h-11 bg-black text-white rounded-full flex items-center justify-center disabled:opacity-40 flex-shrink-0 active:scale-95 transition-transform">
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
