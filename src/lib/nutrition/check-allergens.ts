import { prisma } from '@/lib/prisma';
import {
  AllergenCheckResult,
  AllergenDecision,
  AllergenMemberRef,
  AllergenStatus,
  AllergenWarning,
  AllergenWarningKind,
  ALLERGENS_NOT_VERIFIED_NOTICE,
  MemberAllergies,
  NormalizedAllergen,
  NORMALIZED_ALLERGENS,
} from '@/types/nutrition';

const PRODUCT_VOCAB = new Set<string>(NORMALIZED_ALLERGENS);

/**
 * Alias de la familia → vocabulario de la tabla.
 * shellfish y mariscos cubren crustacean Y mollusc.
 * fish y pescado cubren solo fish: no coinciden con mariscos.
 */
const FAMILY_ALIAS: Record<string, readonly NormalizedAllergen[]> = {
  shellfish: ['crustacean', 'mollusc'],
  mariscos: ['crustacean', 'mollusc'],
  marisco: ['crustacean', 'mollusc'],
  crustacean: ['crustacean'],
  crustaceans: ['crustacean'],
  crustaceo: ['crustacean'],
  crustaceos: ['crustacean'],
  mollusc: ['mollusc'],
  molluscs: ['mollusc'],
  mollusk: ['mollusc'],
  mollusks: ['mollusc'],
  molusco: ['mollusc'],
  moluscos: ['mollusc'],
  fish: ['fish'],
  pescado: ['fish'],
  pescados: ['fish'],
  peanut: ['peanut'],
  peanuts: ['peanut'],
  mani: ['peanut'],
  tree_nut: ['tree_nut'],
  frutos_secos: ['tree_nut'],
  gluten: ['gluten'],
  milk: ['milk'],
  lacteos: ['milk'],
  lactosa: ['milk'],
  egg: ['egg'],
  huevo: ['egg'],
  huevos: ['egg'],
  soy: ['soy'],
  soya: ['soy'],
  soja: ['soy'],
  sesame: ['sesame'],
  sesamo: ['sesame'],
  sulfites: ['sulfites'],
  sulfitos: ['sulfites'],
  mustard: ['mustard'],
  mostaza: ['mustard'],
  celery: ['celery'],
  apio: ['celery'],
  lupin: ['lupin'],
  lupino: ['lupin'],
  altramuz: ['lupin'],
};

function foldToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_');
}

export function expandFamilyAllergens(familyAllergens: Iterable<string>): Set<NormalizedAllergen> {
  const expanded = new Set<NormalizedAllergen>();
  for (const raw of familyAllergens) {
    const key = foldToken(raw);
    const mapped = FAMILY_ALIAS[key];
    if (mapped) {
      for (const allergen of mapped) expanded.add(allergen);
      continue;
    }
    if (PRODUCT_VOCAB.has(key)) expanded.add(key as NormalizedAllergen);
  }
  return expanded;
}

function matchingTokens(
  tokens: readonly string[],
  family: Set<NormalizedAllergen>,
): NormalizedAllergen[] {
  const matched = new Set<NormalizedAllergen>();
  for (const token of tokens) {
    for (const allergen of expandFamilyAllergens([token])) {
      if (family.has(allergen)) matched.add(allergen);
    }
  }
  return Array.from(matched).sort();
}

const ALLERGEN_LABELS: Record<NormalizedAllergen, string> = {
  peanut: 'maní',
  tree_nut: 'frutos secos',
  fish: 'pescado',
  crustacean: 'crustáceos',
  mollusc: 'moluscos',
  gluten: 'gluten',
  milk: 'lácteos',
  egg: 'huevo',
  soy: 'soya',
  sesame: 'sésamo',
  sulfites: 'sulfitos',
  mustard: 'mostaza',
  celery: 'apio',
  lupin: 'lupino',
};

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'un integrante';
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export function formatAllergenWarning(
  kind: AllergenWarningKind,
  allergen: NormalizedAllergen,
  members: readonly { name: string }[],
): string {
  const lead = kind === 'contains' ? 'Contiene' : 'Puede contener';
  return `${lead} ${ALLERGEN_LABELS[allergen]} — ${joinNames(members.map((member) => member.name))}`;
}

function hitsForMember(token: string, memberAllergens: readonly string[]): NormalizedAllergen[] {
  const family = expandFamilyAllergens(memberAllergens);
  return matchingTokens([token], family);
}

function warningsFor(
  tokens: readonly string[],
  kind: AllergenWarningKind,
  members: readonly MemberAllergies[],
): AllergenWarning[] {
  const byAllergen = new Map<NormalizedAllergen, AllergenMemberRef[]>();
  for (const token of tokens) {
    for (const member of members) {
      for (const allergen of hitsForMember(token, member.allergens)) {
        const affected = byAllergen.get(allergen) ?? [];
        if (!affected.some((item) => item.id === member.id)) {
          affected.push({ id: member.id, name: member.name });
        }
        byAllergen.set(allergen, affected);
      }
    }
  }
  return Array.from(byAllergen.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([allergen, affected]) => ({
      allergen,
      kind,
      members: affected,
      message: formatAllergenWarning(kind, allergen, affected),
    }));
}

/**
 * La alergia es del integrante, no de toda la familia.
 * Un match (contiene o trazas) avisa y pide aprobación: no bloquea,
 * no entra al carro en silencio y no se propone como sustituto sin el aviso.
 * Sin match, unverified/partial piden aprobación con el aviso de no verificado.
 * verified sin match no pide aprobación.
 *
 * shellfish/mariscos avisan por crustacean y mollusc. fish/pescado no.
 */
export function evaluateAllergens(
  allergens: readonly string[],
  traces: readonly string[],
  status: AllergenStatus,
  members: readonly MemberAllergies[],
): AllergenDecision {
  const warnings = [
    ...warningsFor(allergens, 'contains', members),
    ...warningsFor(traces, 'traces', members),
  ];
  if (warnings.length > 0) {
    return { warnings, requiresApproval: true, notice: null };
  }
  if (status !== 'verified') {
    return { warnings, requiresApproval: true, notice: ALLERGENS_NOT_VERIFIED_NOTICE };
  }
  return { warnings, requiresApproval: false, notice: null };
}

export function evaluateProductForFamily(
  product: {
    allergens: readonly string[];
    traces: readonly string[];
    allergenStatus: AllergenStatus;
  },
  members: readonly MemberAllergies[],
): AllergenDecision {
  return evaluateAllergens(product.allergens, product.traces, product.allergenStatus, members);
}

function asStatus(value: string): AllergenStatus {
  if (value === 'verified' || value === 'partial' || value === 'unverified') return value;
  return 'unverified';
}

/**
 * Compara el producto con las alergias de cada integrante.
 * Un match devuelve warnings (contiene o trazas) y requiresApproval.
 * No hay resultado blocked.
 */
export async function checkAllergens(
  productNutritionId: string,
  members: readonly MemberAllergies[],
): Promise<AllergenCheckResult> {
  const product = await prisma.productNutrition.findUnique({
    where: { id: productNutritionId },
    select: {
      id: true,
      name: true,
      allergens: true,
      traces: true,
      allergenStatus: true,
    },
  });

  if (!product) {
    return {
      productId: productNutritionId,
      productName: 'Unknown',
      allergenStatus: 'unverified',
      warnings: [],
      requiresApproval: true,
      notice: ALLERGENS_NOT_VERIFIED_NOTICE,
    };
  }

  const status = asStatus(product.allergenStatus);
  const decision = evaluateProductForFamily(
    {
      allergens: product.allergens ?? [],
      traces: product.traces ?? [],
      allergenStatus: status,
    },
    members,
  );

  return {
    productId: productNutritionId,
    productName: product.name,
    allergenStatus: status,
    warnings: decision.warnings,
    requiresApproval: decision.requiresApproval,
    notice: decision.notice,
  };
}

/**
 * Separa lo que puede entrar solo de lo que el aprobador tiene que ver.
 * Un warning no va a `safe`: no se agrega en silencio ni se propone
 * como sustituto sin mostrar el aviso.
 */
export async function batchCheckAllergens(
  productNutritionIds: string[],
  members: readonly MemberAllergies[],
): Promise<{
  safe: AllergenCheckResult[];
  needsApproval: AllergenCheckResult[];
}> {
  const results = await Promise.all(
    productNutritionIds.map((id) => checkAllergens(id, members)),
  );

  return {
    safe: results.filter((row) => !row.requiresApproval),
    needsApproval: results.filter((row) => row.requiresApproval),
  };
}
