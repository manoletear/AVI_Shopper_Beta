'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, ShoppingCart, Users, Check, DollarSign, X, Edit3, Clock, MapPin, Brain, Smartphone, AlertCircle, Star, Zap } from 'lucide-react'

// Base de datos simulada realista con 80+ productos chilenos
const PRODUCT_DATABASE = [
  // Lácteos
  { id: 1, name: 'Leche Entera Soprole 1L', category: 'lacteos', brand: 'Soprole', basePrice: 1250, nutrition: { calories: 150, protein: 8, carbs: 12 } },
  { id: 2, name: 'Leche Descremada Colun 1L', category: 'lacteos', brand: 'Colun', basePrice: 1180, nutrition: { calories: 90, protein: 8, carbs: 12 } },
  { id: 3, name: 'Yogurt Natural Soprole 1kg', category: 'lacteos', brand: 'Soprole', basePrice: 2890, nutrition: { calories: 120, protein: 10, carbs: 15 } },
  { id: 4, name: 'Queso Gauda Colun 200g', category: 'lacteos', brand: 'Colun', basePrice: 3450, nutrition: { calories: 350, protein: 25, carbs: 2 } },
  { id: 5, name: 'Mantequilla Surlat 250g', category: 'lacteos', brand: 'Surlat', basePrice: 2150, nutrition: { calories: 750, protein: 1, carbs: 1 } },
  
  // Panadería
  { id: 6, name: 'Pan de Molde Ideal 500g', category: 'panaderia', brand: 'Ideal', basePrice: 2650, nutrition: { calories: 250, protein: 8, carbs: 50 } },
  { id: 7, name: 'Pan Integral Bimbo 680g', category: 'panaderia', brand: 'Bimbo', basePrice: 2890, nutrition: { calories: 240, protein: 9, carbs: 45 } },
  { id: 8, name: 'Marraquetas Pre-cocidas 6un', category: 'panaderia', brand: 'Artesanal', basePrice: 1650, nutrition: { calories: 180, protein: 6, carbs: 35 } },
  
  // Frutas y Verduras
  { id: 9, name: 'Manzanas Red Delicious 1kg', category: 'frutas', brand: 'Nacional', basePrice: 1890, nutrition: { calories: 52, protein: 0, carbs: 14 } },
  { id: 10, name: 'Plátanos 1kg', category: 'frutas', brand: 'Ecuatoriano', basePrice: 1450, nutrition: { calories: 89, protein: 1, carbs: 23 } },
  { id: 11, name: 'Paltas Hass 1kg', category: 'frutas', brand: 'Nacional', basePrice: 3890, nutrition: { calories: 160, protein: 2, carbs: 9 } },
  { id: 12, name: 'Tomates 1kg', category: 'verduras', brand: 'Nacional', basePrice: 1650, nutrition: { calories: 18, protein: 1, carbs: 4 } },
  { id: 13, name: 'Cebollas 1kg', category: 'verduras', brand: 'Nacional', basePrice: 890, nutrition: { calories: 40, protein: 1, carbs: 9 } },
  { id: 14, name: 'Papas 2kg', category: 'verduras', brand: 'Nacional', basePrice: 1850, nutrition: { calories: 77, protein: 2, carbs: 17 } },
  
  // Carnes
  { id: 15, name: 'Pechuga de Pollo 1kg', category: 'carnes', brand: 'Ariztía', basePrice: 4890, nutrition: { calories: 165, protein: 31, carbs: 0 } },
  { id: 16, name: 'Carne Molida 80/20 1kg', category: 'carnes', brand: 'PF', basePrice: 6890, nutrition: { calories: 250, protein: 26, carbs: 0 } },
  { id: 17, name: 'Salmón Filete 500g', category: 'carnes', brand: 'Multiexport', basePrice: 8950, nutrition: { calories: 208, protein: 25, carbs: 0 } },
  
  // Despensa
  { id: 18, name: 'Arroz Tucapel Grado 1 1kg', category: 'despensa', brand: 'Tucapel', basePrice: 1380, nutrition: { calories: 130, protein: 3, carbs: 28 } },
  { id: 19, name: 'Fideos Carozzi 400g', category: 'despensa', brand: 'Carozzi', basePrice: 890, nutrition: { calories: 220, protein: 8, carbs: 44 } },
  { id: 20, name: 'Aceite Maravilla Chef 1L', category: 'despensa', brand: 'Chef', basePrice: 2450, nutrition: { calories: 884, protein: 0, carbs: 0 } },
  { id: 21, name: 'Azúcar Iansa 1kg', category: 'despensa', brand: 'Iansa', basePrice: 1250, nutrition: { calories: 387, protein: 0, carbs: 100 } },
  { id: 22, name: 'Sal Lobos 1kg', category: 'despensa', brand: 'Lobos', basePrice: 650, nutrition: { calories: 0, protein: 0, carbs: 0 } },
  
  // Bebidas
  { id: 23, name: 'Coca Cola 2L', category: 'bebidas', brand: 'Coca Cola', basePrice: 2190, nutrition: { calories: 42, protein: 0, carbs: 11 } },
  { id: 24, name: 'Agua Mineral Cachantún 6x500ml', category: 'bebidas', brand: 'Cachantún', basePrice: 2890, nutrition: { calories: 0, protein: 0, carbs: 0 } },
  { id: 25, name: 'Jugo Watts Naranja 1L', category: 'bebidas', brand: 'Watts', basePrice: 1650, nutrition: { calories: 45, protein: 0, carbs: 11 } },
  
  // Limpieza
  { id: 26, name: 'Detergente Omo 3kg', category: 'limpieza', brand: 'Omo', basePrice: 8950, nutrition: null },
  { id: 27, name: 'Papel Higiénico Elite 12 rollos', category: 'limpieza', brand: 'Elite', basePrice: 4890, nutrition: null },
  { id: 28, name: 'Shampoo Head & Shoulders 400ml', category: 'limpieza', brand: 'H&S', basePrice: 3450, nutrition: null }
]

const STORES = [
  { 
    id: 'jumbo', 
    name: 'Jumbo', 
    logo: '🛒', 
    color: 'green',
    priceMultiplier: { min: 0.95, max: 1.1 },
    deliveryFee: 2990,
    minOrder: 15000
  },
  { 
    id: 'lider', 
    name: 'Líder', 
    logo: '🏪', 
    color: 'red',
    priceMultiplier: { min: 0.92, max: 1.05 },
    deliveryFee: 2490,
    minOrder: 12000
  },
  { 
    id: 'santa-isabel', 
    name: 'Santa Isabel', 
    logo: '🏬', 
    color: 'blue',
    priceMultiplier: { min: 0.98, max: 1.15 },
    deliveryFee: 3490,
    minOrder: 18000
  },
  { 
    id: 'unimarc', 
    name: 'Unimarc', 
    logo: '🏭', 
    color: 'orange',
    priceMultiplier: { min: 0.90, max: 1.08 },
    deliveryFee: 2790,
    minOrder: 10000
  }
]

const SUBSTITUTIONS = {
  1: { original: 'Leche Entera Soprole 1L', alternative: 'Leche Entera Colun 1L', reason: 'Mejor precio y misma calidad nutricional', savings: 180 },
  6: { original: 'Pan de Molde Ideal 500g', alternative: 'Pan Integral Bimbo 680g', reason: 'Más fibra y mejor valor nutricional', savings: 240 },
  18: { original: 'Arroz Tucapel Grado 1 1kg', alternative: 'Arroz Grado 2 1kg', reason: 'Calidad similar, 20% menos precio', savings: 280 }
}

const FAMILY_MEMBERS = [
  { name: 'Ana', role: 'Mamá', preferences: ['sin-gluten', 'organico'] },
  { name: 'Carlos', role: 'Papá', preferences: ['proteinas', 'bajo-sodio'] },
  { name: 'Sofía', role: 'Hija', preferences: ['sin-lactosa', 'vegano'] }
]

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [familyList, setFamilyList] = useState([
    { id: 1, quantity: 2, addedBy: 'Ana' },
    { id: 6, quantity: 1, addedBy: 'Carlos' },
    { id: 9, quantity: 1, addedBy: 'Sofía' },
    { id: 18, quantity: 1, addedBy: 'Ana' }
  ])
  const [newItem, setNewItem] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showSubstitutions, setShowSubstitutions] = useState(false)
  const [acceptedSubstitutions, setAcceptedSubstitutions] = useState({})
  const [priceMatrix, setPriceMatrix] = useState({})
  const [selectedStores, setSelectedStores] = useState(['jumbo', 'lider'])
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [whatsappMessages, setWhatsappMessages] = useState([
    { sender: 'avi', message: '¡Hola! Tu lista está lista. ¿Quieres que te ayude a optimizar los precios?', time: '14:32' }
  ])

  // Simular precios dinámicos en tiempo real
  useEffect(() => {
    const generatePriceMatrix = () => {
      const matrix = {}
      PRODUCT_DATABASE.forEach(product => {
        matrix[product.id] = {}
        STORES.forEach(store => {
          const variation = Math.random() * (store.priceMultiplier.max - store.priceMultiplier.min) + store.priceMultiplier.min
          matrix[product.id][store.id] = Math.round(product.basePrice * variation)
        })
      })
      return matrix
    }

    setPriceMatrix(generatePriceMatrix())
    
    // Actualizar precios cada 30 segundos para simular tiempo real
    const interval = setInterval(() => {
      setPriceMatrix(generatePriceMatrix())
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(price)
  }

  const searchProducts = (query) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    
    const results = PRODUCT_DATABASE.filter(product =>
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      product.brand.toLowerCase().includes(query.toLowerCase()) ||
      product.category.includes(query.toLowerCase())
    ).slice(0, 8)
    
    setSearchResults(results)
  }

  const addToList = (productId, addedBy = 'Usuario') => {
    const existingItem = familyList.find(item => item.id === productId)
    if (existingItem) {
      setFamilyList(familyList.map(item =>
        item.id === productId 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setFamilyList([...familyList, { id: productId, quantity: 1, addedBy }])
    }
    setNewItem('')
    setSearchResults([])
  }

  const removeFromList = (productId) => {
    setFamilyList(familyList.filter(item => item.id !== productId))
  }

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromList(productId)
      return
    }
    setFamilyList(familyList.map(item =>
      item.id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    ))
  }

  const getProductById = (id) => PRODUCT_DATABASE.find(p => p.id === id)

  const getBestPrice = (productId) => {
    if (!priceMatrix[productId]) return 0
    return Math.min(...Object.values(priceMatrix[productId]))
  }

  const getBestStore = (productId) => {
    if (!priceMatrix[productId]) return ''
    const prices = priceMatrix[productId]
    return Object.keys(prices).reduce((best, store) =>
      prices[store] < prices[best] ? store : best
    )
  }

  const getTotalSavings = () => {
    return familyList.reduce((total, item) => {
      const product = getProductById(item.id)
      if (!product || !priceMatrix[item.id]) return total
      
      const maxPrice = Math.max(...Object.values(priceMatrix[item.id]))
      const minPrice = getBestPrice(item.id)
      return total + ((maxPrice - minPrice) * item.quantity)
    }, 0)
  }

  const getOptimizedTotal = () => {
    return familyList.reduce((total, item) => {
      return total + (getBestPrice(item.id) * item.quantity)
    }, 0)
  }

  const simulateAIProcessing = async () => {
    setIsLoading(true)
    // Simular procesamiento de IA
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsLoading(false)
  }

  const categories = ['all', ...new Set(PRODUCT_DATABASE.map(p => p.category))]

  const goHome = () => {
    setCurrentStep(1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={goHome}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver al inicio
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-blue-600">AVI Shopper</span>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">Demo Interactiva</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                Precios actualizados en tiempo real
              </div>
              <button 
                onClick={() => setShowWhatsApp(!showWhatsApp)}
                className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600 transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* WhatsApp Simulation */}
      {showWhatsApp && (
        <div className="fixed right-4 top-20 w-80 bg-white rounded-lg shadow-xl border z-50">
          <div className="bg-green-500 text-white p-3 rounded-t-lg">
            <h3 className="font-semibold">AVI Assistant</h3>
            <p className="text-xs opacity-90">WhatsApp Business</p>
          </div>
          <div className="h-60 overflow-y-auto p-3 space-y-2">
            {whatsappMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs p-2 rounded-lg text-sm ${
                  msg.sender === 'user' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {msg.message}
                  <div className={`text-xs mt-1 ${
                    msg.sender === 'user' ? 'text-green-100' : 'text-gray-500'
                  }`}>
                    {msg.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t">
            <input 
              type="text" 
              placeholder="Escribe tu mensaje..."
              className="w-full p-2 border rounded text-sm"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  setWhatsappMessages([...whatsappMessages, {
                    sender: 'user',
                    message: e.target.value,
                    time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                  }])
                  setTimeout(() => {
                    setWhatsappMessages(prev => [...prev, {
                      sender: 'avi',
                      message: '¡Perfecto! He actualizado tu lista. ¿Quieres que busque ofertas especiales?',
                      time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                    }])
                  }, 1000)
                  e.target.value = ''
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step ? <Check className="w-6 h-6" /> : step}
                </div>
                {step < 4 && (
                  <div
                    className={`w-16 h-2 mx-2 rounded transition-all ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {currentStep === 1 && 'Crea tu Lista Familiar Inteligente'}
              {currentStep === 2 && 'Comparación de Precios en Tiempo Real'}
              {currentStep === 3 && 'IA Optimiza tu Compra'}
              {currentStep === 4 && 'Resumen y División por Tiendas'}
            </h1>
            <p className="text-gray-600 text-lg">
              {currentStep === 1 && 'Agrega productos y colabora con tu familia'}
              {currentStep === 2 && 'Ve los mejores precios actualizados automáticamente'}
              {currentStep === 3 && 'Recibe sustituciones inteligentes basadas en nutrición'}
              {currentStep === 4 && 'Optimiza tu compra y maximiza el ahorro'}
            </p>
          </div>
        </div>

        {/* Step 1: Advanced List Creation */}
        {currentStep === 1 && (
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Main List */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Users className="w-6 h-6 text-blue-600" />
                      <h2 className="text-xl font-semibold">Lista Familiar</h2>
                      <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                        {familyList.length} productos
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Total estimado: <span className="font-bold text-green-600">
                        {formatPrice(familyList.reduce((sum, item) => sum + (getProductById(item.id)?.basePrice || 0) * item.quantity, 0))}
                      </span>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="mb-6">
                    <div className="relative">
                      <input
                        type="text"
                        value={newItem}
                        onChange={(e) => {
                          setNewItem(e.target.value)
                          searchProducts(e.target.value)
                        }}
                        placeholder="Buscar productos (ej: leche, pan, manzanas)..."
                        className="w-full p-4 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      />
                      <div className="absolute right-3 top-4">
                        <Plus className="w-6 h-6 text-gray-400" />
                      </div>
                    </div>
                    
                    {/* Category Filter */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            selectedCategory === cat
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {cat === 'all' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="mt-3 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map((product) => (
                          <div
                            key={product.id}
                            onClick={() => addToList(product.id)}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                          >
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.brand} • {product.category}</div>
                            </div>
                            <div className="text-green-600 font-bold">
                              {formatPrice(product.basePrice)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Current List */}
                  <div className="space-y-3">
                    {familyList.map((item) => {
                      const product = getProductById(item.id)
                      if (!product) return null
                      
                      return (
                        <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex-1">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-gray-500">
                              {product.brand} • Agregado por {item.addedBy}
                            </div>
                            {product.nutrition && (
                              <div className="text-xs text-gray-400 mt-1">
                                {product.nutrition.calories} cal • {product.nutrition.protein}g proteína
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 rounded-full bg-white border flex items-center justify-center hover:bg-gray-50"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 rounded-full bg-white border flex items-center justify-center hover:bg-gray-50"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-green-600 font-bold min-w-20 text-right">
                            {formatPrice(product.basePrice * item.quantity)}
                          </div>
                          <button
                            onClick={() => removeFromList(item.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={async () => {
                      await simulateAIProcessing()
                      setCurrentStep(2)
                    }}
                    disabled={familyList.length === 0}
                    className="w-full mt-6 bg-blue-600 text-white py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Analizando productos...
                      </div>
                    ) : (
                      `Comparar Precios (${familyList.length} productos)`
                    )}
                  </button>
                </div>
              </div>

              {/* Family Panel */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Miembros de la Familia
                  </h3>
                  <div className="space-y-3">
                    {FAMILY_MEMBERS.map((member, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600">
                          {member.name[0]}
                        </div>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.role}</div>
                          <div className="text-xs text-gray-400">
                            {member.preferences.join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    Preferencias IA
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span>Prioridad Nutricional</span>
                      <span className="text-green-600 font-medium">Alta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Presupuesto Semanal</span>
                      <span className="text-blue-600 font-medium">$45.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Productos Orgánicos</span>
                      <span className="text-purple-600 font-medium">Preferidos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Real-time Price Comparison */}
        {currentStep === 2 && (
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-3">
                  <DollarSign className="w-6 h-6 text-green-600" />
                  Comparación en Tiempo Real
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Actualizando precios...
                  </div>
                </h2>
                <div className="flex gap-2">
                  {STORES.map(store => (
                    <button
                      key={store.id}
                      onClick={() => {
                        setSelectedStores(prev => 
                          prev.includes(store.id) 
                            ? prev.filter(s => s !== store.id)
                            : [...prev, store.id]
                        )
                      }}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                        selectedStores.includes(store.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {store.logo} {store.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2">
                      <th className="text-left py-4 px-4 font-semibold">Producto</th>
                      <th className="text-center py-4 px-4 font-semibold">Cantidad</th>
                      {STORES.filter(store => selectedStores.includes(store.id)).map((store) => (
                        <th key={store.id} className="text-center py-4 px-4 font-semibold">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-2xl">{store.logo}</span>
                            <div>
                              <div>{store.name}</div>
                              <div className="text-xs text-gray-500 font-normal">
                                Delivery: {formatPrice(store.deliveryFee)}
                              </div>
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="text-center py-4 px-4 font-semibold text-green-600">
                        <div className="flex items-center justify-center gap-2">
                          <Star className="w-4 h-4" />
                          Mejor Precio
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyList.map((item) => {
                      const product = getProductById(item.id)
                      if (!product || !priceMatrix[item.id]) return null
                      
                      const bestPrice = getBestPrice(item.id)
                      const bestStore = getBestStore(item.id)
                      
                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.brand}</div>
                            {product.nutrition && (
                              <div className="text-xs text-gray-400">
                                {product.nutrition.calories} cal/100g
                              </div>
                            )}
                          </td>
                          <td className="text-center py-4 px-4">
                            <span className="bg-gray-100 px-2 py-1 rounded">{item.quantity}</span>
                          </td>
                          {STORES.filter(store => selectedStores.includes(store.id)).map((store) => (
                            <td key={store.id} className="text-center py-4 px-4">
                              <div className={`transition-all duration-300 ${
                                priceMatrix[item.id][store.id] === bestPrice
                                  ? 'bg-green-100 text-green-800 px-3 py-2 rounded-lg font-bold transform scale-105'
                                  : ''
                              }`}>
                                {formatPrice(priceMatrix[item.id][store.id] * item.quantity)}
                                <div className="text-xs text-gray-500">
                                  {formatPrice(priceMatrix[item.id][store.id])} c/u
                                </div>
                                {priceMatrix[item.id][store.id] === bestPrice && (
                                  <div className="text-xs text-green-600 font-medium">
                                    ¡Mejor precio!
                                  </div>
                                )}
                              </div>
                            </td>
                          ))}
                          <td className="text-center py-4 px-4">
                            <div className="bg-green-100 text-green-800 px-3 py-2 rounded-lg font-bold">
                              {formatPrice(bestPrice * item.quantity)}
                              <div className="text-xs text-green-600">
                                en {STORES.find(s => s.id === bestStore)?.name}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 grid md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-blue-800 font-semibold">Precio Total Original</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatPrice(familyList.reduce((sum, item) => {
                      const product = getProductById(item.id)
                      return sum + (product?.basePrice || 0) * item.quantity
                    }, 0))}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-green-800 font-semibold">Precio Optimizado</div>
                  <div className="text-2xl font-bold text-green-900">
                    {formatPrice(getOptimizedTotal())}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-purple-800 font-semibold">Ahorro Total</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {formatPrice(getTotalSavings())}
                  </div>
                  <div className="text-sm text-purple-700">
                    {((getTotalSavings() / (getOptimizedTotal() + getTotalSavings())) * 100).toFixed(1)}% de descuento
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  await simulateAIProcessing()
                  setCurrentStep(3)
                }}
                className="w-full mt-6 bg-blue-600 text-white py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors text-lg flex items-center justify-center gap-2"
              >
                <Brain className="w-5 h-5" />
                Activar IA para Optimización Avanzada
              </button>
            </div>
          </div>
        )}

        {/* Step 3: AI Optimization */}
        {currentStep === 3 && (
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* AI Suggestions */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-3">
                  <Brain className="w-6 h-6 text-purple-600" />
                  Sustituciones Inteligentes
                  <span className="bg-purple-100 text-purple-800 text-sm px-2 py-1 rounded">
                    IA Activa
                  </span>
                </h2>

                <div className="space-y-4">
                  {Object.entries(SUBSTITUTIONS).map(([productId, substitution]) => {
                    const isInList = familyList.some(item => item.id === parseInt(productId))
                    if (!isInList) return null

                    const isAccepted = acceptedSubstitutions[productId]
                    
                    return (
                      <div key={productId} className={`border rounded-lg p-4 transition-all ${
                        isAccepted ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                      }`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isAccepted ? 'bg-green-500' : 'bg-yellow-500'
                          }`}>
                            {isAccepted ? <Check className="w-5 h-5 text-white" /> : <Zap className="w-5 h-5 text-white" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {isAccepted ? 'Sustitución Aplicada' : 'Sustitución Sugerida'}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="line-through">{substitution.original}</span>
                              <span className="mx-2">→</span>
                              <span className="font-medium text-green-600">{substitution.alternative}</span>
                            </div>
                            <div className="text-sm text-gray-500 mt-2">
                              <AlertCircle className="w-4 h-4 inline mr-1" />
                              {substitution.reason}
                            </div>
                            <div className="text-sm font-medium text-green-600 mt-1">
                              Ahorro: {formatPrice(substitution.savings)}
                            </div>
                          </div>
                          {!isAccepted && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setAcceptedSubstitutions({...acceptedSubstitutions, [productId]: true})}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                              >
                                Aceptar
                              </button>
                              <button
                                onClick={() => setAcceptedSubstitutions({...acceptedSubstitutions, [productId]: false})}
                                className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400 transition-colors"
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Análisis Nutricional IA</h3>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div>• Tu lista tiene un balance nutricional del 85%</div>
                    <div>• Sugerencia: Agregar más verduras verdes</div>
                    <div>• Productos orgánicos: 3 de 4 disponibles</div>
                    <div>• Productos sin gluten para Sofía: Verificados ✓</div>
                  </div>
                </div>
              </div>

              {/* Route Optimization */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-red-600" />
                  Optimización de Ruta
                </h2>

                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                        1
                      </div>
                      <div>
                        <div className="font-medium">Líder Las Condes</div>
                        <div className="text-sm text-gray-500">📍 2.3 km • 8 min en auto</div>
                      </div>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>• Leche Descremada Colun 1L (2x)</div>
                      <div>• Arroz Grado 2 1kg</div>
                      <div>• Manzanas Red Delicious 1kg</div>
                    </div>
                    <div className="mt-2 text-sm font-medium text-green-600">
                      Subtotal: {formatPrice(5280)} • Mejor precio en 3 productos
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        2
                      </div>
                      <div>
                        <div className="font-medium">Jumbo Kennedy</div>
                        <div className="text-sm text-gray-500">📍 1.8 km • 6 min en auto</div>
                      </div>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>• Pan Integral Bimbo 680g</div>
                    </div>
                    <div className="mt-2 text-sm font-medium text-green-600">
                      Subtotal: {formatPrice(2650)} • Mejor precio en 1 producto
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Tiempo total estimado:</span>
                    <span className="text-blue-600 font-bold">32 minutos</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Ahorro vs. una sola tienda:</span>
                    <span className="text-green-600 font-bold">{formatPrice(890)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Combustible estimado:</span>
                    <span className="text-gray-600">{formatPrice(1200)}</span>
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  💡 Tip: Puedes agrupar las compras en un solo día para maximizar eficiencia
                </div>
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(4)}
              className="w-full mt-6 bg-purple-600 text-white py-4 rounded-lg font-medium hover:bg-purple-700 transition-colors text-lg flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Finalizar Optimización
            </button>
          </div>
        )}

        {/* Step 4: Final Summary */}
        {currentStep === 4 && (
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Final Cart Summary */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-3">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                  Resumen Final de Compra
                </h2>

                <div className="space-y-4">
                  {STORES.map((store) => {
                    const storeItems = familyList.filter(item => 
                      getBestStore(item.id) === store.id
                    )
                    
                    if (storeItems.length === 0) return null
                    
                    return (
                      <div key={store.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{store.logo}</span>
                          <div>
                            <h3 className="font-semibold">{store.name}</h3>
                            <div className="text-sm text-gray-500">
                              {storeItems.length} productos • Delivery: {formatPrice(store.deliveryFee)}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {storeItems.map((item) => {
                            const product = getProductById(item.id)
                            return (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span>{product?.name} (x{item.quantity})</span>
                                <span className="font-medium">
                                  {formatPrice(getBestPrice(item.id) * item.quantity)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="border-t mt-3 pt-3">
                          <div className="flex justify-between">
                            <span>Subtotal productos:</span>
                            <span className="font-medium">
                              {formatPrice(
                                storeItems.reduce((sum, item) => sum + getBestPrice(item.id) * item.quantity, 0)
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Delivery:</span>
                            <span>{formatPrice(store.deliveryFee)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                            <span>Total {store.name}:</span>
                            <span>
                              {formatPrice(
                                storeItems.reduce((sum, item) => sum + getBestPrice(item.id) * item.quantity, 0) + store.deliveryFee
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Savings Summary */}
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">🎉 ¡Felicitaciones!</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Ahorro total obtenido:</span>
                      <span className="text-2xl font-bold">{formatPrice(getTotalSavings() + 890)}</span>
                    </div>
                    <div className="flex justify-between items-center text-green-100">
                      <span>Ahorro en productos:</span>
                      <span className="font-medium">{formatPrice(getTotalSavings())}</span>
                    </div>
                    <div className="flex justify-between items-center text-green-100">
                      <span>Ahorro por sustituciones IA:</span>
                      <span className="font-medium">{formatPrice(890)}</span>
                    </div>
                    <div className="text-center mt-4 text-green-100">
                      ¡Has ahorrado el {((getTotalSavings() + 890) / (getOptimizedTotal() + getTotalSavings() + 890) * 100).toFixed(1)}% de tu presupuesto!
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="font-semibold mb-4">Impacto AVI Shopper</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span>Tiempo ahorrado vs. búsqueda manual:</span>
                      <span className="font-medium text-blue-600">2.5 horas</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Productos comparados automáticamente:</span>
                      <span className="font-medium text-purple-600">120+</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tiendas analizadas en tiempo real:</span>
                      <span className="font-medium text-orange-600">4</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sustituciones nutricionales sugeridas:</span>
                      <span className="font-medium text-green-600">3</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="font-semibold mb-4">Próximos Pasos</h3>
                  <div className="space-y-3">
                    <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                      Proceder al Checkout
                    </button>
                    <button className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors">
                      Enviar Lista por WhatsApp
                    </button>
                    <button className="w-full border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                      Programar Compra Recurrente
                    </button>
                  </div>
                </div>

                <div className="text-center">
                  <button
                    onClick={goHome}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 text-lg"
                  >
                    ¡Comenzar a Usar AVI Shopper!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}