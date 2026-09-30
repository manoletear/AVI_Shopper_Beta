'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Search, ShoppingCart, Plus, X, Loader2,
  DollarSign, TrendingDown, Heart, AlertTriangle,
  Check, Store, Zap, Trash2, Settings, Shield,
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

export default function CompararPage() {
  const { data: session } = useSession()
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

  const addProduct = () => {
    const trimmed = inputValue.trim()
    if (!trimmed || queries.includes(trimmed)) return
    setQueries((prev) => [...prev, trimmed])
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

  const addMultiple = (text: string) => {
    const items = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    const unique = items.filter((i) => !queries.includes(i))
    setQueries((prev) => [...prev, ...unique])
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
              allResults.push(result)
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

  // Calcular split optimo
  const getSplitRecommendation = (): { splits: SplitRecommendation[]; totalSplit: number; totalSingleBest: number } => {
    const storeItems: Record<string, SplitRecommendation['items']> = {}
    let totalSingleBest = Infinity
    const storeTotals: Record<string, number> = {}

    for (const [, comp] of comparisons) {
      if (!comp.cheapest || comp.loading) continue

      const store = comp.cheapest.store
      if (!storeItems[store]) storeItems[store] = []
      storeItems[store].push({
        query: comp.query,
        name: comp.cheapest.name,
        price: comp.cheapest.price,
      })

      // Acumular por tienda para encontrar mejor single store
      for (const r of comp.results) {
        if (!storeTotals[r.store]) storeTotals[r.store] = 0
        // Solo contar el mas barato de esa tienda para este query
        const storeMin = comp.results
          .filter((x) => x.store === r.store)
          .reduce((min, x) => (x.price < min ? x.price : min), Infinity)
        storeTotals[r.store] = (storeTotals[r.store] || 0)
        // Esto es aproximado — tomamos el primer resultado por tienda
      }
    }

    const splits: SplitRecommendation[] = Object.entries(storeItems).map(([store, items]) => ({
      store,
      items,
      subtotal: items.reduce((s, i) => s + i.price, 0),
    }))

    const totalSplit = splits.reduce((s, sp) => s + sp.subtotal, 0)

    return { splits, totalSplit, totalSingleBest }
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
  const { splits, totalSplit } = showResults ? getSplitRecommendation() : { splits: [], totalSplit: 0 }

  return (
    <div className="min-h-screen bg-gray-50">
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

          <div className="flex space-x-2 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addProduct()
                }}
                placeholder="Escribe un producto (ej: leche, huevos, cafe)"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={addProduct}
              disabled={!inputValue.trim()}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Tambien puedes pegar una lista separada por comas: huevos, queso, jamon, cafe
          </p>

          {/* Quick paste */}
          <div className="flex space-x-2 mb-4">
            <input
              type="text"
              placeholder="Pegar lista completa separada por comas..."
              className="flex-1 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addMultiple((e.target as HTMLInputElement).value)
                  ;(e.target as HTMLInputElement).value = ''
                }
              }}
            />
          </div>

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
                <span>Buscando en Jumbo, Lider, Santa Isabel y Unimarc... ({completedCount}/{queries.length})</span>
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                <span>Comparar en 4 supermercados ({queries.length} producto{queries.length !== 1 ? 's' : ''})</span>
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
            {/* Split Recommendation */}
            {splits.length > 0 && !isComparing && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
                <div className="flex items-center space-x-2 mb-3">
                  <TrendingDown className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">Recomendacion AVI — Compra optima</h3>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {splits.map((split) => (
                    <div key={split.store} className="bg-white rounded-lg border border-green-200 p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <Store className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-sm text-gray-900">{split.store}</span>
                        <span className="text-xs text-gray-400">({split.items.length} items)</span>
                      </div>
                      {split.items.map((item) => (
                        <div key={item.query} className="flex justify-between text-xs text-gray-600 py-0.5">
                          <span className="truncate mr-2">{item.name}</span>
                          <span className="font-medium text-gray-900 flex-shrink-0">{formatCLP(item.price)}</span>
                        </div>
                      ))}
                      <div className="border-t mt-2 pt-1 flex justify-between text-sm font-semibold text-green-700">
                        <span>Subtotal</span>
                        <span>{formatCLP(split.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between bg-green-100 rounded-lg px-4 py-2">
                  <span className="font-semibold text-green-900">Total optimizado</span>
                  <span className="text-xl font-bold text-green-700">{formatCLP(totalSplit)}</span>
                </div>
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
              AVI busca en Jumbo, Lider, Santa Isabel y Unimarc para encontrar los mejores precios
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
