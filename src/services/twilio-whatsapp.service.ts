/**
 * Twilio WhatsApp Service
 *
 * Adapter para enviar/recibir mensajes de WhatsApp vía Twilio.
 * Se activa con TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM.
 * Si no están configuradas, el servicio original (Meta Cloud API) sigue funcionando.
 *
 * Requiere:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_FROM (ej: "whatsapp:+56949893097")
 */

import twilio from 'twilio';

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function getFrom(): string {
  return process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+56949893097';
}

function toWhatsApp(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return `whatsapp:+${clean}`;
}

export async function sendText(to: string, body: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    await client.messages.create({
      from: getFrom(),
      to: toWhatsApp(to),
      body,
    });
    return true;
  } catch (error) {
    console.error('[Twilio] Error enviando texto:', error);
    return false;
  }
}

export async function sendButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const buttonText = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
    await client.messages.create({
      from: getFrom(),
      to: toWhatsApp(to),
      body: `${body}\n\n${buttonText}\n\nResponde con el número de tu opción.`,
    });
    return true;
  } catch (error) {
    console.error('[Twilio] Error enviando botones:', error);
    return false;
  }
}

export interface TwilioWebhookMessage {
  from: string;
  body: string;
  messageSid: string;
  numMedia: number;
  profileName?: string;
}

export function extractTwilioMessage(formData: URLSearchParams): TwilioWebhookMessage | null {
  const from = formData.get('From');
  const body = formData.get('Body');
  const sid = formData.get('MessageSid');

  if (!from || !body || !sid) return null;

  return {
    from: from.replace('whatsapp:', '').replace('+', ''),
    body: body.trim(),
    messageSid: sid,
    numMedia: parseInt(formData.get('NumMedia') || '0', 10),
    profileName: formData.get('ProfileName') || undefined,
  };
}

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;

  const twilioLib = twilio;
  return twilioLib.validateRequest(token, signature, url, params);
}

export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}
