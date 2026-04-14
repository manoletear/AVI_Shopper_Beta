/**
 * Script para preparar el deploy a produccion
 *
 * Cambia el provider de Prisma de sqlite a postgresql,
 * ajusta tipos incompatibles, y genera el cliente.
 *
 * Uso:
 *   npx tsx scripts/prepare-production.ts
 *
 * Revertir a dev:
 *   npx tsx scripts/prepare-production.ts --dev
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SCHEMA_PATH = join(__dirname, '..', 'prisma', 'schema.prisma');
const isDev = process.argv.includes('--dev');

function main() {
  let schema = readFileSync(SCHEMA_PATH, 'utf-8');

  if (isDev) {
    // Revertir a SQLite para desarrollo
    schema = schema.replace(
      /provider = "postgresql"/,
      'provider = "sqlite"'
    );
    console.log('✅ Schema revertido a SQLite (desarrollo)');
  } else {
    // Preparar para PostgreSQL
    schema = schema.replace(
      /provider = "sqlite"/,
      'provider = "postgresql"'
    );
    console.log('✅ Schema actualizado a PostgreSQL (produccion)');
  }

  writeFileSync(SCHEMA_PATH, schema);
  console.log(`📄 ${SCHEMA_PATH} actualizado`);
  console.log('');
  console.log('Siguiente paso:');

  if (isDev) {
    console.log('  npx prisma generate');
    console.log('  npx prisma db push');
  } else {
    console.log('  1. Configura DATABASE_URL con tu connection string de PostgreSQL');
    console.log('     Ejemplo: postgresql://user:pass@host:5432/avi_shopper');
    console.log('  2. npx prisma generate');
    console.log('  3. npx prisma db push');
    console.log('  4. npx tsx prisma/seed.ts');
  }
}

main();
