'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Search, ShoppingCart, Plus, X, Loader2,
  DollarSign, TrendingDown, Heart, AlertTriangle,
  Check, Store, Zap, Trash2, Settings, Shield, ExternalLink,
  Camera,
} from 'lucide-react'

interface ProductResult {
  name: string
  brand: string
  price: number
  listPrice?: number
  store: string
  url?: string
  imageUrl?: string
  healthScore?: number
  healthLevel?: string
  isUltraProcessed?: boolean
  allergenWarnings?: string[]
  dietWarning?: string
  nutriscoreGrade?: string
  novaGroup?: number
  nutritionWarnings?: string[]
}

interface ComparisonItem {
  query: string
  results: ProductResult[]
  cheapest: ProductResult | null
  loading: boolean
  error?: string
}

interface SplitRecommendation {
  store: string
  items: Array<{ query: string; name: string; price: number }>
  subtotal: number
}

function CompararInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const autoLoadedRef = useRef(false)
  const [inputValue, setInputValue] = useState('')
  const [queries, setQueries] = useState<string[]>([])
  const [comparisons, setComparisons] = useState<Map<string, ComparisonItem>>(new Map())
  const [isComparing, setIsComparing] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Perfil nutricional del usuario
  const [userAllergies, setUserAllergies] = useState<string[]>([])
  const [userDiet, setUserDiet] = useState('')
  const [userGoals, setUserGoals] = useState<string[]>([])

  // Mapa de alergenos → patrones en nombres de productos
  const ALLERGEN_PATTERNS: Record<string, RegExp> = {
    gluten: /pan|fideos|galleta|harina|trigo|avena|cebada|centeno|pasta|marraqueta|molde|tortilla/i,
    lactosa: /leche|queso|yogurt|mantequilla|crema|helado|manjar/i,
    frutos_secos: /nuez|almendra|maní|mani|avellana|pistacho|castaña/i,
    mariscos: /camarón|camaron|langostino|jaiba|cholga|chorito|almeja|ostra/i,
    huevo: /huevo|mayonesa/i,
    soya: /soya|soja|tofu|edamame/i,
  }

  // Dietas → productos que no deberian consumir
  const DIET_RESTRICTIONS: Record<string, RegExp> = {
    vegetarian: /jamon|jamón|carne|pollo|cerdo|res|pavo|salchicha|vienesa|tocino|chorizo/i,
    vegan: /jamon|jamón|carne|pollo|cerdo|pavo|leche|queso|yogurt|mantequilla|huevo|miel|mayonesa/i,
    keto: /harina|pan |azucar|azúcar|fideos|arroz|papa|galleta/i,
    diabetic: /azucar|azúcar|coca.cola|bebida|jugo|néctar|nectar|galleta|chocolate|helado/i,
    celiac: /pan|fideos|galleta|harina|trigo|avena|cebada|centeno|pasta|marraqueta|tortilla/i,
  }

  // Cargar preferencias del usuario
  useEffect(() => {
    if (!session) return
    fetch('/api/users/preferences')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setUserAllergies(data.data.allergies || [])
          setUserDiet(data.data.dietType || '')
          if (data.data.favorites && Array.isArray(data.data.favorites)) {
            const meta = data.data.favorites.find((f: string) => f.startsWith('meta:'))
            if (meta) {
              try {
                const parsed = JSON.parse(meta.replace('meta:', ''))
                setUserGoals(parsed.healthGoals || [])
              } catch {}
            }
          }
        }
      })
      .catch(() => {})
  }, [session])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !autoLoadedRef.current) {
      autoLoadedRef.current = true
      const items = q.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
      setQueries(items)
    }
  }, [searchParams])

  useEffect(() => {
    if (autoLoadedRef.current && queries.length > 0 && !isComparing && comparisons.size === 0) {
      compareAll()
    }
  }, [queries])

  // Verificar alergenos y restricciones de dieta en un producto
  const checkProduct = (product: ProductResult): ProductResult => {
    const warnings: string[] = []
    let dietWarning = ''

    // Check alergenos
    for (const allergen of userAllergies) {
      const pattern = ALLERGEN_PATTERNS[allergen]
      if (pattern && pattern.test(product.name)) {
        const labels: Record<string, string> = {
          gluten: 'Gluten', lactosa: 'Lactosa', frutos_secos: 'Frutos secos',
          mariscos: 'Mariscos', huevo: 'Huevo', soya: 'Soya',
        }
        warnings.push(labels[allergen] || allergen)
      }
    }

    // Check dieta
    if (userDiet) {
      const pattern = DIET_RESTRICTIONS[userDiet]
      if (pattern && pattern.test(product.name)) {
        const labels: Record<string, string> = {
          vegetarian: 'No vegetariano', vegan: 'No vegano',
          keto: 'Alto en carbohidratos', diabetic: 'Alto en azucar',
          celiac: 'Contiene gluten',
        }
        dietWarning = labels[userDiet] || `No apto para ${userDiet}`
      }
    }

    return { ...product, allergenWarnings: warnings, dietWarning }
  }

  const [pasteNotice, setPasteNotice] = useState('')

  const [importingImage, setImportingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const importFromImage = async (file: File) => {
    setImportingImage(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/import-list', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success && data.data.products.length > 0) {
        const names = data.data.products.map((p: any) => p.name)
        const unique = names.filter((n: string) => !queries.includes(n))
        setQueries((prev) => [...prev, ...unique])
        setPasteNotice(`${unique.length} productos detectados en la imagen`)
        setTimeout(() => setPasteNotice(''), 4000)
      } else {
        setPasteNotice('No se encontraron productos en la imagen')
        setTimeout(() => setPasteNotice(''), 3000)
      }
    } catch {
      setPasteNotice('Error al procesar la imagen')
      setTimeout(() => setPasteNotice(''), 3000)
    }
    setImportingImage(false)
  }

  const addProducts = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const items = trimmed.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean)

    if (items.length > 1) {
      const unique = items.filter((i) => !queries.includes(i))
      if (unique.length > 0) {
        setQueries((prev) => [...prev, ...unique])
        setPasteNotice(`${unique.length} producto${unique.length > 1 ? 's' : ''} agregado${unique.length > 1 ? 's' : ''}`)
        setTimeout(() => setPasteNotice(''), 3000)
      }
    } else if (items.length === 1 && !queries.includes(items[0])) {
      setQueries((prev) => [...prev, items[0]])
    }

    setInputValue('')
  }

  const removeProduct = (query: string) => {
    setQueries((prev) => prev.filter((q) => q !== query))
    setComparisons((prev) => {
      const next = new Map(prev)
      next.delete(query)
      return next
    })
  }

  const compareAll = async () => {
    if (queries.length === 0) return
    setIsComparing(true)
    setShowResults(true)

    const newComparisons = new Map<string, ComparisonItem>()
    queries.forEach((q) => {
      newComparisons.set(q, { query: q, results: [], cheapest: null, loading: true })
    })
    setComparisons(new Map(newComparisons))

    for (const query of queries) {
      try {
        const res = await fetch(`/api/prices?q=${encodeURIComponent(query)}&analyze=true`)
        const data = await res.json()

        if (data.success) {
          const allResults: ProductResult[] = []
          const byStore = data.data.byStore || {}

          // Palabras clave de la busqueda para filtrar relevancia
          const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)

          for (const [store, products] of Object.entries(byStore)) {
            for (const p of (products as any[])) {
              const result = checkProduct({
                name: p.name,
                brand: p.brand || '',
                price: p.price,
                listPrice: p.listPrice,
                store: store.charAt(0).toUpperCase() + store.slice(1),
                url: p.url,
                imageUrl: p.imageUrl,
              })

              // Filtro de relevancia: el producto debe contener al menos
              // una palabra clave de la busqueda (>2 chars) en su nombre
              const productNameLower = result.name.toLowerCase()
              const isRelevant = queryWords.some(w => productNameLower.includes(w))
              if (isRelevant) {
                allResults.push(result)
              }
            }
          }

          // Si el filtro elimino todo, mostrar todos sin filtro
          if (allResults.length === 0) {
            for (const [store, products] of Object.entries(byStore)) {
              for (const p of (products as any[])) {
                allResults.push(checkProduct({
                  name: p.name, brand: p.brand || '', price: p.price,
                  listPrice: p.listPrice,
                  store: store.charAt(0).toUpperCase() + store.slice(1),
                  url: p.url, imageUrl: p.imageUrl,
                }))
              }
            }
          }

          // Agregar health analysis si existe
          if (data.data.healthAnalysis) {
            for (const ha of data.data.healthAnalysis) {
              const match = allResults.find((r) => r.name === ha.name && r.store === ha.store)
              if (match) {
                match.healthScore = ha.healthScore
                match.healthLevel = ha.healthLevel
                match.isUltraProcessed = ha.isUltraProcessed
              }
            }
          }

          const cheapest = allResults.length > 0
            ? allResults.reduce((min, p) => (p.price < min.price ? p : min))
            : null

          // Enriquecer con datos nutricionales de Open Food Facts
          if (allResults.length > 0) {
            try {
              const nutritionRes = await fetch('/api/nutrition/lookup?q=' + encodeURIComponent(query))
              const nutritionData = await nutritionRes.json()
              if (nutritionData.success && nutritionData.data.found) {
                const n = nutritionData.data.nutrition
                const badge = nutritionData.data.badge
                for (const r of allResults) {
                  r.nutriscoreGrade = n.nutriscoreGrade
                  r.novaGroup = n.novaGroup
                  r.isUltraProcessed = n.isUltraProcessed
                  r.nutritionWarnings = n.healthWarnings
                }
              }
            } catch {}
          }

          setComparisons((prev) => {
            const next = new Map(prev)
            next.set(query, { query, results: allResults, cheapest, loading: false })
            return next
          })
        } else {
          setComparisons((prev) => {
            const next = new Map(prev)
            next.set(query, { query, results: [], cheapest: null, loading: false, error: data.error?.message })
            return next
          })
        }
      } catch {
        setComparisons((prev) => {
          const next = new Map(prev)
          next.set(query, { query, results: [], cheapest: null, loading: false, error: 'Error de conexion' })
          return next
        })
      }
    }

    setIsComparing(false)
  }

  const DELIVERY_FEES: Record<string, number> = {
    Jumbo: 2990, Lider: 2490, Unimarc: 2790, 'Santa Isabel': 3490, 'Santa-isabel': 3490, Tottus: 2990,
  }

  interface BuyItem { name: string; price: number; url?: string }
  interface BuyOption {
    id: string
    label: string
    description: string
    stores: Array<{ store: string; items: BuyItem[]; subtotal: number; delivery: number }>
    totalProducts: number
    totalDelivery: number
    grandTotal: number
    isCheapest: boolean
  }

  const [checkoutItems, setCheckoutItems] = useState<BuyItem[] | null>(null)
  const [checkoutStore, setCheckoutStore] = useState('')
  const [cartBuilding, setCartBuilding] = useState(false)
  const [cartProgress, setCartProgress] = useState<Array<{ name: string; status: 'pending' | 'adding' | 'done' | 'failed'; url?: string }>>([])
  const [cartResult, setCartResult] = useState<{ success: boolean; cartUrl?: string; added: number; failed: string[] } | null>(null)

  const buildCartAuto = async (items: BuyItem[], storeName: string) => {
    setCartBuilding(true)
    setCartResult(null)
    const storeSlugMap: Record<string, string> = {
      Jumbo: 'jumbo', Lider: 'lider', Unimarc: 'unimarc', 'Santa Isabel': 'santa-isabel', Tottus: 'tottus',
    }
    const slug = storeSlugMap[storeName] || storeName.toLowerCase().split(' + ')[0]

    setCartProgress(items.map((i) => ({ name: i.name, status: 'pending', url: i.url })))

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeSlug: slug,
          items: items.map((i) => ({ productName: i.name, quantity: 1, productUrl: i.url })),
        }),
      })
      const data = await res.json()

      if (data.success && data.data.mode === 'auto') {
        setCartProgress(items.map((i) => ({ name: i.name, status: 'done', url: i.url })))
        setCartResult({ success: true, cartUrl: data.data.cartUrl, added: data.data.itemsAdded, failed: data.data.itemsFailed || [] })
      } else {
        setCartProgress(items.map((i) => ({ name: i.name, status: 'pending', url: i.url })))
        setCartResult({ success: false, added: 0, failed: [] })
      }
    } catch {
      setCartProgress(items.map((i) => ({ name: i.name, status: 'pending', url: i.url })))
      setCartResult({ success: false, added: 0, failed: [] })
    }

    setCartBuilding(false)
  }

  // Calcular opciones de compra con despacho
  const getBuyOptions = (): BuyOption[] => {
    if (isComparing) return []

    const completed = Array.from(comparisons.values()).filter((c) => !c.loading && c.results.length > 0)
    if (completed.length === 0) return []

    const storeTotals: Record<string, { items: BuyItem[]; total: number }> = {}
    for (const comp of completed) {
      for (const r of comp.results) {
        if (!storeTotals[r.store]) storeTotals[r.store] = { items: [], total: 0 }
        const existing = storeTotals[r.store].items.find((i) => i.name === comp.query)
        if (!existing) {
          const cheapestInStore = comp.results.filter((x) => x.store === r.store).reduce((min, x) => x.price < min.price ? x : min)
          storeTotals[r.store].items.push({ name: comp.query, price: cheapestInStore.price, url: cheapestInStore.url })
          storeTotals[r.store].total += cheapestInStore.price
        }
      }
    }

    // Solo tiendas que tienen TODOS los productos
    const fullStores = Object.entries(storeTotals)
      .filter(([, d]) => d.items.length === completed.length)
      .map(([store, d]) => ({
        store,
        items: d.items,
        subtotal: d.total,
        delivery: DELIVERY_FEES[store] || 2990,
        grandTotal: d.total + (DELIVERY_FEES[store] || 2990),
      }))
      .sort((a, b) => a.grandTotal - b.grandTotal)

    const singleBestOptions: BuyOption[] = fullStores.slice(0, 2).map((s, i) => ({
      id: `single-${i}`,
      label: `Todo en ${s.store}`,
      description: `${completed.length} productos + 1 despacho`,
      stores: [{ store: s.store, items: s.items, subtotal: s.subtotal, delivery: s.delivery }],
      totalProducts: s.subtotal,
      totalDelivery: s.delivery,
      grandTotal: s.grandTotal,
      isCheapest: false,
    }))

    const splitStores: Record<string, BuyItem[]> = {}
    for (const comp of completed) {
      if (!comp.cheapest) continue
      const store = comp.cheapest.store
      if (!splitStores[store]) splitStores[store] = []
      splitStores[store].push({ name: comp.query, price: comp.cheapest.price, url: comp.cheapest.url })
    }

    const splitStoreList = Object.entries(splitStores).map(([store, items]) => ({
      store,
      items,
      subtotal: items.reduce((s, i) => s + i.price, 0),
      delivery: DELIVERY_FEES[store] || 2990,
    }))
    const splitTotalProducts = splitStoreList.reduce((s, st) => s + st.subtotal, 0)
    const splitTotalDelivery = splitStoreList.reduce((s, st) => s + st.delivery, 0)
    const splitGrandTotal = splitTotalProducts + splitTotalDelivery

    const splitOption: BuyOption = {
      id: 'split',
      label: `Split en ${splitStoreList.length} tiendas`,
      description: `Cada producto donde es mas barato + ${splitStoreList.length} despacho${splitStoreList.length > 1 ? 's' : ''}`,
      stores: splitStoreList,
      totalProducts: splitTotalProducts,
      totalDelivery: splitTotalDelivery,
      grandTotal: splitGrandTotal,
      isCheapest: false,
    }

    // Juntar todas las opciones y marcar la mas barata
    const allOptions = [...singleBestOptions, splitOption].filter((o) => o.stores.length > 0)
    const cheapestTotal = Math.min(...allOptions.map((o) => o.grandTotal))
    for (const opt of allOptions) {
      opt.isCheapest = opt.grandTotal === cheapestTotal
    }

    // Ordenar: mas barata primero
    return allOptions.sort((a, b) => a.grandTotal - b.grandTotal)
  }

  const formatCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)

  const getHealthColor = (score?: number) => {
    if (!score) return 'text-gray-400'
    if (score >= 75) return 'text-green-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  const completedCount = Array.from(comparisons.values()).filter((c) => !c.loading).length

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <DollarSign className="h-6 w-6 text-green-600" />
            <h1 className="text-lg font-semibold">Comparar Precios</h1>
          </div>
          <a href="/configuracion/cuentas" className="text-gray-400 hover:text-gray-600">
            <Settings className="h-5 w-5" />
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Input Section */}
        <div className="bg-white rounded-xl border p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">¿Que necesitas comprar?</h2>

          <div className="flex space-x-2 mb-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addProducts(inputValue)
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text')
                  if (pasted.includes('\n') || pasted.includes('\r') || pasted.includes(',')) {
                    e.preventDefault()
                    addProducts(pasted)
                  }
                }}
                placeholder="Escribe o pega tu lista de productos"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => addProducts(inputValue)}
              disabled={!inputValue.trim()}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">
              Pega una lista o sube una foto — AVI detecta cada producto
            </p>
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={importingImage}
              className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              {importingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              Desde foto
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
          </div>

          {pasteNotice && (
            <div className="flex items-center gap-2 mb-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <Check className="h-4 w-4" />
              {pasteNotice}
            </div>
          )}

          {/* Product chips */}
          {queries.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {queries.map((q) => (
                <span
                  key={q}
                  className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 text-sm px-3 py-1.5 rounded-full border border-blue-200"
                >
                  <ShoppingCart className="h-3 w-3" />
                  <span>{q}</span>
                  <button onClick={() => removeProduct(q)} className="hover:text-red-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Compare button */}
          <button
            onClick={compareAll}
            disabled={queries.length === 0 || isComparing}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
          >
            {isComparing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Buscando en Jumbo, Lider, Santa Isabel, Unimarc y Tottus... ({completedCount}/{queries.length})</span>
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                <span>Comparar en 5 supermercados ({queries.length} producto{queries.length !== 1 ? 's' : ''})</span>
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {showResults && (
          <>
            {/* User profile active banner */}
            {(userAllergies.length > 0 || userDiet) && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center space-x-2">
                <Shield className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                <p className="text-xs text-indigo-700">
                  <span className="font-medium">Perfil activo: </span>
                  {userDiet && <span className="capitalize">{userDiet}</span>}
                  {userDiet && userAllergies.length > 0 && ' · '}
                  {userAllergies.length > 0 && `Alergias: ${userAllergies.join(', ')}`}
                  {' — '}
                  <a href="/perfil" className="underline">editar</a>
                </p>
              </div>
            )}
            {/* Buy Options */}
            {!isComparing && getBuyOptions().length > 0 && (
              <div className="space-y-3 mb-6">
                <div className="flex items-center space-x-2">
                  <Store className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Opciones de compra</h3>
                </div>

                {getBuyOptions().map((opt) => (
                  <div key={opt.id} className={`rounded-2xl border-2 p-4 transition-all ${
                    opt.isCheapest
                      ? 'border-emerald-400 bg-emerald-50/50 shadow-sm'
                      : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{opt.label}</span>
                          {opt.isCheapest && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Mas barato</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold ${opt.isCheapest ? 'text-emerald-700' : 'text-gray-900'}`}>
                          {formatCLP(opt.grandTotal)}
                        </div>
                      </div>
                    </div>

                    {/* Store breakdown */}
                    <div className="space-y-2 mb-3">
                      {opt.stores.map((st) => (
                        <div key={st.store} className="bg-white/70 rounded-lg p-2.5 border border-gray-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-gray-800">{st.store}</span>
                            <span className="text-xs text-gray-400">{st.items.length} producto{st.items.length > 1 ? 's' : ''}</span>
                          </div>
                          {st.items.map((item, ii) => (
                            <div key={ii} className="flex justify-between text-xs text-gray-600 py-0.5">
                              <span className="truncate mr-2">{item.name}</span>
                              <span className="font-medium text-gray-800 flex-shrink-0">{formatCLP(item.price)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs text-gray-400 mt-1 pt-1 border-t border-gray-100">
                            <span>Despacho</span>
                            <span>{formatCLP(st.delivery)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total breakdown */}
                    <div className="flex justify-between text-xs text-gray-500 mb-3">
                      <span>Productos: {formatCLP(opt.totalProducts)} + Despacho{opt.stores.length > 1 ? 's' : ''}: {formatCLP(opt.totalDelivery)}</span>
                    </div>

                    {/* BUY BUTTON */}
                    <button
                      onClick={() => {
                        const allItems: BuyItem[] = []
                        for (const st of opt.stores) {
                          for (const item of st.items) {
                            allItems.push(item)
                          }
                        }
                        const storeName = opt.stores.map((s) => s.store).join(' + ')
                        setCheckoutItems(allItems)
                        setCheckoutStore(storeName)
                        buildCartAuto(allItems, opt.stores[0].store)
                      }}
                      className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                        opt.isCheapest
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Comprar en {opt.stores.map((s) => s.store).join(' + ')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Per-product comparison */}
            <div className="space-y-4">
              {queries.map((query) => {
                const comp = comparisons.get(query)
                if (!comp) return null

                return (
                  <div key={query} className="bg-white rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ShoppingCart className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-900">{query}</span>
                      </div>
                      {comp.loading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      {comp.cheapest && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Mejor: {comp.cheapest.store} {formatCLP(comp.cheapest.price)}
                        </span>
                      )}
                    </div>

                    {comp.error && (
                      <div className="px-4 py-3 text-sm text-red-600 flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{comp.error}</span>
                      </div>
                    )}

                    {comp.results.length > 0 && (
                      <div className="divide-y">
                        {comp.results.slice(0, 6).map((r, i) => {
                          const isCheapest = comp.cheapest && r.price === comp.cheapest.price && r.store === comp.cheapest.store
                          return (
                            <div
                              key={`${r.store}-${i}`}
                              className={`px-4 py-3 flex items-center space-x-3 ${isCheapest ? 'bg-green-50' : ''}`}
                            >
                              {isCheapest && <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                              {!isCheapest && <div className="w-4" />}

                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 truncate">{r.name}</p>
                                <div className="flex items-center space-x-2 mt-0.5">
                                  <span className="text-xs text-gray-400">{r.store}</span>
                                  {r.brand && <span className="text-xs text-gray-400">· {r.brand}</span>}
                                  {r.healthScore !== undefined && (
                                    <span className={`text-xs flex items-center space-x-0.5 ${getHealthColor(r.healthScore)}`}>
                                      <Heart className="h-3 w-3" />
                                      <span>{r.healthScore}/100</span>
                                    </span>
                                  )}
                                  {r.nutriscoreGrade && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                      r.nutriscoreGrade === 'a' ? 'bg-green-100 text-green-700' :
                                      r.nutriscoreGrade === 'b' ? 'bg-lime-100 text-lime-700' :
                                      r.nutriscoreGrade === 'c' ? 'bg-amber-100 text-amber-700' :
                                      r.nutriscoreGrade === 'd' ? 'bg-orange-100 text-orange-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      NS:{r.nutriscoreGrade.toUpperCase()}
                                    </span>
                                  )}
                                  {r.novaGroup && r.novaGroup >= 3 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      r.novaGroup === 4 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                    }`}>
                                      NOVA {r.novaGroup}
                                    </span>
                                  )}
                                  {r.isUltraProcessed && !r.novaGroup && (
                                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Ultra-proc</span>
                                  )}
                                  {r.dietWarning && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{r.dietWarning}</span>
                                  )}
                                </div>
                                {r.allergenWarnings && r.allergenWarnings.length > 0 && (
                                  <div className="flex items-center space-x-1 mt-1">
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                    <span className="text-xs text-red-600 font-medium">
                                      Alergeno: {r.allergenWarnings.join(', ')}
                                    </span>
                                  </div>
                                )}
                                {r.nutritionWarnings && r.nutritionWarnings.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {r.nutritionWarnings.map((w, wi) => (
                                      <span key={wi} className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                                        {w}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="text-right flex-shrink-0">
                                <p className={`text-sm font-semibold ${isCheapest ? 'text-green-700' : 'text-gray-900'}`}>
                                  {formatCLP(r.price)}
                                </p>
                                {r.listPrice && r.listPrice > r.price && (
                                  <p className="text-xs text-gray-400 line-through">{formatCLP(r.listPrice)}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!comp.loading && comp.results.length === 0 && !comp.error && (
                      <div className="px-4 py-4 text-center text-sm text-gray-400">
                        No se encontraron resultados
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Empty state */}
        {!showResults && queries.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Agrega productos para comparar</p>
            <p className="text-sm text-gray-400 mt-1">
              AVI busca en Jumbo, Lider, Santa Isabel, Unimarc y Tottus para encontrar los mejores precios
            </p>
          </div>
        )}
      </main>

      {/* Checkout panel — AVI arma el carrito */}
      {checkoutItems && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center overflow-hidden">
                  <img src="/avi-icon.svg" alt="" className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">AVI armando tu carrito</h3>
                  <p className="text-xs text-gray-500">{checkoutStore} · {checkoutItems.length} productos</p>
                </div>
              </div>
              <button onClick={() => { setCheckoutItems(null); setCartResult(null); setCartProgress([]) }} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Progress */}
            {cartBuilding && (
              <div className="p-4 bg-blue-50 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  <p className="text-sm text-blue-800 font-medium">
                    AVI esta agregando productos al carrito de {checkoutStore}...
                  </p>
                </div>
              </div>
            )}

            {/* Result: carrito armado */}
            {cartResult?.success && (
              <div className="p-4 bg-green-50 border-b flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-800 font-medium">
                    Carrito listo — {cartResult.added} productos agregados
                  </p>
                </div>
                {cartResult.cartUrl && (
                  <a
                    href={cartResult.cartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Ir a pagar en {checkoutStore}
                  </a>
                )}
              </div>
            )}

            {/* Fallback: open store directly */}
            {cartResult && !cartResult.success && !cartBuilding && (
              <div className="p-4 bg-indigo-50 border-b flex-shrink-0">
                <p className="text-sm text-indigo-800 font-medium mb-1">
                  Toca cada producto para abrirlo en {checkoutStore}
                </p>
                <p className="text-xs text-indigo-600">
                  Buscalo, agregalo al carrito y vuelve por el siguiente
                </p>
                <a
                  href="/configuracion/cuentas"
                  className="text-[10px] text-indigo-400 mt-1 inline-block hover:text-indigo-600"
                >
                  Vincula tu cuenta para que AVI lo haga automaticamente
                </a>
              </div>
            )}

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(cartProgress.length > 0 ? cartProgress : checkoutItems.map((i) => ({ name: i.name, status: 'pending' as const, url: i.url }))).map((item, idx) => {
                const SEARCH_URLS: Record<string, (q: string) => string> = {
                  Jumbo: (q) => `https://www.jumbo.cl/search?ft=${encodeURIComponent(q)}`,
                  Lider: (q) => `https://super.lider.cl/search?q=${encodeURIComponent(q)}`,
                  Unimarc: (q) => `https://www.unimarc.cl/buscar?q=${encodeURIComponent(q)}`,
                  'Santa Isabel': (q) => `https://www.santaisabel.cl/buscar?ft=${encodeURIComponent(q)}`,
                  Tottus: (q) => `https://www.tottus.cl/search?Ntt=${encodeURIComponent(q)}`,
                }
                const storePrimary = checkoutStore.split(' + ')[0]
                const productUrl = item.url || SEARCH_URLS[storePrimary]?.(item.name) || `https://www.jumbo.cl/search?ft=${encodeURIComponent(item.name)}`

                return (
                  <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border ${
                    item.status === 'done' ? 'bg-green-50 border-green-200' :
                    item.status === 'adding' ? 'bg-blue-50 border-blue-200' :
                    item.status === 'failed' ? 'bg-red-50 border-red-200' :
                    'bg-white border-gray-200'
                  }`}>
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {item.status === 'done' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : item.status === 'adding' ? (
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      ) : item.status === 'failed' ? (
                        <X className="h-4 w-4 text-red-500" />
                      ) : (
                        <span className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-400">
                          {idx + 1}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${item.status === 'done' ? 'text-green-700' : 'text-gray-900'}`}>
                        {item.name}
                      </p>
                    </div>
                    {/* Show link for manual fallback */}
                    {(cartResult && !cartResult.success && item.status !== 'done') && (
                      <a
                        href={productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex-shrink-0"
                      >
                        Abrir
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t flex-shrink-0">
              <p className="text-center text-xs text-gray-400">
                Total estimado: {formatCLP(checkoutItems.reduce((s, i) => s + i.price, 0))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CompararPage() {
  return (
    <Suspense>
      <CompararInner />
    </Suspense>
  )
}
