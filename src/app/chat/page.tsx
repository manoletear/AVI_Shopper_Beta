'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ShoppingCart,
  Send,
  Bot,
  User,
  ArrowLeft,
  Sparkles,
  ShoppingBag,
  DollarSign,
  Apple,
  Wallet,
  Link2,
  Truck,
  RotateCw,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type ChatRole = 'user' | 'avi' | 'system'
type AgentId = 'orchestrator' | 'shopping' | 'pricing' | 'nutrition' | 'budget' | 'account' | 'delivery'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  agentId?: AgentId
  timestamp: string
  metadata?: {
    intent?: string
    agentsInvolved?: AgentId[]
    products?: Array<{ name: string; price?: number }>
    savings?: number
    actionButtons?: Array<{ label: string; action: string }>
  }
}

// ============================================
// AGENT CONFIG
// ============================================

const AGENT_CONFIG: Record<AgentId, { name: string; icon: typeof Bot; color: string; bgColor: string }> = {
  orchestrator: { name: 'AVI Orchestrator', icon: Sparkles, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  shopping: { name: 'Shopping Agent', icon: ShoppingBag, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  pricing: { name: 'Pricing Agent', icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-100' },
  nutrition: { name: 'Nutrition Agent', icon: Apple, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  budget: { name: 'Budget Agent', icon: Wallet, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  account: { name: 'Account Agent', icon: Link2, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  delivery: { name: 'Delivery Agent', icon: Truck, color: 'text-teal-600', bgColor: 'bg-teal-100' },
}

const QUICK_ACTIONS = [
  { label: 'Crear lista semanal', message: 'Quiero crear mi lista de compras para la semana' },
  { label: 'Comparar precios', message: 'Compara los precios de mi lista en todos los supermercados' },
  { label: 'Ver presupuesto', message: '¿Cuánto llevo gastado este mes?' },
  { label: 'Mis cuentas', message: '¿En qué supermercados tengo cuenta vinculada?' },
  { label: 'Estado de pedidos', message: '¿Cómo van mis pedidos?' },
  { label: 'Análisis nutricional', message: '¿Qué tan saludable es mi carrito actual?' },
]

// ============================================
// COMPONENT
// ============================================

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeAgents, setActiveAgents] = useState<AgentId[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Mensaje de bienvenida al montar
  useEffect(() => {
    const welcome: ChatMessage = {
      id: 'welcome',
      role: 'avi',
      content:
        '¡Hola! Soy **AVI**, tu asistente inteligente de compras familiares.\n\n' +
        'Tengo un equipo de agentes especializados listos para ayudarte:\n\n' +
        '🛍️ **Shopping** — Listas de compras\n' +
        '💰 **Pricing** — Comparación de precios\n' +
        '🥗 **Nutrition** — Análisis nutricional\n' +
        '📊 **Budget** — Control de presupuesto\n' +
        '🔗 **Account** — Cuentas de supermercados\n' +
        '🚚 **Delivery** — Pedidos y entregas\n\n' +
        '¿En qué te puedo ayudar hoy?',
      agentId: 'orchestrator',
      timestamp: new Date().toISOString(),
      metadata: {
        intent: 'welcome',
        agentsInvolved: ['orchestrator'],
      },
    }
    setMessages([welcome])
  }, [])

  // Scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      })

      const data = await res.json()

      if (data.success) {
        // Simular delay de "pensando"
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 700))

        setMessages((prev) => [...prev, data.data.message])
        setSessionId(data.data.sessionId)

        // Actualizar agentes activos
        if (data.data.message.metadata?.agentsInvolved) {
          setActiveAgents(data.data.message.metadata.agentsInvolved)
        }
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Error de conexión. Intenta de nuevo.',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleActionButton = (action: string) => {
    const actionMessages: Record<string, string> = {
      add_all: 'Sí, agrega todos los productos a mi lista',
      show_more: 'Muéstrame más opciones de productos',
      view_list: 'Muéstrame mi lista de compras actual',
      suggest: 'Sugiere productos basados en mis compras anteriores',
      weekly_template: 'Usa el template de compras semanales',
      apply_split: 'Aplica el split óptimo por tiendas',
      single_store: 'Prefiero comprar todo en una sola tienda',
      price_detail: 'Muéstrame el detalle de precios por producto',
      apply_substitutions: 'Aplica las sustituciones saludables',
      nutrition_detail: 'Dame el detalle nutricional completo',
      dismiss: 'Está bien, dejo mi carrito como está',
      adjust_budget: 'Quiero ajustar mi presupuesto mensual',
      spending_history: 'Muéstrame el historial de gastos',
      auto_create_accounts: 'Sí, crea las cuentas faltantes con mis datos',
      go_settings: 'Llévame a la configuración de cuentas',
      order_detail: 'Dame el detalle completo de mis pedidos',
      contact_driver: 'Necesito contactar al repartidor',
      weekly_list: 'Quiero crear mi lista de compras para la semana',
      compare: 'Compara los precios de mi lista en todos los supermercados',
      budget: '¿Cuánto llevo gastado este mes?',
    }

    const message = actionMessages[action] || action
    sendMessage(message)
  }

  // Renderizar markdown simplificado (bold, listas)
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Bold
      const parts = line.split(/\*\*(.*?)\*\*/g)
      const rendered = parts.map((part, j) =>
        j % 2 === 1 ? (
          <strong key={j} className="font-semibold">
            {part}
          </strong>
        ) : (
          <span key={j}>{part}</span>
        )
      )

      if (line.trim() === '') return <br key={i} />
      return (
        <div key={i} className="leading-relaxed">
          {rendered}
        </div>
      )
    })
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-blue-600">AVI</span>
              <span className="font-semibold text-gray-800">Chat</span>
            </div>
          </div>

          {/* Active Agents Indicator */}
          <div className="flex items-center space-x-1">
            {activeAgents.map((agentId) => {
              const agent = AGENT_CONFIG[agentId]
              const Icon = agent.icon
              return (
                <div
                  key={agentId}
                  className={`${agent.bgColor} ${agent.color} p-1.5 rounded-lg`}
                  title={agent.name}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
              )
            })}
            {activeAgents.length > 0 && (
              <span className="text-xs text-gray-400 ml-1">
                {activeAgents.length} agente{activeAgents.length > 1 ? 's' : ''} activo{activeAgents.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-lg">
                    <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-md">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString('es-CL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center ml-2 flex-shrink-0">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                </div>
              )
            }

            if (msg.role === 'system') {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
                    {msg.content}
                  </div>
                </div>
              )
            }

            // AVI message
            const agent = msg.agentId ? AGENT_CONFIG[msg.agentId] : AGENT_CONFIG.orchestrator
            const AgentIcon = agent.icon

            return (
              <div key={msg.id} className="flex justify-start">
                <div
                  className={`w-8 h-8 ${agent.bgColor} rounded-full flex items-center justify-center mr-2 flex-shrink-0`}
                >
                  <AgentIcon className={`h-4 w-4 ${agent.color}`} />
                </div>
                <div className="max-w-lg">
                  {/* Agent badge */}
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`text-xs font-medium ${agent.color}`}>{agent.name}</span>
                    {msg.metadata?.agentsInvolved && msg.metadata.agentsInvolved.length > 1 && (
                      <span className="text-xs text-gray-400">
                        +{msg.metadata.agentsInvolved.length - 1} agente
                        {msg.metadata.agentsInvolved.length - 1 > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                    <div className="text-sm text-gray-800">{renderContent(msg.content)}</div>

                    {/* Savings highlight */}
                    {msg.metadata?.savings && (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          Ahorro potencial: ${msg.metadata.savings.toLocaleString('es-CL')}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    {msg.metadata?.actionButtons && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.metadata.actionButtons.map((btn) => (
                          <button
                            key={btn.action}
                            onClick={() => handleActionButton(btn.action)}
                            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 rounded-full border border-gray-200 hover:border-blue-200 transition-colors"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )
          })}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
              </div>
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                <div className="flex items-center space-x-2">
                  <RotateCw className="h-4 w-4 text-blue-500 animate-spin" />
                  <span className="text-sm text-gray-500">AVI está procesando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions (solo si no hay mensajes del usuario) */}
      {messages.length <= 1 && (
        <div className="flex-shrink-0 border-t bg-white">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <p className="text-xs text-gray-400 mb-2">Acciones rápidas:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.message)}
                  className="text-sm px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t bg-white">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage(input)
            }}
            className="flex items-center space-x-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escríbele a AVI... (ej: necesito comprar leche y pan)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2 text-center">
            AVI Mesh Orquestado — Los agentes colaboran para resolver tu solicitud
          </p>
        </div>
      </div>
    </div>
  )
}
