'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, ShoppingCart, Plus, Check, X, Edit3, Trash2,
  AlertCircle, Zap, Shield, CreditCard, Loader2,
} from 'lucide-react'

const AVAILABLE_STORES = [
  { id: 'jumbo', name: 'Jumbo', logo: '🟢', color: 'bg-green-500', bgLight: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
  { id: 'lider', name: 'Lider', logo: '🔴', color: 'bg-red-500', bgLight: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
  { id: 'santa-isabel', name: 'Santa Isabel', logo: '🔵', color: 'bg-blue-500', bgLight: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  { id: 'unimarc', name: 'Unimarc', logo: '🟠', color: 'bg-orange-500', bgLight: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  { id: 'tottus', name: 'Tottus', logo: '🟢', color: 'bg-teal-500', bgLight: 'bg-teal-50', textColor: 'text-teal-700', borderColor: 'border-teal-200' },
]

interface StoreAccount {
  id: string
  storeId: string
  storeName: string
  storeSlug: string
  accountEmail: string
  accountName: string | null
  accountPhone: string | null
  loyaltyNumber: string | null
  hasPassword: boolean
  isVerified: boolean
  isAutoCreated: boolean
  status: 'active' | 'pending' | 'suspended'
}

export default function CuentasSupermercadoPage() {
  const { data: session } = useSession()
  const [accounts, setAccounts] = useState<StoreAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    fetch('/api/users/store-accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setAccounts(data.data.map((a: any) => ({
            id: a.id,
            storeId: a.storeSlug || a.storeId,
            storeName: a.storeName,
            storeSlug: a.storeSlug,
            accountEmail: a.accountEmail,
            accountName: a.accountName,
            accountPhone: a.accountPhone,
            loyaltyNumber: a.loyaltyNumber,
            hasPassword: a.hasPassword || false,
            isVerified: a.isVerified,
            isAutoCreated: a.isAutoCreated,
            status: a.status || 'active',
          })))
        }
      })
      .catch(() => setError('Error al cargar cuentas'))
      .finally(() => setLoading(false))
  }, [session])

  const [showLinkForm, setShowLinkForm] = useState(false)
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [editingAccount, setEditingAccount] = useState<string | null>(null)

  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formLoyalty, setFormLoyalty] = useState('')

  const linkedStoreIds = accounts.map((a) => a.storeId)
  const unlinkedStores = AVAILABLE_STORES.filter((s) => !linkedStoreIds.includes(s.id))

  const getStoreInfo = (storeId: string) =>
    AVAILABLE_STORES.find((s) => s.id === storeId)

  const handleLinkAccount = async () => {
    if (!selectedStore || !formEmail) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/users/store-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: selectedStore,
          accountEmail: formEmail,
          accountPassword: formPassword || undefined,
          accountName: formName || undefined,
          accountPhone: formPhone || undefined,
          loyaltyNumber: formLoyalty || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAccounts((prev) => [...prev, data.data])
        resetForm()
      } else {
        setError(data.error?.message || 'Error al vincular')
      }
    } catch {
      setError('Error de conexion')
    }
    setSaving(false)
  }

  const handleAutoCreate = async (storeId: string) => {
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/users/store-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      })
      const data = await res.json()
      if (data.success) {
        setAccounts((prev) => [...prev, data.data])
      } else {
        setError(data.error?.message || 'Error al crear cuenta')
      }
    } catch {
      setError('Error de conexion')
    }
    setSaving(false)
  }

  const handleRemoveAccount = async (accountId: string) => {
    try {
      await fetch(`/api/users/store-accounts/${accountId}`, { method: 'DELETE' })
      setAccounts((prev) => prev.filter((a) => a.id !== accountId))
    } catch {
      setError('Error al eliminar cuenta')
    }
  }

  const handleUpdateAccount = async (accountId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/store-accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountEmail: formEmail || undefined,
          accountName: formName || undefined,
          accountPhone: formPhone || undefined,
          loyaltyNumber: formLoyalty || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAccounts((prev) =>
          prev.map((a) => a.id === accountId ? { ...a, ...data.data } : a)
        )
        setEditingAccount(null)
        resetForm()
      }
    } catch {
      setError('Error al actualizar')
    }
    setSaving(false)
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
    setFormPassword('')
    setFormName('')
    setFormPhone('')
    setFormLoyalty('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="avi-page min-h-screen pb-20">
      <header className="avi-header">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center space-x-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <ShoppingCart className="h-6 w-6 text-blue-600" />
          <h1 className="text-lg font-semibold">Mis Supermercados</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center space-x-2 mb-4">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} className="ml-auto"><X className="h-4 w-4 text-red-400" /></button>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-800 font-medium">
              Vincula tus cuentas para comprar directo desde AVI
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Con tu cuenta vinculada, AVI abre tus productos directamente en el supermercado
              para que los agregues al carrito y pagues. Sin cuenta, puedes comprar como invitado.
            </p>
          </div>
        </div>

        {/* Cuentas Vinculadas */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Vinculadas ({accounts.length})
          </h2>

          {accounts.length === 0 ? (
            <div className="avi-card p-8 text-center">
              <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 font-medium">Sin cuentas vinculadas</p>
              <p className="text-sm text-gray-400 mt-1">Vincula un supermercado abajo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const store = getStoreInfo(account.storeId) || getStoreInfo(account.storeSlug)
                if (!store) return null
                const isEditing = editingAccount === account.id

                return (
                  <div key={account.id} className={`avi-card overflow-hidden border ${store.borderColor}`}>
                    <div className={`${store.bgLight} px-4 py-2.5 flex items-center justify-between`}>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{store.logo}</span>
                        <h3 className={`font-semibold text-sm ${store.textColor}`}>{store.name}</h3>
                        {account.hasPassword ? (
                          <span className="flex items-center text-[10px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                            <Zap className="h-2.5 w-2.5 mr-0.5" /> Carrito auto
                          </span>
                        ) : (
                          <span className="flex items-center text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                            Solo links
                          </span>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex items-center space-x-1">
                          <button onClick={() => startEditing(account)} className="p-1 text-gray-400 hover:text-blue-600">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleRemoveAccount(account.id)} className="p-1 text-gray-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                            placeholder="Email" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                              placeholder="Nombre" className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                            <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                              placeholder="Telefono" className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <input type="text" value={formLoyalty} onChange={(e) => setFormLoyalty(e.target.value)}
                            placeholder="Tarjeta fidelidad (opcional)" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                          <div className="flex space-x-2">
                            <button onClick={() => handleUpdateAccount(account.id)} disabled={saving}
                              className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                            </button>
                            <button onClick={resetForm} className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs">Email</span>
                            <p className="text-gray-800 truncate">{account.accountEmail}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Nombre</span>
                            <p className="text-gray-800">{account.accountName || '—'}</p>
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

        {/* Agregar Supermercado */}
        {unlinkedStores.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Agregar supermercado
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {unlinkedStores.map((store) => (
                <div key={store.id} className={`avi-card p-4 border ${store.borderColor}`}>
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-xl">{store.logo}</span>
                    <h3 className={`font-semibold ${store.textColor}`}>{store.name}</h3>
                  </div>

                  {showLinkForm && selectedStore === store.id ? (
                    <div className="space-y-2">
                      <input type="email" placeholder="Email de tu cuenta" value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      <input type="password" placeholder="Contrasena del supermercado" value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      <p className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Se almacena encriptada (AES-256). AVI la usa para armar tu carrito.
                      </p>
                      <input type="text" placeholder="Nombre (opcional)" value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      <div className="flex space-x-2">
                        <button onClick={handleLinkAccount} disabled={!formEmail || saving}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Vincular</>}
                        </button>
                        <button onClick={resetForm} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => { setShowLinkForm(true); setSelectedStore(store.id) }}
                        className="w-full flex items-center justify-center px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors gap-1"
                      >
                        <Plus className="h-4 w-4" /> Ya tengo cuenta
                      </button>
                      <button
                        onClick={() => handleAutoCreate(store.id)}
                        disabled={saving}
                        className={`w-full flex items-center justify-center px-3 py-2 ${store.color} text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 gap-1`}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4" /> Crear con mis datos</>}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {unlinkedStores.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <p className="text-green-800 font-semibold">Todas las tiendas estan vinculadas</p>
          </div>
        )}
      </main>
    </div>
  )
}
