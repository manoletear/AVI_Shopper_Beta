import { parseBasicState } from '@/lib/onboarding/basic';
import { prisma } from '@/lib/prisma';

interface ApproverMember {
  id: string;
  name: string;
  role: string;
}

interface ApproverSettings {
  approverRole?: string | null;
  stepState?: string | null;
}

export function isApprover(
  member: ApproverMember,
  settings: ApproverSettings | null,
): boolean {
  const chosen = parseBasicState(settings?.stepState).answers.approver;
  if (chosen?.memberId) return member.id === chosen.memberId;
  if (chosen?.memberName) return member.name === chosen.memberName;
  return member.role === (settings?.approverRole || 'master');
}

/**
 * Verifica que un memberId sea aprobador real de la familia.
 * Chequea contra la configuración de la familia (stepState, approverRole).
 */
export async function isFamilyApproverById(memberId: string, familyId: string): Promise<boolean> {
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, familyId, isActive: true },
    select: { id: true, name: true, role: true },
  });
  if (!member) return false;
  const settings = await prisma.familySettings.findUnique({
    where: { familyId },
    select: { approverRole: true, stepState: true },
  });
  return isApprover(member, settings);
}
