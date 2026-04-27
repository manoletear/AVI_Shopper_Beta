'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Car,
  Search,
  Filter,
  ExternalLink,
  Calculator,
  BarChart3,
  ShieldCheck,
  Database,
  Info,
} from 'lucide-react'
import {
  VEHICULOS_CHILE,
  SEGMENTOS,
  COMBUSTIBLES,
  REGIONES,
  RANGO_ANIO,
  RANGO_PRECIO,
  ALL,
  type Vehiculo,
  type Combustible,
  type Segmento,
  type AllOption,
} from '@/lib/data/vehiculos-chile'
import {
  FUENTES,
  buildSiiTasacionUrl,
  buildChileAutosUrl,
  buildAnacUrl,
} from '@/lib/data/fuentes'
import { formatCLP } from '@/lib/utils'

type VehicleActionLinksProps = {
  vehiculo: Vehiculo
  precioMax?: number
  region?: string
  variant?: 'compact' | 'full'
  onShowDetail?: () => void
}

function VehicleActionLinks({
  vehiculo,
  precioMax,
  region,
  variant = 'compact',
  onShowDetail,
}: VehicleActionLinksProps) {
  const siiUrl = buildSiiTasacionUrl({
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    anio: vehiculo.anioHasta,
  })
  const chileautosUrl = buildChileAutosUrl({
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    anioDesde: vehiculo.anioDesde,
    precioMax,
    region: region && region !== ALL ? region : undefined,
  })

  if (variant === 'full') {
    return (
      <div className="space-y-2">
        <a
          href={siiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          <Calculator className="w-4 h-4" />
          Consultar tasación oficial en SII
          <ExternalLink className="w-4 h-4" />
        </a>
        <a
          href={chileautosUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Car className="w-4 h-4" />
          Ver avisos en ChileAutos.cl
          <ExternalLink className="w-4 h-4" />
        </a>
        <a
          href={buildAnacUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-800 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          Estadísticas de mercado ANAC
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <a
        href={siiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-1 bg-emerald-50 text-emerald-700 py-2 rounded-lg hover:bg-emerald-100 transition-colors"
      >
        <Calculator className="w-4 h-4" />
        Tasación SII
      </a>
      <a
        href={chileautosUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-1 bg-blue-50 text-blue-700 py-2 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <Car className="w-4 h-4" />
        Avisos
      </a>
      <button
        type="button"
        onClick={onShowDetail}
        className="flex flex-col items-center gap-1 bg-gray-50 text-gray-700 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Info className="w-4 h-4" />
        Detalle
      </button>
    </div>
  )
}

export default function ChileAutosPage() {
  const [query, setQuery] = useState('')
  const [segmento, setSegmento] = useState<Segmento | AllOption>(ALL)
  const [combustible, setCombustible] = useState<Combustible | AllOption>(ALL)
  const [region, setRegion] = useState<string>(ALL)
  const [anioDesde, setAnioDesde] = useState(2020)
  const [precioMax, setPrecioMax] = useState(35_000_000)
  const [seleccionado, setSeleccionado] = useState<Vehiculo | null>(null)

  const filtrados = useMemo(() => {
    return VEHICULOS_CHILE.filter((v) => {
      if (segmento !== ALL && v.segmento !== segmento) return false
      if (combustible !== ALL && v.combustible !== combustible) return false
      if (v.precioRefCLP > precioMax) return false
      if (v.anioHasta < anioDesde) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        const hay = `${v.marca} ${v.modelo} ${v.carroceria}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => a.precioRefCLP - b.precioRefCLP)
  }, [query, segmento, combustible, precioMax, anioDesde])

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
                Datos públicos
              </span>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              Sin scraping · Solo fuentes oficiales
            </div>
          </div>
        </div>
      </header>

      <section className="bg-white border-b">
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full mb-4">
              <Database className="w-4 h-4" />
              Catálogo Chile · Tasación SII · Mercado ANAC · Avisos ChileAutos
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Herramienta de consulta de autos en{' '}
              <span className="text-blue-600">Chile</span>
            </h1>
            <p className="text-lg text-gray-600">
              Filtra por segmento, combustible y precio referencial. Para cada
              modelo abrimos la consulta oficial del SII (tasación fiscal), el
              informe ANAC del mercado y los avisos disponibles en
              ChileAutos.cl.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-5 sticky top-24 space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold">Filtros</h2>
              </div>

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
                  Segmento
                </label>
                <select
                  value={segmento}
                  onChange={(e) =>
                    setSegmento(e.target.value as Segmento | 'all')
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {SEGMENTOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Combustible
                </label>
                <select
                  value={combustible}
                  onChange={(e) =>
                    setCombustible(e.target.value as Combustible | AllOption)
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {COMBUSTIBLES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Región (para avisos)
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {REGIONES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Año desde:{' '}
                  <span className="text-blue-600">{anioDesde}</span>
                </label>
                <input
                  type="range"
                  min={RANGO_ANIO.min}
                  max={RANGO_ANIO.max}
                  value={anioDesde}
                  onChange={(e) => setAnioDesde(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Precio máx:{' '}
                  <span className="text-blue-600">{formatCLP(precioMax)}</span>
                </label>
                <input
                  type="range"
                  min={RANGO_PRECIO.min}
                  max={RANGO_PRECIO.max}
                  step={RANGO_PRECIO.step}
                  value={precioMax}
                  onChange={(e) => setPrecioMax(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="border-t pt-4 space-y-2 text-xs">
                <div className="font-medium text-gray-700">Fuentes:</div>
                <a
                  href={FUENTES.siiHome}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <Calculator className="w-3 h-3" />
                  SII Tasación Fiscal
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={buildAnacUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <BarChart3 className="w-3 h-3" />
                  ANAC Mercado Automotor
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={FUENTES.chileautos}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <Car className="w-3 h-3" />
                  ChileAutos.cl
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </aside>

          <main className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-gray-500">Modelos encontrados:</span>{' '}
                <span className="font-bold text-blue-600">
                  {filtrados.length}
                </span>
              </div>
              <div className="text-gray-500">
                Catálogo seed ·{' '}
                <span className="text-gray-700">
                  Para tasación oficial completa, consulta el SII
                </span>
              </div>
            </div>

            {filtrados.length === 0 ? (
              <div className="bg-white rounded-xl border p-10 text-center">
                <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">
                  Ningún modelo del catálogo coincide con tus filtros.
                </p>
                <a
                  href={FUENTES.chileautos}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Buscar directo en ChileAutos.cl
                </a>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filtrados.map((v) => (
                  <article
                    key={v.id}
                    className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {v.marca} {v.modelo}
                        </h3>
                        <div className="text-sm text-gray-500">
                          {v.carroceria} · {v.combustible}
                          {v.cilindrada ? ` · ${v.cilindrada}` : ''}
                        </div>
                      </div>
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
                        {v.segmento}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 mb-4 space-y-1">
                      <div>
                        Años:{' '}
                        <span className="font-medium">
                          {v.anioDesde}–{v.anioHasta}
                        </span>
                      </div>
                      <div>
                        Precio referencia mercado nuevo:{' '}
                        <span className="font-bold text-gray-900">
                          {formatCLP(v.precioRefCLP)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <VehicleActionLinks
                        vehiculo={v}
                        precioMax={precioMax}
                        region={region}
                        onShowDetail={() => setSeleccionado(v)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-900">
              <p className="font-medium mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                ¿De dónde vienen los datos?
              </p>
              <ul className="text-blue-800 list-disc ml-5 space-y-1">
                <li>
                  <strong>Catálogo de modelos:</strong> base seed con modelos
                  populares en Chile. Para la nómina oficial completa (~81.611
                  tasaciones), corre{' '}
                  <code className="bg-blue-100 px-1 rounded">
                    node scripts/ingest-sii.mjs
                  </code>{' '}
                  con el Excel descargado del SII.
                </li>
                <li>
                  <strong>Tasación fiscal:</strong> al hacer click se abre la
                  consulta oficial en sii.cl — sin scraping.
                </li>
                <li>
                  <strong>Avisos:</strong> deep link al catálogo público de
                  ChileAutos.cl con tus filtros precargados.
                </li>
                <li>
                  <strong>Estadísticas de mercado:</strong> informes mensuales
                  de ANAC en PDF (datos del Registro Civil).
                </li>
              </ul>
            </div>
          </main>
        </div>
      </div>

      {seleccionado && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSeleccionado(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold mb-1">
              {seleccionado.marca} {seleccionado.modelo}
            </h3>
            <p className="text-gray-500 mb-4">
              {seleccionado.carroceria} · {seleccionado.combustible}
              {seleccionado.cilindrada ? ` · ${seleccionado.cilindrada}` : ''}
            </p>

            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Segmento</span>
                <span className="font-medium">{seleccionado.segmento}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Años de venta en Chile</span>
                <span className="font-medium">
                  {seleccionado.anioDesde}–{seleccionado.anioHasta}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Precio nuevo (ref.)</span>
                <span className="font-medium">
                  {formatCLP(seleccionado.precioRefCLP)}
                </span>
              </div>
            </div>

            <VehicleActionLinks vehiculo={seleccionado} variant="full" />

            <button
              type="button"
              onClick={() => setSeleccionado(null)}
              className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <footer className="py-8 border-t bg-white mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          AVI Shopper · Herramienta de consulta con datos públicos &copy; 2026
        </div>
      </footer>
    </div>
  )
}
