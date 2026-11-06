import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  extractMessage,
  sendTextMessage,
  sendButtonMessage,
  markAsRead,
  verifyWebhookSignature,
} from '@/services/whatsapp.service';
import {
  isTwilioConfigured,
  extractTwilioMessage,
  verifyTwilioSignature,
  sendText as twilioSendText,
  sendButtons as twilioSendButtons,
} from '@/services/twilio-whatsapp.service';
import { processAgentMessage } from '@/services/agent.service';

const useTwilio = () => isTwilioConfigured();

async function sendResponse(phone: string, text: string) {
  if (useTwilio()) return twilioSendText(phone, text);
  return sendTextMessage(phone, text);
}

async function sendResponseButtons(
  phone: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
) {
  if (useTwilio()) return twilioSendButtons(phone, body, buttons);
  return sendButtonMessage(phone, body, buttons);
}

// GET /api/whatsapp — Verificación del webhook (Meta o Twilio)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WhatsApp webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// POST /api/whatsapp — Recibir mensajes (Meta Cloud API o Twilio)
export async function POST(request: NextRequest) {
  try {
    let phone: string;
    let userText: string;
    let messageId: string;

    if (useTwilio()) {
      // ── Twilio path ──
      const sig = request.headers.get('x-twilio-signature') || '';
      const rawBody = await request.clone().text();
      const formData = new URLSearchParams(rawBody);

      const url = request.url;
      const params: Record<string, string> = {};
      formData.forEach((v, k) => { params[k] = v; });

      if (process.env.TWILIO_AUTH_TOKEN && !verifyTwilioSignature(url, params, sig)) {
        console.warn('[Twilio] Firma inválida — request rechazado');
        return new NextResponse('Forbidden', { status: 403 });
      }

      const msg = extractTwilioMessage(formData);
      if (!msg || !msg.body) {
        return new NextResponse('<Response></Response>', {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      phone = msg.from;
      userText = msg.body;
      messageId = msg.messageSid;
    } else {
      // ── Meta Cloud API path ──
      const appSecret = process.env.WHATSAPP_APP_SECRET;
      if (appSecret) {
        const signature = request.headers.get('x-hub-signature-256') || '';
        const rawBody = await request.clone().text();
        if (!verifyWebhookSignature(signature, rawBody, appSecret)) {
          console.warn('[WhatsApp] Firma inválida — request rechazado');
          return new NextResponse('Forbidden', { status: 403 });
        }
      }

      const body = await request.json();
      const message = extractMessage(body);

      if (!message) {
        return new NextResponse('OK', { status: 200 });
      }

      markAsRead(message.id).catch(() => {});

      phone = message.from;
      messageId = message.id;

      if (message.type === 'text' && message.text) {
        userText = message.text.body;
      } else if (message.type === 'interactive') {
        userText = message.interactive?.button_reply?.title
          || message.interactive?.list_reply?.title
          || '';
      } else if (message.type === 'image' && message.image?.caption) {
        userText = message.image.caption;
      } else {
        userText = '';
      }
    }

    if (!userText) {
      await sendResponse(phone, 'Hola! Soy AVI 🛒 Envíame un mensaje de texto y te ayudo con tus compras.');
      return new NextResponse('OK', { status: 200 });
    }

    // Buscar o crear usuario por número de teléfono
    let user = await prisma.user.findFirst({
      where: { image: phone },
    });

    if (!user) {
      const bcrypt = require('bcryptjs');
      user = await prisma.user.create({
        data: {
          email: `wa_${phone}@avishopper.cl`,
          password: await bcrypt.hash(phone, 10),
          name: `WhatsApp ${phone.slice(-4)}`,
          image: phone,
          consents: { create: { precios: true, consumo: true, salud: false } },
          preferences: { create: {} },
        },
      });

      await sendResponseButtons(
        phone,
        '¡Hola! Soy AVI, tu asistente de compras familiares 🛒\n\nPuedo:\n• Armar tu lista de compras\n• Comparar precios en 4 supermercados\n• Cuidar la nutrición de tu familia\n• Comprar por ti al mejor precio\n\n¿Qué necesitas?',
        [
          { id: 'crear_lista', title: 'Crear mi lista' },
          { id: 'comparar', title: 'Comparar precios' },
          { id: 'ayuda', title: 'Qué puedes hacer?' },
        ]
      );
      return new NextResponse('OK', { status: 200 });
    }

    // Procesar con el agente AVI
    const result = await processAgentMessage(userText, user.id);
    const response = result.response;

    if (response.length > 1024) {
      const chunks = response.match(/.{1,1024}/gs) || [response];
      for (const chunk of chunks) {
        await sendResponse(phone, chunk);
        await new Promise((r) => setTimeout(r, 500));
      }
    } else {
      const hasCheckout = result.toolsUsed.some((t) => t.tool === 'checkout');
      const hasList = result.toolsUsed.some((t) => t.tool === 'get_list');
      const hasSuggestions = result.toolsUsed.some((t) => t.tool === 'suggest_products');

      if (hasCheckout) {
        await sendResponseButtons(phone, response, [
          { id: 'confirmar_compra', title: 'Confirmar compra' },
          { id: 'ver_lista', title: 'Ver mi lista' },
          { id: 'cancelar', title: 'Cancelar' },
        ]);
      } else if (hasList || hasSuggestions) {
        await sendResponseButtons(phone, response, [
          { id: 'comparar_precios', title: 'Comparar precios' },
          { id: 'comprar', title: 'Comprar ahora' },
          { id: 'agregar_mas', title: 'Agregar más' },
        ]);
      } else {
        await sendResponse(phone, response);
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}
