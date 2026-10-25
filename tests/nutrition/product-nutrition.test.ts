import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nutritionIdentityError, productNutritionSchema } from '../../src/types/nutrition';

const verifiedManual = {
  name: 'Yogurt natural',
  ean: '7801234567890',
  ingredients_text: 'Leche, fermentos',
  source: 'manual' as const,
  source_detail: { provider: 'manual' },
  allergen_status: 'verified' as const,
  allergens: ['milk'] as const,
  sodium_mg_100g: 40,
};

describe('productNutritionSchema', () => {
  it('accepts a verified manual row with sodium_mg_100g and live sellos', () => {
    const parsed = productNutritionSchema.parse({
      ...verifiedManual,
      sellos_chile: ['alto_sodio'],
    });
    assert.equal(parsed.sodium_mg_100g, 40);
    assert.equal('sodium_100mg' in parsed, false);
    assert.deepEqual(parsed.sellos_chile, ['alto_sodio']);
    assert.deepEqual(parsed.source_detail, { provider: 'manual' });
  });

  it('keeps sodium_mg_100g and drops the old sodium_100mg key', () => {
    assert.equal('sodium_100mg' in productNutritionSchema.shape, false);
    const { sodium_mg_100g, ...withoutSodium } = verifiedManual;
    const parsed = productNutritionSchema.parse({
      ...withoutSodium,
      sodium_100mg: 5,
    });
    assert.equal(parsed.sodium_mg_100g ?? null, null);
    assert.equal(sodium_mg_100g, 40);
  });

  it('rejects shellfish and the old sello phrases', () => {
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      allergens: ['shellfish'],
    }).success, false);
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      sellos_chile: ['ALTO EN SODIO'],
    }).success, false);
  });

  it('accepts crustacean, mollusc, sulfites, mustard, celery and lupin', () => {
    const parsed = productNutritionSchema.parse({
      ...verifiedManual,
      allergens: ['crustacean', 'mollusc', 'sulfites', 'mustard', 'celery', 'lupin'],
      traces: ['crustacean'],
    });
    assert.deepEqual(parsed.allergens, ['crustacean', 'mollusc', 'sulfites', 'mustard', 'celery', 'lupin']);
  });

  it('verified is rejected for Open Food Facts and for rows without ingredients', () => {
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      source: 'open_food_facts',
      allergen_status: 'verified',
    }).success, false);
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      ingredients_text: '   ',
      allergen_status: 'verified',
    }).success, false);
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      source: 'open_food_facts',
      allergen_status: 'partial',
    }).success, true);
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      source: 'store_page',
      allergen_status: 'verified',
    }).success, true);
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      source: 'manufacturer',
      allergen_status: 'verified',
    }).success, true);
  });

  it('requires source_detail object', () => {
    const parsed = productNutritionSchema.parse({
      name: 'Arroz',
      ean: '7800000000001',
      source: 'manual',
      allergen_status: 'unverified',
    });
    assert.deepEqual(parsed.source_detail, {});
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      source_detail: null,
    }).success, false);
  });

  it('pn_has_identity and pn_sku_needs_store', () => {
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      ean: null,
      store_sku: null,
      canonical_product_id: null,
    }).success, false);
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      ean: '   ',
    }).success, false);
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      ean: null,
      store_sku: 'SKU-1',
      store: null,
    }).success, false);
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      ean: null,
      store_sku: 'SKU-1',
      store: 'jumbo',
    }).success, true);
    assert.equal(productNutritionSchema.safeParse({
      ...verifiedManual,
      ean: null,
      canonical_product_id: 'cp_1',
    }).success, true);
  });
});

describe('nutritionIdentityError', () => {
  it('flags rows with no identity and never treats a blank as an id', () => {
    assert.match(
      nutritionIdentityError({ ean: null, store_sku: null, canonical_product_id: null }) ?? '',
      /pn_has_identity/,
    );
    assert.match(nutritionIdentityError({ ean: '  ' }) ?? '', /pn_has_identity/);
    assert.equal(nutritionIdentityError({ ean: '780123' }), null);
    assert.equal(nutritionIdentityError({ canonical_product_id: 'cp_1' }), null);
  });

  it('store_sku requires store', () => {
    assert.match(
      nutritionIdentityError({ store_sku: 'abc', store: null }) ?? '',
      /pn_sku_needs_store/,
    );
    assert.equal(nutritionIdentityError({ store_sku: 'abc', store: 'lider' }), null);
  });
});
