import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mapOFFTags,
  extractAllergensFromText,
  mergeAllergens,
  determineAllergenStatus,
} from '../../src/lib/nutrition/allergen-mapper';
import { evaluateAllergens } from '../../src/lib/nutrition/check-allergens';

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

  it('maps shellfish variants', () => {
    const tags = ['en:crustaceans', 'en:molluscs'];
    expect(mapOFFTags(tags)).toEqual(['shellfish']);
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
    expect(determineAllergenStatus(null, true)).toBe('unverified');
    expect(determineAllergenStatus('', true)).toBe('unverified');
  });

  it('returns verified when ingredients exist and sources agree', () => {
    expect(determineAllergenStatus('Harina, azúcar', true)).toBe('verified');
  });

  it('returns partial when sources disagree', () => {
    expect(determineAllergenStatus('Harina, azúcar', false)).toBe('partial');
  });
});

describe('evaluateAllergens', () => {
  const family = new Set(['peanut', 'shellfish'] as const) as Set<any>;
  it('blocks unverified product with allergen match', () => {
    const r = evaluateAllergens(['peanut'], [], 'unverified', family);
    assert.equal(r.blocked, true);
    assert.equal(r.requiresApproval, false);
  });
  it('blocks partial product with trace match', () => {
    assert.equal(evaluateAllergens([], ['shellfish'], 'partial', family).blocked, true);
  });
  it('unverified without match requires approval', () => {
    const r = evaluateAllergens(['milk'], [], 'unverified', family);
    assert.equal(r.blocked, false);
    assert.equal(r.requiresApproval, true);
  });
  it('verified without match is safe', () => {
    const r = evaluateAllergens(['milk'], [], 'verified', family);
    assert.equal(r.blocked || r.requiresApproval, false);
  });
});
