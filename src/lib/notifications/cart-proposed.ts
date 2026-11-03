import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { isApprover } from '@/lib/mcp/tools';
import { CartProposedEmail, type CartItemProps, type AllergenWarningProps } from '@/emails/CartProposedEmail';
import type { AllergenCheckResult } from '@/types/nutrition';

const APP_URL = 'https://avi-shopper-beta.vercel.app';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function getFrom(): string {
  return process.env.RESEND_FROM || 'AVI Shopper <avi@avishopper.cl>';
}

export interface CartNotificationPayload {
  cartId: string;
  familyId: string;
  storeName: string;
  items: CartItemProps[];
  subtotal: number;
  allergenChecks: (AllergenCheckResult | null)[];
  note?: string;
}

export function buildAllergenWarnings(checks: (AllergenCheckResult | null)[]): AllergenWarningProps[] {
  const warnings: AllergenWarningProps[] = [];
  for (const check of checks) {
    if (!check?.warnings.length) continue;
    for (const w of check.warnings) {
      const memberNames = w.members.map((m) => m.name).join(', ') || 'familia';
      warnings.push({
        message: w.message,
        memberName: memberNames,
      });
    }
  }
  return warnings;
}

export function buildApproveUrl(cartId: string): string {
  return `${APP_URL}/carro/${cartId}`;
}

/**
 * Fire-and-forget: notifica por email a los aprobadores de la familia.
 * Si Resend falla o no hay email, registra y no tira error.
 * Idempotente: no envía si notifiedAt ya tiene valor.
 */
export async function notifyCartProposed(payload: CartNotificationPayload): Promise<void> {
  try {
    // Idempotency: check notifiedAt
    const cart = await prisma.proposedCart.findUnique({
      where: { id: payload.cartId },
      select: { id: true, notifiedAt: true },
    });
    if (!cart) return;
    if (cart.notifiedAt) return;

    const resend = getResend();
    if (!resend) {
      console.warn('[notify] RESEND_API_KEY no configurada, saltando email');
      return;
    }

    // Find approvers with email
    const family = await prisma.family.findUnique({
      where: { id: payload.familyId },
      select: { name: true, settings: true },
    });
    if (!family) return;

    const members = await prisma.familyMember.findMany({
      where: { familyId: payload.familyId, isActive: true, type: 'person' },
      include: { user: { select: { email: true } } },
    });

    const approvers = members.filter((m) => isApprover(m, family.settings));
    const emails = approvers
      .map((a) => a.user?.email)
      .filter((e): e is string => !!e);

    if (emails.length === 0) {
      console.warn(`[notify] Sin email de aprobador para familia ${payload.familyId}`);
      return;
    }

    const allergenWarnings = buildAllergenWarnings(payload.allergenChecks);
    const approveUrl = buildApproveUrl(payload.cartId);

    await resend.emails.send({
      from: getFrom(),
      to: emails,
      subject: `🛒 AVI propone un carro en ${payload.storeName} — revísalo`,
      react: CartProposedEmail({
        familyName: family.name,
        storeName: payload.storeName,
        cartId: payload.cartId,
        items: payload.items,
        subtotal: payload.subtotal,
        allergenWarnings,
        approveUrl,
        note: payload.note,
      }),
    });

    // Mark as notified
    await prisma.proposedCart.update({
      where: { id: payload.cartId },
      data: { notifiedAt: new Date() },
    });
  } catch (error) {
    console.error('[notify] Error enviando email de carro propuesto:', error);
  }
}
