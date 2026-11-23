'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Send, ArrowLeft, Loader2, Wrench, ShoppingCart, Sparkles } from 'lucide-react'

interface ToolUse {
  tool: string
  success: boolean
  label?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  tools?: ToolUse[]
}

const SUGGESTIONS = [
  '¿Qué se está acabando?',
  'Arma la lista de esta semana',
  '¿Dónde es más barato el yoghurt?',
  'Agrega leche y huevos a la lista',
  '¿Qué compramos la semana pasada?',
  'Revisa los alérgenos de la familia',
]

export default function AviPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTools, setActiveTools] = useState<string[]>([])
  const [streamingText, setStreamingText] = useState('')
  const messagesEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setStreamingText('')
    setActiveTools([])

    try {
      const res = await fetch('/api/avi-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error de conexión' }))
        setMessages((prev) => [...prev, { role: 'assistant', content: err.error || 'Error' }])
        setLoading(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Error de streaming' }])
        setLoading(false)
        return
      }

      const decoder = new TextDecoder()
      let fullText = ''
      let tools: ToolUse[] = []
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6))
              if (eventType === 'text') {
                fullText = data.content || ''
                setStreamingText(fullText)
              } else if (eventType === 'tool_start') {
                setActiveTools((prev) => [...prev, data.label || data.tool])
              } else if (eventType === 'tool_end') {
                tools.push({ tool: data.tool, success: data.success })
                setActiveTools((prev) => prev.filter((t) => t !== (data.label || data.tool)))
              } else if (eventType === 'done') {
                tools = data.toolsUsed || tools
              } else if (eventType === 'error') {
                fullText = data.message || 'Error del asistente'
                setStreamingText(fullText)
              }
            } catch {}
            eventType = ''
          }
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullText, tools: tools.length > 0 ? tools : undefined }])
      setStreamingText('')
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }])
    }

    setLoading(false)
    setActiveTools([])
    inputRef.current?.focus()
  }, [loading, messages])

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#F8FAFC' }}>
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center shadow-sm overflow-hidden">
            <img src="/avi-icon.svg" alt="AVI" className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">AVI</div>
            <div className="text-xs text-teal-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
              {loading ? 'Pensando...' : 'En línea'}
            </div>
          </div>
          <a href="/dashboard" className="text-gray-400 hover:text-indigo-600 transition-colors">
            <ShoppingCart className="h-5 w-5" />
          </a>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-50 to-violet-100 rounded-full flex items-center justify-center overflow-hidden">
                <img src="/avi-icon.svg" alt="AVI" className="w-14 h-14" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Hola{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Soy AVI, tu asistente de compras. Sé lo que necesita tu casa.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3 text-indigo-400" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden">
                  <img src="/avi-icon.svg" alt="" className="w-5 h-5" />
                </div>
              )}
              <div className="max-w-[85%]">
                <div className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm shadow-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-sm shadow-sm'
                }`}>
                  {msg.content}
                </div>
                {msg.tools && msg.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {msg.tools.map((t, ti) => (
                      <span key={ti} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        t.success ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'
                      }`}>
                        <Wrench className="h-2.5 w-2.5" />
                        {t.tool.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-xs font-bold text-indigo-600">
                  {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
          ))}

          {/* Streaming response */}
          {loading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 mt-1">
                <img src="/avi-icon.svg" alt="" className="w-5 h-5" />
              </div>
              <div className="max-w-[85%]">
                {/* Active tool indicators */}
                {activeTools.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {activeTools.map((label, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 text-xs px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full font-medium animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {streamingText ? (
                  <div className="bg-white border border-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                    {streamingText}
                  </div>
                ) : activeTools.length === 0 ? (
                  <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-md border-t border-gray-100 pb-20 sm:pb-4">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escríbele a AVI..."
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-300 placeholder:text-gray-400 transition-all outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-11 h-11 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-full flex items-center justify-center hover:shadow-lg hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 transition-all flex-shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
