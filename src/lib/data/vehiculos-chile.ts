// Catálogo seed de modelos populares en Chile.
// Fuente: conocimiento público del mercado automotor chileno.
// Para datos de tasación fiscal oficial, usar scripts/ingest-sii.mjs con la
// nómina anual descargable desde sii.cl/destacados/tasacion_vehiculos/<año>/.

export type Segmento =
  | 'citycar'
  | 'sedan'
  | 'hatchback'
  | 'suv'
  | 'pickup'
  | 'station'
  | 'electrico'
  | 'hibrido'

export type Combustible = 'Bencina' | 'Diésel' | 'Híbrido' | 'Eléctrico' | 'GLP'

export type Vehiculo = {
  id: string
  marca: string
  modelo: string
  segmento: Segmento
  combustible: Combustible
  cilindrada?: string
  carroceria: string
  // Rango de años de comercialización vigente en Chile (referencial).
  anioDesde: number
  anioHasta: number
  // Precio de referencia mercado nuevo en CLP (orientativo, NO oficial).
  precioRefCLP: number
}

export const VEHICULOS_CHILE: Vehiculo[] = [
  // Citycar
  { id: 'kia-morning', marca: 'Kia', modelo: 'Morning', segmento: 'citycar', combustible: 'Bencina', cilindrada: '1.0', carroceria: 'Hatchback 5p', anioDesde: 2018, anioHasta: 2026, precioRefCLP: 9990000 },
  { id: 'chevrolet-spark', marca: 'Chevrolet', modelo: 'Spark', segmento: 'citycar', combustible: 'Bencina', cilindrada: '1.2', carroceria: 'Hatchback 5p', anioDesde: 2017, anioHasta: 2024, precioRefCLP: 8990000 },
  { id: 'suzuki-celerio', marca: 'Suzuki', modelo: 'Celerio', segmento: 'citycar', combustible: 'Bencina', cilindrada: '1.0', carroceria: 'Hatchback 5p', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 8490000 },
  { id: 'hyundai-grand-i10', marca: 'Hyundai', modelo: 'Grand i10', segmento: 'citycar', combustible: 'Bencina', cilindrada: '1.2', carroceria: 'Hatchback 5p', anioDesde: 2018, anioHasta: 2026, precioRefCLP: 9590000 },

  // Sedán
  { id: 'chevrolet-sail', marca: 'Chevrolet', modelo: 'Sail', segmento: 'sedan', combustible: 'Bencina', cilindrada: '1.5', carroceria: 'Sedán 4p', anioDesde: 2018, anioHasta: 2024, precioRefCLP: 10990000 },
  { id: 'nissan-v-drive', marca: 'Nissan', modelo: 'V-Drive', segmento: 'sedan', combustible: 'Bencina', cilindrada: '1.6', carroceria: 'Sedán 4p', anioDesde: 2020, anioHasta: 2026, precioRefCLP: 11490000 },
  { id: 'kia-rio-sedan', marca: 'Kia', modelo: 'Rio Sedán', segmento: 'sedan', combustible: 'Bencina', cilindrada: '1.4', carroceria: 'Sedán 4p', anioDesde: 2017, anioHasta: 2024, precioRefCLP: 11990000 },
  { id: 'hyundai-accent', marca: 'Hyundai', modelo: 'Accent', segmento: 'sedan', combustible: 'Bencina', cilindrada: '1.4', carroceria: 'Sedán 4p', anioDesde: 2018, anioHasta: 2026, precioRefCLP: 12490000 },
  { id: 'toyota-yaris-sedan', marca: 'Toyota', modelo: 'Yaris Sedán', segmento: 'sedan', combustible: 'Bencina', cilindrada: '1.5', carroceria: 'Sedán 4p', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 13990000 },
  { id: 'mazda-3-sedan', marca: 'Mazda', modelo: '3 Sedán', segmento: 'sedan', combustible: 'Bencina', cilindrada: '2.0', carroceria: 'Sedán 4p', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 19990000 },
  { id: 'toyota-corolla', marca: 'Toyota', modelo: 'Corolla', segmento: 'sedan', combustible: 'Bencina', cilindrada: '2.0', carroceria: 'Sedán 4p', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 18990000 },

  // Hatchback
  { id: 'peugeot-208', marca: 'Peugeot', modelo: '208', segmento: 'hatchback', combustible: 'Bencina', cilindrada: '1.2', carroceria: 'Hatchback 5p', anioDesde: 2020, anioHasta: 2026, precioRefCLP: 13990000 },
  { id: 'mazda-2', marca: 'Mazda', modelo: '2 Sport', segmento: 'hatchback', combustible: 'Bencina', cilindrada: '1.5', carroceria: 'Hatchback 5p', anioDesde: 2018, anioHasta: 2026, precioRefCLP: 14990000 },
  { id: 'suzuki-baleno', marca: 'Suzuki', modelo: 'Baleno', segmento: 'hatchback', combustible: 'Bencina', cilindrada: '1.4', carroceria: 'Hatchback 5p', anioDesde: 2018, anioHasta: 2026, precioRefCLP: 11990000 },
  { id: 'toyota-yaris-sport', marca: 'Toyota', modelo: 'Yaris Sport', segmento: 'hatchback', combustible: 'Bencina', cilindrada: '1.5', carroceria: 'Hatchback 5p', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 13490000 },

  // SUV compactos / urbanos
  { id: 'suzuki-vitara', marca: 'Suzuki', modelo: 'Vitara', segmento: 'suv', combustible: 'Bencina', cilindrada: '1.6', carroceria: 'SUV 5p', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 16990000 },
  { id: 'hyundai-creta', marca: 'Hyundai', modelo: 'Creta', segmento: 'suv', combustible: 'Bencina', cilindrada: '1.6', carroceria: 'SUV 5p', anioDesde: 2020, anioHasta: 2026, precioRefCLP: 17990000 },
  { id: 'kia-seltos', marca: 'Kia', modelo: 'Seltos', segmento: 'suv', combustible: 'Bencina', cilindrada: '1.6', carroceria: 'SUV 5p', anioDesde: 2020, anioHasta: 2026, precioRefCLP: 18990000 },
  { id: 'mg-zs', marca: 'MG', modelo: 'ZS', segmento: 'suv', combustible: 'Bencina', cilindrada: '1.5', carroceria: 'SUV 5p', anioDesde: 2020, anioHasta: 2026, precioRefCLP: 14990000 },
  { id: 'changan-cs35-plus', marca: 'Changan', modelo: 'CS35 Plus', segmento: 'suv', combustible: 'Bencina', cilindrada: '1.4T', carroceria: 'SUV 5p', anioDesde: 2021, anioHasta: 2026, precioRefCLP: 15990000 },
  { id: 'chery-tiggo-2', marca: 'Chery', modelo: 'Tiggo 2', segmento: 'suv', combustible: 'Bencina', cilindrada: '1.5', carroceria: 'SUV 5p', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 12990000 },
  { id: 'mazda-cx30', marca: 'Mazda', modelo: 'CX-30', segmento: 'suv', combustible: 'Bencina', cilindrada: '2.0', carroceria: 'SUV 5p', anioDesde: 2020, anioHasta: 2026, precioRefCLP: 22990000 },

  // SUV medianos / grandes
  { id: 'hyundai-tucson', marca: 'Hyundai', modelo: 'Tucson', segmento: 'suv', combustible: 'Diésel', cilindrada: '2.0 CRDI', carroceria: 'SUV 5p', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 24990000 },
  { id: 'kia-sportage', marca: 'Kia', modelo: 'Sportage', segmento: 'suv', combustible: 'Diésel', cilindrada: '2.0 CRDI', carroceria: 'SUV 5p', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 25990000 },
  { id: 'mazda-cx5', marca: 'Mazda', modelo: 'CX-5', segmento: 'suv', combustible: 'Bencina', cilindrada: '2.0', carroceria: 'SUV 5p', anioDesde: 2018, anioHasta: 2026, precioRefCLP: 26990000 },
  { id: 'toyota-rav4', marca: 'Toyota', modelo: 'RAV4', segmento: 'suv', combustible: 'Híbrido', cilindrada: '2.5', carroceria: 'SUV 5p', anioDesde: 2020, anioHasta: 2026, precioRefCLP: 32990000 },
  { id: 'mitsubishi-outlander', marca: 'Mitsubishi', modelo: 'Outlander', segmento: 'suv', combustible: 'Bencina', cilindrada: '2.4', carroceria: 'SUV 7p', anioDesde: 2019, anioHasta: 2024, precioRefCLP: 28990000 },

  // Pickups
  { id: 'mitsubishi-l200', marca: 'Mitsubishi', modelo: 'L200 Katana', segmento: 'pickup', combustible: 'Diésel', cilindrada: '2.4', carroceria: 'Pickup 4x4', anioDesde: 2018, anioHasta: 2026, precioRefCLP: 24990000 },
  { id: 'toyota-hilux', marca: 'Toyota', modelo: 'Hilux', segmento: 'pickup', combustible: 'Diésel', cilindrada: '2.8', carroceria: 'Pickup 4x4', anioDesde: 2018, anioHasta: 2026, precioRefCLP: 33990000 },
  { id: 'nissan-navara', marca: 'Nissan', modelo: 'Navara', segmento: 'pickup', combustible: 'Diésel', cilindrada: '2.3', carroceria: 'Pickup 4x4', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 29990000 },
  { id: 'ford-ranger', marca: 'Ford', modelo: 'Ranger', segmento: 'pickup', combustible: 'Diésel', cilindrada: '3.2', carroceria: 'Pickup 4x4', anioDesde: 2019, anioHasta: 2026, precioRefCLP: 34990000 },
  { id: 'maxus-t60', marca: 'Maxus', modelo: 'T60', segmento: 'pickup', combustible: 'Diésel', cilindrada: '2.8', carroceria: 'Pickup 4x4', anioDesde: 2020, anioHasta: 2026, precioRefCLP: 22990000 },

  // Eléctricos / híbridos
  { id: 'mg-zs-ev', marca: 'MG', modelo: 'ZS EV', segmento: 'electrico', combustible: 'Eléctrico', carroceria: 'SUV 5p', anioDesde: 2021, anioHasta: 2026, precioRefCLP: 24990000 },
  { id: 'byd-yuan-plus', marca: 'BYD', modelo: 'Yuan Plus', segmento: 'electrico', combustible: 'Eléctrico', carroceria: 'SUV 5p', anioDesde: 2023, anioHasta: 2026, precioRefCLP: 28990000 },
  { id: 'byd-dolphin', marca: 'BYD', modelo: 'Dolphin', segmento: 'electrico', combustible: 'Eléctrico', carroceria: 'Hatchback 5p', anioDesde: 2023, anioHasta: 2026, precioRefCLP: 19990000 },
  { id: 'jac-e-js1', marca: 'JAC', modelo: 'E-JS1', segmento: 'electrico', combustible: 'Eléctrico', carroceria: 'Crossover 5p', anioDesde: 2022, anioHasta: 2026, precioRefCLP: 17990000 },
  { id: 'toyota-corolla-hybrid', marca: 'Toyota', modelo: 'Corolla Hybrid', segmento: 'hibrido', combustible: 'Híbrido', cilindrada: '1.8', carroceria: 'Sedán 4p', anioDesde: 2020, anioHasta: 2026, precioRefCLP: 23990000 },
  { id: 'toyota-corolla-cross-hybrid', marca: 'Toyota', modelo: 'Corolla Cross Hybrid', segmento: 'hibrido', combustible: 'Híbrido', cilindrada: '1.8', carroceria: 'SUV 5p', anioDesde: 2022, anioHasta: 2026, precioRefCLP: 27990000 },
]

export const ALL = 'all' as const
export type AllOption = typeof ALL

export const SEGMENTOS: { id: Segmento | AllOption; label: string }[] = [
  { id: ALL, label: 'Todos' },
  { id: 'citycar', label: 'Citycar' },
  { id: 'sedan', label: 'Sedán' },
  { id: 'hatchback', label: 'Hatchback' },
  { id: 'suv', label: 'SUV' },
  { id: 'pickup', label: 'Pickup' },
  { id: 'electrico', label: 'Eléctrico' },
  { id: 'hibrido', label: 'Híbrido' },
]

export const COMBUSTIBLES: { id: Combustible | AllOption; label: string }[] = [
  { id: ALL, label: 'Todos' },
  { id: 'Bencina', label: 'Bencina' },
  { id: 'Diésel', label: 'Diésel' },
  { id: 'Híbrido', label: 'Híbrido' },
  { id: 'Eléctrico', label: 'Eléctrico' },
  { id: 'GLP', label: 'GLP' },
]

export const REGIONES: { id: AllOption | string; label: string }[] = [
  { id: ALL, label: 'Todas' },
  { id: 'Metropolitana', label: 'Metropolitana' },
  { id: 'Valparaíso', label: 'Valparaíso' },
  { id: 'Biobío', label: 'Biobío' },
  { id: "O'Higgins", label: "O'Higgins" },
  { id: 'Maule', label: 'Maule' },
  { id: 'La Araucanía', label: 'La Araucanía' },
  { id: 'Los Lagos', label: 'Los Lagos' },
  { id: 'Antofagasta', label: 'Antofagasta' },
  { id: 'Coquimbo', label: 'Coquimbo' },
]

export const RANGO_ANIO = { min: 2010, max: 2026 } as const
export const RANGO_PRECIO = {
  min: 5_000_000,
  max: 50_000_000,
  step: 500_000,
} as const
