import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractMessage, sendTextMessage, sendButtonMessage, markAsRead } from '@/services/whatsapp.service';
import { processAgentMessage } from '@/services/agent.service';

// GET /api/whatsapp — Verificacion del webhook de Meta
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

// POST /api/whatsapp — Recibir mensajes de WhatsApp
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = extractMessage(body);

    if (!message) {
      return new NextResponse('OK', { status: 200 });
    }

    // Marcar como leido
    markAsRead(message.id).catch(() => {});

    // Extraer texto del mensaje
    let userText = '';
    if (message.type === 'text' && message.text) {
      userText = message.text.body;
    } else if (message.type === 'interactive') {
      userText = message.interactive?.button_reply?.title
        || message.interactive?.list_reply?.title
        || '';
    } else if (message.type === 'image' && message.image?.caption) {
      userText = message.image.caption;
    }

    if (!userText) {
      await sendTextMessage(message.from, 'Hola! Soy AVI 🛒 Enviame un mensaje de texto y te ayudo con tus compras.');
      return new NextResponse('OK', { status: 200 });
    }

    // Buscar o crear usuario por numero de telefono
    const phone = message.from;
    let user = await prisma.user.findFirst({
      where: { image: phone }, // Usamos image field para guardar phone temporalmente
    });

    if (!user) {
      // Crear usuario nuevo desde WhatsApp
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

      // Mensaje de bienvenida
      await sendButtonMessage(
        phone,
        '¡Hola! Soy AVI, tu asistente de compras familiares 🛒\n\nPuedo:\n• Armar tu lista de compras\n• Comparar precios en 4 supermercados\n• Cuidar la nutricion de tu familia\n• Comprar por ti al mejor precio\n\n¿Que necesitas?',
        [
          { id: 'crear_lista', title: 'Crear mi lista' },
          { id: 'comparar', title: 'Comparar precios' },
          { id: 'ayuda', title: 'Que puedes hacer?' },
        ]
      );
      return new NextResponse('OK', { status: 200 });
    }

    // Procesar con el agente AVI
    const result = await processAgentMessage(userText, user.id);

    // Enviar respuesta
    const response = result.response;

    // Si la respuesta es larga, dividir en mensajes
    if (response.length > 1024) {
      const chunks = response.match(/.{1,1024}/gs) || [response];
      for (const chunk of chunks) {
        await sendTextMessage(phone, chunk);
        await new Promise((r) => setTimeout(r, 500));
      }
    } else {
      // Si hay tools de compra, enviar con botones
      const hasCheckout = result.toolsUsed.some((t) => t.tool === 'checkout');
      const hasList = result.toolsUsed.some((t) => t.tool === 'get_list');
      const hasSuggestions = result.toolsUsed.some((t) => t.tool === 'suggest_products');

      if (hasCheckout) {
        await sendButtonMessage(phone, response, [
          { id: 'confirmar_compra', title: 'Confirmar compra' },
          { id: 'ver_lista', title: 'Ver mi lista' },
          { id: 'cancelar', title: 'Cancelar' },
        ]);
      } else if (hasList || hasSuggestions) {
        await sendButtonMessage(phone, response, [
          { id: 'comparar_precios', title: 'Comparar precios' },
          { id: 'comprar', title: 'Comprar ahora' },
          { id: 'agregar_mas', title: 'Agregar mas' },
        ]);
      } else {
        await sendTextMessage(phone, response);
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}
