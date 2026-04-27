#!/usr/bin/env node
// Convierte la nómina oficial de Tasación Fiscal del SII a JSON normalizado.
//
// Uso:
//   1. Descargar el archivo Excel desde:
//      https://www.sii.cl/destacados/tasacion_vehiculos/<año>/
//      (sección "Nómina histórica de Tasación" o "Listados").
//   2. Guardarlo como data/sii-tasacion-<año>.xlsx
//   3. node scripts/ingest-sii.mjs <año>
//   4. Genera src/lib/data/sii-tasacion-<año>.json
//
// El script no descarga nada por su cuenta: el archivo lo descarga el usuario
// desde el portal oficial. Esto evita scraping y respeta la fuente.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const anio = process.argv[2] || new Date().getFullYear().toString()
const inputPath = join(ROOT, 'data', `sii-tasacion-${anio}.xlsx`)
const outputPath = join(ROOT, 'src', 'lib', 'data', `sii-tasacion-${anio}.json`)

if (!existsSync(inputPath)) {
  console.error(`No encuentro ${inputPath}`)
  console.error(
    `Descarga la nómina oficial desde https://www.sii.cl/destacados/tasacion_vehiculos/${anio}/ y guárdala ahí.`,
  )
  process.exit(1)
}

let xlsx
try {
  xlsx = await import('xlsx')
} catch {
  console.error('Falta la dependencia "xlsx". Instalala con: npm i -D xlsx')
  process.exit(1)
}

const buffer = await readFile(inputPath)
const wb = xlsx.read(buffer, { type: 'buffer' })
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' })

const normalized = rows
  .map((r) => {
    const get = (...keys) => {
      for (const k of keys) {
        const found = Object.keys(r).find(
          (rk) => rk.toLowerCase().trim() === k.toLowerCase(),
        )
        if (found && r[found] !== '') return r[found]
      }
      return undefined
    }
    return {
      codigo: String(get('codigo', 'código', 'cod') ?? ''),
      marca: String(get('marca') ?? '').trim(),
      modelo: String(get('modelo') ?? '').trim(),
      anio: Number(get('año', 'anio', 'año fab', 'año fabricacion') ?? 0),
      tasacion: Number(get('tasacion', 'tasación', 'monto', 'valor') ?? 0),
      categoria: String(get('categoria', 'categoría', 'tipo') ?? '').trim(),
    }
  })
  .filter((v) => v.marca && v.modelo)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(normalized, null, 2))

console.log(`Generado ${outputPath}`)
console.log(`Registros: ${normalized.length}`)
