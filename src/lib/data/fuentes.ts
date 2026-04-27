// Constructores de deep links a fuentes oficiales / públicas.
// Esto reemplaza cualquier intento de scraping: la herramienta enlaza al
// recurso oficial donde el usuario verá los datos de primera mano.

export const FUENTES = {
  sii: 'https://www4.sii.cl/vehiculospubui/',
  siiHome: 'https://www.sii.cl/destacados/tasacion_vehiculos/',
  chileautos: 'https://www.chileautos.cl',
  anac: 'https://www.anac.cl/category/estudio-de-mercado/',
  datosGob: 'https://datos.gob.cl/dataset',
} as const

export const buildSiiTasacionUrl = (params: {
  marca?: string
  modelo?: string
  anio?: number
}) => {
  // El consultador del SII abre con marca/modelo precargado vía hash.
  // Usamos la URL pública; el usuario completa filtros si el sitio no acepta
  // los query params (varían entre años).
  const qs = new URLSearchParams()
  if (params.marca) qs.set('marca', params.marca)
  if (params.modelo) qs.set('modelo', params.modelo)
  if (params.anio) qs.set('anio', String(params.anio))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return `${FUENTES.sii}${suffix}`
}

export const buildChileAutosUrl = (params: {
  marca?: string
  modelo?: string
  anioDesde?: number
  anioHasta?: number
  precioMax?: number
  region?: string
}) => {
  const qs = new URLSearchParams()
  const q = [params.marca, params.modelo].filter(Boolean).join(' ')
  if (q) qs.set('q', q)
  if (params.anioDesde) qs.set('anio_desde', String(params.anioDesde))
  if (params.anioHasta) qs.set('anio_hasta', String(params.anioHasta))
  if (params.precioMax) qs.set('precio_hasta', String(params.precioMax))
  if (params.region) qs.set('region', params.region.toLowerCase())
  return `${FUENTES.chileautos}/vehiculos${qs.toString() ? `?${qs.toString()}` : ''}`
}

export const buildAnacUrl = () => FUENTES.anac

export const buildDatosGobUrl = (query: string) =>
  `${FUENTES.datosGob}?q=${encodeURIComponent(query)}`
