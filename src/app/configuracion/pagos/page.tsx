'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, CreditCard, Plus, Check, X, Trash2,
  Shield, Smartphone, Building2, Wallet,
} from 'lucide-react'

interface PaymentMethod {
  id: string
  type: 'credit' | 'debit' | 'webpay' | 'transfer'
  label: string
  last4?: string
  bank?: string
  isDefault: boolean
}

const PAYMENT_TYPES = [
  { type: 'credit', label: 'Tarjeta de Credito', icon: CreditCard, desc: 'Visa, Mastercard, Amex', color: 'bg-indigo-500' },
  { type: 'debit', label: 'Tarjeta de Debito', icon: CreditCard, desc: 'Redcompra', color: 'bg-teal-500' },
  { type: 'webpay', label: 'Webpay', icon: Smartphone, desc: 'Transbank', color: 'bg-blue-600' },
  { type: 'transfer', label: 'Transferencia', icon: Building2, desc: 'Banco a banco', color: 'bg-gray-600' },
]

export default function PagosPage() {
  const { data: session } = useSession()
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [saved, setSaved] = useState(false)

  const addMethod = () => {
    if (!selectedType) return
    const typeInfo = PAYMENT_TYPES.find((t) => t.type === selectedType)
    const newMethod: PaymentMethod = {
      id: Date.now().toString(),
      type: selectedType as PaymentMethod['type'],
      label: typeInfo?.label || selectedType,
      last4: cardNumber ? cardNumber.slice(-4) : undefined,
      bank: cardName || undefined,
      isDefault: methods.length === 0,
    }
    setMethods((prev) => [...prev, newMethod])
    setShowAdd(false)
    setSelectedType(null)
    setCardNumber('')
    setCardName('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const removeMethod = (id: string) => {
    setMethods((prev) => {
      const filtered = prev.filter((m) => m.id !== id)
      if (filtered.length > 0 && !filtered.some((m) => m.isDefault)) {
        filtered[0].isDefault = true
      }
      return filtered
    })
  }

  const setDefault = (id: string) => {
    setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })))
  }

  return (
    <div className="avi-page min-h-screen pb-20">
      <header className="avi-header">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></a>
          <Wallet className="h-6 w-6 text-indigo-600" />
          <h1 className="text-lg font-semibold">Medios de Pago</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Info */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-indigo-800 font-medium">Pagos seguros</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              AVI usa Flow.cl y Webpay para procesar pagos. Tus datos estan encriptados y nunca se almacenan en nuestros servidores.
            </p>
          </div>
        </div>

        {saved && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
            <Check className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">Metodo de pago guardado</p>
          </div>
        )}

        {/* Saved methods */}
        {methods.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Tus metodos</h2>
            <div className="space-y-2">
              {methods.map((m) => {
                const typeInfo = PAYMENT_TYPES.find((t) => t.type === m.type)
                const Icon = typeInfo?.icon || CreditCard
                return (
                  <div key={m.id} className="avi-card p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 ${typeInfo?.color || 'bg-gray-500'} rounded-xl flex items-center justify-center`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                        {m.isDefault && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">Principal</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {m.last4 ? `**** ${m.last4}` : ''}{m.bank ? ` · ${m.bank}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!m.isDefault && (
                        <button onClick={() => setDefault(m.id)} className="text-xs text-indigo-600 font-medium px-2 py-1 hover:bg-indigo-50 rounded-lg">
                          Usar
                        </button>
                      )}
                      <button onClick={() => removeMethod(m.id)} className="p-1 text-gray-300 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Add method */}
        {showAdd ? (
          <div className="avi-card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Agregar metodo de pago</h3>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {PAYMENT_TYPES.map((pt) => {
                const Icon = pt.icon
                return (
                  <button
                    key={pt.type}
                    onClick={() => setSelectedType(pt.type)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                      selectedType === pt.type
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-8 h-8 ${pt.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{pt.label}</p>
                      <p className="text-[10px] text-gray-400">{pt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedType && (selectedType === 'credit' || selectedType === 'debit') && (
              <div className="space-y-3 mb-4">
                <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                  placeholder="Numero de tarjeta" className="avi-input" maxLength={16} />
                <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)}
                  placeholder="Nombre en la tarjeta" className="avi-input" />
              </div>
            )}

            {selectedType === 'transfer' && (
              <div className="space-y-3 mb-4">
                <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)}
                  placeholder="Nombre del banco" className="avi-input" />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={addMethod} disabled={!selectedType}
                className="flex-1 avi-btn-primary flex items-center justify-center gap-2">
                <Check className="h-4 w-4" /> Guardar
              </button>
              <button onClick={() => { setShowAdd(false); setSelectedType(null) }}
                className="avi-btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors active:scale-[0.98]">
            <Plus className="h-5 w-5" />
            <span className="font-medium">Agregar metodo de pago</span>
          </button>
        )}

        {/* No methods */}
        {methods.length === 0 && !showAdd && (
          <div className="text-center py-4">
            <p className="text-xs text-gray-400">
              Tambien puedes pagar directo en el supermercado sin agregar metodos aqui
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
