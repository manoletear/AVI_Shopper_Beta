'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  ShoppingCart, Plus, Trash2, Check, X, ArrowLeft,
  ListChecks, AlertCircle, Package, Settings,
} from 'lucide-react'

interface ShoppingItem {
  id: string
  name: string
  quantity: number
  urgent: boolean
  checked: boolean
}

interface ShoppingList {
  id: string
  name: string
  items: ShoppingItem[]
  createdAt: string
  updatedAt: string
}

export default function ListasPage() {
  const { data: session } = useSession()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeList, setActiveList] = useState<ShoppingList | null>(null)
  const [newListName, setNewListName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [creatingList, setCreatingList] = useState(false)

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch('/api/shopping-lists')
      const data = await res.json()
      if (data.success) {
        setLists(data.data)
        if (data.data.length > 0 && !activeList) {
          setActiveList(data.data[0])
        }
      }
    } catch {
      setError('Error al cargar listas')
    } finally {
      setLoading(false)
    }
  }, [activeList])

  useEffect(() => {
    if (session) fetchLists()
  }, [session, fetchLists])

  const createList = async () => {
    if (!newListName.trim()) return
    setCreatingList(true)
    try {
      const res = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName }),
      })
      const data = await res.json()
      if (data.success) {
        const newList = { ...data.data, items: [] }
        setLists((prev) => [newList, ...prev])
        setActiveList(newList)
        setNewListName('')
      }
    } catch {
      setError('Error al crear lista')
    } finally {
      setCreatingList(false)
    }
  }

  const deleteList = async (listId: string) => {
    try {
      await fetch(`/api/shopping-lists/${listId}`, { method: 'DELETE' })
      setLists((prev) => prev.filter((l) => l.id !== listId))
      if (activeList?.id === listId) {
        setActiveList(lists.length > 1 ? lists.find((l) => l.id !== listId) || null : null)
      }
    } catch {
      setError('Error al eliminar lista')
    }
  }

  const addItem = async () => {
    if (!newItemName.trim() || !activeList) return
    try {
      const res = await fetch(`/api/shopping-lists/${activeList.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName, quantity: 1 }),
      })
      const data = await res.json()
      if (data.success) {
        setActiveList((prev) =>
          prev ? { ...prev, items: [...prev.items, data.data] } : null
        )
        setNewItemName('')
      }
    } catch {
      setError('Error al agregar item')
    }
  }

  const toggleItem = async (itemId: string, checked: boolean) => {
    if (!activeList) return
    try {
      await fetch(`/api/shopping-lists/${activeList.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: !checked }),
      })
      setActiveList((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === itemId ? { ...i, checked: !checked } : i
              ),
            }
          : null
      )
    } catch {
      setError('Error al actualizar item')
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!activeList) return
    try {
      await fetch(`/api/shopping-lists/${activeList.id}/items/${itemId}`, {
        method: 'DELETE',
      })
      setActiveList((prev) =>
        prev
          ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) }
          : null
      )
    } catch {
      setError('Error al eliminar item')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="h-8 w-8 text-blue-600 animate-pulse mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Cargando listas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <ListChecks className="h-6 w-6 text-purple-600" />
            <h1 className="text-lg font-semibold">Mis Listas</h1>
          </div>
          <a href="/configuracion/cuentas" className="text-gray-400 hover:text-gray-600">
            <Settings className="h-5 w-5" />
          </a>
        </div>
      </header>

      {error && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} className="ml-auto"><X className="h-4 w-4 text-red-400" /></button>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Sidebar: lista de listas */}
          <div className="md:col-span-1 space-y-3">
            {/* Crear nueva lista */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Nueva Lista</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createList()}
                  placeholder="Nombre de la lista"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={createList}
                  disabled={creatingList || !newListName.trim()}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Listas existentes */}
            {lists.length === 0 ? (
              <div className="bg-white rounded-xl border p-6 text-center">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No tienes listas aun</p>
              </div>
            ) : (
              lists.map((list) => (
                <div
                  key={list.id}
                  onClick={() => setActiveList(list)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                    activeList?.id === list.id
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm">{list.name}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {list.items?.length || 0} items
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteList(list.id) }}
                      className="p-1 text-gray-300 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Main: items de la lista activa */}
          <div className="md:col-span-2">
            {activeList ? (
              <div className="bg-white rounded-xl border">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-gray-900">{activeList.name}</h2>
                  <p className="text-xs text-gray-400">
                    {activeList.items.filter((i) => i.checked).length}/{activeList.items.length} completados
                  </p>
                </div>

                {/* Agregar item */}
                <div className="p-4 border-b">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addItem()}
                      placeholder="Agregar producto (ej: Leche Colun 1L)"
                      className="flex-1 px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={addItem}
                      disabled={!newItemName.trim()}
                      className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y">
                  {activeList.items.length === 0 ? (
                    <div className="p-8 text-center">
                      <ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Lista vacia</p>
                      <p className="text-xs text-gray-400">Agrega productos arriba</p>
                    </div>
                  ) : (
                    activeList.items.map((item) => (
                      <div
                        key={item.id}
                        className={`px-4 py-3 flex items-center space-x-3 ${
                          item.checked ? 'bg-gray-50' : ''
                        }`}
                      >
                        <button
                          onClick={() => toggleItem(item.id, item.checked)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            item.checked
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 hover:border-blue-500'
                          }`}
                        >
                          {item.checked && <Check className="h-3 w-3 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {item.name}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-gray-400">x{item.quantity}</p>
                          )}
                        </div>
                        {item.urgent && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Urgente</span>
                        )}
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1 text-gray-300 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-12 text-center">
                <ListChecks className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Selecciona o crea una lista</p>
                <p className="text-sm text-gray-400 mt-1">Tus listas de compras apareceran aqui</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
