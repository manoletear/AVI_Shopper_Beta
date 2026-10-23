export type ReviewAction = 'confirm' | 'reject' | 'merge';

export interface ReviewInput {
  id: string;
  listingId: string;
  suggestedId: string | null;
  status: string;
}

export interface ReviewOutcome {
  listing: {
    canonicalId: string | null;
    matchStatus: 'matched' | 'rejected';
    matchMethod: 'human';
    matchConfidence: number;
  };
  review: {
    status: 'confirmed' | 'rejected' | 'merged';
    resolverNote: string | null;
  };
  reassignFrom: string | null;
}

export function applyReview(action: ReviewAction, review: ReviewInput, canonicalId?: string | null, note?: string | null): ReviewOutcome {
  if (review.status !== 'pending') {
    throw new Error('Esta ficha ya fue revisada');
  }
  const resolverNote = note?.trim() || null;
  if (action === 'confirm') {
    if (!review.suggestedId) throw new Error('No hay un producto sugerido');
    return {
      listing: {
        canonicalId: review.suggestedId,
        matchStatus: 'matched',
        matchMethod: 'human',
        matchConfidence: 1,
      },
      review: { status: 'confirmed', resolverNote },
      reassignFrom: null,
    };
  }
  if (action === 'reject') {
    return {
      listing: {
        canonicalId: null,
        matchStatus: 'rejected',
        matchMethod: 'human',
        matchConfidence: 0,
      },
      review: { status: 'rejected', resolverNote },
      reassignFrom: null,
    };
  }
  if (!canonicalId) throw new Error('Elige el producto con el que se fusiona');
  return {
    listing: {
      canonicalId,
      matchStatus: 'matched',
      matchMethod: 'human',
      matchConfidence: 1,
    },
    review: { status: 'merged', resolverNote },
    reassignFrom: null,
  };
}
