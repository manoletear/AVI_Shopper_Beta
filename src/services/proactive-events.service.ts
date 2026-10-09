import { prisma } from '@/lib/prisma';

interface UpcomingEvent {
  id: string;
  name: string;
  type: string;
  daysUntil: number;
  date: string;
  suggestedProducts: string[];
  budgetEstimate: number | null;
  memberName?: string;
}

const CHILEAN_HOLIDAYS = [
  { name: 'Ano Nuevo', month: 1, day: 1, remind: 5, type: 'national_holiday', products: ['Champagne', 'Carne para asado', 'Ensaladas', 'Fruta de estacion', 'Hielo', 'Bebidas'] },
  { name: 'Semana Santa', month: 4, day: 10, remind: 7, type: 'religious', products: ['Pescado fresco', 'Mariscos', 'Empanadas de vigilia', 'Pan amasado', 'Aceite'] },
  { name: 'Dia de la Madre', month: 5, day: 11, remind: 7, type: 'cultural', products: ['Torta', 'Cafe especial', 'Croissants', 'Jugo natural', 'Flores'] },
  { name: 'Dia del Padre', month: 6, day: 15, remind: 5, type: 'cultural', products: ['Carne premium', 'Cerveza artesanal', 'Vino', 'Carbon', 'Palta'] },
  { name: 'Fiestas Patrias', month: 9, day: 18, remind: 14, type: 'national_holiday', products: ['Carne para asado', 'Longanizas', 'Choricillos', 'Empanadas de pino', 'Vino tinto', 'Chicha', 'Pisco', 'Carbon vegetal', 'Pan amasado', 'Pebre', 'Mote con huesillo', 'Ensalada chilena'] },
  { name: 'Halloween', month: 10, day: 31, remind: 7, type: 'cultural', products: ['Dulces surtidos', 'Chocolates', 'Galletas', 'Jugos', 'Calabaza'] },
  { name: 'Navidad', month: 12, day: 25, remind: 14, type: 'religious', products: ['Pan de pascua', 'Cola de mono', 'Pavo', 'Ensalada rusa', 'Helados', 'Torta', 'Fruta de estacion', 'Champagne', 'Vino blanco'] },
  { name: 'Vuelta a Clases', month: 3, day: 1, remind: 10, type: 'seasonal', products: ['Yogurt', 'Fruta para lonchera', 'Cereal', 'Jugos individuales', 'Galletas', 'Pan molde', 'Jamon', 'Queso'] },
  { name: 'Inicio Invierno', month: 6, day: 1, remind: 7, type: 'seasonal', products: ['Legumbres', 'Sopas', 'Te', 'Chocolate', 'Miel', 'Cafe'] },
  { name: 'Inicio Verano', month: 12, day: 1, remind: 5, type: 'seasonal', products: ['Protector solar', 'Agua mineral', 'Frutas', 'Helados', 'Jugos', 'Bebidas'] },
  { name: 'San Valentin', month: 2, day: 14, remind: 5, type: 'cultural', products: ['Chocolate', 'Vino', 'Queso', 'Galletas', 'Fruta'] },
  { name: 'Dia del Nino', month: 8, day: 10, remind: 7, type: 'cultural', products: ['Dulces', 'Torta', 'Jugos', 'Snacks', 'Helados', 'Galletas'] },
  { name: 'Ano Nuevo (preparacion)', month: 12, day: 30, remind: 3, type: 'national_holiday', products: ['Champagne', 'Carne para asado', 'Ensaladas', 'Fruta', 'Hielo', 'Bebidas', 'Carbon'] },
  { name: 'Cyber Monday', month: 10, day: 5, remind: 3, type: 'seasonal', products: ['Revisar ofertas en Jumbo', 'Revisar ofertas en Lider', 'Aprovecha descuentos en Unimarc'] },
];

export async function seedNationalEvents(familyId: string): Promise<number> {
  let created = 0;
  for (const h of CHILEAN_HOLIDAYS) {
    const exists = await prisma.familyEvent.findFirst({
      where: { familyId, name: h.name, type: h.type },
    });
    if (!exists) {
      await prisma.familyEvent.create({
        data: {
          familyId,
          type: h.type,
          name: h.name,
          month: h.month,
          day: h.day,
          remindDays: h.remind,
          suggestedProducts: JSON.stringify(h.products),
          isAnnual: true,
        },
      });
      created++;
    }
  }
  return created;
}

export async function createBirthdayEvent(
  familyId: string,
  memberId: string,
  memberName: string,
  dateOfBirth: string
): Promise<void> {
  const parts = dateOfBirth.split('-');
  if (parts.length < 2) return;
  const month = parseInt(parts.length === 3 ? parts[1] : parts[0]);
  const day = parseInt(parts.length === 3 ? parts[2] : parts[1]);
  if (!month || !day) return;

  const exists = await prisma.familyEvent.findFirst({
    where: { familyId, memberId, type: 'family' },
  });
  if (exists) return;

  await prisma.familyEvent.create({
    data: {
      familyId,
      memberId,
      type: 'family',
      name: `Cumpleanos de ${memberName}`,
      month,
      day,
      remindDays: 7,
      suggestedProducts: JSON.stringify(['Torta', 'Bebidas', 'Snacks', 'Dulces', 'Globos', 'Platos desechables']),
      isAnnual: true,
    },
  });
}

export async function getUpcomingEvents(
  familyId: string,
  daysAhead: number = 30
): Promise<UpcomingEvent[]> {
  const events = await prisma.familyEvent.findMany({
    where: { familyId, isActive: true },
    include: { member: { select: { name: true } } },
  });

  const now = new Date();
  const upcoming: UpcomingEvent[] = [];

  for (const event of events) {
    if (!event.month || !event.day) continue;

    let eventDate = new Date(now.getFullYear(), event.month - 1, event.day);
    if (eventDate < now) {
      eventDate = new Date(now.getFullYear() + 1, event.month - 1, event.day);
    }

    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil <= daysAhead + event.remindDays) {
      upcoming.push({
        id: event.id,
        name: event.name,
        type: event.type,
        daysUntil,
        date: eventDate.toISOString(),
        suggestedProducts: event.suggestedProducts ? JSON.parse(event.suggestedProducts) : [],
        budgetEstimate: event.budgetEstimate,
        memberName: event.member?.name || undefined,
      });
    }
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

export async function getEventReminders(familyId: string): Promise<UpcomingEvent[]> {
  const events = await getUpcomingEvents(familyId, 30);
  return events.filter((e) => {
    const event = e as any;
    return e.daysUntil <= (event.remindDays || 7);
  });
}
