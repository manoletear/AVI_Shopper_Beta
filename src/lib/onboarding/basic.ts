/**
 * Onboarding básico (5 pasos) y perfil progresivo.
 * Las alergias avisan por integrante: no bloquean la compra.
 * La sustitución parte en propose_approve.
 */

import { z } from 'zod';
import {
  CADENCES,
  DELIVERY_SLOTS,
  DIET_TAGS,
  DietTagId,
  StepState,
  SUBSTITUTION_MODES,
  WEEKDAYS,
  emptyStepState,
  parseStepState,
} from '@/lib/onboarding/model';

export const BASIC_DONE = 'basic_done';
export const DEFAULT_SUBSTITUTION_MODE = 'propose_approve' as const;

export const BASIC_STEP_IDS = ['address', 'household', 'allergies', 'stores', 'approver'] as const;
export type BasicStepId = (typeof BASIC_STEP_IDS)[number];

export const HOUSING_TYPES = ['casa', 'casa en condominio', 'departamento'] as const;
export type HousingType = (typeof HOUSING_TYPES)[number];

export const HOUSING_OPTIONS: { id: HousingType; label: string; hint: string; recommended?: boolean }[] = [
  { id: 'casa', label: 'Casa', hint: 'Llegamos a la puerta', recommended: true },
  { id: 'casa en condominio', label: 'Casa en condominio', hint: 'Conserjería o portón' },
  { id: 'departamento', label: 'Departamento', hint: 'Piso, depto y conserjería' },
];

export const CHILD_AGES = [
  { id: '0-2', label: '0–2' },
  { id: '3-5', label: '3–5' },
  { id: '6-12', label: '6–12', recommended: true },
  { id: '13-17', label: '13–17' },
] as const;
export type ChildAge = (typeof CHILD_AGES)[number]['id'];

export const SEX_OPTIONS = [
  { id: 'mujer', label: 'Mujer' },
  { id: 'hombre', label: 'Hombre' },
  { id: 'otro', label: 'Otro' },
] as const;
export type MemberSex = (typeof SEX_OPTIONS)[number]['id'];

export const PET_SPECIES = [
  { id: 'perro', label: 'Perro', recommended: true },
  { id: 'gato', label: 'Gato' },
  { id: 'otro', label: 'Otra' },
] as const;
export const PET_SIZES = [
  { id: 'pequeño', label: 'Pequeño' },
  { id: 'mediano', label: 'Mediano', recommended: true },
  { id: 'grande', label: 'Grande' },
] as const;
export const PET_AGES = [
  { id: 'cachorro', label: 'Cachorro' },
  { id: 'adulto', label: 'Adulto', recommended: true },
  { id: 'senior', label: 'Senior' },
] as const;

export const BASIC_ALLERGENS = [
  'ninguna',
  'mani_frutos_secos',
  'mariscos',
  'pescado',
  'gluten',
  'lacteos',
  'huevo',
  'soya',
] as const;
export type BasicAllergen = (typeof BASIC_ALLERGENS)[number];

export const BASIC_ALLERGEN_OPTIONS: { id: BasicAllergen; label: string; recommended?: boolean }[] = [
  { id: 'ninguna', label: 'Ninguna', recommended: true },
  { id: 'mani_frutos_secos', label: 'Maní y frutos secos' },
  { id: 'mariscos', label: 'Mariscos' },
  { id: 'pescado', label: 'Pescado' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'lacteos', label: 'Lácteos' },
  { id: 'huevo', label: 'Huevo' },
  { id: 'soya', label: 'Soya' },
];

export const STORE_CHAINS = ['jumbo', 'lider', 'unimarc', 'tottus'] as const;
export type StoreChainId = (typeof STORE_CHAINS)[number];
export const STORE_OPTIONS: { id: StoreChainId; label: string }[] = [
  { id: 'jumbo', label: 'Jumbo' },
  { id: 'lider', label: 'Lider' },
  { id: 'unimarc', label: 'Unimarc' },
  { id: 'tottus', label: 'Tottus' },
];

export const PROGRESSIVE_IDS = [
  'presupuesto',
  'cadencia',
  'sustitucion',
  'alcohol',
  'dietas',
  'marcas',
  'categorias',
  'horarios',
  'mascotas_aseo',
] as const;
export type ProgressiveId = (typeof PROGRESSIVE_IDS)[number];

export const PROGRESSIVE_STEPS: { id: ProgressiveId; label: string; hint: string }[] = [
  { id: 'presupuesto', label: 'Presupuesto mensual', hint: 'Tope del mes' },
  { id: 'cadencia', label: 'Cadencia', hint: 'Cada cuánto repones' },
  { id: 'sustitucion', label: 'Preferencia de sustitución', hint: 'Proponer reemplazo y que yo apruebe' },
  { id: 'alcohol', label: 'Alcohol', hint: 'Sí o no' },
  { id: 'dietas', label: 'Dietas', hint: 'Y a quién aplican' },
  { id: 'marcas', label: 'Marcas', hint: 'Fijas o la más conveniente' },
  { id: 'categorias', label: 'Categorías', hint: 'Qué compra AVI' },
  { id: 'horarios', label: 'Horarios de entrega', hint: 'Día y ventana' },
  { id: 'mascotas_aseo', label: 'Mascotas y aseo', hint: 'Alimento y limpieza' },
];

export const MONTHLY_OPTIONS = [300000, 200000, 450000, 600000] as const;
export const SHOP_CATEGORIES = [
  { id: 'despensa', label: 'Despensa', recommended: true },
  { id: 'frutas_verduras', label: 'Frutas y verduras', recommended: true },
  { id: 'lacteos', label: 'Lácteos', recommended: true },
  { id: 'carnes', label: 'Carnes' },
  { id: 'aseo', label: 'Aseo', recommended: true },
  { id: 'mascotas', label: 'Mascotas' },
  { id: 'bebes', label: 'Bebés' },
  { id: 'bebidas', label: 'Bebidas' },
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number]['id'];
export const DEFAULT_CATEGORIES: ShopCategory[] = ['despensa', 'frutas_verduras', 'lacteos', 'aseo'];

const housingTypeSchema = z.enum(HOUSING_TYPES);
const childAgeSchema = z.enum(['0-2', '3-5', '6-12', '13-17']);
const sexSchema = z.enum(['mujer', 'hombre', 'otro']);
const basicAllergenSchema = z.enum(BASIC_ALLERGENS);
const chainSchema = z.enum(STORE_CHAINS);

export const addressStepSchema = z.object({
  street: z.string().trim().min(3, 'Escribe la calle.'),
  number: z.string().trim().min(1, 'Escribe el número.'),
  unit: z.string().trim().max(40).optional(),
  comuna: z.string().trim().min(2, 'Escribe la comuna.'),
  housingType: housingTypeSchema,
  accessNote: z.string().trim().max(240, 'La nota de acceso es muy larga.').optional(),
});
export type AddressStep = z.infer<typeof addressStepSchema>;

export const memberDraftSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, 'Cada persona necesita un nombre.').max(60),
  kind: z.enum(['adult', 'child', 'nana']),
  ageRange: childAgeSchema.nullish(),
  sex: sexSchema.nullish(),
  nanaMode: z.enum(['adentro', 'afuera']).nullish(),
});
export type MemberDraft = z.infer<typeof memberDraftSchema>;

export const petDraftSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().max(40).optional(),
  species: z.enum(['perro', 'gato', 'otro']),
  breed: z.string().trim().max(60).optional(),
  size: z.enum(['pequeño', 'mediano', 'grande']),
  age: z.enum(['cachorro', 'adulto', 'senior']),
});
export type PetDraft = z.infer<typeof petDraftSchema>;

export const householdStepSchema = z.object({
  people: z.number().int().min(1, 'Indica cuántas personas.').max(12),
  adults: z.number().int().min(1, 'Tiene que haber al menos un adulto.').max(12),
  children: z.number().int().min(0).max(12),
  hasNana: z.boolean(),
  nanaMode: z.enum(['adentro', 'afuera']).nullable(),
  members: z.array(memberDraftSchema).min(1).max(12),
  pets: z.array(petDraftSchema).max(6),
}).superRefine((value, ctx) => {
  const nana = value.hasNana ? 1 : 0;
  if (value.hasNana && !value.nanaMode) {
    ctx.addIssue({ code: 'custom', message: 'Elige si la nana es puertas adentro o afuera.', path: ['nanaMode'] });
  }
  if (!value.hasNana && value.nanaMode) {
    ctx.addIssue({ code: 'custom', message: 'Sin nana no va el tipo de puerta.', path: ['nanaMode'] });
  }
  if (value.adults + value.children + nana !== value.people) {
    ctx.addIssue({
      code: 'custom',
      message: 'Adultos, niños y nana tienen que sumar las personas. La nana cuenta en las cantidades.',
      path: ['people'],
    });
  }
  const adults = value.members.filter((member) => member.kind === 'adult');
  const children = value.members.filter((member) => member.kind === 'child');
  const nanas = value.members.filter((member) => member.kind === 'nana');
  if (adults.length !== value.adults || children.length !== value.children || nanas.length !== nana) {
    ctx.addIssue({ code: 'custom', message: 'Faltan nombres para el hogar que armaste.', path: ['members'] });
  }
  if (children.some((child) => !child.ageRange)) {
    ctx.addIssue({ code: 'custom', message: 'Elige la edad de cada niño.', path: ['members'] });
  }
  if (nanas.some((member) => member.nanaMode !== value.nanaMode)) {
    ctx.addIssue({ code: 'custom', message: 'La nana tiene que coincidir con puertas adentro o afuera.', path: ['members'] });
  }
});
export type HouseholdStep = z.infer<typeof householdStepSchema>;

export const allergiesStepSchema = z.object({
  allergens: z.array(basicAllergenSchema).min(1, 'Elige al menos una opción.'),
  assignments: z.array(z.object({
    allergen: basicAllergenSchema,
    memberName: z.string().trim().min(1, 'Indica quién tiene la alergia.'),
  })).max(40),
}).superRefine((value, ctx) => {
  const unique = new Set(value.allergens);
  if (unique.has('ninguna') && unique.size > 1) {
    ctx.addIssue({ code: 'custom', message: 'Si no hay alergias, deja solo Ninguna.', path: ['allergens'] });
  }
  if (unique.has('ninguna') && value.assignments.length) {
    ctx.addIssue({ code: 'custom', message: 'Ninguna no se asigna a una persona.', path: ['assignments'] });
  }
  const real = [...unique].filter((id) => id !== 'ninguna');
  for (const allergen of real) {
    if (!value.assignments.some((row) => row.allergen === allergen)) {
      const label = BASIC_ALLERGEN_OPTIONS.find((item) => item.id === allergen)?.label || allergen;
      ctx.addIssue({ code: 'custom', message: `Indica quién tiene alergia a ${label}.`, path: ['assignments'] });
    }
  }
  for (const row of value.assignments) {
    if (row.allergen === 'ninguna' || !unique.has(row.allergen)) {
      ctx.addIssue({ code: 'custom', message: 'La alergia asignada no está marcada.', path: ['assignments'] });
    }
  }
});
export type AllergiesStep = z.infer<typeof allergiesStepSchema>;

export const storesStepSchema = z.object({
  chains: z.array(chainSchema).min(1, 'Elige al menos una tienda.'),
});
export type StoresStep = z.infer<typeof storesStepSchema>;

export const approverStepSchema = z.object({
  memberName: z.string().trim().min(1, 'Elige quién aprueba el carro.'),
  memberId: z.string().trim().min(1).optional(),
});
export type ApproverStep = z.infer<typeof approverStepSchema>;

export const basicOnboardingSchema = z.object({
  address: addressStepSchema,
  household: householdStepSchema,
  allergies: allergiesStepSchema,
  stores: storesStepSchema,
  approver: approverStepSchema,
});
export type BasicAnswers = z.infer<typeof basicOnboardingSchema>;

export const presupuestoSchema = z.object({
  monthlyBudget: z.number().int().positive('El presupuesto mensual tiene que ser un monto en pesos.').max(50_000_000),
});
export const cadenciaSchema = z.object({
  cadence: z.enum(['2w', '1m', '2m', '3m', '4m', '5m', '6m']),
});
export const sustitucionSchema = z.object({
  mode: z.enum(['propose_approve', 'best_match', 'specific', 'none']),
  replacements: z.array(z.string().trim().min(1).max(80)).max(3).optional(),
}).refine((value) => value.mode !== 'specific' || (value.replacements?.length || 0) > 0, {
  message: 'Indica al menos un reemplazo, hasta 3.',
});
export const alcoholSchema = z.object({
  proposeAlcohol: z.boolean(),
});
export const dietasSchema = z.object({
  tags: z.array(z.string().trim().min(1)).max(20),
  members: z.array(z.string().trim().min(1)).max(12),
}).refine((value) => value.tags.every((tag) => DIET_TAGS.some((item) => item.id === tag)), {
  message: 'Hay una dieta que no reconozco.',
});
export const marcasSchema = z.object({
  preference: z.enum(['conveniente', 'fija']),
});
export const categoriasSchema = z.object({
  categories: z.array(z.enum([
    'despensa', 'frutas_verduras', 'lacteos', 'carnes', 'aseo', 'mascotas', 'bebes', 'bebidas',
  ])).min(1, 'Elige al menos una categoría.'),
});
export const horariosSchema = z.object({
  day: z.enum(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']),
  start: z.string(),
  end: z.string(),
}).refine((value) => DELIVERY_SLOTS.some((slot) => slot.start === value.start && slot.end === value.end)
  && WEEKDAYS.some((day) => day.id === value.day), {
  message: 'Elige un día y una ventana.',
});
export const mascotasAseoSchema = z.object({
  includeAseo: z.boolean(),
  petFood: z.enum(['seco', 'humedo', 'mixto']).nullable().optional(),
});

const PROGRESSIVE_SCHEMAS = {
  presupuesto: presupuestoSchema,
  cadencia: cadenciaSchema,
  sustitucion: sustitucionSchema,
  alcohol: alcoholSchema,
  dietas: dietasSchema,
  marcas: marcasSchema,
  categorias: categoriasSchema,
  horarios: horariosSchema,
  mascotas_aseo: mascotasAseoSchema,
} as const;

export interface BasicState {
  answers: Partial<BasicAnswers>;
  pendingProgressive: ProgressiveId[];
  progressive: Partial<Record<ProgressiveId, unknown>>;
  allergyPolicy: 'warn' | 'block';
  legacy: StepState;
  explicitPending: boolean;
}

export function firstZodMessage(error: { issues?: { message: string }[] }): string {
  return error.issues?.[0]?.message || 'Revisa los datos.';
}

export function isBasicStep(value: string): value is BasicStepId {
  return (BASIC_STEP_IDS as readonly string[]).includes(value);
}

export function isProgressiveId(value: string): value is ProgressiveId {
  return (PROGRESSIVE_IDS as readonly string[]).includes(value);
}

export function emptyHousehold(selfName = 'Yo'): HouseholdStep {
  return {
    people: 2,
    adults: 2,
    children: 0,
    hasNana: false,
    nanaMode: null,
    members: [
      { name: selfName, kind: 'adult', sex: null, ageRange: null, nanaMode: null },
      { name: '', kind: 'adult', sex: null, ageRange: null, nanaMode: null },
    ],
    pets: [],
  };
}

function spaceFor(household: Pick<HouseholdStep, 'people' | 'hasNana'>): number {
  return household.people - (household.hasNana ? 1 : 0);
}

export function syncMemberSlots(household: HouseholdStep, selfName: string): HouseholdStep {
  const previous = household.members;
  const adults = previous.filter((member) => member.kind === 'adult');
  const children = previous.filter((member) => member.kind === 'child');
  const nana = previous.find((member) => member.kind === 'nana');
  const members: MemberDraft[] = [];
  for (let index = 0; index < household.adults; index += 1) {
    const current = adults[index];
    members.push({
      id: current?.id,
      name: current?.name || (index === 0 ? selfName : ''),
      kind: 'adult',
      sex: current?.sex ?? null,
      ageRange: null,
      nanaMode: null,
    });
  }
  for (let index = 0; index < household.children; index += 1) {
    const current = children[index];
    members.push({
      id: current?.id,
      name: current?.name || '',
      kind: 'child',
      sex: current?.sex ?? null,
      ageRange: current?.ageRange || '6-12',
      nanaMode: null,
    });
  }
  if (household.hasNana && household.nanaMode) {
    members.push({
      id: nana?.id,
      name: nana?.name || 'Nana',
      kind: 'nana',
      sex: nana?.sex ?? null,
      ageRange: null,
      nanaMode: household.nanaMode,
    });
  }
  return { ...household, members };
}

export function withPeople(household: HouseholdStep, people: number, selfName: string): HouseholdStep {
  const hasNana = household.hasNana;
  const nextPeople = hasNana ? Math.max(2, people) : Math.max(1, people);
  const space = nextPeople - (hasNana ? 1 : 0);
  const adults = Math.min(Math.max(1, household.adults), space);
  return syncMemberSlots({
    ...household,
    people: nextPeople,
    adults,
    children: space - adults,
    nanaMode: hasNana ? household.nanaMode : null,
  }, selfName);
}

export function withNana(
  household: HouseholdStep,
  choice: 'no' | 'adentro' | 'afuera',
  selfName: string,
): HouseholdStep {
  if (choice === 'no') {
    const adults = household.adults + (household.hasNana ? 1 : 0);
    return syncMemberSlots({
      ...household,
      hasNana: false,
      nanaMode: null,
      adults,
      children: household.children,
    }, selfName);
  }
  const people = Math.max(2, household.people);
  const space = people - 1;
  const adults = Math.min(Math.max(1, household.adults), space);
  return syncMemberSlots({
    ...household,
    people,
    hasNana: true,
    nanaMode: choice,
    adults,
    children: space - adults,
  }, selfName);
}

export function withAdults(household: HouseholdStep, adults: number, selfName: string): HouseholdStep {
  const space = Math.max(1, spaceFor(household));
  const nextAdults = Math.min(Math.max(1, adults), space);
  return syncMemberSlots({
    ...household,
    adults: nextAdults,
    children: space - nextAdults,
  }, selfName);
}

export function canonicalAllergens(id: BasicAllergen): string[] {
  if (id === 'ninguna') return [];
  if (id === 'mani_frutos_secos') return ['mani', 'frutos_secos'];
  return [id];
}

export function allergyWarnings(assignments: { allergen: BasicAllergen; memberName: string }[]): string[] {
  return assignments
    .filter((row) => row.allergen !== 'ninguna')
    .map((row) => {
      const label = BASIC_ALLERGEN_OPTIONS.find((item) => item.id === row.allergen)?.label || row.allergen;
      return `${row.memberName}: alergia a ${label}. AVI avisa en el carro y no bloquea la compra.`;
    });
}

export function profileCompleteness(pending: readonly string[]): number {
  const left = pending.filter((id) => isProgressiveId(id)).length;
  return Math.round(((PROGRESSIVE_IDS.length - left) / PROGRESSIVE_IDS.length) * 100);
}

function inferPending(legacy: StepState, progressive: Partial<Record<ProgressiveId, unknown>>): ProgressiveId[] {
  const done = new Set(PROGRESSIVE_IDS.filter((id) => progressive[id] != null));
  const pending: ProgressiveId[] = [];
  const add = (id: ProgressiveId, legacyDone: boolean) => {
    if (!legacyDone && !done.has(id)) pending.push(id);
  };
  add('presupuesto', legacy.budget === 'done');
  add('cadencia', legacy.cadence === 'done');
  add('sustitucion', legacy.substitutions === 'done');
  add('alcohol', legacy.budget === 'done');
  add('dietas', legacy.diets === 'done');
  add('marcas', false);
  add('categorias', false);
  add('horarios', false);
  add('mascotas_aseo', legacy.pets === 'done');
  return pending;
}

export function emptyBasicState(): BasicState {
  const legacy = emptyStepState();
  return {
    answers: {},
    pendingProgressive: inferPending(legacy, {}),
    progressive: {},
    allergyPolicy: 'block',
    legacy,
    explicitPending: false,
  };
}

export function parseBasicState(raw: string | null | undefined): BasicState {
  const legacy = parseStepState(raw);
  let parsed: Record<string, unknown> = {};
  try {
    const value = JSON.parse(raw || '{}') as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  const progressive = parsed.progressive && typeof parsed.progressive === 'object'
    ? parsed.progressive as Partial<Record<ProgressiveId, unknown>>
    : {};
  const explicitPending = Array.isArray(parsed.pendingProgressive);
  const pendingProgressive = explicitPending
    ? (parsed.pendingProgressive as unknown[]).map(String).filter(isProgressiveId)
    : inferPending(legacy, progressive);
  const answers = parsed.answers && typeof parsed.answers === 'object'
    ? parsed.answers as Partial<BasicAnswers>
    : {};
  return {
    answers,
    pendingProgressive,
    progressive,
    allergyPolicy: parsed.allergyPolicy === 'warn' ? 'warn' : 'block',
    legacy,
    explicitPending,
  };
}

export function serializeBasicState(state: BasicState): string {
  return JSON.stringify({
    ...state.legacy,
    answers: state.answers,
    pendingProgressive: state.pendingProgressive,
    progressive: state.progressive,
    allergyPolicy: state.allergyPolicy,
  });
}

export function rememberBasicAnswer(state: BasicState, step: BasicStepId, value: unknown): BasicState {
  const answers = { ...state.answers, [step]: value } as Partial<BasicAnswers>;
  const legacy: StepState = { ...state.legacy };
  if (step === 'address') legacy.address = 'done';
  if (step === 'household') {
    legacy.household = 'done';
    legacy.members = 'done';
  }
  if (step === 'allergies') legacy.allergies = 'done';
  if (step === 'stores') legacy.stores = 'done';
  const pending = state.explicitPending ? state.pendingProgressive : [...PROGRESSIVE_IDS];
  return {
    answers,
    pendingProgressive: pending,
    progressive: state.progressive,
    allergyPolicy: step === 'allergies' || state.allergyPolicy === 'warn' ? 'warn' : state.allergyPolicy,
    legacy,
    explicitPending: true,
  };
}

export function buildBasicCompletion(answers: BasicAnswers, previous?: BasicState | null) {
  const base = previous ?? emptyBasicState();
  const pending = PROGRESSIVE_IDS.filter((id) => base.progressive[id] == null);
  const legacy: StepState = {
    ...base.legacy,
    address: 'done',
    stores: 'done',
    household: 'done',
    members: 'done',
    allergies: 'done',
  };
  const savedMode = (base.progressive.sustitucion as { mode?: string } | undefined)?.mode;
  const state: BasicState = {
    answers,
    pendingProgressive: pending,
    progressive: base.progressive,
    allergyPolicy: 'warn',
    legacy,
    explicitPending: true,
  };
  return {
    onboardingStep: BASIC_DONE,
    substitutionMode: savedMode || DEFAULT_SUBSTITUTION_MODE,
    stepState: serializeBasicState(state),
    state,
  };
}

function legacyAfter(legacy: StepState, id: ProgressiveId, pending: ProgressiveId[]): StepState {
  const next = { ...legacy };
  if ((id === 'presupuesto' || id === 'alcohol') && !pending.includes('presupuesto') && !pending.includes('alcohol')) {
    next.budget = 'done';
  }
  if (id === 'cadencia') next.cadence = 'done';
  if (id === 'sustitucion') next.substitutions = 'done';
  if (id === 'dietas') next.diets = 'done';
  if (id === 'mascotas_aseo') next.pets = 'done';
  return next;
}

export function completeProgressive(state: BasicState, id: ProgressiveId, value: unknown): BasicState {
  const pendingProgressive = (state.explicitPending ? state.pendingProgressive : inferPending(state.legacy, state.progressive))
    .filter((item) => item !== id);
  return {
    ...state,
    progressive: { ...state.progressive, [id]: value },
    pendingProgressive,
    legacy: legacyAfter(state.legacy, id, pendingProgressive),
    explicitPending: true,
  };
}

export function parseBasicStep(step: BasicStepId, payload: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const schemas = {
    address: addressStepSchema,
    household: householdStepSchema,
    allergies: allergiesStepSchema,
    stores: storesStepSchema,
    approver: approverStepSchema,
  } as const;
  const parsed = schemas[step].safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstZodMessage(parsed.error) };
  return { ok: true, value: parsed.data };
}

export function parseProgressiveStep(
  step: string,
  payload: unknown,
): { ok: true; id: ProgressiveId; value: unknown } | { ok: false; error: string } {
  if (!isProgressiveId(step)) return { ok: false, error: 'Paso desconocido' };
  const parsed = PROGRESSIVE_SCHEMAS[step].safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstZodMessage(parsed.error) };
  return { ok: true, id: step, value: parsed.data };
}

export function nextBasicStep(step: BasicStepId): string {
  const index = BASIC_STEP_IDS.indexOf(step);
  return BASIC_STEP_IDS[index + 1] || step;
}

export function substitutionLabel(mode: string): string {
  return SUBSTITUTION_MODES.find((item) => item.id === mode)?.label || mode;
}

export function cadenceLabel(id: string): string {
  return CADENCES.find((item) => item.id === id)?.label || id;
}

export function dietLabel(id: string): string {
  return DIET_TAGS.find((item) => item.id === (id as DietTagId))?.label || id;
}
