'use client'

import { useState } from 'react'
import { ArrowLeft, ShoppingCart, Plus, Check, X, Edit3, Trash2, AlertCircle, Zap, Shield, CreditCard } from 'lucide-react'

// Supermercados disponibles en Chile
const AVAILABLE_STORES = [
  { id: 'jumbo', name: 'Jumbo', logo: '🛒', color: 'bg-green-500', bgLight: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
  { id: 'lider', name: 'Líder', logo: '🏪', color: 'bg-red-500', bgLight: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
  { id: 'santa-isabel', name: 'Santa Isabel', logo: '🏬', color: 'bg-blue-500', bgLight: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  { id: 'unimarc', name: 'Unimarc', logo: '🏭', color: 'bg-orange-500', bgLight: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
]

interface StoreAccount {
  id: string
  storeId: string
  storeName: string
  accountEmail: string
  accountName: string | null
  accountPhone: string | null
  loyaltyNumber: string | null
  isVerified: boolean
  isAutoCreated: boolean
  status: 'active' | 'pending' | 'suspended'
}

export default function CuentasSupermercadoPage() {
  // Estado simulado de cuentas vinculadas
  const [accounts, setAccounts] = useState<StoreAccount[]>([
    {
      id: '1',
      storeId: 'jumbo',
      storeName: 'Jumbo',
      accountEmail: 'ana.garcia@email.com',
      accountName: 'Ana García',
      accountPhone: '+56 9 1234 5678',
      loyaltyNumber: 'JMB-987654',
      isVerified: true,
      isAutoCreated: false,
      status: 'active',
    },
  ])

  const [showLinkForm, setShowLinkForm] = useState(false)
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [editingAccount, setEditingAccount] = useState<string | null>(null)
  const [isCreatingAuto, setIsCreatingAuto] = useState(false)

  // Form state
  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formLoyalty, setFormLoyalty] = useState('')

  const linkedStoreIds = accounts.map((a) => a.storeId)
  const unlinkedStores = AVAILABLE_STORES.filter((s) => !linkedStoreIds.includes(s.id))

  const getStoreInfo = (storeId: string) =>
    AVAILABLE_STORES.find((s) => s.id === storeId)

  const handleLinkAccount = () => {
    if (!selectedStore || !formEmail) return

    const store = getStoreInfo(selectedStore)
    if (!store) return

    const newAccount: StoreAccount = {
      id: Date.now().toString(),
      storeId: selectedStore,
      storeName: store.name,
      accountEmail: formEmail,
      accountName: formName || null,
      accountPhone: formPhone || null,
      loyaltyNumber: formLoyalty || null,
      isVerified: false,
      isAutoCreated: false,
      status: 'active',
    }

    setAccounts((prev) => [...prev, newAccount])
    resetForm()
  }

  const handleAutoCreate = (storeId: string) => {
    const store = getStoreInfo(storeId)
    if (!store) return

    setIsCreatingAuto(true)

    // Simular creación automática con datos del usuario
    setTimeout(() => {
      const newAccount: StoreAccount = {
        id: Date.now().toString(),
        storeId,
        storeName: store.name,
        accountEmail: 'ana.garcia@email.com',
        accountName: 'Ana García',
        accountPhone: null,
        loyaltyNumber: null,
        isVerified: false,
        isAutoCreated: true,
        status: 'pending',
      }

      setAccounts((prev) => [...prev, newAccount])
      setIsCreatingAuto(false)
    }, 1500)
  }

  const handleUpdateAccount = (accountId: string) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId
          ? {
              ...a,
              accountEmail: formEmail || a.accountEmail,
              accountName: formName || a.accountName,
              accountPhone: formPhone || a.accountPhone,
              loyaltyNumber: formLoyalty || a.loyaltyNumber,
            }
          : a
      )
    )
    setEditingAccount(null)
    resetForm()
  }

  const handleRemoveAccount = (accountId: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
  }

  const startEditing = (account: StoreAccount) => {
    setEditingAccount(account.id)
    setFormEmail(account.accountEmail)
    setFormName(account.accountName || '')
    setFormPhone(account.accountPhone || '')
    setFormLoyalty(account.loyaltyNumber || '')
  }

  const resetForm = () => {
    setShowLinkForm(false)
    setSelectedStore(null)
    setEditingAccount(null)
    setFormEmail('')
    setFormName('')
    setFormPhone('')
    setFormLoyalty('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center space-x-4">
          <a href="/" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-blue-600">AVI</span>
            <span className="text-lg font-semibold">Shopper</span>
          </div>
          <span className="text-gray-400">|</span>
          <h1 className="text-lg font-semibold text-gray-800">Mis Supermercados</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex items-start space-x-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-800 font-medium">
              Vincula tus cuentas de supermercado para comprar directamente desde AVI
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Si no tienes cuenta en un supermercado, AVI puede crear una automáticamente con tus datos.
              Tus credenciales se almacenan de forma segura y encriptada.
            </p>
          </div>
        </div>

        {/* Cuentas Vinculadas */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Cuentas Vinculadas ({accounts.length})
          </h2>

          {accounts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No tienes cuentas vinculadas</p>
              <p className="text-sm text-gray-400 mt-1">
                Vincula o crea una cuenta de supermercado para empezar
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => {
                const store = getStoreInfo(account.storeId)
                if (!store) return null
                const isEditing = editingAccount === account.id

                return (
                  <div
                    key={account.id}
                    className={`bg-white rounded-xl border ${store.borderColor} overflow-hidden`}
                  >
                    {/* Card Header */}
                    <div className={`${store.bgLight} px-5 py-3 flex items-center justify-between`}>
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{store.logo}</span>
                        <div>
                          <h3 className={`font-semibold ${store.textColor}`}>{store.name}</h3>
                          <div className="flex items-center space-x-2 mt-0.5">
                            {account.isVerified ? (
                              <span className="flex items-center text-xs text-green-600">
                                <Check className="h-3 w-3 mr-1" /> Verificada
                              </span>
                            ) : (
                              <span className="flex items-center text-xs text-amber-600">
                                <AlertCircle className="h-3 w-3 mr-1" /> Pendiente de verificación
                              </span>
                            )}
                            {account.isAutoCreated && (
                              <span className="flex items-center text-xs text-purple-600">
                                <Zap className="h-3 w-3 mr-1" /> Auto-creada por AVI
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            account.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : account.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {account.status === 'active'
                            ? 'Activa'
                            : account.status === 'pending'
                            ? 'Pendiente'
                            : 'Suspendida'}
                        </span>
                        {!isEditing && (
                          <>
                            <button
                              onClick={() => startEditing(account)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveAccount(account.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="px-5 py-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Email de la cuenta
                            </label>
                            <input
                              type="email"
                              value={formEmail}
                              onChange={(e) => setFormEmail(e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Nombre
                              </label>
                              <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Teléfono
                              </label>
                              <input
                                type="text"
                                value={formPhone}
                                onChange={(e) => setFormPhone(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              N° Tarjeta de Fidelidad
                            </label>
                            <input
                              type="text"
                              value={formLoyalty}
                              onChange={(e) => setFormLoyalty(e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Opcional"
                            />
                          </div>
                          <div className="flex space-x-2 pt-2">
                            <button
                              onClick={() => handleUpdateAccount(account.id)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                            >
                              Guardar Cambios
                            </button>
                            <button
                              onClick={resetForm}
                              className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs">Email</span>
                            <p className="text-gray-800">{account.accountEmail}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Nombre</span>
                            <p className="text-gray-800">{account.accountName || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Teléfono</span>
                            <p className="text-gray-800">{account.accountPhone || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Tarjeta Fidelidad</span>
                            <p className="text-gray-800">{account.loyaltyNumber || '—'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Supermercados Disponibles (no vinculados) */}
        {unlinkedStores.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Agregar Supermercado
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {unlinkedStores.map((store) => (
                <div
                  key={store.id}
                  className={`bg-white rounded-xl border ${store.borderColor} p-5`}
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <span className="text-3xl">{store.logo}</span>
                    <h3 className={`text-lg font-semibold ${store.textColor}`}>{store.name}</h3>
                  </div>

                  {showLinkForm && selectedStore === store.id ? (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 font-medium">
                        Ingresa los datos de tu cuenta en {store.name}:
                      </p>
                      <input
                        type="email"
                        placeholder="Email de tu cuenta"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Nombre (opcional)"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Teléfono (opcional)"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="N° Tarjeta Fidelidad (opcional)"
                        value={formLoyalty}
                        onChange={(e) => setFormLoyalty(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleLinkAccount}
                          disabled={!formEmail}
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          <Check className="h-4 w-4 mr-1" /> Vincular
                        </button>
                        <button
                          onClick={resetForm}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setShowLinkForm(true)
                          setSelectedStore(store.id)
                        }}
                        className="w-full flex items-center justify-center px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Ya tengo cuenta
                      </button>
                      <button
                        onClick={() => handleAutoCreate(store.id)}
                        disabled={isCreatingAuto}
                        className={`w-full flex items-center justify-center px-4 py-2.5 ${store.color} text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50`}
                      >
                        {isCreatingAuto ? (
                          <>
                            <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Creando cuenta...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" /> Crear cuenta con mis datos
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Todas vinculadas */}
        {unlinkedStores.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <p className="text-green-800 font-semibold">
              Todas las tiendas están vinculadas
            </p>
            <p className="text-sm text-green-600 mt-1">
              AVI puede comparar precios y hacer pedidos en todos los supermercados disponibles.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
