'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  ShoppingCart, Plus, Trash2, Check, X, ArrowLeft,
  ListChecks, AlertCircle, Package, Settings,
  DollarSign, ArrowRight, Sparkles, Users, Flame,
  PartyPopper, Sun, Baby, PawPrint, Briefcase,
  Camera, Loader2, Image as ImageIcon,
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

interface ListTemplate {
  name: string
  icon: any
  color: string
  description: string
  askPeople?: boolean
  items: string[]
}

const LIST_TEMPLATES: ListTemplate[] = [
  {
    name: 'Asado',
    icon: Flame,
    color: 'bg-orange-500',
    description: 'Todo para un asado chileno',
    askPeople: true,
    items: ['Carbon', 'Carne de vacuno', 'Longanizas', 'Choricillos', 'Pan de completo', 'Tomate', 'Lechuga', 'Cebolla', 'Palta', 'Limon', 'Sal', 'Pebre', 'Bebidas', 'Hielo', 'Servilletas', 'Platos desechables'],
  },
  {
    name: 'Cumpleanos',
    icon: PartyPopper,
    color: 'bg-pink-500',
    description: 'Fiesta de cumpleanos',
    askPeople: true,
    items: ['Torta', 'Velitas', 'Bebidas', 'Jugos', 'Papas fritas', 'Ramitas', 'Galletas', 'Sandwich de miga', 'Servilletas', 'Vasos', 'Platos', 'Globos', 'Dulces para pinata'],
  },
  {
    name: 'Desayuno semanal',
    icon: Sun,
    color: 'bg-amber-500',
    description: 'Desayuno para la semana',
    items: ['Leche', 'Pan', 'Huevos', 'Queso', 'Jamon', 'Mantequilla', 'Mermelada', 'Cafe', 'Te', 'Cereal', 'Yogurt', 'Fruta'],
  },
  {
    name: 'Bebe / Guagua',
    icon: Baby,
    color: 'bg-blue-400',
    description: 'Esenciales para bebe',
    items: ['Panales', 'Toallitas humedas', 'Formula o leche', 'Compotas', 'Crema para coceduras', 'Shampoo bebe', 'Jabon bebe', 'Mamadera'],
  },
  {
    name: 'Mascotas',
    icon: PawPrint,
    color: 'bg-emerald-500',
    description: 'Comida y cuidado de mascotas',
    items: ['Alimento perro/gato', 'Snacks mascotas', 'Arena sanitaria', 'Bolsas para desechos', 'Shampoo mascota'],
  },
  {
    name: 'Limpieza',
    icon: Sparkles,
    color: 'bg-cyan-500',
    description: 'Productos de limpieza del hogar',
    items: ['Lavalozas', 'Detergente ropa', 'Suavizante', 'Cloro', 'Limpia pisos', 'Esponja', 'Bolsas de basura', 'Papel higienico', 'Toalla de papel', 'Desinfectante'],
  },
]

export default function ListasPage() {
  const { data: session } = useSession()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeList, setActiveList] = useState<ShoppingList | null>(null)
  const [newListName, setNewListName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templatePeople, setTemplatePeople] = useState<{ template: ListTemplate; count: string } | null>(null)
  const [importingImage, setImportingImage] = useState(false)
  const [importedProducts, setImportedProducts] = useState<Array<{ name: string; quantity: number }> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const createFromTemplate = async (template: ListTemplate, peopleCount?: number) => {
    setCreatingList(true)
    try {
      const name = peopleCount
        ? `${template.name} (${peopleCount} personas)`
        : template.name

      const res = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!data.success) return

      const listId = data.data.id
      const items: ShoppingItem[] = []

      for (const itemName of template.items) {
        const qty = peopleCount && peopleCount > 4
          ? Math.ceil(peopleCount / 4)
          : 1
        try {
          const itemRes = await fetch(`/api/shopping-lists/${listId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: itemName, quantity: qty }),
          })
          const itemData = await itemRes.json()
          if (itemData.success) items.push(itemData.data)
        } catch {}
      }

      const newList = { ...data.data, items }
      setLists((prev) => [newList, ...prev])
      setActiveList(newList)
      setShowTemplates(false)
      setTemplatePeople(null)
    } catch {
      setError('Error al crear lista')
    } finally {
      setCreatingList(false)
    }
  }

  const importFromImage = async (file: File) => {
    setImportingImage(true)
    setImportedProducts(null)
    setError('')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/import-list', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.success && data.data.products.length > 0) {
        setImportedProducts(data.data.products)
      } else {
        setError(data.data?.message || 'No se encontraron productos en la imagen')
      }
    } catch {
      setError('Error al procesar la imagen')
    }
    setImportingImage(false)
  }

  const createListFromImport = async () => {
    if (!importedProducts || importedProducts.length === 0) return
    setCreatingList(true)

    try {
      const res = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Lista importada' }),
      })
      const data = await res.json()
      if (!data.success) return

      const listId = data.data.id
      const items: ShoppingItem[] = []

      for (const p of importedProducts) {
        try {
          const itemRes = await fetch(`/api/shopping-lists/${listId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: p.name, quantity: p.quantity || 1 }),
          })
          const itemData = await itemRes.json()
          if (itemData.success) items.push(itemData.data)
        } catch {}
      }

      const newList = { ...data.data, items }
      setLists((prev) => [newList, ...prev])
      setActiveList(newList)
      setImportedProducts(null)
    } catch {
      setError('Error al crear lista')
    }
    setCreatingList(false)
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

  const syncListItems = (listId: string, updater: (items: ShoppingItem[]) => ShoppingItem[]) => {
    setActiveList((prev) =>
      prev && prev.id === listId ? { ...prev, items: updater(prev.items) } : prev
    )
    setLists((prev) =>
      prev.map((l) => l.id === listId ? { ...l, items: updater(l.items || []) } : l)
    )
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
        syncListItems(activeList.id, (items) => [...items, data.data])
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
      syncListItems(activeList.id, (items) =>
        items.map((i) => i.id === itemId ? { ...i, checked: !checked } : i)
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
      syncListItems(activeList.id, (items) => items.filter((i) => i.id !== itemId))
    } catch {
      setError('Error al eliminar item')
    }
  }

  const getListProducts = (list: ShoppingList): string[] => {
    const items = list.items || []
    return items.filter((i) => !i.checked).map((i) => i.name)
  }

  const buyList = (list: ShoppingList) => {
    const products = getListProducts(list)
    if (products.length === 0) return
    window.location.href = `/cart-assistant?products=${encodeURIComponent(products.join(', '))}`
  }

  const compareList = (list: ShoppingList) => {
    const products = getListProducts(list)
    if (products.length === 0) return
    window.location.href = `/comparar?q=${encodeURIComponent(products.join(', '))}`
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
    <div className="avi-page min-h-screen pb-20">
      {/* Header */}
      <header className="avi-header">
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
            <div className="avi-card p-4">
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
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex-1 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Plantilla
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importingImage}
                  className="flex-1 text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                >
                  {importingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  Desde foto
                </button>
              </div>
              <input
                ref={fileInputRef}
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
            </div>

            {/* Image import preview */}
            {importedProducts && (
              <div className="avi-card p-4 border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-purple-700 flex items-center gap-1">
                    <ImageIcon className="h-4 w-4" />
                    {importedProducts.length} productos encontrados
                  </h3>
                  <button onClick={() => setImportedProducts(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                  {importedProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                      <span className="text-gray-800">{p.name}</span>
                      {p.quantity > 1 && <span className="text-gray-400">x{p.quantity}</span>}
                    </div>
                  ))}
                </div>
                <button
                  onClick={createListFromImport}
                  disabled={creatingList}
                  className="w-full bg-purple-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creatingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Crear lista con estos productos
                </button>
              </div>
            )}

            {importingImage && (
              <div className="avi-card p-4 text-center">
                <Loader2 className="h-6 w-6 text-purple-500 animate-spin mx-auto mb-2" />
                <p className="text-sm text-purple-700 font-medium">AVI analizando imagen...</p>
                <p className="text-xs text-gray-400">Extrayendo productos</p>
              </div>
            )}

            {/* Plantillas */}
            {showTemplates && (
              <div className="avi-card p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Plantillas</h3>
                <div className="space-y-2">
                  {LIST_TEMPLATES.map((tpl) => {
                    const Icon = tpl.icon
                    return (
                      <button
                        key={tpl.name}
                        onClick={() => {
                          if (tpl.askPeople) {
                            setTemplatePeople({ template: tpl, count: '' })
                          } else {
                            createFromTemplate(tpl)
                          }
                        }}
                        disabled={creatingList}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                      >
                        <div className={`w-8 h-8 ${tpl.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{tpl.name}</p>
                          <p className="text-xs text-gray-400">{tpl.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {templatePeople && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      ¿Cuantas personas van al {templatePeople.template.name.toLowerCase()}?
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={templatePeople.count}
                        onChange={(e) => setTemplatePeople({ ...templatePeople, count: e.target.value })}
                        placeholder="Ej: 8"
                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => createFromTemplate(templatePeople.template, parseInt(templatePeople.count) || undefined)}
                        disabled={creatingList}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Crear
                      </button>
                      <button
                        onClick={() => setTemplatePeople(null)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Listas existentes */}
            {lists.length === 0 ? (
              <div className="avi-card p-6 text-center">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No tienes listas aun</p>
                <p className="text-xs text-gray-400 mt-1">Crea una o usa una plantilla</p>
              </div>
            ) : (
              lists.map((list) => {
                const isActive = activeList?.id === list.id
                const uncheckedCount = list.items?.filter((i) => !i.checked).length || 0
                const totalCount = list.items?.length || 0

                return (
                  <div
                    key={list.id}
                    onClick={() => setActiveList(list)}
                    className={`avi-card p-4 cursor-pointer transition-all ${
                      isActive
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{list.name}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {uncheckedCount} pendiente{uncheckedCount !== 1 ? 's' : ''} de {totalCount}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteList(list.id) }}
                        className="p-1 text-gray-300 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Action buttons */}
                    {totalCount > 0 && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); compareList(list) }}
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <DollarSign className="h-3 w-3" />
                          Comparar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); buyList(list) }}
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <ShoppingCart className="h-3 w-3" />
                          Comprar
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Main: items de la lista activa */}
          <div className="md:col-span-2">
            {activeList ? (
              <div className="bg-white rounded-xl border">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="font-semibold text-gray-900">{activeList.name}</h2>
                      <p className="text-xs text-gray-400">
                        {activeList.items.filter((i) => !i.checked).length} pendiente{activeList.items.filter((i) => !i.checked).length !== 1 ? 's' : ''} de {activeList.items.length}
                      </p>
                    </div>
                  </div>
                  {activeList.items.filter((i) => !i.checked).length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => compareList(activeList)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
                      >
                        <DollarSign className="h-4 w-4" />
                        Comparar precios
                      </button>
                      <button
                        onClick={() => buyList(activeList)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 px-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Comprar
                      </button>
                    </div>
                  )}
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
              <div className="avi-card p-12 text-center">
                <ListChecks className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Selecciona o crea una lista</p>
                <p className="text-sm text-gray-400 mt-1">Tus listas de compras apareceran aqui</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fixed bottom action bar for mobile */}
      {activeList && activeList.items.filter((i) => !i.checked).length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 sm:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3">
          <div className="flex gap-2 max-w-lg mx-auto">
            <button
              onClick={() => compareList(activeList)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              <DollarSign className="h-4 w-4" />
              Comparar
            </button>
            <button
              onClick={() => buyList(activeList)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl bg-blue-600 text-white"
            >
              <ShoppingCart className="h-4 w-4" />
              Comprar ({activeList.items.filter((i) => !i.checked).length})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
