import { prisma } from '@/lib/prisma';
import { clearFamilyContextCache } from '@/lib/family';
import {
  AddressStep,
  AllergiesStep,
  ApproverStep,
  BASIC_DONE,
  BasicAnswers,
  BasicStepId,
  HouseholdStep,
  PROGRESSIVE_STEPS,
  ProgressiveId,
  StoresStep,
  allergyWarnings,
  buildBasicCompletion,
  canonicalAllergens,
  completeProgressive,
  nextBasicStep,
  parseBasicState,
  parseBasicStep,
  parseProgressiveStep,
  profileCompleteness,
  rememberBasicAnswer,
  serializeBasicState,
  basicOnboardingSchema,
  firstZodMessage,
} from '@/lib/onboarding/basic';
import { ensureHousehold } from './persist';

export interface BasicMemberView {
  id: string;
  name: string;
  role: string;
  type: string;
}

export interface BasicView {
  needsOnboarding: boolean;
  onboardingStep: string;
  selfName: string;
  substitutionMode: string;
  answers: Partial<BasicAnswers>;
  pendingProgressive: ProgressiveId[];
  completeness: number;
  members: BasicMemberView[];
  warnings: string[];
}

export interface ProgressiveView {
  showReminder: boolean;
  completeness: number;
  pending: ProgressiveId[];
  steps: { id: ProgressiveId; label: string; hint: string; done: boolean }[];
  members: { id: string; name: string }[];
  hasPets: boolean;
  onboardingStep: string;
}

async function context(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { householdOnboarding: true, name: true },
  });
  if (user?.householdOnboarding) await ensureHousehold(userId, user.name);
  const membership = await prisma.familyMember.findFirst({
    where: { userId, isActive: true },
    include: {
      family: {
        include: {
          settings: true,
          members: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  return { user, membership };
}

function toView(
  user: { householdOnboarding: boolean; name: string | null } | null,
  membership: NonNullable<Awaited<ReturnType<typeof context>>['membership']> | null,
): BasicView {
  const settings = membership?.family.settings;
  const state = parseBasicState(settings?.stepState);
  const self = membership?.family.members.find((member) => member.userId) || membership?.family.members[0];
  const people = (membership?.family.members || []).filter((member) => member.type !== 'pet');
  const onboardingStep = settings?.onboardingStep || 'address';
  return {
    needsOnboarding: Boolean(user?.householdOnboarding) && onboardingStep !== BASIC_DONE,
    onboardingStep,
    selfName: self?.name || user?.name || 'Yo',
    substitutionMode: settings?.substitutionMode || 'propose_approve',
    answers: state.answers,
    pendingProgressive: state.pendingProgressive,
    completeness: profileCompleteness(state.pendingProgressive),
    members: people.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      type: member.type,
    })),
    warnings: allergyWarnings(state.answers.allergies?.assignments || []),
  };
}

export async function getBasicOnboarding(userId: string): Promise<BasicView> {
  const { user, membership } = await context(userId);
  return toView(user, membership);
}

async function applyAddress(familyId: string, input: AddressStep) {
  const current = await prisma.familyAddress.findFirst({ where: { familyId, isPrimary: true } });
  const data = {
    street: input.street,
    number: input.number,
    unit: input.unit || null,
    comuna: input.comuna,
    housingType: input.housingType,
    notes: input.accessNote || null,
    isPrimary: true,
    dropoff: current?.dropoff || 'door',
  };
  if (current) await prisma.familyAddress.update({ where: { id: current.id }, data });
  else await prisma.familyAddress.create({ data: { familyId, ...data } });
}

async function applyHousehold(familyId: string, userId: string, input: HouseholdStep) {
  const current = await prisma.familyMember.findMany({
    where: { familyId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  const people = current.filter((member) => member.type !== 'pet');
  const master = people.find((member) => member.userId === userId) || people[0];
  const keep = new Set<string>();
  let masterUsed = false;

  for (const member of input.members) {
    const byId = member.id ? people.find((person) => person.id === member.id) : undefined;
    const match = byId || (!masterUsed && member.kind === 'adult' && master ? master : undefined);
    if (match?.id === master?.id) masterUsed = true;
    const role = member.kind === 'child'
      ? 'child'
      : member.kind === 'nana'
        ? 'nana'
        : match?.role === 'master' ? 'master' : 'adult';
    const data = {
      name: member.name,
      role,
      type: 'person',
      sex: member.sex ?? null,
      ageRange: member.kind === 'child' ? member.ageRange ?? null : null,
      size: null,
      ...(member.kind === 'nana' ? { notes: `nana:${member.nanaMode};recibe:1` } : {}),
    };
    if (match) {
      await prisma.familyMember.update({ where: { id: match.id }, data });
      keep.add(match.id);
    } else {
      const created = await prisma.familyMember.create({ data: { familyId, ...data } });
      keep.add(created.id);
    }
  }

  for (const person of people) {
    if (!keep.has(person.id) && !person.userId) {
      await prisma.familyMember.delete({ where: { id: person.id } });
    }
  }

  const pets = current.filter((member) => member.type === 'pet');
  const petKeep = new Set<string>();
  for (const pet of input.pets) {
    const match = pet.id ? pets.find((item) => item.id === pet.id) : undefined;
    const data = {
      name: pet.name || (pet.species === 'gato' ? 'Gato' : pet.species === 'perro' ? 'Perro' : 'Mascota'),
      type: 'pet',
      role: 'pet',
      species: pet.species,
      breed: pet.breed || null,
      size: pet.size,
      ageRange: pet.age,
    };
    if (match) {
      await prisma.familyMember.update({ where: { id: match.id }, data });
      petKeep.add(match.id);
    } else {
      const created = await prisma.familyMember.create({ data: { familyId, ...data } });
      petKeep.add(created.id);
    }
  }
  for (const pet of pets) {
    if (!petKeep.has(pet.id)) await prisma.familyMember.delete({ where: { id: pet.id } });
  }

  await prisma.familySettings.update({
    where: { familyId },
    data: {
      householdSize: input.people,
      includesBaby: input.members.some((member) => member.ageRange === '0-2'),
      includesToddler: input.members.some((member) => member.ageRange === '3-5'),
      includesPet: input.pets.length > 0,
    },
  });
}

async function applyAllergies(familyId: string, input: AllergiesStep) {
  const people = await prisma.familyMember.findMany({
    where: { familyId, type: 'person', isActive: true },
  });
  const clear = input.allergens.includes('ninguna');
  for (const person of people) {
    const ids = clear
      ? []
      : input.assignments
        .filter((row) => row.memberName === person.name)
        .flatMap((row) => canonicalAllergens(row.allergen));
    await prisma.familyMember.update({
      where: { id: person.id },
      data: { allergies: JSON.stringify([...new Set(ids)]) },
    });
  }
}

async function applyStores(familyId: string, input: StoresStep) {
  for (const chain of ['jumbo', 'lider', 'unimarc', 'tottus'] as const) {
    const enabled = input.chains.includes(chain);
    await prisma.familyStore.upsert({
      where: { familyId_chain: { familyId, chain } },
      update: { enabled },
      create: { familyId, chain, enabled, mode: 'delivery' },
    });
  }
}

async function applyApprover(familyId: string, input: ApproverStep): Promise<ApproverStep | string> {
  const people = await prisma.familyMember.findMany({
    where: { familyId, type: 'person', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  const chosen = people.find((person) => person.id === input.memberId)
    || people.find((person) => person.name === input.memberName);
  if (!chosen) return 'Elige un integrante del hogar.';
  await prisma.familySettings.update({
    where: { familyId },
    data: { approverRole: chosen.role === 'master' ? 'master' : 'adult' },
  });
  return { memberName: chosen.name, memberId: chosen.id };
}

async function applyStep(
  familyId: string,
  userId: string,
  step: BasicStepId,
  value: unknown,
): Promise<unknown | string> {
  if (step === 'address') {
    await applyAddress(familyId, value as AddressStep);
    return value;
  }
  if (step === 'household') {
    await applyHousehold(familyId, userId, value as HouseholdStep);
    return value;
  }
  if (step === 'allergies') {
    await applyAllergies(familyId, value as AllergiesStep);
    return value;
  }
  if (step === 'stores') {
    await applyStores(familyId, value as StoresStep);
    return value;
  }
  return applyApprover(familyId, value as ApproverStep);
}

async function writeProgress(familyId: string, state: ReturnType<typeof rememberBasicAnswer>, onboardingStep: string) {
  await prisma.familySettings.update({
    where: { familyId },
    data: {
      stepState: serializeBasicState(state),
      onboardingStep,
      mandatoryComplete: Boolean(state.answers.address && state.answers.stores),
    },
  });
  clearFamilyContextCache();
}

export async function saveBasicStep(
  userId: string,
  step: BasicStepId,
  payload: unknown,
): Promise<{ ok: true; state: BasicView } | { ok: false; error: string }> {
  const parsed = parseBasicStep(step, payload);
  if (!parsed.ok) return parsed;
  const familyId = await ensureHousehold(userId);
  const applied = await applyStep(familyId, userId, step, parsed.value);
  if (typeof applied === 'string') return { ok: false, error: applied };
  const settings = await prisma.familySettings.findUnique({ where: { familyId } });
  const state = rememberBasicAnswer(parseBasicState(settings?.stepState), step, applied);
  const onboardingStep = settings?.onboardingStep === BASIC_DONE ? BASIC_DONE : nextBasicStep(step);
  await writeProgress(familyId, state, onboardingStep);
  return { ok: true, state: await getBasicOnboarding(userId) };
}

export async function completeBasicOnboarding(
  userId: string,
  payload: unknown,
): Promise<{ ok: true; state: BasicView } | { ok: false; error: string }> {
  const parsed = basicOnboardingSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstZodMessage(parsed.error) };
  const names = new Set(parsed.data.household.members.map((member) => member.name));
  if (!names.has(parsed.data.approver.memberName)) {
    return { ok: false, error: 'Elige un integrante del hogar para aprobar el carro.' };
  }
  const familyId = await ensureHousehold(userId);
  await applyAddress(familyId, parsed.data.address);
  await applyHousehold(familyId, userId, parsed.data.household);
  await applyAllergies(familyId, parsed.data.allergies);
  await applyStores(familyId, parsed.data.stores);
  const approver = await applyApprover(familyId, parsed.data.approver);
  if (typeof approver === 'string') return { ok: false, error: approver };
  const settings = await prisma.familySettings.findUnique({ where: { familyId } });
  const previous = parseBasicState(settings?.stepState);
  const answers: BasicAnswers = { ...parsed.data, approver };
  const completion = buildBasicCompletion(answers, previous);
  await prisma.familySettings.update({
    where: { familyId },
    data: {
      stepState: completion.stepState,
      onboardingStep: completion.onboardingStep,
      substitutionMode: completion.substitutionMode,
      mandatoryComplete: true,
    },
  });
  await prisma.memberPreference.updateMany({
    where: { member: { familyId } },
    data: { substitutionMode: completion.substitutionMode },
  });
  await prisma.user.update({ where: { id: userId }, data: { householdOnboarding: false } });
  clearFamilyContextCache();
  return { ok: true, state: await getBasicOnboarding(userId) };
}

export async function getProgressive(userId: string): Promise<ProgressiveView> {
  const { user, membership } = await context(userId);
  const settings = membership?.family.settings;
  let state = parseBasicState(settings?.stepState);
  if (!state.explicitPending && settings?.deliveryWindows) {
    state = {
      ...state,
      pendingProgressive: state.pendingProgressive.filter((id) => id !== 'horarios'),
    };
  }
  const people = (membership?.family.members || []).filter((member) => member.type === 'person');
  const pets = (membership?.family.members || []).some((member) => member.type === 'pet')
    || (state.answers.household?.pets.length || 0) > 0;
  const needsOnboarding = Boolean(user?.householdOnboarding) && settings?.onboardingStep !== BASIC_DONE;
  return {
    showReminder: !needsOnboarding && state.pendingProgressive.length > 0,
    completeness: profileCompleteness(state.pendingProgressive),
    pending: state.pendingProgressive,
    steps: PROGRESSIVE_STEPS.map((step) => ({
      ...step,
      done: !state.pendingProgressive.includes(step.id),
    })),
    members: people.map((member) => ({ id: member.id, name: member.name })),
    hasPets: pets,
    onboardingStep: settings?.onboardingStep || 'address',
  };
}

async function applyProgressive(familyId: string, id: ProgressiveId, value: unknown) {
  if (id === 'presupuesto') {
    const budget = value as { monthlyBudget: number };
    await prisma.familySettings.update({ where: { familyId }, data: { monthlyBudget: budget.monthlyBudget } });
  }
  if (id === 'cadencia') {
    const cadence = value as { cadence: string };
    await prisma.familySettings.update({ where: { familyId }, data: { cadence: cadence.cadence } });
  }
  if (id === 'sustitucion') {
    const choice = value as { mode: string; replacements?: string[] };
    await prisma.familySettings.update({
      where: { familyId },
      data: {
        substitutionMode: choice.mode,
        specificReplacements: JSON.stringify(choice.mode === 'specific' ? choice.replacements || [] : []),
      },
    });
    await prisma.memberPreference.updateMany({
      where: { member: { familyId } },
      data: { substitutionMode: choice.mode },
    });
  }
  if (id === 'alcohol') {
    const alcohol = value as { proposeAlcohol: boolean };
    await prisma.familySettings.update({ where: { familyId }, data: { proposeAlcohol: alcohol.proposeAlcohol } });
  }
  if (id === 'dietas') {
    const diets = value as { tags: string[]; members: string[] };
    const people = await prisma.familyMember.findMany({ where: { familyId, type: 'person', isActive: true } });
    const names = new Set(diets.members);
    const applyAll = names.size === 0;
    for (const person of people) {
      if (!applyAll && !names.has(person.name)) continue;
      await prisma.familyMember.update({
        where: { id: person.id },
        data: { dietTags: diets.tags, dietType: diets.tags[0] || null },
      });
    }
  }
  if (id === 'horarios') {
    const slot = value as { day: string; start: string; end: string };
    await prisma.familySettings.update({
      where: { familyId },
      data: {
        deliveryDay: slot.day,
        deliveryWindows: JSON.stringify([slot]),
      },
    });
  }
  if (id === 'mascotas_aseo') {
    const care = value as { includeAseo: boolean; petFood?: string | null };
    if (care.petFood) {
      await prisma.familyMember.updateMany({
        where: { familyId, type: 'pet' },
        data: { notes: `alimento:${care.petFood}` },
      });
    }
  }
}

export async function saveProgressiveStep(
  userId: string,
  step: string,
  payload: unknown,
): Promise<{ ok: true; state: ProgressiveView } | { ok: false; error: string }> {
  const parsed = parseProgressiveStep(step, payload);
  if (!parsed.ok) return parsed;
  const familyId = await ensureHousehold(userId);
  await applyProgressive(familyId, parsed.id, parsed.value);
  const settings = await prisma.familySettings.findUnique({ where: { familyId } });
  const state = completeProgressive(parseBasicState(settings?.stepState), parsed.id, parsed.value);
  const finished = state.pendingProgressive.length === 0;
  await prisma.familySettings.update({
    where: { familyId },
    data: {
      stepState: serializeBasicState(state),
      onboardingStep: finished
        ? 'progressive_done'
        : (settings?.onboardingStep && settings.onboardingStep !== 'progressive_done' ? settings.onboardingStep : BASIC_DONE),
    },
  });
  clearFamilyContextCache();
  return { ok: true, state: await getProgressive(userId) };
}
