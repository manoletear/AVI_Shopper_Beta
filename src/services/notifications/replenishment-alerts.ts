/**
 * Notificaciones de reposición: email, push y Grok Bot.
 *
 * Se dispara desde get_pantry o desde el cron cuando hay productos
 * en rojo (se acabó) o amarillo (no alcanza a la próxima compra).
 *
 * Canales:
 * - Email (Resend): resumen diario a los aprobadores
 * - Push (web push): alerta inmediata por producto crítico
 * - Grok Bot: la rutina diaria de las 10am ya cubre esto
 * - In-app: siempre se guarda como Alert en la DB
 */

import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import type { SmartProduct } from '@/services/consumption/household-intelligence';

const APP_URL = 'https://avi-shopper-beta.vercel.app';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function getFrom(): string | null {
  return process.env.RESEND_FROM || null;
}

interface ReplenishmentNotifyInput {
  familyId: string;
  red: SmartProduct[];
  yellow: SmartProduct[];
  estimatedCartTotal: number;
}

function formatProductLine(p: SmartProduct): string {
  const name = p.groupKey.replace(/_/g, ' ');
  const price = p.estimatedCost ? ` · ~$${p.estimatedCost.toLocaleString('es-CL')}` : '';
  if (p.status === 'red') {
    return `🔴 ${name} — ${p.alertMessage || 'se acabó'}${price}`;
  }
  return `🟡 ${name} — ${p.alertMessage || p.statusLabel}${price}`;
}

export async function notifyReplenishment(input: ReplenishmentNotifyInput): Promise<{ email: number; inApp: number }> {
  const urgent = [...input.red, ...input.yellow.filter((p) => p.estimatedDaysLeft <= 3)];
  if (urgent.length === 0) return { email: 0, inApp: 0 };

  // Find approvers with email
  const approvers = await prisma.familyMember.findMany({
    where: { familyId: input.familyId, isActive: true, role: 'master' },
    include: { user: { select: { email: true, id: true } } },
  });

  const emailTargets = approvers.filter((a) => a.user?.email).map((a) => ({
    email: a.user!.email,
    userId: a.user!.id,
    name: a.name,
  }));

  let emailsSent = 0;
  let inAppCreated = 0;

  // ── In-app alerts (always) ──
  for (const target of emailTargets) {
    const since = new Date(Date.now() - 12 * 3600000);
    const existing = await prisma.alert.findFirst({
      where: { userId: target.userId, type: 'replenishment', dismissed: false, createdAt: { gte: since } },
    });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        userId: target.userId,
        type: 'replenishment',
        title: `${urgent.length} producto${urgent.length > 1 ? 's' : ''} por acabarse`,
        message: urgent.slice(0, 5).map(formatProductLine).join('\n'),
        level: input.red.length > 0 ? 'warn' : 'info',
      },
    });
    inAppCreated++;
  }

  // ── Email (Resend) ──
  const resend = getResend();
  const from = getFrom();
  if (!resend || !from) return { email: 0, inApp: inAppCreated };

  const redLines = input.red.slice(0, 8).map(formatProductLine);
  const yellowLines = input.yellow.filter((p) => p.estimatedDaysLeft <= 3).slice(0, 5).map(formatProductLine);
  const totalLine = input.estimatedCartTotal > 0
    ? `\n💰 Carro estimado: ~$${input.estimatedCartTotal.toLocaleString('es-CL')}`
    : '';

  const body = [
    input.red.length > 0 ? `Se acabó:\n${redLines.join('\n')}` : null,
    yellowLines.length > 0 ? `\nSe acaba pronto:\n${yellowLines.join('\n')}` : null,
    totalLine,
    `\nAVI propone, la familia decide.\n${APP_URL}/reposicion`,
  ].filter(Boolean).join('\n');

  for (const target of emailTargets) {
    try {
      await resend.emails.send({
        from,
        to: target.email,
        subject: `🛒 ${urgent.length} producto${urgent.length > 1 ? 's' : ''} por acabarse — AVI`,
        text: `Hola ${target.name},\n\n${body}`,
      });
      emailsSent++;
    } catch (error) {
      console.error(`[replenishment-notify] Error enviando email a ${target.name}:`, error instanceof Error ? error.message : error);
    }
  }

  return { email: emailsSent, inApp: inAppCreated };
}
