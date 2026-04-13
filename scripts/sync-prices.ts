/**
 * Script de sincronizacion de precios
 *
 * Uso:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sync-prices.ts
 *
 * Cron (cada 12 horas):
 *   0 */12 * * * cd /path/to/avi-shopper && npx ts-node scripts/sync-prices.ts >> logs/price-sync.log 2>&1
 */

import { runFullSync } from '../src/services/scrapers/price-sync.service';

async function main() {
  console.log('========================================');
  console.log(`[PriceSync] Inicio: ${new Date().toISOString()}`);
  console.log('========================================');

  const stats = await runFullSync();

  console.log('\n========================================');
  console.log('[PriceSync] RESUMEN');
  console.log('========================================');

  for (const s of stats) {
    console.log(`\n${s.store}:`);
    console.log(`  Productos encontrados: ${s.productsFound}`);
    console.log(`  Precios sincronizados: ${s.pricesUpserted}`);
    console.log(`  Errores: ${s.errors.length}`);
    console.log(`  Duracion: ${s.duration}ms`);
    if (s.errors.length > 0) {
      s.errors.slice(0, 5).forEach((e) => console.log(`  ⚠ ${e}`));
    }
  }

  console.log(`\n[PriceSync] Fin: ${new Date().toISOString()}`);
}

main().catch(console.error);
