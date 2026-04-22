'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Car,
  Search,
  MapPin,
  Gauge,
  Fuel,
  Calendar,
  ExternalLink,
  Filter,
  Zap,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react'

const CHILEAUTOS_BASE = 'https://www.chileautos.cl'

const BRANDS = [
  'Todas',
  'Chevrolet',
  'Hyundai',
  'Kia',
  'Nissan',
  'Toyota',
  'Suzuki',
  'Mazda',
  'Peugeot',
  'Mitsubishi',
  'Ford',
  'MG',
  'Volkswagen',
]

const REGIONS = [
  'Todas',
  'Metropolitana',
  'Valparaíso',
  'Biobío',
  "O'Higgins",
  'Maule',
  'La Araucanía',
  'Los Lagos',
  'Antofagasta',
  'Coquimbo',
]

const FUEL_TYPES = ['Todos', 'Bencina', 'Diésel', 'Híbrido', 'Eléctrico']

type Listing = {
  id: number
  brand: string
  model: string
  year: number
  kms: number
  fuel: string
  transmission: 'Manual' | 'Automática'
  region: string
  commune: string
  price: number
  seller: 'Particular' | 'Automotora'
  image: string
}

const LISTINGS: Listing[] = [
  {
    id: 1,
    brand: 'Chevrolet',
    model: 'Sail 1.5 LT',
    year: 2021,
    kms: 48000,
    fuel: 'Bencina',
    transmission: 'Manual',
    region: 'Metropolitana',
    commune: 'Las Condes',
    price: 7490000,
    seller: 'Automotora',
    image: '🚗',
  },
  {
    id: 2,
    brand: 'Kia',
    model: 'Morning EX 1.25',
    year: 2022,
    kms: 31500,
    fuel: 'Bencina',
    transmission: 'Manual',
    region: 'Metropolitana',
    commune: 'Ñuñoa',
    price: 8290000,
    seller: 'Particular',
    image: '🚙',
  },
  {
    id: 3,
    brand: 'Hyundai',
    model: 'Accent 1.4 GL',
    year: 2020,
    kms: 62300,
    fuel: 'Bencina',
    transmission: 'Automática',
    region: 'Valparaíso',
    commune: 'Viña del Mar',
    price: 8990000,
    seller: 'Automotora',
    image: '🚗',
  },
  {
    id: 4,
    brand: 'Nissan',
    model: 'V-Drive 1.6',
    year: 2023,
    kms: 18200,
    fuel: 'Bencina',
    transmission: 'Manual',
    region: 'Metropolitana',
    commune: 'Maipú',
    price: 9790000,
    seller: 'Particular',
    image: '🚗',
  },
  {
    id: 5,
    brand: 'Toyota',
    model: 'Yaris Sport 1.5',
    year: 2022,
    kms: 29800,
    fuel: 'Bencina',
    transmission: 'Automática',
    region: 'Metropolitana',
    commune: 'Providencia',
    price: 11490000,
    seller: 'Automotora',
    image: '🚙',
  },
  {
    id: 6,
    brand: 'Suzuki',
    model: 'Baleno GLX 1.4',
    year: 2021,
    kms: 42100,
    fuel: 'Bencina',
    transmission: 'Manual',
    region: 'Biobío',
    commune: 'Concepción',
    price: 8150000,
    seller: 'Particular',
    image: '🚗',
  },
  {
    id: 7,
    brand: 'Mazda',
    model: '3 Sport 2.0',
    year: 2020,
    kms: 70500,
    fuel: 'Bencina',
    transmission: 'Automática',
    region: 'Metropolitana',
    commune: 'La Reina',
    price: 12990000,
    seller: 'Automotora',
    image: '🚙',
  },
  {
    id: 8,
    brand: 'Peugeot',
    model: '208 Active 1.2',
    year: 2022,
    kms: 24300,
    fuel: 'Bencina',
    transmission: 'Manual',
    region: 'Metropolitana',
    commune: 'Vitacura',
    price: 10490000,
    seller: 'Particular',
    image: '🚗',
  },
  {
    id: 9,
    brand: 'Hyundai',
    model: 'Tucson 2.0 CRDI',
    year: 2019,
    kms: 89400,
    fuel: 'Diésel',
    transmission: 'Automática',
    region: 'La Araucanía',
    commune: 'Temuco',
    price: 13290000,
    seller: 'Automotora',
    image: '🚙',
  },
  {
    id: 10,
    brand: 'Toyota',
    model: 'Corolla Hybrid',
    year: 2023,
    kms: 12000,
    fuel: 'Híbrido',
    transmission: 'Automática',
    region: 'Metropolitana',
    commune: 'Las Condes',
    price: 18990000,
    seller: 'Automotora',
    image: '🚙',
  },
  {
    id: 11,
    brand: 'MG',
    model: 'ZS EV Luxury',
    year: 2023,
    kms: 9500,
    fuel: 'Eléctrico',
    transmission: 'Automática',
    region: 'Metropolitana',
    commune: 'Lo Barnechea',
    price: 21990000,
    seller: 'Particular',
    image: '⚡',
  },
  {
    id: 12,
    brand: 'Mitsubishi',
    model: 'L200 Katana 2.4',
    year: 2020,
    kms: 95000,
    fuel: 'Diésel',
    transmission: 'Manual',
    region: "O'Higgins",
    commune: 'Rancagua',
    price: 16490000,
    seller: 'Automotora',
    image: '🛻',
  },
]

const formatCLP = (price: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(price)

const formatKm = (kms: number) =>
  new Intl.NumberFormat('es-CL').format(kms) + ' km'

const buildChileAutosUrl = (params: {
  brand?: string
  region?: string
  fuel?: string
  query?: string
  minYear?: number
  maxPrice?: number
}) => {
  const parts: string[] = []
  if (params.query) parts.push(`q=${encodeURIComponent(params.query)}`)
  if (params.brand && params.brand !== 'Todas')
    parts.push(`marca=${encodeURIComponent(params.brand.toLowerCase())}`)
  if (params.region && params.region !== 'Todas')
    parts.push(`region=${encodeURIComponent(params.region.toLowerCase())}`)
  if (params.fuel && params.fuel !== 'Todos')
    parts.push(`combustible=${encodeURIComponent(params.fuel.toLowerCase())}`)
  if (params.minYear) parts.push(`anio_desde=${params.minYear}`)
  if (params.maxPrice) parts.push(`precio_hasta=${params.maxPrice}`)
  const suffix = parts.length ? `?${parts.join('&')}` : ''
  return `${CHILEAUTOS_BASE}/vehiculos${suffix}`
}

export default function ChileAutosPage() {
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('Todas')
  const [region, setRegion] = useState('Todas')
  const [fuel, setFuel] = useState('Todos')
  const [minYear, setMinYear] = useState(2018)
  const [maxPrice, setMaxPrice] = useState(25000000)

  const filtered = useMemo(() => {
    return LISTINGS.filter((l) => {
      if (brand !== 'Todas' && l.brand !== brand) return false
      if (region !== 'Todas' && l.region !== region) return false
      if (fuel !== 'Todos' && l.fuel !== fuel) return false
      if (l.year < minYear) return false
      if (l.price > maxPrice) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        const hay = `${l.brand} ${l.model} ${l.commune}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => a.price - b.price)
  }, [query, brand, region, fuel, minYear, maxPrice])

  const avgPrice = filtered.length
    ? filtered.reduce((s, l) => s + l.price, 0) / filtered.length
    : 0

  const searchUrl = buildChileAutosUrl({
    brand,
    region,
    fuel,
    query,
    minYear,
    maxPrice,
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver al inicio
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Car className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-blue-600">AVI</span>
              <span className="text-lg font-semibold">Autos</span>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">
                Conectado a ChileAutos.cl
              </span>
            </div>
            <a
              href={CHILEAUTOS_BASE}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="w-4 h-4" />
              chileautos.cl
            </a>
          </div>
        </div>
      </header>

      <section className="bg-white border-b">
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-sm px-3 py-1 rounded-full mb-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Fuente: ChileAutos.cl — el mayor marketplace de autos en Chile
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Encuentra tu próximo auto con{' '}
              <span className="text-blue-600">IA</span>
            </h1>
            <p className="text-lg text-gray-600">
              AVI Shopper compara miles de publicaciones de ChileAutos.cl para
              mostrarte las mejores oportunidades según tu presupuesto y
              preferencias.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-5 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold">Filtros</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Buscar
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ej: Corolla, Sail..."
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Marca
                  </label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Región
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Combustible
                  </label>
                  <select
                    value={fuel}
                    onChange={(e) => setFuel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Año desde: <span className="text-blue-600">{minYear}</span>
                  </label>
                  <input
                    type="range"
                    min={2010}
                    max={2024}
                    value={minYear}
                    onChange={(e) => setMinYear(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Precio máx:{' '}
                    <span className="text-blue-600">{formatCLP(maxPrice)}</span>
                  </label>
                  <input
                    type="range"
                    min={3000000}
                    max={30000000}
                    step={500000}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  Ver en ChileAutos.cl
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </aside>

          <main className="lg:col-span-3 space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Car className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Publicaciones</div>
                  <div className="font-bold text-lg">{filtered.length}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Precio promedio</div>
                  <div className="font-bold text-lg">
                    {filtered.length ? formatCLP(avgPrice) : '—'}
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Motor IA</div>
                  <div className="font-bold text-sm text-purple-700">
                    Ordenados por mejor valor
                  </div>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border p-10 text-center">
                <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">
                  No hay publicaciones que coincidan con tus filtros.
                </p>
                <p className="text-sm text-gray-500">
                  Ajusta los criterios o{' '}
                  <a
                    href={CHILEAUTOS_BASE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    busca en ChileAutos.cl
                  </a>
                  .
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filtered.map((l, idx) => {
                  const isBestDeal = idx === 0 && filtered.length > 1
                  const detailUrl = `${CHILEAUTOS_BASE}/vehiculos?q=${encodeURIComponent(
                    `${l.brand} ${l.model} ${l.year}`,
                  )}`
                  return (
                    <article
                      key={l.id}
                      className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                      <div className="h-40 bg-gradient-to-br from-slate-100 to-blue-100 flex items-center justify-center text-6xl relative">
                        <span>{l.image}</span>
                        {isBestDeal && (
                          <span className="absolute top-3 left-3 bg-green-600 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Mejor valor IA
                          </span>
                        )}
                        <span className="absolute top-3 right-3 bg-white/90 text-gray-700 text-xs px-2 py-1 rounded-full">
                          {l.seller}
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {l.brand} {l.model}
                            </h3>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {l.commune}, {l.region}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">
                              {formatCLP(l.price)}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {l.year}
                          </div>
                          <div className="flex items-center gap-1">
                            <Gauge className="w-3 h-3" />
                            {formatKm(l.kms)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Fuel className="w-3 h-3" />
                            {l.fuel}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                          <ShieldCheck className="w-3 h-3 text-green-600" />
                          Verificado por ChileAutos · {l.transmission}
                        </div>
                        <a
                          href={detailUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          Ver en ChileAutos.cl
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-900">
              <p className="font-medium mb-1">
                ¿Cómo funciona la conexión con ChileAutos.cl?
              </p>
              <p className="text-blue-800">
                AVI Shopper usa los filtros de este panel para enlazar tus
                búsquedas al catálogo oficial de ChileAutos.cl, el mayor
                marketplace de autos usados y nuevos en Chile. Los listados
                mostrados son ejemplos representativos; al hacer click en
                &ldquo;Ver en ChileAutos.cl&rdquo; accedes a las publicaciones
                reales.
              </p>
            </div>
          </main>
        </div>
      </div>

      <footer className="py-8 border-t bg-white mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          AVI Shopper &middot; Integración con ChileAutos.cl &copy; 2025
        </div>
      </footer>
    </div>
  )
}
