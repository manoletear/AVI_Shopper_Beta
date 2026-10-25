import { parseBasicState } from '@/lib/onboarding/basic';
import { SubstitutionMode } from '@/lib/onboarding/model';
import { prisma } from '@/lib/prisma';
import { collectAllergens, ProposalConstraints } from './constraints';

const OPEN: ProposalConstraints = {
  allergens: [],
  dislikes: [],
  proposeAlcohol: true,
  substitutionMode: 'propose_approve',
  specificReplacements: [],
};

function replacementsFrom(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export async function loadProposalConstraints(familyId: string): Promise<ProposalConstraints> {
  const [settings, members, prefs] = await Promise.all([
    prisma.familySettings.findUnique({ where: { familyId } }),
    prisma.familyMember.findMany({ where: { familyId, isActive: true }, select: { allergies: true } }),
    prisma.memberPreference.findMany({
      where: { avoid: true, member: { familyId, isActive: true } },
      include: { group: true },
    }),
  ]);
  const dislikes = prefs
    .filter((pref) => pref.group.familyKey.startsWith('ingrediente|'))
    .map((pref) => pref.notes || pref.group.familyKey.slice('ingrediente|'.length))
    .filter((name): name is string => Boolean(name));
  const profile = parseBasicState(settings?.stepState);
  return {
    allergens: collectAllergens(members),
    dislikes,
    proposeAlcohol: settings?.proposeAlcohol ?? true,
    substitutionMode: (settings?.substitutionMode as SubstitutionMode) || 'propose_approve',
    specificReplacements: replacementsFrom(settings?.specificReplacements),
    allergenPolicy: profile.allergyPolicy,
  };
}

export async function loadProposalConstraintsForUser(userId: string): Promise<ProposalConstraints> {
  const member = await prisma.familyMember.findFirst({
    where: { userId, isActive: true },
    select: { familyId: true },
  });
  if (!member) return OPEN;
  return loadProposalConstraints(member.familyId);
}
