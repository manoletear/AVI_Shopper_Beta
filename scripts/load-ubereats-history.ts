/**
 * Carga las líneas de compra de Uber Eats (CSV de Grok) a purchase_history.
 * Reemplaza las filas existentes con source=ubereats de fam-manu-001.
 *
 * Uso: DATABASE_URL=... npx tsx scripts/load-ubereats-history.ts lineas_compra.csv
 */
import { PrismaClient } from '@prisma/client';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const prisma = new PrismaClient();
const FAMILY_ID = 'fam-manu-001';
const SOURCE = 'ubereats';

// Map comprador → userId (Manuel is manu-001, Claudia needs her userId)
const COMPRADOR_USER: Record<string, string> = {
  Manu: 'manu-001',
  Claudia: '', // se llena al arrancar
};

const STORE_SLUG_MAP: Record<string, string> = {
  Jumbo: 'jumbo',
  'Lider Express': 'lider',
  Lider: 'lider',
  UNIMARC: 'unimarc',
  'SPID Express': 'spid',
  Oxxo: 'oxxo',
  Kiosclub: 'kiosclub',
  'Frutas y Verduras Johnny': 'verduleria',
};

interface CsvRow {
  orden_id: string;
  comprador: string;
  fecha_local: string;
  tienda: string;
  producto_original: string;
  marca: string;
  nombre: string;
  formato: string;
  contenido: string;
  unidad_contenido: string;
  cantidad: string;
  precio_unitario_clp: string;
  subtotal_clp: string;
  estado: string;
  producto_canonico: string;
  categoria: string;
  contexto_consumo: string;
  cuenta_para_prediccion: string;
}

function parseCsvLine(header: string[], line: string): CsvRow {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { values.push(current); current = ''; continue; }
    current += char;
  }
  values.push(current);
  const row: any = {};
  header.forEach((h, i) => { row[h] = values[i] || ''; });
  return row;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) { console.error('Uso: npx tsx scripts/load-ubereats-history.ts <lineas_compra.csv>'); process.exit(1); }

  // Resolve Claudia's userId
  const claudia = await prisma.familyMember.findFirst({
    where: { familyId: FAMILY_ID, name: 'Claudia', isActive: true },
    select: { userId: true },
  });
  if (claudia?.userId) COMPRADOR_USER.Claudia = claudia.userId;
  console.log(`Claudia userId: ${COMPRADOR_USER.Claudia || '(no vinculada)'}`);

  // Delete existing ubereats rows for this family
  const deleted = await prisma.purchaseHistory.deleteMany({
    where: { familyId: FAMILY_ID, source: SOURCE },
  });
  console.log(`Eliminadas ${deleted.count} filas existentes (source=${SOURCE}, family=${FAMILY_ID})`);

  // Read CSV
  const rl = createInterface({ input: createReadStream(csvPath, 'utf-8') });
  let header: string[] = [];
  let count = 0;
  const batch: any[] = [];

  for await (const line of rl) {
    if (!header.length) { header = line.split(','); continue; }
    if (!line.trim()) continue;

    const row = parseCsvLine(header, line);

    // Skip non-delivered or cancelled
    if (row.estado === 'cancelada' || row.estado === 'no_encontrado') continue;

    const userId = COMPRADOR_USER[row.comprador] || COMPRADOR_USER.Manu;
    const storeSlug = STORE_SLUG_MAP[row.tienda] || row.tienda.toLowerCase().replace(/\s+/g, '_');

    batch.push({
      userId,
      familyId: FAMILY_ID,
      productName: row.producto_original || row.nombre,
      brand: row.marca || null,
      category: row.categoria || null,
      storeSlug,
      storeName: row.tienda,
      price: row.precio_unitario_clp ? Math.round(parseFloat(row.precio_unitario_clp)) : null,
      quantity: parseFloat(row.cantidad) || 1,
      unit: row.unidad_contenido || null,
      baseAmount: row.contenido ? parseFloat(row.contenido) : null,
      baseUnit: row.unidad_contenido || null,
      groupKey: row.producto_canonico || null,
      orderRef: row.orden_id,
      source: SOURCE,
      purchasedAt: new Date(row.fecha_local),
    });

    if (batch.length >= 100) {
      await prisma.purchaseHistory.createMany({ data: batch });
      count += batch.length;
      batch.length = 0;
      process.stdout.write(`\r  ${count} filas cargadas...`);
    }
  }

  if (batch.length > 0) {
    await prisma.purchaseHistory.createMany({ data: batch });
    count += batch.length;
  }

  console.log(`\n✅ ${count} filas cargadas a purchase_history (family=${FAMILY_ID}, source=${SOURCE})`);
  console.log('Ahora llama get_pantry desde Grok para aplicar las compras y generar perfiles.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
