import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'manuel.aravenal@gmail.com';
  const rawPassword = process.env.SEED_PASSWORD || 'AviDemo2026!';
  const password = await bcrypt.hash(rawPassword, 12);

  // Create or update user
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: 'Manuel Aravena', password },
    create: {
      email,
      name: 'Manuel Aravena',
      password,
    },
  });

  console.log('User:', user.id, user.email);

  // User preferences
  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {
      dietType: 'none',
      allergies: '[]',
      favorites: '["meta:{\\"healthGoals\\":[\\"comer_sano\\"],\\"familySize\\":4}"]',
    },
    create: {
      userId: user.id,
      dietType: 'none',
      allergies: '[]',
      favorites: '["meta:{\\"healthGoals\\":[\\"comer_sano\\"],\\"familySize\\":4}"]',
    },
  });

  console.log('Preferences created');

  // Family
  let family = await prisma.family.findFirst({
    where: { members: { some: { userId: user.id } } },
  });

  if (!family) {
    family = await prisma.family.create({
      data: {
        name: 'Familia Aravena',
        members: {
          create: {
            userId: user.id,
            name: 'Manuel',
            role: 'master',
            type: 'person',
          },
        },
      },
    });
    console.log('Family created:', family.id);
  }

  // Family members
  const existingMembers = await prisma.familyMember.count({ where: { familyId: family.id } });
  if (existingMembers <= 1) {
    await prisma.familyMember.createMany({
      data: [
        { familyId: family.id, name: 'Pareja', role: 'adult', type: 'person', allergies: '[]' },
        { familyId: family.id, name: 'Hijo 1', role: 'child', type: 'person', dateOfBirth: '2018-06-15', allergies: '[]' },
        { familyId: family.id, name: 'Hijo 2', role: 'child', type: 'person', dateOfBirth: '2020-11-20', allergies: '[]' },
      ],
    });
    console.log('Family members created');
  }

  // Budget
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  await prisma.budget.upsert({
    where: { id: 'manu-budget-oct-2026' },
    update: { spent: 45000 },
    create: {
      id: 'manu-budget-oct-2026',
      userId: user.id,
      period: 'monthly',
      amount: 120000,
      spent: 45000,
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: endOfMonth,
    },
  });
  console.log('Budget created');

  // Shopping lists
  const list1 = await prisma.shoppingList.create({
    data: {
      userId: user.id,
      name: 'Supermercado semanal',
      items: {
        create: [
          { name: 'Leche Colun 1L', quantity: 2 },
          { name: 'Pan molde integral', quantity: 1 },
          { name: 'Huevos 12 unidades', quantity: 1 },
          { name: 'Palta', quantity: 3 },
          { name: 'Tomate', quantity: 1, urgent: true },
          { name: 'Pollo entero', quantity: 1 },
          { name: 'Arroz 1kg', quantity: 1 },
          { name: 'Fideos', quantity: 2 },
          { name: 'Queso laminado', quantity: 1 },
          { name: 'Yogurt pack 6', quantity: 1 },
        ],
      },
    },
  });
  console.log('List created:', list1.name);

  const list2 = await prisma.shoppingList.create({
    data: {
      userId: user.id,
      name: 'Limpieza mensual',
      items: {
        create: [
          { name: 'Detergente liquido', quantity: 1 },
          { name: 'Cloro', quantity: 1 },
          { name: 'Lavalozas', quantity: 1 },
          { name: 'Papel higienico 12 rollos', quantity: 1 },
          { name: 'Toalla de papel', quantity: 2 },
          { name: 'Bolsas de basura', quantity: 1 },
        ],
      },
    },
  });
  console.log('List created:', list2.name);

  // Purchase history (for replenishment + learning)
  const purchases = [
    { productName: 'Leche Colun 1L', storeSlug: 'jumbo', storeName: 'Jumbo', price: 1290, quantity: 2 },
    { productName: 'Pan molde integral', storeSlug: 'lider', storeName: 'Lider', price: 2490, quantity: 1 },
    { productName: 'Huevos 12 unidades', storeSlug: 'jumbo', storeName: 'Jumbo', price: 3990, quantity: 1 },
    { productName: 'Pollo entero', storeSlug: 'lider', storeName: 'Lider', price: 4990, quantity: 1 },
    { productName: 'Arroz 1kg', storeSlug: 'unimarc', storeName: 'Unimarc', price: 1590, quantity: 1 },
    { productName: 'Detergente liquido', storeSlug: 'tottus', storeName: 'Tottus', price: 5990, quantity: 1 },
    { productName: 'Palta', storeSlug: 'jumbo', storeName: 'Jumbo', price: 990, quantity: 3 },
    { productName: 'Queso laminado', storeSlug: 'jumbo', storeName: 'Jumbo', price: 2890, quantity: 1 },
  ];

  for (const p of purchases) {
    // Create 3 months of history
    for (let monthsAgo = 0; monthsAgo < 3; monthsAgo++) {
      const date = new Date();
      date.setMonth(date.getMonth() - monthsAgo);
      date.setDate(Math.floor(Math.random() * 20) + 1);

      await prisma.purchaseHistory.create({
        data: {
          userId: user.id,
          ...p,
          source: 'manual',
          purchasedAt: date,
        },
      });
    }
  }
  console.log('Purchase history created (3 months)');

  // Seed family events (Chilean holidays)
  try {
    const { seedNationalEvents, createBirthdayEvent } = await import('../src/services/proactive-events.service');
    await seedNationalEvents(family.id);

    // Birthday events for kids
    const kids = await prisma.familyMember.findMany({
      where: { familyId: family.id, role: 'child' },
    });
    for (const kid of kids) {
      if (kid.dateOfBirth) {
        await createBirthdayEvent(family.id, kid.id, kid.name, kid.dateOfBirth);
      }
    }
    console.log('Events seeded');
  } catch (e) {
    console.log('Events seed skipped (run from Next.js context)');
  }

  console.log('\nDone! Login with:');
  console.log('Email: manuel.aravenal@gmail.com');
  console.log('Password: (set via SEED_PASSWORD env var)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
