/**
 * El más barato se elige entre fichas del mismo producto.
 * Otra marca, otro pack o un corte distinto se muestran aparte.
 */

import { normalizeName, NormalizedProduct, pricePerUnit } from './normalize';
import { allowsProposedItem, allowsSubstitution, ProposalConstraints } from '../household/constraints';
import { proposeSubstituteReason } from './substitutes';

export type CatalogRelation = 'same' | 'substitute' | 'other';

export interface CatalogTag {
  relation: CatalogRelation;
  reason: string;
  pricePerUnitLabel: string | null;
}

interface PricedName {
  name: string;
  price: number;
}

function convertPreferred(amount: number, unit: string): { amount: number; unit: 'g' | 'ml' | 'un' } | null {
  const normalized = unit.toLowerCase();
  if (normalized === 'kg') return { amount: Math.round(amount * 1000), unit: 'g' };
  if (normalized === 'g' || normalized === 'gr' || normalized === 'grs') return { amount: Math.round(amount), unit: 'g' };
  if (normalized === 'l' || normalized === 'lt' || normalized === 'litro' || normalized === 'litros') {
    return { amount: Math.round(amount * 1000), unit: 'ml' };
  }
  if (normalized === 'ml' || normalized === 'cc') return { amount: Math.round(amount), unit: 'ml' };
  if (normalized === 'un' || normalized === 'und') return { amount: Math.round(amount), unit: 'un' };
  return null;
}

export function queryProfile(query: string): { norm: NormalizedProduct; preferred: { amount: number; unit: 'g' | 'ml' | 'un' } | null } {
  const hasPack = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|ml|cc|lt|l|litro|litros)\b/i.test(query);
  if (hasPack) return { norm: normalizeName(query), preferred: null };
  const tail = query.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|ml|cc|lt|l|litro|litros|un|und)\s*$/i);
  if (!tail || tail.index == null) return { norm: normalizeName(query), preferred: null };
  const preferred = convertPreferred(Number(tail[1].replace(',', '.')), tail[2]);
  const productText = query.slice(0, tail.index).trim();
  return { norm: normalizeName(productText || query), preferred };
}

function sameFamily(query: NormalizedProduct, offer: NormalizedProduct): boolean {
  if (query.category !== offer.category) return false;
  if (query.brand && offer.brand && query.brand !== offer.brand) return false;
  if (query.variant && offer.variant && query.variant !== offer.variant) return false;
  if (query.soldByWeight && !offer.soldByWeight) return false;
  if (query.sizeAmount != null && offer.sizeAmount != null) {
    return query.sizeAmount === offer.sizeAmount
      && query.sizeUnit === offer.sizeUnit
      && query.packCount === offer.packCount
      && query.soldByWeight === offer.soldByWeight;
  }
  return true;
}

function dimensionOk(offer: NormalizedProduct, preferred: { unit: 'g' | 'ml' | 'un' } | null): boolean {
  if (!preferred || !offer.sizeUnit) return true;
  return offer.sizeUnit === preferred.unit;
}

function isPrimary(
  query: NormalizedProduct,
  offer: NormalizedProduct,
  preferred: { amount: number; unit: 'g' | 'ml' | 'un' } | null,
): boolean {
  if (!sameFamily(query, offer)) return false;
  if (query.soldByWeight || offer.soldByWeight) return query.soldByWeight && offer.soldByWeight;
  if (query.sizeAmount != null) {
    return offer.sizeAmount === query.sizeAmount
      && offer.sizeUnit === query.sizeUnit
      && offer.packCount === query.packCount;
  }
  if (preferred && offer.packCount === 1 && offer.sizeAmount === preferred.amount && offer.sizeUnit === preferred.unit) {
    return true;
  }
  return false;
}

export function shouldShowWithQuery(query: string, name: string, price = 0): boolean {
  const queryWords = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  if (queryWords.some((word) => name.toLowerCase().includes(word))) return true;
  const tag = tagOffers(query, [{ name, price }])[0];
  if (tag.relation === 'same' || tag.relation === 'substitute') return true;
  const left = queryProfile(query).norm;
  const right = normalizeName(name);
  if (left.category === 'general' || left.category !== right.category || !left.variant || !right.variant || left.variant === right.variant) {
    return false;
  }
  let shared = 0;
  while (shared < left.variant.length && shared < right.variant.length && left.variant[shared] === right.variant[shared]) shared += 1;
  return shared >= 5;
}

export function tagOffers<T extends PricedName>(
  query: string,
  offers: T[],
  constraints?: ProposalConstraints,
): CatalogTag[] {
  const profile = queryProfile(query);
  const norms = offers.map((offer) => normalizeName(offer.name));
  if (profile.norm.category === 'general') {
    return norms.map((norm, index) => ({
      relation: 'same',
      reason: '',
      pricePerUnitLabel: pricePerUnit(norm, offers[index].price)?.label || null,
    }));
  }

  let primary = norms.map((norm) => isPrimary(profile.norm, norm, profile.preferred));
  if (!primary.some(Boolean)) {
    primary = norms.map((norm) => sameFamily(profile.norm, norm) && !norm.soldByWeight && norm.packCount === 1 && dimensionOk(norm, profile.preferred));
  }
  if (!primary.some(Boolean)) {
    primary = norms.map((norm) => sameFamily(profile.norm, norm));
  }

  return norms.map((norm, index) => {
    const unit = pricePerUnit(norm, offers[index].price)?.label || null;
    const name = offers[index].name;
    if (constraints && !allowsProposedItem(name, constraints)) {
      return { relation: 'other', reason: 'No cumple las restricciones del hogar', pricePerUnitLabel: unit };
    }
    if (norm.category === 'general') return { relation: 'same', reason: '', pricePerUnitLabel: unit };
    if (primary[index]) return { relation: 'same', reason: '', pricePerUnitLabel: unit };
    if (constraints && !allowsSubstitution(name, constraints)) {
      return { relation: 'other', reason: 'No cumple las restricciones del hogar', pricePerUnitLabel: unit };
    }
    const reason = proposeSubstituteReason(profile.norm, norm, name, constraints);
    if (reason || sameFamily(profile.norm, norm)) {
      return { relation: 'substitute', reason: reason || 'otro formato', pricePerUnitLabel: unit };
    }
    return { relation: 'other', reason: 'No es el mismo producto', pricePerUnitLabel: unit };
  });
}
