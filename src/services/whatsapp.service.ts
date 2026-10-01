/**
 * WhatsApp Cloud API Service
 *
 * AVI vive en WhatsApp como asistente de compras familiar.
 * Usa Meta Cloud API para recibir y enviar mensajes.
 *
 * Flujo:
 * 1. Usuario manda mensaje por WhatsApp
 * 2. Meta envia webhook a /api/whatsapp
 * 3. AVI procesa con el agente tool_use
 * 4. AVI responde por WhatsApp
 *
 * Requiere:
 * - WHATSAPP_TOKEN (token de acceso de la app Meta)
 * - WHATSAPP_PHONE_ID (ID del numero de telefono)
 * - WHATSAPP_VERIFY_TOKEN (token de verificacion del webhook)
 */

const GRAPH_API = 'https://graph.facebook.com/v23.0';

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'interactive';
  text?: { body: string };
  image?: { id: string; caption?: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
}

/**
 * Enviar mensaje de texto
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) return false;

  try {
    const res = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Enviar mensaje con botones interactivos
 */
export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) return false;

  try {
    const res = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.slice(0, 3).map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Enviar lista interactiva
 */
export async function sendListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>
): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) return false;

  try {
    const res = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          action: {
            button: buttonText,
            sections,
          },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Marcar mensaje como leido
 */
export async function markAsRead(messageId: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return;

  await fetch(`${GRAPH_API}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  }).catch(() => {});
}

/**
 * Extraer mensaje de texto del webhook payload
 */
export function extractMessage(body: any): WhatsAppMessage | null {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    if (!message) return null;

    return {
      from: message.from,
      id: message.id,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text,
      image: message.image,
      interactive: message.interactive,
    };
  } catch {
    return null;
  }
}

/**
 * Verificar firma del webhook de Meta
 */
export function verifyWebhookSignature(
  signature: string,
  body: string,
  appSecret: string
): boolean {
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(body)
    .digest('hex');
  return `sha256=${expected}` === signature;
}
