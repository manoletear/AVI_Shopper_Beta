/**
 * Orden: código de barras, nombre normalizado, y recién ahí el parecido.
 * Por debajo de 0,85 la ficha queda para una persona.
 */

import { FuzzyCandidate, FuzzyMatcher } from './ai';
import { isSpecific, normalizeName, NormalizedProduct } from './normalize';

export const AUTO_CONFIDENCE = 0.85;
export const REVIEW_CONFIDENCE = 0.55;

export interface CatalogCandidate {
  id: string;
  name: string;
  ean?: string | null;
}

export interface MatchDecision {
  status: 'matched' | 'pending' | 'unmatched';
  method: 'ean' | 'rules' | 'ai' | null;
  confidence: number;
  canonicalId: string | null;
  reason: string;
  normalized: NormalizedProduct;
}

function asCandidate(candidate: CatalogCandidate): FuzzyCandidate {
  const normalized = normalizeName(candidate.name, candidate.ean);
  return {
    id: candidate.id,
    name: candidate.name,
    identity: normalized.identity,
    brand: normalized.brand,
    category: normalized.category,
    variant: normalized.variant,
    normalized,
  };
}

export async function matchListing(
  input: { rawName: string; ean?: string | null },
  catalog: CatalogCandidate[],
  matcher: FuzzyMatcher,
): Promise<MatchDecision> {
  const normalized = normalizeName(input.rawName, input.ean);
  const candidates = catalog.map(asCandidate);
  const base = {
    normalized,
    canonicalId: null as string | null,
    method: null as MatchDecision['method'],
    confidence: 0,
    reason: 'No encontré un producto igual',
    status: 'unmatched' as MatchDecision['status'],
  };

  if (normalized.ean) {
    const byCode = candidates.find((candidate) => candidate.normalized.ean === normalized.ean);
    if (byCode) {
      return {
        ...base,
        status: 'matched',
        method: 'ean',
        confidence: 1,
        canonicalId: byCode.id,
        reason: 'Mismo código de barras',
      };
    }
  }

  if (isSpecific(normalized)) {
    const exact = candidates.filter((candidate) => candidate.identity === normalized.identity);
    const exactMatch = exact[0];
    if (exact.length === 1 && exactMatch) {
      return {
        ...base,
        status: 'matched',
        method: 'rules',
        confidence: 0.98,
        canonicalId: exactMatch.id,
        reason: 'Mismo nombre normalizado',
      };
    }
    if (exact.length > 1 && exactMatch) {
      return {
        ...base,
        status: 'pending',
        method: 'rules',
        confidence: 0.7,
        canonicalId: exactMatch.id,
        reason: 'Hay dos productos canónicos con el mismo formato',
      };
    }

    const relaxed = candidates.filter((candidate) => {
      if (candidate.normalized.family !== normalized.family) return false;
      if (candidate.normalized.soldByWeight !== normalized.soldByWeight) return false;
      if (normalized.sizeAmount == null || candidate.normalized.sizeAmount == null) return true;
      return candidate.normalized.sizeAmount === normalized.sizeAmount
        && candidate.normalized.sizeUnit === normalized.sizeUnit
        && candidate.normalized.packCount === normalized.packCount;
    });
    const relaxedMatch = relaxed[0];
    if (relaxed.length === 1 && relaxedMatch && (normalized.sizeAmount == null || relaxedMatch.normalized.sizeAmount == null)) {
      return {
        ...base,
        status: 'matched',
        method: 'rules',
        confidence: 0.9,
        canonicalId: relaxedMatch.id,
        reason: 'Misma marca y variante; a uno de los dos le falta el tamaño',
      };
    }
  } else if (normalized.category !== 'general' && (normalized.brand || normalized.variant)) {
    const relaxed = candidates.filter((candidate) => candidate.normalized.family === normalized.family && candidate.normalized.soldByWeight === normalized.soldByWeight);
    const familyMatch = relaxed[0];
    if (relaxed.length === 1 && familyMatch) {
      return {
        ...base,
        status: 'matched',
        method: 'rules',
        confidence: 0.9,
        canonicalId: familyMatch.id,
        reason: 'Misma marca y variante; falta el tamaño en el nombre',
      };
    }
  }

  const fuzzy = await matcher.match(normalized, candidates);
  if (!fuzzy.candidateId || fuzzy.confidence < REVIEW_CONFIDENCE) return base;
  return {
    ...base,
    status: fuzzy.confidence >= AUTO_CONFIDENCE ? 'matched' : 'pending',
    method: 'ai',
    confidence: fuzzy.confidence,
    canonicalId: fuzzy.candidateId,
    reason: fuzzy.reason,
  };
}
