/**
 * Un sustituto no es el mismo producto. Comparte categoría y, si se conoce,
 * la variante (entera con entera). Cambia la marca, el pack o el formato.
 */

import { NormalizedProduct } from './normalize';

export function substituteReason(left: NormalizedProduct, right: NormalizedProduct): string | null {
  if (left.identity === right.identity) return null;
  if (left.category === 'general' || right.category === 'general') return null;
  if (left.category !== right.category) return null;
  if (left.variant && right.variant && left.variant !== right.variant) return null;

  const brandDiff = Boolean(left.brand && right.brand && left.brand !== right.brand);
  const bothSized = left.sizeAmount != null && right.sizeAmount != null;
  const formatDiff = left.soldByWeight !== right.soldByWeight
    || left.packCount !== right.packCount
    || (bothSized && (left.sizeAmount !== right.sizeAmount || left.sizeUnit !== right.sizeUnit));

  if (brandDiff && formatDiff) return 'otra marca y otro formato';
  if (brandDiff) return 'otra marca';
  if (formatDiff) return 'otro formato';
  if ((left.brand && !right.brand) || (!left.brand && right.brand)) return 'marca no confirmada';
  return null;
}
