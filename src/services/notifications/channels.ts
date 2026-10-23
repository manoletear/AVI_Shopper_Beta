/**
 * Avisos del hogar.
 * Hoy se guardan en la app. WhatsApp y el push quedan enchufados
 * pero no envían nada: el día que haya clave, se completa deliver().
 */

import { prisma } from '@/lib/prisma';

export interface AlertDraft {
  userId: string;
  title: string;
  message: string;
  level: 'info' | 'warn' | 'good';
  dedupeTitle: string;
}

export interface NotificationChannel {
  name: 'in-app' | 'whatsapp' | 'push';
  deliver(draft: AlertDraft): Promise<'sent' | 'updated' | 'skipped'>;
}

const DAY_MS = 86_400_000;

export function inAppChannel(): NotificationChannel {
  return {
    name: 'in-app',
    async deliver(draft) {
      const since = new Date(Date.now() - DAY_MS);
      const existing = await prisma.alert.findFirst({
        where: {
          userId: draft.userId,
          type: 'replenishment',
          title: draft.dedupeTitle,
          dismissed: false,
          createdAt: { gte: since },
        },
      });
      if (existing) {
        if (existing.message !== draft.message || existing.level !== draft.level) {
          await prisma.alert.update({
            where: { id: existing.id },
            data: { message: draft.message, level: draft.level, read: false },
          });
          return 'updated';
        }
        return 'skipped';
      }
      await prisma.alert.create({
        data: {
          userId: draft.userId,
          type: 'replenishment',
          title: draft.dedupeTitle,
          message: draft.message,
          level: draft.level,
        },
      });
      return 'sent';
    },
  };
}

export function whatsappChannel(env: Record<string, string | undefined> = process.env): NotificationChannel {
  return {
    name: 'whatsapp',
    async deliver() {
      if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) return 'skipped';
      return 'skipped';
    },
  };
}

export function pushChannel(env: Record<string, string | undefined> = process.env): NotificationChannel {
  return {
    name: 'push',
    async deliver() {
      if (!env.PUSH_API_KEY) return 'skipped';
      return 'skipped';
    },
  };
}

export function defaultChannels(): NotificationChannel[] {
  return [inAppChannel(), whatsappChannel(), pushChannel()];
}

export async function deliverAlerts(
  drafts: AlertDraft[],
  channels: NotificationChannel[] = defaultChannels()
): Promise<{ sent: number; updated: number }> {
  let sent = 0;
  let updated = 0;
  for (const draft of drafts) {
    for (const channel of channels) {
      const result = await channel.deliver(draft);
      if (result === 'sent') sent += 1;
      if (result === 'updated') updated += 1;
    }
  }
  return { sent, updated };
}

