import { parseBasicState } from '@/lib/onboarding/basic';

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
