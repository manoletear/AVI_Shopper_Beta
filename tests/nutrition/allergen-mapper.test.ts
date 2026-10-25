import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mapOFFTags,
  extractAllergensFromText,
  mergeAllergens,
  determineAllergenStatus,
} from '../../src/lib/nutrition/allergen-mapper';
import { evaluateAllergens } from '../../src/lib/nutrition/check-allergens';
import { ALLERGENS_NOT_VERIFIED_NOTICE, MemberAllergies } from '../../src/types/nutrition';
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

function person(id: string, name: string, allergens: string[]): MemberAllergies {
  return { id, name, allergens };
}

const claudia = person('claudia', 'Claudia', ['frutos_secos', 'shellfish']);
const pedro = person('pedro', 'Pedro', ['fish']);

describe('evaluateAllergens', () => {
  it('names the member and does not block when the product contains their allergen', () => {
    const result = evaluateAllergens(['tree_nut'], [], 'verified', [claudia, pedro]);
    assert.equal('blocked' in result, false);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.notice, null);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].kind, 'contains');
    assert.equal(result.warnings[0].allergen, 'tree_nut');
    assert.deepEqual(result.warnings[0].members, [{ id: 'claudia', name: 'Claudia' }]);
    assert.equal(result.warnings[0].message, 'Contiene frutos secos — Claudia');
  });

  it('uses a traces warning and still requires approval', () => {
    const result = evaluateAllergens([], ['tree_nut'], 'verified', [claudia]);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.warnings[0].kind, 'traces');
    assert.equal(result.warnings[0].message, 'Puede contener frutos secos — Claudia');
  });

  it('unverified without match asks for approval and does not warn', () => {
    const result = evaluateAllergens(['milk'], [], 'unverified', [claudia]);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.notice, ALLERGENS_NOT_VERIFIED_NOTICE);
  });

  it('partial without match asks for approval with the same notice', () => {
    const result = evaluateAllergens(['milk'], [], 'partial', [pedro]);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.notice, ALLERGENS_NOT_VERIFIED_NOTICE);
  });

  it('verified without match does not ask for approval', () => {
    const result = evaluateAllergens(['milk'], [], 'verified', [claudia, pedro]);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.notice, null);
  });

  it('names every affected member', () => {
    const ana = person('ana', 'Ana', ['peanut']);
    const luis = person('luis', 'Luis', ['mani']);
    const result = evaluateAllergens(['peanut'], [], 'verified', [ana, luis, pedro]);
    assert.equal(result.warnings[0].message, 'Contiene maní — Ana y Luis');
    assert.deepEqual(result.warnings[0].members.map((member) => member.name), ['Ana', 'Luis']);
  });
});

describe('alergia a mariscos avisa crustáceos y moluscos', () => {
  it('shellfish warns on a crustacean product even when unverified', () => {
    const result = evaluateAllergens(['crustacean'], [], 'unverified', [claudia]);
    assert.equal('blocked' in result, false);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.notice, null);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].kind, 'contains');
    assert.equal(result.warnings[0].allergen, 'crustacean');
    assert.equal(result.warnings[0].members[0].name, 'Claudia');
    assert.equal(result.warnings[0].message, 'Contiene crustáceos — Claudia');
  });

  it('shellfish warns on a mollusc product', () => {
    const result = evaluateAllergens(['mollusc'], [], 'partial', [claudia]);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.warnings[0].kind, 'contains');
    assert.equal(result.warnings[0].allergen, 'mollusc');
    assert.equal(result.warnings[0].message, 'Contiene moluscos — Claudia');
  });

  it('shellfish warns on crustacean traces when unverified', () => {
    const result = evaluateAllergens([], ['crustacean'], 'unverified', [claudia]);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].kind, 'traces');
    assert.equal(result.warnings[0].allergen, 'crustacean');
    assert.equal(result.warnings[0].message, 'Puede contener crustáceos — Claudia');
  });

  it('mariscos warns on mollusc traces and names the member', () => {
    const ana = person('ana', 'Ana', ['mariscos']);
    const result = evaluateAllergens([], ['mollusc'], 'unverified', [ana, pedro]);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.warnings[0].kind, 'traces');
    assert.equal(result.warnings[0].allergen, 'mollusc');
    assert.deepEqual(result.warnings[0].members, [{ id: 'ana', name: 'Ana' }]);
    assert.equal(result.warnings[0].message, 'Puede contener moluscos — Ana');
  });

  it('a crustacean-only allergy does not warn on mollusc', () => {
    const onlyCrustacean = person('c', 'Claudia', ['crustacean']);
    const mollusc = evaluateAllergens(['mollusc'], [], 'verified', [onlyCrustacean]);
    assert.deepEqual(mollusc.warnings, []);
    assert.equal(mollusc.requiresApproval, false);
    const crustacean = evaluateAllergens(['crustacean'], [], 'verified', [onlyCrustacean]);
    assert.equal(crustacean.warnings[0].kind, 'contains');
    assert.equal(crustacean.requiresApproval, true);
  });

  it('fish does not warn on crustacean or mollusc, and shellfish does not warn on fish', () => {
    const fishOnly = evaluateAllergens(['crustacean', 'mollusc'], ['crustacean'], 'unverified', [pedro]);
    assert.deepEqual(fishOnly.warnings, []);
    assert.equal(fishOnly.requiresApproval, true);
    assert.equal(fishOnly.notice, ALLERGENS_NOT_VERIFIED_NOTICE);

    const pescado = evaluateAllergens(['mollusc'], ['crustacean'], 'verified', [
      person('p', 'Pedro', ['pescado']),
    ]);
    assert.deepEqual(pescado.warnings, []);
    assert.equal(pescado.requiresApproval, false);

    const fishProduct = evaluateAllergens(['fish'], [], 'verified', [pedro]);
    assert.equal(fishProduct.requiresApproval, true);
    assert.equal(fishProduct.warnings[0].kind, 'contains');
    assert.equal(fishProduct.warnings[0].message, 'Contiene pescado — Pedro');

    const shellfishOnFish = evaluateAllergens(['fish'], [], 'unverified', [claudia]);
    assert.deepEqual(shellfishOnFish.warnings, []);
    assert.equal(shellfishOnFish.requiresApproval, true);
    assert.equal(shellfishOnFish.notice, ALLERGENS_NOT_VERIFIED_NOTICE);

    const mariscosOnFish = evaluateAllergens(['fish'], [], 'verified', [
      person('ana', 'Ana', ['mariscos']),
    ]);
    assert.deepEqual(mariscosOnFish.warnings, []);
    assert.equal(mariscosOnFish.requiresApproval, false);
  });
});
