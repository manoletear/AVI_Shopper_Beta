/**
 * Restricciones duras del hogar.
 * La propuesta y los reemplazos tienen que pasar por aquí:
 * un alérgeno no se propone ni se ofrece como sustituto.
 */

import { AllergenId, ALLERGENS, SubstitutionMode } from '@/lib/onboarding/model';

const ALIASES: Record<string, AllergenId> = {
  mariscos: 'mariscos',
  marisco: 'mariscos',
  shellfish: 'mariscos',
  pescado: 'pescado',
  fish: 'pescado',
  gluten: 'gluten',
  trigo: 'gluten',
  lacteos: 'lacteos',
  lacteo: 'lacteos',
  lactosa: 'lacteos',
  leche: 'lacteos',
  dairy: 'lacteos',
  frutos_secos: 'frutos_secos',
  'frutos secos': 'frutos_secos',
  'frutos secos de arbol': 'frutos_secos',
  nueces: 'frutos_secos',
  mani: 'mani',
  'maní': 'mani',
  peanut: 'mani',
  cacahuate: 'mani',
  soya: 'soya',
  soja: 'soya',
  soy: 'soya',
  huevo: 'huevo',
  huevos: 'huevo',
  egg: 'huevo',
  sesamo: 'sesamo',
  'sésamo': 'sesamo',
  sesame: 'sesamo',
  mostaza: 'mostaza',
  mustard: 'mostaza',
};

export interface ProposalConstraints {
  allergens: string[];
  dislikes?: string[];
  proposeAlcohol?: boolean;
  substitutionMode?: SubstitutionMode;
  specificReplacements?: string[];
}

export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeAllergenId(value: string): AllergenId | null {
  const key = fold(value).replace(/[_-]+/g, ' ').trim();
  const compact = key.replace(/\s+/g, '_');
  return ALIASES[key] || ALIASES[compact] || ALIASES[key.replace(/\s+/g, '')] || null;
}

function hasWord(name: string, pattern: RegExp): boolean {
  return pattern.test(fold(name));
}

function matchesAllergen(name: string, id: AllergenId): boolean {
  const text = fold(name);
  if (id === 'mariscos') {
    return hasWord(text, /\b(marisc\w*|camaron\w*|jaiba\w*|langosta\w*|langostino\w*|ostion\w*|mejillon\w*|chorito\w*|almeja\w*|pulpo\w*|calamar\w*|centolla\w*|macha\w*|erizo\w*|loco\b|ostra\w*|camaron)\b/);
  }
  if (id === 'pescado') {
    return hasWord(text, /\b(pescad\w*|salmon\w*|atun\w*|merluza\w*|reineta\w*|jurel\w*|trucha\w*|sardina\w*|bacalao\w*|congrio\w*)\b/);
  }
  if (id === 'gluten') {
    return hasWord(text, /\b(gluten|trigo|harina|fideo\w*|pasta\w*|marraqueta\w*|hallulla\w*|galleta\w*|avena|cebada|centeno|pizza\w*|empanada\w*|pan)\b/);
  }
  if (id === 'lacteos') {
    const plantMilk = /\bleche de (soya|soja|almendra|avena|coco|arroz|arveja)\b/.test(text);
    const dairy = /\b(queso\w*|yogurt\w*|yogur\w*|mantequilla\w*|manjar\w*|helado\w*|lacteo\w*|quesillo\w*|mantecoso\w*|crema)\b/.test(text)
      || (/\bleche\b/.test(text) && !plantMilk);
    return dairy;
  }
  if (id === 'frutos_secos') {
    return hasWord(text, /\b(nuez\w*|almendra\w*|avellana\w*|pistacho\w*|castana\w*|maranon\w*|pecana\w*|nogal\w*|anacardo\w*|macadamia\w*)\b/);
  }
  if (id === 'mani') return hasWord(text, /\b(mani\w*|peanut\w*|cacahuate\w*)\b/);
  if (id === 'soya') return hasWord(text, /\b(soya|soja|tofu|edamame)\b/);
  if (id === 'huevo') return hasWord(text, /\b(huevo\w*|mayonesa\w*|merengue\w*)\b/);
  if (id === 'sesamo') return hasWord(text, /\b(sesamo|tahini|ajonjoli)\b/);
  if (id === 'mostaza') return hasWord(text, /\bmostaza\w*\b/);
  return false;
}

export function isAllergenItem(name: string, allergens: string[]): boolean {
  const ids = new Set<AllergenId>();
  for (const allergen of allergens) {
    const id = normalizeAllergenId(allergen);
    if (id) ids.add(id);
  }
  for (const id of ids) {
    if (matchesAllergen(name, id)) return true;
  }
  return false;
}

export function isAlcoholItem(name: string): boolean {
  const text = fold(name);
  if (/\bvinagre\b/.test(text)) return false;
  return /\b(vino\w*|pisco\w*|cerveza\w*|ron\b|whisky\w*|whiskey\w*|vodka\w*|gin\b|espumante\w*|champana\w*|licor\w*|piscola\w*)\b/.test(text);
}

export function matchesDislike(name: string, dislike: string): boolean {
  const needle = fold(dislike).trim();
  if (needle.length < 3) return false;
  return fold(name).includes(needle);
}

export function allowsProposedItem(name: string, constraints: ProposalConstraints): boolean {
  if (isAllergenItem(name, constraints.allergens)) return false;
  if (constraints.proposeAlcohol === false && isAlcoholItem(name)) return false;
  if ((constraints.dislikes || []).some((dislike) => matchesDislike(name, dislike))) return false;
  return true;
}

function sameProduct(left: string, right: string): boolean {
  const a = fold(left);
  const b = fold(right);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/** Un reemplazo nunca puede ser un alérgeno, aunque el modo sea mejor coincidencia. */
export function allowsSubstitution(candidateName: string, constraints: ProposalConstraints): boolean {
  if (!allowsProposedItem(candidateName, constraints)) return false;
  const mode = constraints.substitutionMode ?? 'best_match';
  if (mode === 'none') return false;
  if (mode === 'specific') {
    const names = constraints.specificReplacements || [];
    return names.some((name) => sameProduct(candidateName, name));
  }
  return true;
}

export function offerFitsHousehold(
  itemName: string,
  offerName: string,
  constraints: ProposalConstraints | undefined,
): boolean {
  if (!constraints) return true;
  if (!allowsProposedItem(offerName, constraints)) return false;
  const requestedIsBlocked = !itemName.includes('|') && !allowsProposedItem(itemName, constraints);
  if (sameProduct(itemName, offerName)) return !requestedIsBlocked;
  if (requestedIsBlocked) return allowsSubstitution(offerName, constraints);
  return allowsSubstitution(offerName, constraints);
}

export function collectAllergens(members: { allergies: string | null }[]): string[] {
  const found = new Set<string>();
  for (const member of members) {
    if (!member.allergies) continue;
    try {
      const parsed = JSON.parse(member.allergies);
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        const id = normalizeAllergenId(String(item));
        if (id) found.add(id);
      }
    } catch {
      continue;
    }
  }
  return [...found];
}

export function allergenLabel(id: string): string {
  return ALLERGENS.find((item) => item.id === id)?.label || id;
}
