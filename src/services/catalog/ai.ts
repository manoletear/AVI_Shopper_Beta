/**
 * Parecido cuando el nombre no calza solo. Grok entra si hay XAI_API_KEY.
 * Sin clave se usa un puntaje local que nunca confirma solo: manda la revisión.
 */

import { NormalizedProduct } from './normalize';

export interface FuzzyCandidate {
  id: string;
  name: string;
  identity: string;
  brand: string | null;
  category: string;
  variant: string | null;
  normalized: NormalizedProduct;
}

export interface FuzzyDecision {
  candidateId: string | null;
  confidence: number;
  reason: string;
}

export interface FuzzyMatcher {
  match(listing: NormalizedProduct, candidates: FuzzyCandidate[]): Promise<FuzzyDecision>;
}

export function fuzzyScore(listing: NormalizedProduct, candidate: NormalizedProduct): number {
  if (listing.category === 'general' || candidate.category === 'general') return 0.2;
  if (listing.category !== candidate.category) return 0.05;
  if (listing.variant && candidate.variant && listing.variant !== candidate.variant) return 0.1;
  if (listing.brand && candidate.brand && listing.brand !== candidate.brand) return 0.35;
  let score = 0.2;
  if (listing.variant && listing.variant === candidate.variant) score += 0.25;
  if (listing.brand && listing.brand === candidate.brand) score += 0.3;
  else if (!listing.brand || !candidate.brand) score += 0.05;
  const sameSize = listing.sizeAmount != null
    && listing.sizeAmount === candidate.sizeAmount
    && listing.sizeUnit === candidate.sizeUnit
    && listing.packCount === candidate.packCount
    && listing.soldByWeight === candidate.soldByWeight;
  if (sameSize || (listing.soldByWeight && candidate.soldByWeight)) score += 0.2;
  return Math.min(0.84, Math.round(score * 100) / 100);
}

export const heuristicFuzzyMatcher: FuzzyMatcher = {
  async match(listing, candidates) {
    let best: FuzzyDecision = { candidateId: null, confidence: 0, reason: 'Sin parecido suficiente' };
    for (const candidate of candidates) {
      const confidence = fuzzyScore(listing, candidate.normalized);
      if (confidence > best.confidence) {
        best = {
          candidateId: candidate.id,
          confidence,
          reason: 'Parecido por marca, variante y formato. Sin clave de Grok no lo confirmo solo.',
        };
      }
    }
    return best;
  },
};

function readDecision(content: string): FuzzyDecision | null {
  const cleaned = content.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence)) return null;
    return {
      candidateId: parsed.candidateId ? String(parsed.candidateId) : null,
      confidence: Math.max(0, Math.min(1, confidence)),
      reason: String(parsed.reason || 'Grok'),
    };
  } catch {
    return null;
  }
}

export const grokFuzzyMatcher: FuzzyMatcher = {
  async match(listing, candidates) {
    const key = process.env.XAI_API_KEY;
    if (!key || candidates.length === 0) return heuristicFuzzyMatcher.match(listing, candidates);
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.XAI_MODEL || 'grok-4.7',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: 'Comparas fichas de supermercado chileno. Responde solo JSON {"candidateId":string|null,"confidence":number,"reason":string}. confidence va de 0 a 1. candidateId null si no es el mismo producto. No marques sustitutos de otra marca o otro corte como el mismo.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                listing: {
                  name: listing.rawName,
                  brand: listing.brand,
                  category: listing.category,
                  variant: listing.variant,
                  sizeAmount: listing.sizeAmount,
                  sizeUnit: listing.sizeUnit,
                  packCount: listing.packCount,
                  soldByWeight: listing.soldByWeight,
                },
                candidates: candidates.map((candidate) => ({
                  id: candidate.id,
                  name: candidate.name,
                  brand: candidate.brand,
                  category: candidate.category,
                  variant: candidate.variant,
                  identity: candidate.identity,
                })),
              }),
            },
          ],
        }),
      });
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      const decision = typeof content === 'string' ? readDecision(content) : null;
      if (!decision) return heuristicFuzzyMatcher.match(listing, candidates);
      return decision;
    } catch {
      return heuristicFuzzyMatcher.match(listing, candidates);
    }
  },
};

export function createFuzzyMatcher(env: NodeJS.ProcessEnv = process.env): FuzzyMatcher {
  return env.XAI_API_KEY ? grokFuzzyMatcher : heuristicFuzzyMatcher;
}
