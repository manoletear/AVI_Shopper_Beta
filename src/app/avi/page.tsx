'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  ShoppingCart, Send, ArrowLeft, Bot, User,
  Loader2, Wrench, Settings,
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  tools?: Array<{ tool: string; success: boolean; message: string }>
}

export default function AviPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.data.response,
            tools: data.data.toolsUsed,
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error?.message || 'Error del agente' },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error de conexión' },
      ])
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  const SUGGESTIONS = [
    'Agrega leche y huevos a mi lista',
    '¿Cuánto cuesta el café en los supermercados?',
    '¿Qué tan saludable es la Coca Cola?',
    '¿Cuánto llevo gastado este mes?',
    '¿Qué se me está acabando?',
    'Compré pan en Jumbo por $2.500',
  ]

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">AVI</h1>
              <p className="text-xs text-gray-400">Asistente de compras</p>
            </div>
          </div>
          <a href="/configuracion/cuentas" className="text-gray-400 hover:text-gray-600">
            <Settings className="h-5 w-5" />
          </a>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {/* Welcome */}
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Hola, soy AVI</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                Tu asistente de compras familiares. Dime que necesitas y yo lo hago.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot className="h-3.5 w-3.5 text-blue-600" />
                </div>
              )}
              <div className={`max-w-md ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Tool badges */}
                {msg.tools && msg.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msg.tools.map((t, ti) => (
                      <span
                        key={ti}
                        className={`inline-flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full ${
                          t.success
                            ? 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        <Wrench className="h-2.5 w-2.5" />
                        <span>{t.tool}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                  <User className="h-3.5 w-3.5 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                <Bot className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-2xl rounded-bl-md">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
            className="flex space-x-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escríbele a AVI..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
