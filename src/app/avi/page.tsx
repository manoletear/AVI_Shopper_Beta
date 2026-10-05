'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Send, ArrowLeft, Loader2, Wrench, Settings } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  tools?: Array<{ tool: string; success: boolean; message: string }>
}

const SUGGESTIONS = [
  'Agrega leche y huevos a mi lista',
  '¿Donde es mas barato el cafe?',
  '¿Es saludable la Coca Cola?',
  '¿Cuanto llevo gastado?',
  '¿Que se me esta acabando?',
  'Compre pan en Jumbo por $2.500',
]

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
    setMessages((prev) => [...prev, { role: 'user', content: text }])
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
        setMessages((prev) => [...prev, { role: 'assistant', content: data.data.response, tools: data.data.toolsUsed }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error?.message || 'Error' }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error de conexion' }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div className="avi-page flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="avi-header flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 rounded-full flex items-center justify-center shadow-sm overflow-hidden">
            <img src="/avi-icon.svg" alt="AVI" className="w-7 h-7" />
          </div>
          <div>
            <div className="text-sm font-semibold">AVI</div>
            <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              En linea
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center overflow-hidden">
                <img src="/avi-icon.svg" alt="AVI" className="w-14 h-14" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Hola, soy AVI</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Tu asistente de compras. Dime que necesitas y yo lo hago.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden">
                  <img src="/avi-icon.svg" alt="" className="w-5 h-5" />
                </div>
              )}
              <div className="max-w-[80%]">
                <div className={`px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-2xl rounded-br-md shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-md shadow-sm'
                }`}>
                  {msg.content.split('\n').map((line, li) => (
                    <span key={li}>{line}{li < msg.content.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
                {msg.tools && msg.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msg.tools.map((t, ti) => (
                      <span key={ti} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        t.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        <Wrench className="h-2.5 w-2.5" />
                        {t.tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-xs font-bold text-gray-600">
                  {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center overflow-hidden">
                <img src="/avi-icon.svg" alt="" className="w-5 h-5" />
              </div>
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white/90 backdrop-blur-md border-t border-gray-100 pb-20 sm:pb-4">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribele a AVI..."
              className="flex-1 px-4 py-3 bg-gray-100 border-0 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border focus:border-indigo-200 placeholder:text-gray-400 transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-11 h-11 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-full flex items-center justify-center hover:shadow-lg disabled:opacity-40 transition-all flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
