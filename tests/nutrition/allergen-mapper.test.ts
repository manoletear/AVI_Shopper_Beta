import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mapOFFTags,
  extractAllergensFromText,
  mergeAllergens,
  determineAllergenStatus,
} from '../../src/lib/nutrition/allergen-mapper';
import { evaluateAllergens, evaluateProductForFamily } from '../../src/lib/nutrition/check-allergens';
import { inferSellosChile } from '../../src/lib/nutrition/off-client';

const expect = (actual: unknown) => ({
  toEqual: (expected: unknown) => assert.deepEqual(actual, expected),
  toBe: (expected: unknown) => assert.equal(actual, expected),
  toContain: (item: unknown) => assert.ok((actual as unknown[]).includes(item)),
});

describe('mapOFFTags', () => {
  it('maps standard OFF allergen tags to normalized values', () => {
    const tags = ['en:peanuts', 'en:milk', 'en:gluten'];
    expect(mapOFFTags(tags)).toEqual(['gluten', 'milk', 'peanut']);
  });

  it('maps tree nut variants to tree_nut', () => {
    const tags = ['en:almonds', 'en:walnuts', 'en:hazelnuts'];
    expect(mapOFFTags(tags)).toEqual(['tree_nut']);
  });

  it('maps crustaceans and molluscs separately', () => {
    expect(mapOFFTags(['en:crustaceans'])).toEqual(['crustacean']);
    expect(mapOFFTags(['en:molluscs'])).toEqual(['mollusc']);
    expect(mapOFFTags(['en:crustaceans', 'en:molluscs'])).toEqual(['crustacean', 'mollusc']);
  });

  it('maps sulfites, mustard, celery and lupin', () => {
    expect(mapOFFTags([
      'en:sulphur-dioxide-and-sulphites',
      'en:mustard',
      'en:celery',
      'en:lupin',
    ])).toEqual(['celery', 'lupin', 'mustard', 'sulfites']);
  });

  it('ignores unknown tags', () => {
    expect(mapOFFTags(['en:unknown', 'en:peanuts'])).toEqual(['peanut']);
  });

  it('returns empty array for empty input', () => {
    expect(mapOFFTags([])).toEqual([]);
  });

  it('deduplicates tree nuts', () => {
    const tags = ['en:nuts', 'en:tree-nuts', 'en:almonds'];
    expect(mapOFFTags(tags)).toEqual(['tree_nut']);
  });

  it('maps gluten-containing cereals', () => {
    expect(mapOFFTags(['en:wheat', 'en:barley', 'en:rye'])).toEqual(['gluten']);
  });

  it('maps lactose to milk', () => {
    expect(mapOFFTags(['en:lactose'])).toEqual(['milk']);
  });
});

describe('extractAllergensFromText', () => {
  it('extracts gluten from Spanish text', () => {
    expect(extractAllergensFromText('Harina de trigo, azúcar')).toContain('gluten');
  });

  it('extracts milk from lácteo reference', () => {
    expect(extractAllergensFromText('Proteína láctea')).toContain('milk');
  });

  it('extracts egg', () => {
    expect(extractAllergensFromText('Huevo pasteurizado')).toContain('egg');
  });

  it('extracts soy variants', () => {
    expect(extractAllergensFromText('Lecitina de soya')).toContain('soy');
    expect(extractAllergensFromText('Proteína de soja')).toContain('soy');
  });

  it('extracts peanut (maní)', () => {
    expect(extractAllergensFromText('Contiene maní tostado')).toContain('peanut');
  });

  it('extracts tree nuts', () => {
    expect(extractAllergensFromText('Almendra molida, nueces')).toContain('tree_nut');
  });

  it('extracts sesame (ajonjolí)', () => {
    expect(extractAllergensFromText('Semillas de ajonjolí')).toContain('sesame');
  });

  it('separa pescado, crustáceos y moluscos', () => {
    expect(extractAllergensFromText('Filete de pescado')).toEqual(['fish']);
    expect(extractAllergensFromText('Camarones pelados')).toEqual(['crustacean']);
    expect(extractAllergensFromText('Calamares en su tinta')).toEqual(['mollusc']);
  });

  it('mariscos en el texto marca crustáceo y molusco', () => {
    expect(extractAllergensFromText('Contiene mariscos')).toEqual(['crustacean', 'mollusc']);
  });

  it('extracts sulfites, mustard, celery and lupin', () => {
    expect(extractAllergensFromText('Sulfitos, mostaza, apio y altramuz')).toEqual([
      'celery', 'lupin', 'mustard', 'sulfites',
    ]);
  });

  it('extracts multiple allergens from complex text', () => {
    const text = 'Harina de trigo, leche, huevo, soya, maní';
    const result = extractAllergensFromText(text);
    expect(result).toContain('gluten');
    expect(result).toContain('milk');
    expect(result).toContain('egg');
    expect(result).toContain('soy');
    expect(result).toContain('peanut');
  });

  it('returns empty for text without allergens', () => {
    expect(extractAllergensFromText('Agua, sal, pimienta')).toEqual([]);
  });
});

describe('mergeAllergens', () => {
  it('takes the union of multiple lists', () => {
    const a = ['peanut' as const, 'milk' as const];
    const b = ['milk' as const, 'gluten' as const];
    expect(mergeAllergens(a, b)).toEqual(['gluten', 'milk', 'peanut']);
  });

  it('handles empty lists', () => {
    expect(mergeAllergens([], [])).toEqual([]);
  });

  it('deduplicates', () => {
    expect(mergeAllergens(['milk' as const, 'milk' as const])).toEqual(['milk']);
  });

  it('returns sorted output', () => {
    expect(mergeAllergens(['soy' as const, 'egg' as const, 'milk' as const]))
      .toEqual(['egg', 'milk', 'soy']);
  });
});

describe('determineAllergenStatus', () => {
  it('returns unverified when no ingredients text', () => {
    expect(determineAllergenStatus(null, 'manual', true)).toBe('unverified');
    expect(determineAllergenStatus('', 'store_page', true)).toBe('unverified');
    expect(determineAllergenStatus('   ', 'manufacturer', true)).toBe('unverified');
  });

  it('returns verified only for store, manufacturer or manual when sources agree', () => {
    expect(determineAllergenStatus('Harina, azúcar', 'manual', true)).toBe('verified');
    expect(determineAllergenStatus('Harina, azúcar', 'store_page', true)).toBe('verified');
    expect(determineAllergenStatus('Harina, azúcar', 'manufacturer', true)).toBe('verified');
  });

  it('returns partial when sources disagree', () => {
    expect(determineAllergenStatus('Harina, azúcar', 'manual', false)).toBe('partial');
  });

  it('Open Food Facts alone is partial, never verified', () => {
    expect(determineAllergenStatus('Harina, azúcar', 'open_food_facts', true)).toBe('partial');
    expect(determineAllergenStatus(null, 'open_food_facts', true)).toBe('unverified');
  });
});

describe('inferSellosChile', () => {
  it('uses the live sello vocabulary', () => {
    expect(inferSellosChile({
      'energy-kcal_100g': 400,
      sugars_100g: 20,
      fat_100g: 10,
      sodium_100g: 0.5,
    })).toEqual(['alto_calorias', 'alto_azucares', 'alto_grasas_saturadas', 'alto_sodio']);
  });
});

describe('evaluateAllergens', () => {
  const family = new Set(['peanut', 'shellfish']);

  it('blocks unverified product with allergen match', () => {
    const result = evaluateAllergens(['peanut'], [], 'unverified', family);
    assert.equal(result.blocked, true);
    assert.equal(result.requiresApproval, false);
  });

  it('blocks partial product with trace match', () => {
    assert.equal(evaluateAllergens([], ['crustacean'], 'partial', family).blocked, true);
  });

  it('unverified without match requires approval', () => {
    const result = evaluateAllergens(['milk'], [], 'unverified', family);
    assert.equal(result.blocked, false);
    assert.equal(result.requiresApproval, true);
  });

  it('verified without match is safe', () => {
    const result = evaluateAllergens(['milk'], [], 'verified', family);
    assert.equal(result.blocked || result.requiresApproval, false);
  });
});

describe('alergia a mariscos bloquea crustáceos y moluscos', () => {
  it('shellfish blocks a crustacean product even when unverified', () => {
    const result = evaluateAllergens(['crustacean'], [], 'unverified', ['shellfish']);
    assert.equal(result.blocked, true);
    assert.equal(result.requiresApproval, false);
    assert.deepEqual(result.matchedAllergens, ['crustacean']);
  });

  it('shellfish blocks a mollusc product', () => {
    const result = evaluateAllergens(['mollusc'], [], 'partial', ['shellfish']);
    assert.equal(result.blocked, true);
    assert.deepEqual(result.matchedAllergens, ['mollusc']);
  });

  it('shellfish blocks crustacean traces on an unverified product', () => {
    const result = evaluateAllergens([], ['crustacean'], 'unverified', ['shellfish']);
    assert.equal(result.blocked, true);
    assert.equal(result.requiresApproval, false);
    assert.deepEqual(result.matchedTraces, ['crustacean']);
    assert.deepEqual(result.matchedAllergens, []);
  });

  it('shellfish blocks mollusc traces', () => {
    const result = evaluateAllergens([], ['mollusc'], 'unverified', ['shellfish']);
    assert.equal(result.blocked, true);
    assert.deepEqual(result.matchedTraces, ['mollusc']);
  });

  it('mariscos blocks both crustacean and mollusc, including traces', () => {
    const byAllergen = evaluateProductForFamily(
      { allergens: ['crustacean'], traces: [], allergenStatus: 'unverified' },
      { ana: ['mariscos'] },
    );
    const byTrace = evaluateProductForFamily(
      { allergens: [], traces: ['mollusc'], allergenStatus: 'unverified' },
      { ana: ['mariscos'] },
    );
    assert.equal(byAllergen.blocked, true);
    assert.deepEqual(byAllergen.matchedAllergens, ['crustacean']);
    assert.equal(byTrace.blocked, true);
    assert.deepEqual(byTrace.matchedTraces, ['mollusc']);
  });

  it('a crustacean-only allergy does not block mollusc', () => {
    const result = evaluateAllergens(['mollusc'], [], 'verified', ['crustacean']);
    assert.equal(result.blocked, false);
    assert.equal(evaluateAllergens(['crustacean'], [], 'verified', ['crustacean']).blocked, true);
  });

  it('fish does not block crustacean or mollusc, and shellfish does not block fish', () => {
    const fishFamily = evaluateAllergens(
      ['crustacean', 'mollusc'],
      ['crustacean'],
      'unverified',
      ['fish'],
    );
    assert.equal(fishFamily.blocked, false);
    assert.equal(fishFamily.requiresApproval, true);

    const pescado = evaluateAllergens(['mollusc'], ['crustacean'], 'verified', ['pescado']);
    assert.equal(pescado.blocked, false);
    assert.equal(pescado.requiresApproval, false);

    const fishProduct = evaluateAllergens(['fish'], [], 'verified', ['fish']);
    assert.equal(fishProduct.blocked, true);
    assert.deepEqual(fishProduct.matchedAllergens, ['fish']);

    const shellfishOnFish = evaluateAllergens(['fish'], [], 'unverified', ['shellfish']);
    assert.equal(shellfishOnFish.blocked, false);
    assert.equal(shellfishOnFish.requiresApproval, true);

    const mariscosOnFish = evaluateProductForFamily(
      { allergens: ['fish'], traces: [], allergenStatus: 'verified' },
      { hijo: ['mariscos'] },
    );
    assert.equal(mariscosOnFish.blocked, false);
  });
});
