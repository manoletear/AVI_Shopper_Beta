/**
 * Pasos del onboarding del hogar.
 * Dirección y tiendas son obligatorias. El resto se puede saltar
 * y completar después desde Ajustes.
 */

export const STEP_IDS = [
  'address',
  'stores',
  'household',
  'members',
  'allergies',
  'diets',
  'pets',
  'substitutions',
  'cadence',
  'budget',
] as const;

export type StepId = (typeof STEP_IDS)[number];
export type StepStatus = 'pending' | 'done' | 'skipped';
export type StepState = Record<StepId, StepStatus>;

export interface StepMeta {
  id: StepId;
  required: boolean;
  title: string;
  subtitle: string;
  settingsLabel: string;
}

export const STEPS: StepMeta[] = [
  {
    id: 'address',
    required: true,
    title: '¿Dónde recibes?',
    subtitle: 'La dirección y la ventana de entrega, para cotizar el despacho.',
    settingsLabel: 'Dirección y ventanas',
  },
  {
    id: 'stores',
    required: true,
    title: 'Tus tiendas',
    subtitle: 'Elige dónde comprar y, si quieres, el programa de puntos.',
    settingsLabel: 'Tiendas y puntos',
  },
  {
    id: 'household',
    required: false,
    title: '¿Para cuántos compras?',
    subtitle: 'Puedes cambiarlo después.',
    settingsLabel: 'Tamaño del hogar',
  },
  {
    id: 'members',
    required: false,
    title: 'Integrantes e invitaciones',
    subtitle: 'Invita a la familia a un carro compartido. Puedes hacerlo después.',
    settingsLabel: 'Integrantes',
  },
  {
    id: 'allergies',
    required: false,
    title: 'Alergias y restricciones',
    subtitle: 'AVI no propone productos con estos alérgenos. Puedes completarlo después.',
    settingsLabel: 'Alergias',
  },
  {
    id: 'diets',
    required: false,
    title: 'Dieta y preferencias',
    subtitle: 'Puedes elegir varias y una dieta principal. Se edita después.',
    settingsLabel: 'Dietas',
  },
  {
    id: 'pets',
    required: false,
    title: 'Mascotas',
    subtitle: 'El perfil ayuda a comprar alimento. No es obligatorio.',
    settingsLabel: 'Mascotas',
  },
  {
    id: 'substitutions',
    required: false,
    title: 'Si un producto falta',
    subtitle: 'La preferencia se recuerda en los pedidos siguientes.',
    settingsLabel: 'Reemplazos',
  },
  {
    id: 'cadence',
    required: false,
    title: 'Ritmo de reposición',
    subtitle: 'Cada cuánto repones y qué día prefieres recibir.',
    settingsLabel: 'Ritmo',
  },
  {
    id: 'budget',
    required: false,
    title: 'Presupuesto',
    subtitle: 'Opcional. El administrador del hogar aprueba el carro.',
    settingsLabel: 'Presupuesto',
  },
];

export const STEP_BY_ID: Record<StepId, StepMeta> = Object.fromEntries(
  STEPS.map((step) => [step.id, step]),
) as Record<StepId, StepMeta>;

export const DEFAULT_DELIVERY_WINDOW = { day: 'sabado' as const, start: '09:00', end: '13:00' };

export const HOUSEHOLD_DEFAULTS = {
  approverRole: 'master' as const,
  elderWeight: 0.8,
  proposeAlcohol: true,
  substitutionMode: 'propose_approve' as const,
  householdSize: 2,
};

export type Dropoff = 'door' | 'handoff' | 'curbside';
export type StoreChain = 'jumbo' | 'lider' | 'unimarc' | 'tottus';
export type DeliveryMode = 'delivery' | 'pickup';
export type LoyaltyProgram =
  | 'puntos_cencosud'
  | 'jumbo_prime'
  | 'mi_club_lider'
  | 'club_unimarc'
  | 'cmr_puntos';
export type SubstitutionMode = 'propose_approve' | 'best_match' | 'specific' | 'none';
export type Cadence = '2w' | '1m' | '2m' | '3m' | '4m' | '5m' | '6m';
export type Weekday = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export const DROPOFFS: { id: Dropoff; label: string; hint: string }[] = [
  { id: 'door', label: 'Dejar en la puerta', hint: 'El repartidor deja el pedido y se va' },
  { id: 'handoff', label: 'Recibir en la puerta', hint: 'Alguien recibe el pedido en persona' },
  { id: 'curbside', label: 'Retiro afuera', hint: 'Sales a buscarlo a la entrada' },
];

export const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: 'lunes', label: 'Lunes' },
  { id: 'martes', label: 'Martes' },
  { id: 'miercoles', label: 'Miércoles' },
  { id: 'jueves', label: 'Jueves' },
  { id: 'viernes', label: 'Viernes' },
  { id: 'sabado', label: 'Sábado' },
  { id: 'domingo', label: 'Domingo' },
];

export const DELIVERY_SLOTS = [
  { start: '09:00', end: '13:00', label: '09:00–13:00' },
  { start: '12:00', end: '16:00', label: '12:00–16:00' },
  { start: '15:00', end: '19:00', label: '15:00–19:00' },
  { start: '18:00', end: '22:00', label: '18:00–22:00' },
];

export const CHAINS: {
  id: StoreChain;
  label: string;
  loyalty: { id: LoyaltyProgram; label: string }[];
}[] = [
  {
    id: 'jumbo',
    label: 'Jumbo',
    loyalty: [
      { id: 'puntos_cencosud', label: 'Puntos Cencosud' },
      { id: 'jumbo_prime', label: 'Jumbo Prime' },
    ],
  },
  {
    id: 'lider',
    label: 'Lider',
    loyalty: [{ id: 'mi_club_lider', label: 'Mi Club Lider' }],
  },
  {
    id: 'unimarc',
    label: 'Unimarc',
    loyalty: [{ id: 'club_unimarc', label: 'Club Unimarc' }],
  },
  {
    id: 'tottus',
    label: 'Tottus',
    loyalty: [{ id: 'cmr_puntos', label: 'CMR Puntos' }],
  },
];

export const ALLERGENS = [
  { id: 'mariscos', label: 'Sin mariscos' },
  { id: 'pescado', label: 'Sin pescado' },
  { id: 'gluten', label: 'Sin gluten' },
  { id: 'lacteos', label: 'Sin lácteos' },
  { id: 'frutos_secos', label: 'Sin frutos secos de árbol' },
  { id: 'mani', label: 'Sin maní' },
  { id: 'soya', label: 'Sin soya' },
  { id: 'huevo', label: 'Sin huevo' },
  { id: 'sesamo', label: 'Sin sésamo' },
  { id: 'mostaza', label: 'Sin mostaza' },
] as const;

export type AllergenId = (typeof ALLERGENS)[number]['id'];

export const DIET_TAGS = [
  { id: 'sin_gluten', label: 'Sin gluten' },
  { id: 'alta_proteina', label: 'Alta proteína' },
  { id: 'alta_fibra', label: 'Alta fibra' },
  { id: 'sin_lactosa', label: 'Sin lactosa' },
  { id: 'bajo_calorias', label: 'Bajo en calorías' },
  { id: 'bajo_carbohidratos', label: 'Bajo en carbohidratos' },
  { id: 'bajo_sodio', label: 'Bajo en sodio' },
  { id: 'bajo_azucar', label: 'Bajo en azúcar' },
  { id: 'bajo_grasa', label: 'Bajo en grasa' },
  { id: 'organico', label: 'Orgánico' },
  { id: 'pescetariano', label: 'Pescetariano' },
  { id: 'sin_preservantes', label: 'Sin preservantes' },
  { id: 'vegano', label: 'Vegano' },
  { id: 'vegetariano', label: 'Vegetariano' },
] as const;

export type DietTagId = (typeof DIET_TAGS)[number]['id'];

export const HOUSEHOLD_SIZES = [2, 4, 6] as const;

export const MEMBER_COLORS = ['#4F46E5', '#0D9488', '#F59E0B', '#E11D48', '#7C3AED', '#0284C7', '#65A30D', '#EA580C'];

export const CADENCES: { id: Cadence; label: string }[] = [
  { id: '2w', label: 'Cada 2 semanas' },
  { id: '1m', label: 'Cada mes' },
  { id: '2m', label: 'Cada 2 meses' },
  { id: '3m', label: 'Cada 3 meses' },
  { id: '4m', label: 'Cada 4 meses' },
  { id: '5m', label: 'Cada 5 meses' },
  { id: '6m', label: 'Cada 6 meses' },
];

export const PORTION_BUDGETS = [3000, 4000, 5000] as const;

export const SUBSTITUTION_MODES: { id: SubstitutionMode; label: string; hint: string }[] = [
  { id: 'propose_approve', label: 'Proponer reemplazo y que yo apruebe', hint: 'AVI propone el cambio y el carro espera tu ok' },
  { id: 'best_match', label: 'Mejor coincidencia', hint: 'AVI elige el reemplazo más parecido' },
  { id: 'specific', label: 'Reemplazo específico', hint: 'Hasta 3 alternativas que tú indicas' },
  { id: 'none', label: 'No reemplazar', hint: 'Si falta, no lo cambia por otro' },
];

export const MAX_EXTRA_MEMBERS = 3;
export const MAX_SPECIFIC_REPLACEMENTS = 3;

export function emptyStepState(): StepState {
  return {
    address: 'pending',
    stores: 'pending',
    household: 'pending',
    members: 'pending',
    allergies: 'pending',
    diets: 'pending',
    pets: 'pending',
    substitutions: 'pending',
    cadence: 'pending',
    budget: 'pending',
  };
}

export function parseStepState(raw: string | null | undefined): StepState {
  const state = emptyStepState();
  if (!raw) return state;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<StepId, StepStatus>>;
    for (const id of STEP_IDS) {
      const value = parsed[id];
      if (value === 'done' || value === 'skipped' || value === 'pending') state[id] = value;
    }
  } catch {
    return state;
  }
  return state;
}

export function wizardFinished(steps: StepState): boolean {
  return STEP_IDS.every((id) => steps[id] === 'done' || steps[id] === 'skipped');
}

export function mandatoryComplete(steps: StepState): boolean {
  return steps.address === 'done' && steps.stores === 'done';
}

export function resumeStep(steps: StepState): StepId | 'done' {
  for (const id of STEP_IDS) {
    if (steps[id] === 'pending') return id;
  }
  return 'done';
}

export function transition(
  steps: StepState,
  step: StepId,
  action: 'save' | 'skip',
): { ok: true; steps: StepState; next: StepId | 'done' } | { ok: false; error: string } {
  if (!STEP_BY_ID[step]) return { ok: false, error: 'Paso desconocido' };
  if (action === 'skip' && STEP_BY_ID[step].required) {
    return { ok: false, error: 'Este paso es necesario para cotizar.' };
  }
  const nextSteps: StepState = { ...steps, [step]: action === 'skip' ? 'skipped' : 'done' };
  const index = STEP_IDS.indexOf(step);
  let next: StepId | 'done' = 'done';
  for (let i = index + 1; i < STEP_IDS.length; i += 1) {
    if (nextSteps[STEP_IDS[i]] === 'pending') {
      next = STEP_IDS[i];
      break;
    }
  }
  return { ok: true, steps: nextSteps, next };
}

export interface DeliveryWindow {
  day: Weekday;
  start: string;
  end: string;
}

export interface AddressInput {
  street: string;
  number: string;
  unit: string;
  comuna: string;
  dropoff: Dropoff;
  notes: string;
  windows: DeliveryWindow[];
}

export interface StoreInput {
  chain: StoreChain;
  enabled: boolean;
  mode: DeliveryMode;
  loyaltyProgram: LoyaltyProgram | null;
}

export interface MemberInput {
  id?: string;
  name: string;
  email: string;
  color: string;
}

export interface PetInput {
  id?: string;
  name: string;
  species: 'perro' | 'gato';
  stage: 'cachorro' | 'adulto' | 'senior';
  food: 'seco' | 'humedo';
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isWeekday(value: string): value is Weekday {
  return WEEKDAYS.some((day) => day.id === value);
}

function isSlot(start: string, end: string): boolean {
  return DELIVERY_SLOTS.some((slot) => slot.start === start && slot.end === end);
}

export function parseAddress(payload: unknown): Parsed<AddressInput> {
  const body = (payload || {}) as Record<string, unknown>;
  const street = text(body.street);
  const number = text(body.number);
  const comuna = text(body.comuna);
  const unit = text(body.unit);
  const notes = text(body.notes);
  const dropoff = text(body.dropoff) as Dropoff;
  if (street.length < 3) return { ok: false, error: 'Escribe la calle.' };
  if (!number) return { ok: false, error: 'Escribe el número.' };
  if (comuna.length < 2) return { ok: false, error: 'Escribe la comuna.' };
  if (!DROPOFFS.some((item) => item.id === dropoff)) return { ok: false, error: 'Elige cómo entregar el pedido.' };
  const rawWindows = Array.isArray(body.windows) ? body.windows : [];
  const windows: DeliveryWindow[] = [];
  for (const item of rawWindows) {
    const row = item as Record<string, unknown>;
    const day = text(row.day);
    const start = text(row.start);
    const end = text(row.end);
    if (!isWeekday(day) || !isSlot(start, end)) return { ok: false, error: 'La ventana de entrega no es válida.' };
    windows.push({ day, start, end });
    if (windows.length === 3) break;
  }
  if (!windows.length) windows.push({ ...DEFAULT_DELIVERY_WINDOW });
  return { ok: true, value: { street, number, unit, comuna, dropoff, notes, windows } };
}

export function parseStores(payload: unknown): Parsed<{ mode: DeliveryMode; stores: StoreInput[] }> {
  const body = (payload || {}) as Record<string, unknown>;
  const mode = text(body.mode) as DeliveryMode;
  if (mode !== 'delivery' && mode !== 'pickup') return { ok: false, error: 'Elige despacho o retiro.' };
  const rows = Array.isArray(body.stores) ? body.stores : [];
  const stores: StoreInput[] = [];
  for (const chain of CHAINS) {
    const found = rows.find((row) => text((row as Record<string, unknown>).chain) === chain.id) as
      | Record<string, unknown>
      | undefined;
    const enabled = Boolean(found?.enabled);
    const loyalty = found ? text(found.loyaltyProgram) : '';
    const allowed = chain.loyalty.map((item) => item.id);
    if (loyalty && !allowed.includes(loyalty as LoyaltyProgram)) {
      return { ok: false, error: `El programa de ${chain.label} no corresponde.` };
    }
    stores.push({
      chain: chain.id,
      enabled,
      mode,
      loyaltyProgram: loyalty ? (loyalty as LoyaltyProgram) : null,
    });
  }
  if (!stores.some((store) => store.enabled)) return { ok: false, error: 'Elige al menos una tienda.' };
  return { ok: true, value: { mode, stores } };
}

export function parseHousehold(payload: unknown): Parsed<{
  householdSize: 2 | 4 | 6;
  includesBaby: boolean;
  includesToddler: boolean;
  includesPet: boolean;
}> {
  const body = (payload || {}) as Record<string, unknown>;
  const size = Number(body.householdSize);
  if (size !== 2 && size !== 4 && size !== 6) return { ok: false, error: 'Elige 2, 4 o 6 personas.' };
  return {
    ok: true,
    value: {
      householdSize: size,
      includesBaby: Boolean(body.includesBaby),
      includesToddler: Boolean(body.includesToddler),
      includesPet: Boolean(body.includesPet),
    },
  };
}

export function parseMembers(payload: unknown): Parsed<MemberInput[]> {
  const body = (payload || {}) as Record<string, unknown>;
  const rows = Array.isArray(body.members) ? body.members : [];
  if (rows.length > MAX_EXTRA_MEMBERS + 1) {
    return { ok: false, error: 'Puedes invitar hasta 3 integrantes además de ti.' };
  }
  const members: MemberInput[] = [];
  for (const row of rows) {
    const item = row as Record<string, unknown>;
    const name = text(item.name);
    const email = text(item.email);
    const color = text(item.color) || MEMBER_COLORS[0];
    if (!name) return { ok: false, error: 'Cada integrante necesita un nombre.' };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: `El email de ${name} no es válido.` };
    if (!MEMBER_COLORS.includes(color)) return { ok: false, error: 'Elige un color de la lista.' };
    members.push({ id: text(item.id) || undefined, name, email, color });
  }
  return { ok: true, value: members };
}

export function parseAllergies(payload: unknown): Parsed<{ allergens: AllergenId[]; dislikes: string[] }> {
  const body = (payload || {}) as Record<string, unknown>;
  const raw = Array.isArray(body.allergens) ? body.allergens.map((item) => text(item)) : [];
  const known = new Set(ALLERGENS.map((item) => item.id));
  const allergens: AllergenId[] = [];
  for (const id of raw) {
    if (!known.has(id as AllergenId)) return { ok: false, error: 'Hay una alergia que no reconozco.' };
    if (!allergens.includes(id as AllergenId)) allergens.push(id as AllergenId);
  }
  const dislikes = Array.isArray(body.dislikes)
    ? body.dislikes.map((item) => text(item)).filter(Boolean).slice(0, 20)
    : [];
  if (dislikes.some((item) => item.length > 40)) return { ok: false, error: 'Un ingrediente es demasiado largo.' };
  return { ok: true, value: { allergens, dislikes } };
}

export function parseDiets(payload: unknown): Parsed<{ tags: DietTagId[]; primary: DietTagId | null }> {
  const body = (payload || {}) as Record<string, unknown>;
  const known = new Set(DIET_TAGS.map((item) => item.id));
  const tags: DietTagId[] = [];
  for (const item of Array.isArray(body.tags) ? body.tags : []) {
    const id = text(item);
    if (!known.has(id as DietTagId)) return { ok: false, error: 'Hay una dieta que no reconozco.' };
    if (!tags.includes(id as DietTagId)) tags.push(id as DietTagId);
  }
  const primaryText = text(body.primary);
  if (primaryText && !known.has(primaryText as DietTagId)) return { ok: false, error: 'La dieta principal no es válida.' };
  return { ok: true, value: { tags, primary: primaryText ? (primaryText as DietTagId) : null } };
}

export function parsePets(payload: unknown): Parsed<PetInput[]> {
  const body = (payload || {}) as Record<string, unknown>;
  const rows = Array.isArray(body.pets) ? body.pets : [];
  const pets: PetInput[] = [];
  for (const row of rows) {
    const item = row as Record<string, unknown>;
    const species = text(item.species);
    const stage = text(item.stage);
    const food = text(item.food);
    const name = text(item.name) || (species === 'gato' ? 'Gato' : 'Perro');
    if (species !== 'perro' && species !== 'gato') return { ok: false, error: 'La especie es perro o gato.' };
    if (stage !== 'cachorro' && stage !== 'adulto' && stage !== 'senior') return { ok: false, error: 'Elige la etapa de la mascota.' };
    if (food !== 'seco' && food !== 'humedo') return { ok: false, error: 'Elige alimento seco o húmedo.' };
    pets.push({ id: text(item.id) || undefined, name, species, stage, food });
  }
  return { ok: true, value: pets };
}

export function parseSubstitutions(payload: unknown): Parsed<{ mode: SubstitutionMode; replacements: string[] }> {
  const body = (payload || {}) as Record<string, unknown>;
  const mode = text(body.mode) as SubstitutionMode;
  if (!SUBSTITUTION_MODES.some((item) => item.id === mode)) return { ok: false, error: 'Elige cómo reemplazar.' };
  const replacements = Array.isArray(body.replacements)
    ? body.replacements.map((item) => text(item)).filter(Boolean).slice(0, MAX_SPECIFIC_REPLACEMENTS)
    : [];
  if (mode === 'specific' && replacements.length === 0) {
    return { ok: false, error: 'Indica al menos un reemplazo, hasta 3.' };
  }
  return { ok: true, value: { mode, replacements: mode === 'specific' ? replacements : [] } };
}

export function parseCadence(payload: unknown): Parsed<{ cadence: Cadence; deliveryDay: Weekday }> {
  const body = (payload || {}) as Record<string, unknown>;
  const cadence = text(body.cadence) as Cadence;
  const deliveryDay = text(body.deliveryDay);
  if (!CADENCES.some((item) => item.id === cadence)) return { ok: false, error: 'Elige cada cuánto repones.' };
  if (!isWeekday(deliveryDay)) return { ok: false, error: 'Elige el día de entrega.' };
  return { ok: true, value: { cadence, deliveryDay } };
}

function optionalClp(value: unknown, label: string): Parsed<number | null> {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  const amount = typeof value === 'number' ? value : Number(text(value).replace(/\./g, ''));
  if (!Number.isInteger(amount) || amount < 0 || amount > 50_000_000) {
    return { ok: false, error: `${label} tiene que ser un monto en pesos.` };
  }
  return { ok: true, value: amount };
}

export function parseBudget(payload: unknown): Parsed<{
  budget: number | null;
  monthlyBudget: number | null;
  orderCap: number | null;
  proposeAlcohol: boolean;
}> {
  const body = (payload || {}) as Record<string, unknown>;
  const portion = optionalClp(body.budget, 'El presupuesto por porción');
  if (!portion.ok) return portion;
  if (portion.value !== null && !PORTION_BUDGETS.includes(portion.value as (typeof PORTION_BUDGETS)[number])) {
    return { ok: false, error: 'El presupuesto por porción es $3.000, $4.000 o $5.000.' };
  }
  const monthly = optionalClp(body.monthlyBudget, 'El presupuesto mensual');
  if (!monthly.ok) return monthly;
  const cap = optionalClp(body.orderCap, 'El tope por pedido');
  if (!cap.ok) return cap;
  return {
    ok: true,
    value: {
      budget: portion.value,
      monthlyBudget: monthly.value,
      orderCap: cap.value,
      proposeAlcohol: body.proposeAlcohol === undefined ? true : Boolean(body.proposeAlcohol),
    },
  };
}

export interface OnboardingView {
  needsOnboarding: boolean;
  finished: boolean;
  step: StepId | 'done';
  steps: StepState;
  inviteCode: string | null;
  address: {
    street: string;
    number: string;
    unit: string;
    comuna: string;
    dropoff: string;
    notes: string;
  } | null;
  windows: DeliveryWindow[];
  stores: StoreInput[];
  mode: DeliveryMode;
  householdSize: number | null;
  includesBaby: boolean;
  includesToddler: boolean;
  includesPet: boolean;
  members: MemberInput[];
  allergens: AllergenId[];
  dislikes: string[];
  dietTags: DietTagId[];
  primaryDiet: string | null;
  pets: PetInput[];
  substitutionMode: SubstitutionMode;
  replacements: string[];
  cadence: string | null;
  deliveryDay: string | null;
  budget: number | null;
  monthlyBudget: number | null;
  orderCap: number | null;
  proposeAlcohol: boolean;
  approverRole: string;
  elderWeight: number;
}

export function clp(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
}
