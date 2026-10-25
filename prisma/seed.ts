import { PrismaClient, type Product, type Store } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { syncReplenishmentAlerts } from '../src/services/replenishment.service';
import { seedCanonicalCatalog } from '../src/services/catalog/persist';

const prisma = new PrismaClient();

/**
 * Seed idempotente para soc-chile (public) y para la base vacía de CI.
 * No borra filas. Si el usuario demo ya existe, no le cambia la clave.
 * Las compras, listas, presupuestos y avisos solo se crean si faltan.
 */

const DEMO_EMAIL = 'demo@avishopper.cl';

function utcNoonDaysAgo(days: number): Date {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

async function main() {
  console.log('🌱 Seeding database (sin borrar filas)...');

  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  const user = existingUser ?? await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      password: await bcrypt.hash('demo123456', 10),
      name: 'Usuario Demo',
    },
  });
  if (existingUser) {
    console.log('✅ Demo user already present, password left as-is:', user.email);
  } else {
    console.log('✅ Created demo user:', user.email);
  }

  await prisma.userConsent.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, precios: true, consumo: true, salud: true },
  });
  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      dietType: 'balanced',
      allergies: JSON.stringify(['gluten']),
      favorites: JSON.stringify([]),
    },
  });

  const storeDefs = [
    { name: 'Lider', slug: 'lider', deliveryFee: 179000, minOrder: 1000000, address: 'Av. Kennedy 9001, Las Condes' },
    { name: 'Jumbo', slug: 'jumbo', deliveryFee: 199000, minOrder: 1500000, address: 'Av. Presidente Kennedy 9001' },
    { name: 'Unimarc', slug: 'unimarc', deliveryFee: 149000, minOrder: 800000, address: 'Av. Apoquindo 4900' },
  ];
  const stores: Store[] = [];
  for (const store of storeDefs) {
    stores.push(await prisma.store.upsert({
      where: { slug: store.slug },
      update: {},
      create: store,
    }));
  }
  console.log('✅ Stores:', stores.map((store) => store.name).join(', '));

  const productDefs = [
    { name: 'Leche descremada Colun 1L', category: 'Lácteos', brand: 'Colun', calories: 350, protein: 33, carbs: 48, fat: 1.5, isUltraProcessed: false, nutritionScore: 85 },
    { name: 'Pan integral Ideal', category: 'Panadería', brand: 'Ideal', calories: 1200, protein: 40, carbs: 200, fat: 15, fiber: 24, isUltraProcessed: false, nutritionScore: 75 },
    { name: 'Pechuga de pollo 1kg', category: 'Carnes', brand: 'Agrosuper', calories: 1650, protein: 310, carbs: 0, fat: 36, isUltraProcessed: false, nutritionScore: 90 },
    { name: 'Manzanas Fuji por kg', category: 'Frutas', calories: 520, protein: 2.6, carbs: 138, fat: 1.7, fiber: 24, sugar: 104, isUltraProcessed: false, nutritionScore: 95 },
    { name: 'Detergente Omo 3L', category: 'Limpieza', brand: 'Omo' },
    { name: 'Yogurt natural Quillayes 1L', category: 'Lácteos', brand: 'Quillayes', calories: 620, protein: 38, carbs: 54, fat: 32, isUltraProcessed: false, nutritionScore: 80 },
    { name: 'Arroz Tucapel 1kg', category: 'Abarrotes', brand: 'Tucapel', calories: 3650, protein: 80, carbs: 800, fat: 7, isUltraProcessed: false, nutritionScore: 70 },
    { name: 'Coca-Cola 2L', category: 'Bebidas', brand: 'Coca-Cola', calories: 840, protein: 0, carbs: 210, fat: 0, sugar: 210, isUltraProcessed: true, nutritionScore: 25 },
  ];
  const products: Product[] = [];
  for (const product of productDefs) {
    const found = await prisma.product.findFirst({ where: { name: product.name } });
    products.push(found ?? await prisma.product.create({ data: product }));
  }
  console.log('✅ Products:', products.length);

  const priceData = [
    { productIdx: 0, storeIdx: 0, price: 119000 },
    { productIdx: 0, storeIdx: 1, price: 129000 },
    { productIdx: 0, storeIdx: 2, price: 115000 },
    { productIdx: 1, storeIdx: 0, price: 189000 },
    { productIdx: 1, storeIdx: 1, price: 179000 },
    { productIdx: 1, storeIdx: 2, price: 195000 },
    { productIdx: 2, storeIdx: 0, price: 429000 },
    { productIdx: 2, storeIdx: 1, price: 449000 },
    { productIdx: 2, storeIdx: 2, price: 419000 },
    { productIdx: 3, storeIdx: 0, price: 149000 },
    { productIdx: 3, storeIdx: 1, price: 139000 },
    { productIdx: 3, storeIdx: 2, price: 159000 },
    { productIdx: 4, storeIdx: 0, price: 679000 },
    { productIdx: 4, storeIdx: 1, price: 699000 },
    { productIdx: 4, storeIdx: 2, price: 659000 },
    { productIdx: 5, storeIdx: 0, price: 229000 },
    { productIdx: 5, storeIdx: 1, price: 219000 },
    { productIdx: 5, storeIdx: 2, price: 239000 },
    { productIdx: 6, storeIdx: 0, price: 119000 },
    { productIdx: 6, storeIdx: 1, price: 129000 },
    { productIdx: 6, storeIdx: 2, price: 109000 },
    { productIdx: 7, storeIdx: 0, price: 229000 },
    { productIdx: 7, storeIdx: 1, price: 239000 },
    { productIdx: 7, storeIdx: 2, price: 219000 },
  ];
  for (const { productIdx, storeIdx, price } of priceData) {
    const product = products[productIdx];
    const store = stores[storeIdx];
    if (!product || !store) continue;
    const productId = product.id;
    const storeId = store.id;
    await prisma.productPrice.upsert({
      where: { productId_storeId: { productId, storeId } },
      update: {},
      create: { productId, storeId, price, stock: 100, inStock: true },
    });
  }
  console.log('✅ Product prices');

  const listName = 'Compras de la semana';
  const existingList = await prisma.shoppingList.findFirst({
    where: { userId: user.id, name: listName },
  });
  if (!existingList) {
    await prisma.shoppingList.create({
      data: {
        userId: user.id,
        name: listName,
        items: {
          create: [0, 1, 2, 3, 4].flatMap((index) => {
            const product = products[index];
            const quantity = [6, 4, 2, 12, 1][index];
            if (!product || quantity === undefined) return [];
            return [{
              productId: product.id,
              name: product.name,
              quantity,
              urgent: index === 0,
            }];
          }),
        },
      },
    });
    console.log('✅ Created shopping list');
  } else {
    console.log('✅ Shopping list already present');
  }

  const existingBudget = await prisma.budget.findFirst({
    where: { userId: user.id, period: 'weekly' },
  });
  if (!existingBudget) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    await prisma.budget.create({
      data: {
        userId: user.id,
        period: 'weekly',
        amount: 4500000,
        spent: 3250000,
        startDate: weekStart,
        endDate: weekEnd,
      },
    });
    console.log('✅ Created budget');
  } else {
    console.log('✅ Budget already present');
  }

  const demoAlerts = [
    { type: 'savings', level: 'good', title: 'Ahorro disponible', message: 'Dividir carrito ahorra 12,4%' },
    { type: 'budget', level: 'warn', title: 'Presupuesto', message: 'Restan $12.500 esta semana' },
    { type: 'stock', level: 'info', title: 'Stock bajo', message: 'Leche se agota en 2 días' },
  ];
  for (const alert of demoAlerts) {
    const found = await prisma.alert.findFirst({ where: { userId: user.id, title: alert.title } });
    if (!found) {
      await prisma.alert.create({ data: { userId: user.id, ...alert } });
    }
  }
  console.log('✅ Alerts');

  const nutritionCount = await prisma.nutritionData.count({ where: { userId: user.id } });
  if (nutritionCount === 0) {
    for (let i = 0; i < 7; i++) {
      await prisma.nutritionData.create({
        data: {
          userId: user.id,
          date: utcNoonDaysAgo(i),
          score: 75 + (i % 5),
          ultraProcessed: 15 + i,
          fruits: (i % 4) + 1,
          protein: 80 + i * 2,
          calories: 1800 + i * 40,
        },
      });
    }
    console.log('✅ Created nutrition data');
  } else {
    console.log('✅ Nutrition data already present');
  }

  const shortcuts = [
    { name: 'Asado', slug: 'asado', items: JSON.stringify([{ name: 'Carne de vacuno 2kg', quantity: 1 }, { name: 'Chorizo 1kg', quantity: 1 }, { name: 'Pan para choripán', quantity: 2 }, { name: 'Carbón 5kg', quantity: 1 }, { name: 'Ensalada mixta', quantity: 1 }]) },
    { name: 'Cumpleaños', slug: 'cumple', items: JSON.stringify([{ name: 'Torta de chocolate', quantity: 1 }, { name: 'Velas', quantity: 1 }, { name: 'Bebidas 2L', quantity: 3 }, { name: 'Papas fritas', quantity: 2 }, { name: 'Platos desechables', quantity: 1 }]) },
    { name: 'Desayunos', slug: 'desayunos', items: JSON.stringify([{ name: 'Pan de molde', quantity: 2 }, { name: 'Mermelada', quantity: 1 }, { name: 'Mantequilla', quantity: 1 }, { name: 'Café 500g', quantity: 1 }, { name: 'Leche 1L', quantity: 4 }]) },
    { name: 'Colación', slug: 'colacion', items: JSON.stringify([{ name: 'Frutas variadas', quantity: 5 }, { name: 'Yogurt', quantity: 6 }, { name: 'Frutos secos', quantity: 2 }, { name: 'Barritas de cereal', quantity: 1 }]) },
  ];
  for (const shortcut of shortcuts) {
    await prisma.shortcutTemplate.upsert({
      where: { slug: shortcut.slug },
      update: {},
      create: shortcut,
    });
  }
  console.log('✅ Shortcut templates');

  const milkName = 'Leche Colun Entera 1 L';
  const seededMilk = await prisma.purchaseHistory.findFirst({
    where: { userId: user.id, productName: milkName, source: 'seed' },
  });
  if (!seededMilk) {
    await prisma.purchaseHistory.createMany({
      data: [33, 26, 19, 12, 5].map((days) => ({
        userId: user.id,
        productName: milkName,
        quantity: 6,
        unit: 'L',
        storeSlug: 'jumbo',
        storeName: 'Jumbo',
        price: 7140,
        source: 'seed',
        purchasedAt: utcNoonDaysAgo(days),
      })),
    });
  }
  const riceName = 'Arroz grado 1 1 kg';
  const seededRice = await prisma.purchaseHistory.findFirst({
    where: { userId: user.id, productName: riceName },
  });
  if (!seededRice) {
    await prisma.purchaseHistory.create({
      data: {
        userId: user.id,
        productName: riceName,
        quantity: 1,
        unit: 'kg',
        storeSlug: 'lider',
        storeName: 'Lider',
        price: 1690,
        source: 'manual',
        purchasedAt: utcNoonDaysAgo(20),
      },
    });
  }
  console.log('✅ Purchase history');

  const observations = [
    { productName: milkName, brand: 'Colun', storeSlug: 'jumbo', storeName: 'Jumbo', price: 1190, inStock: true, searchTerm: 'leche colun' },
    { productName: milkName, brand: 'Colun', storeSlug: 'lider', storeName: 'Lider', price: 1390, inStock: true, searchTerm: 'leche colun' },
    { productName: milkName, brand: 'Colun', storeSlug: 'tottus', storeName: 'Tottus', price: 1290, inStock: true, searchTerm: 'leche colun' },
  ];
  for (const observation of observations) {
    const found = await prisma.priceObservation.findFirst({
      where: { productName: observation.productName, storeSlug: observation.storeSlug },
    });
    if (!found) await prisma.priceObservation.create({ data: observation });
  }

  await seedCanonicalCatalog(prisma);
  const notices = await syncReplenishmentAlerts(new Date(), user.id);
  console.log('✅ Purchase history and replenishment alerts:', notices.sent);

  console.log('🎉 Seeding completed successfully!');
  console.log('');
  console.log('Demo credentials (solo si el usuario se acaba de crear):');
  console.log('  Email: demo@avishopper.cl');
  console.log('  Password: demo123456');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
