import { prisma } from '@/lib/prisma';
import { clearFamilyContextCache } from '@/lib/family';
import { parseBasicState, serializeBasicState } from '@/lib/onboarding/basic';
import {
  AddressInput,
  AllergenId,
  Cadence,
  DeliveryMode,
  DeliveryWindow,
  DietTagId,
  HOUSEHOLD_DEFAULTS,
  MemberInput,
  PetInput,
  StepId,
  StepState,
  StoreInput,
  SubstitutionMode,
  Weekday,
  emptyStepState,
  mandatoryComplete,
  parseAddress,
  parseAllergies,
  parseBudget,
  parseCadence,
  parseDiets,
  parseHousehold,
  parseMembers,
  parsePets,
  parseStepState,
  parseStores,
  parseSubstitutions,
  resumeStep,
  transition,
  wizardFinished,
  OnboardingView,
} from '@/lib/onboarding/model';

function jsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function windowsFrom(raw: string | null | undefined): DeliveryWindow[] {
  return jsonList(raw).length
    ? (JSON.parse(raw as string) as DeliveryWindow[])
    : [];
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function blankView(needsOnboarding: boolean): OnboardingView {
  return {
    needsOnboarding,
    finished: false,
    step: needsOnboarding ? 'address' : 'done',
    steps: emptyStepState(),
    inviteCode: null,
    address: null,
    windows: [],
    stores: [],
    mode: 'delivery',
    householdSize: null,
    includesBaby: false,
    includesToddler: false,
    includesPet: false,
    members: [],
    allergens: [],
    dislikes: [],
    dietTags: [],
    primaryDiet: null,
    pets: [],
    substitutionMode: HOUSEHOLD_DEFAULTS.substitutionMode,
    replacements: [],
    cadence: null,
    deliveryDay: null,
    budget: null,
    monthlyBudget: null,
    orderCap: null,
    proposeAlcohol: HOUSEHOLD_DEFAULTS.proposeAlcohol,
    approverRole: HOUSEHOLD_DEFAULTS.approverRole,
    elderWeight: HOUSEHOLD_DEFAULTS.elderWeight,
  };
}

async function readView(userId: string): Promise<OnboardingView> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { householdOnboarding: true },
  });
  const membership = await prisma.familyMember.findFirst({
    where: { userId, isActive: true },
    include: {
      family: {
        include: {
          settings: true,
          addresses: { orderBy: { createdAt: 'asc' } },
          stores: { orderBy: { chain: 'asc' } },
          members: { where: { isActive: true }, orderBy: { createdAt: 'asc' }, include: { user: { select: { email: true } } } },
        },
      },
    },
  });
  if (!membership) return blankView(Boolean(user?.householdOnboarding));

  const settings = membership.family.settings;
  const steps = parseStepState(settings?.stepState);
  const finished = wizardFinished(steps);
  const address = membership.family.addresses.find((item) => item.isPrimary) || membership.family.addresses[0] || null;
  const people = membership.family.members.filter((member) => member.type !== 'pet');
  const pets = membership.family.members.filter((member) => member.type === 'pet');
  const master = people.find((member) => member.userId === userId) || people[0];
  const dislikeRows = master
    ? await prisma.memberPreference.findMany({
      where: { memberId: master.id, avoid: true, group: { familyKey: { startsWith: 'ingrediente|' } } },
      include: { group: true },
    })
    : [];

  let allergens: AllergenId[] = [];
  if (master?.allergies) {
    try {
      const parsed = JSON.parse(master.allergies);
      if (Array.isArray(parsed)) allergens = parsed.map(String) as AllergenId[];
    } catch {
      allergens = [];
    }
  }

  return {
    needsOnboarding: Boolean(user?.householdOnboarding) && !finished,
    finished,
    step: resumeStep(steps),
    steps,
    inviteCode: membership.family.inviteCode,
    address: address
      ? {
        street: address.street,
        number: address.number,
        unit: address.unit || '',
        comuna: address.comuna,
        dropoff: address.dropoff,
        notes: address.notes || '',
      }
      : null,
    windows: windowsFrom(settings?.deliveryWindows),
    stores: membership.family.stores.map((store) => ({
      chain: store.chain as StoreInput['chain'],
      enabled: store.enabled,
      mode: store.mode as DeliveryMode,
      loyaltyProgram: (store.loyaltyProgram as StoreInput['loyaltyProgram']) || null,
    })),
    mode: (membership.family.stores.find((store) => store.enabled)?.mode as DeliveryMode) || 'delivery',
    householdSize: settings?.householdSize ?? null,
    includesBaby: settings?.includesBaby ?? false,
    includesToddler: settings?.includesToddler ?? false,
    includesPet: settings?.includesPet ?? false,
    members: people.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.user?.email || (member.notes?.includes('@') ? member.notes : ''),
      color: member.avatar || '#4F46E5',
    })),
    allergens,
    dislikes: dislikeRows.map((row) => row.notes || row.group.familyKey.slice('ingrediente|'.length)),
    dietTags: (master?.dietTags || []) as DietTagId[],
    primaryDiet: master?.dietType || null,
    pets: pets.map((pet) => ({
      id: pet.id,
      name: pet.name,
      species: pet.species === 'gato' ? 'gato' : 'perro',
      stage: pet.dateOfBirth === 'cachorro' || pet.dateOfBirth === 'senior' ? pet.dateOfBirth : 'adulto',
      food: pet.notes?.includes('humedo') ? 'humedo' : 'seco',
    })),
    substitutionMode: (settings?.substitutionMode as SubstitutionMode) || 'propose_approve',
    replacements: jsonList(settings?.specificReplacements),
    cadence: settings?.cadence || null,
    deliveryDay: settings?.deliveryDay || null,
    budget: settings?.budget ?? null,
    monthlyBudget: settings?.monthlyBudget ?? null,
    orderCap: settings?.orderCap ?? null,
    proposeAlcohol: settings?.proposeAlcohol ?? true,
    approverRole: settings?.approverRole || 'master',
    elderWeight: settings?.elderWeight ?? 0.8,
  };
}

export async function getOnboarding(userId: string): Promise<OnboardingView> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { householdOnboarding: true, name: true } });
  if (user?.householdOnboarding) await ensureHousehold(userId, user.name);
  return readView(userId);
}

export async function ensureHousehold(userId: string, name?: string | null) {
  const existing = await prisma.familyMember.findFirst({ where: { userId, isActive: true } });
  if (existing) {
    const settings = await prisma.familySettings.findUnique({ where: { familyId: existing.familyId } });
    if (!settings) {
      await prisma.familySettings.create({
        data: {
          familyId: existing.familyId,
          approverRole: HOUSEHOLD_DEFAULTS.approverRole,
          elderWeight: HOUSEHOLD_DEFAULTS.elderWeight,
          proposeAlcohol: HOUSEHOLD_DEFAULTS.proposeAlcohol,
          substitutionMode: HOUSEHOLD_DEFAULTS.substitutionMode,
          stepState: JSON.stringify(emptyStepState()),
        },
      });
    }
    return existing.familyId;
  }
  const user = name === undefined
    ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    : { name };
  const family = await prisma.family.create({
    data: {
      name: 'Mi Familia',
      members: {
        create: {
          userId,
          name: user?.name || 'Yo',
          role: 'master',
          type: 'person',
          avatar: '#4F46E5',
        },
      },
      settings: {
        create: {
          approverRole: HOUSEHOLD_DEFAULTS.approverRole,
          elderWeight: HOUSEHOLD_DEFAULTS.elderWeight,
          proposeAlcohol: HOUSEHOLD_DEFAULTS.proposeAlcohol,
          substitutionMode: HOUSEHOLD_DEFAULTS.substitutionMode,
          stepState: JSON.stringify(emptyStepState()),
        },
      },
    },
  });
  return family.id;
}

async function syncDislikes(memberId: string, dislikes: string[], substitutionMode: string) {
  const existing = await prisma.memberPreference.findMany({
    where: { memberId, group: { familyKey: { startsWith: 'ingrediente|' } } },
    include: { group: true },
  });
  const wanted = new Set(dislikes.map((name) => slug(name)));
  for (const pref of existing) {
    const key = pref.group.familyKey.slice('ingrediente|'.length);
    if (!wanted.has(key)) await prisma.memberPreference.delete({ where: { id: pref.id } });
  }
  for (const name of dislikes) {
    const key = `ingrediente|${slug(name)}`;
    const group = await prisma.productGroup.upsert({
      where: { familyKey: key },
      update: {},
      create: { familyKey: key, category: 'ingrediente', defaultBaseUnit: 'un', priorPerPersonDay: 0 },
    });
    await prisma.memberPreference.upsert({
      where: { memberId_groupId: { memberId, groupId: group.id } },
      update: { avoid: true, notes: name, substitutionMode },
      create: { memberId, groupId: group.id, avoid: true, notes: name, substitutionMode },
    });
  }
}

async function applyPayload(familyId: string, userId: string, step: StepId, payload: unknown) {
  const master = await prisma.familyMember.findFirst({ where: { familyId, userId, isActive: true } });
  if (!master) throw new Error('No encontré tu hogar');

  if (step === 'address') {
    const parsed = parseAddress(payload);
    if (!parsed.ok) return parsed.error;
    const current = await prisma.familyAddress.findFirst({ where: { familyId, isPrimary: true } });
    const data = {
      street: parsed.value.street,
      number: parsed.value.number,
      unit: parsed.value.unit || null,
      comuna: parsed.value.comuna,
      dropoff: parsed.value.dropoff,
      notes: parsed.value.notes || null,
      isPrimary: true,
    };
    if (current) await prisma.familyAddress.update({ where: { id: current.id }, data });
    else await prisma.familyAddress.create({ data: { familyId, ...data } });
    await prisma.familySettings.update({
      where: { familyId },
      data: {
        deliveryWindows: JSON.stringify(parsed.value.windows),
        deliveryDay: parsed.value.windows[0].day,
      },
    });
  }

  if (step === 'stores') {
    const parsed = parseStores(payload);
    if (!parsed.ok) return parsed.error;
    for (const store of parsed.value.stores) {
      await prisma.familyStore.upsert({
        where: { familyId_chain: { familyId, chain: store.chain } },
        update: { enabled: store.enabled, mode: store.mode, loyaltyProgram: store.loyaltyProgram },
        create: { familyId, ...store },
      });
    }
  }

  if (step === 'household') {
    const parsed = parseHousehold(payload);
    if (!parsed.ok) return parsed.error;
    await prisma.familySettings.update({ where: { familyId }, data: parsed.value });
  }

  if (step === 'members') {
    const parsed = parseMembers(payload);
    if (!parsed.ok) return parsed.error;
    const people = await prisma.familyMember.findMany({ where: { familyId, type: 'person', isActive: true } });
    const keep = new Set<string>([master.id]);
    for (const member of parsed.value) {
      if (member.id && member.id === master.id) {
        await prisma.familyMember.update({
          where: { id: master.id },
          data: { name: member.name, avatar: member.color },
        });
        keep.add(master.id);
        continue;
      }
      if (member.id && people.some((person) => person.id === member.id)) {
        await prisma.familyMember.update({
          where: { id: member.id },
          data: { name: member.name, avatar: member.color, notes: member.email || null },
        });
        keep.add(member.id);
        continue;
      }
      const created = await prisma.familyMember.create({
        data: {
          familyId,
          name: member.name,
          role: 'adult',
          type: 'person',
          avatar: member.color,
          notes: member.email || null,
        },
      });
      keep.add(created.id);
    }
    for (const person of people) {
      if (!keep.has(person.id) && !person.userId) {
        await prisma.familyMember.delete({ where: { id: person.id } });
      }
    }
  }

  if (step === 'allergies') {
    const parsed = parseAllergies(payload);
    if (!parsed.ok) return parsed.error;
    const settings = await prisma.familySettings.findUnique({ where: { familyId } });
    await prisma.familyMember.update({
      where: { id: master.id },
      data: { allergies: JSON.stringify(parsed.value.allergens) },
    });
    await syncDislikes(master.id, parsed.value.dislikes, settings?.substitutionMode || 'propose_approve');
  }

  if (step === 'diets') {
    const parsed = parseDiets(payload);
    if (!parsed.ok) return parsed.error;
    await prisma.familyMember.update({
      where: { id: master.id },
      data: { dietTags: parsed.value.tags, dietType: parsed.value.primary },
    });
  }

  if (step === 'pets') {
    const parsed = parsePets(payload);
    if (!parsed.ok) return parsed.error;
    const current = await prisma.familyMember.findMany({ where: { familyId, type: 'pet' } });
    const keep = new Set<string>();
    for (const pet of parsed.value) {
      const data = {
        name: pet.name,
        species: pet.species,
        dateOfBirth: pet.stage,
        notes: `alimento:${pet.food}`,
        type: 'pet',
        role: 'pet',
      };
      if (pet.id && current.some((item) => item.id === pet.id)) {
        await prisma.familyMember.update({ where: { id: pet.id }, data });
        keep.add(pet.id);
      } else {
        const created = await prisma.familyMember.create({ data: { familyId, ...data } });
        keep.add(created.id);
      }
    }
    for (const pet of current) {
      if (!keep.has(pet.id)) await prisma.familyMember.delete({ where: { id: pet.id } });
    }
    if (parsed.value.length) {
      await prisma.familySettings.update({ where: { familyId }, data: { includesPet: true } });
    }
  }

  if (step === 'substitutions') {
    const parsed = parseSubstitutions(payload);
    if (!parsed.ok) return parsed.error;
    await prisma.familySettings.update({
      where: { familyId },
      data: {
        substitutionMode: parsed.value.mode,
        specificReplacements: JSON.stringify(parsed.value.replacements),
      },
    });
    await prisma.memberPreference.updateMany({
      where: { member: { familyId } },
      data: { substitutionMode: parsed.value.mode },
    });
  }

  if (step === 'cadence') {
    const parsed = parseCadence(payload);
    if (!parsed.ok) return parsed.error;
    await prisma.familySettings.update({
      where: { familyId },
      data: { cadence: parsed.value.cadence as Cadence, deliveryDay: parsed.value.deliveryDay as Weekday },
    });
  }

  if (step === 'budget') {
    const parsed = parseBudget(payload);
    if (!parsed.ok) return parsed.error;
    await prisma.familySettings.update({ where: { familyId }, data: parsed.value });
  }

  return null;
}

export async function updateHouseholdDefaults(
  userId: string,
  payload: unknown,
): Promise<{ ok: true; state: OnboardingView } | { ok: false; error: string }> {
  const familyId = await ensureHousehold(userId);
  const body = (payload || {}) as Record<string, unknown>;
  const elderWeight = Number(body.elderWeight);
  const approverRole = body.approverRole === 'adult' ? 'adult' : 'master';
  if (!Number.isFinite(elderWeight) || elderWeight <= 0 || elderWeight > 2) {
    return { ok: false, error: 'La ponderación del adulto mayor tiene que estar entre 0 y 2.' };
  }
  await prisma.familySettings.update({
    where: { familyId },
    data: {
      elderWeight,
      approverRole,
      proposeAlcohol: body.proposeAlcohol === undefined ? true : Boolean(body.proposeAlcohol),
    },
  });
  clearFamilyContextCache();
  return { ok: true, state: await readView(userId) };
}

export async function saveOnboardingStep(
  userId: string,
  step: StepId,
  action: 'save' | 'skip',
  payload: unknown,
): Promise<{ ok: true; state: OnboardingView } | { ok: false; error: string }> {
  const familyId = await ensureHousehold(userId);
  const settings = await prisma.familySettings.findUnique({ where: { familyId } });
  const steps = parseStepState(settings?.stepState);
  if (action === 'save') {
    const error = await applyPayload(familyId, userId, step, payload);
    if (error) return { ok: false, error };
  }
  const moved = transition(steps, step, action);
  if (!moved.ok) return moved;
  const finished = wizardFinished(moved.steps);
  const preserved = parseBasicState(settings?.stepState);
  await prisma.familySettings.update({
    where: { familyId },
    data: {
      stepState: serializeBasicState({ ...preserved, legacy: moved.steps }),
      onboardingStep: settings?.onboardingStep === 'basic_done'
        ? 'basic_done'
        : (moved.next === 'done' ? 'budget' : moved.next),
      mandatoryComplete: mandatoryComplete(moved.steps),
    },
  });
  if (finished) {
    await prisma.user.update({ where: { id: userId }, data: { householdOnboarding: false } });
  }
  clearFamilyContextCache();
  return { ok: true, state: await readView(userId) };
}
