import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.alert.deleteMany();
  await prisma.nutritionData.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productPrice.deleteMany();
  await prisma.shoppingItem.deleteMany();
  await prisma.shoppingList.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.userConsent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shortcutTemplate.deleteMany();

  console.log('✅ Cleared existing data');

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123456', 10);

  const user = await prisma.user.create({
    data: {
      email: 'demo@avishopper.cl',
      password: hashedPassword,
      name: 'Usuario Demo',
      consents: {
        create: {
          precios: true,
          consumo: true,
          salud: true,
        },
      },
      preferences: {
        create: {
          dietType: 'balanced',
          allergies: JSON.stringify(['gluten']),
          favorites: JSON.stringify([]),
        },
      },
    },
  });

  console.log('✅ Created demo user:', user.email);

  // Create stores
  const stores = await Promise.all([
    prisma.store.create({
      data: {
        name: 'Lider',
        slug: 'lider',
        deliveryFee: 179000, // 1790 CLP in cents
        minOrder: 1000000,
        address: 'Av. Kennedy 9001, Las Condes',
      },
    }),
    prisma.store.create({
      data: {
        name: 'Jumbo',
        slug: 'jumbo',
        deliveryFee: 199000, // 1990 CLP in cents
        minOrder: 1500000,
        address: 'Av. Presidente Kennedy 9001',
      },
    }),
    prisma.store.create({
      data: {
        name: 'Unimarc',
        slug: 'unimarc',
        deliveryFee: 149000, // 1490 CLP in cents
        minOrder: 800000,
        address: 'Av. Apoquindo 4900',
      },
    }),
  ]);

  console.log('✅ Created stores:', stores.map(s => s.name).join(', '));

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Leche descremada Colun 1L',
        category: 'Lácteos',
        brand: 'Colun',
        calories: 350,
        protein: 33,
        carbs: 48,
        fat: 1.5,
        isUltraProcessed: false,
        nutritionScore: 85,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Pan integral Ideal',
        category: 'Panadería',
        brand: 'Ideal',
        calories: 1200,
        protein: 40,
        carbs: 200,
        fat: 15,
        fiber: 24,
        isUltraProcessed: false,
        nutritionScore: 75,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Pechuga de pollo 1kg',
        category: 'Carnes',
        brand: 'Agrosuper',
        calories: 1650,
        protein: 310,
        carbs: 0,
        fat: 36,
        isUltraProcessed: false,
        nutritionScore: 90,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Manzanas Fuji por kg',
        category: 'Frutas',
        calories: 520,
        protein: 2.6,
        carbs: 138,
        fat: 1.7,
        fiber: 24,
        sugar: 104,
        isUltraProcessed: false,
        nutritionScore: 95,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Detergente Omo 3L',
        category: 'Limpieza',
        brand: 'Omo',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Yogurt natural Quillayes 1L',
        category: 'Lácteos',
        brand: 'Quillayes',
        calories: 620,
        protein: 38,
        carbs: 54,
        fat: 32,
        isUltraProcessed: false,
        nutritionScore: 80,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Arroz Tucapel 1kg',
        category: 'Abarrotes',
        brand: 'Tucapel',
        calories: 3650,
        protein: 80,
        carbs: 800,
        fat: 7,
        isUltraProcessed: false,
        nutritionScore: 70,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Coca-Cola 2L',
        category: 'Bebidas',
        brand: 'Coca-Cola',
        calories: 840,
        protein: 0,
        carbs: 210,
        fat: 0,
        sugar: 210,
        isUltraProcessed: true,
        nutritionScore: 25,
      },
    }),
  ]);

  console.log('✅ Created products:', products.length);

  // Create product prices for each store
  const priceData = [
    // Leche
    { productIdx: 0, storeIdx: 0, price: 119000 }, // Lider: 1190
    { productIdx: 0, storeIdx: 1, price: 129000 }, // Jumbo: 1290
    { productIdx: 0, storeIdx: 2, price: 115000 }, // Unimarc: 1150

    // Pan
    { productIdx: 1, storeIdx: 0, price: 189000 }, // Lider: 1890
    { productIdx: 1, storeIdx: 1, price: 179000 }, // Jumbo: 1790
    { productIdx: 1, storeIdx: 2, price: 195000 }, // Unimarc: 1950

    // Pollo
    { productIdx: 2, storeIdx: 0, price: 429000 }, // Lider: 4290
    { productIdx: 2, storeIdx: 1, price: 449000 }, // Jumbo: 4490
    { productIdx: 2, storeIdx: 2, price: 419000 }, // Unimarc: 4190

    // Manzanas
    { productIdx: 3, storeIdx: 0, price: 149000 }, // Lider: 1490/kg
    { productIdx: 3, storeIdx: 1, price: 139000 }, // Jumbo: 1390/kg
    { productIdx: 3, storeIdx: 2, price: 159000 }, // Unimarc: 1590/kg

    // Detergente
    { productIdx: 4, storeIdx: 0, price: 679000 }, // Lider: 6790
    { productIdx: 4, storeIdx: 1, price: 699000 }, // Jumbo: 6990
    { productIdx: 4, storeIdx: 2, price: 659000 }, // Unimarc: 6590

    // Yogurt
    { productIdx: 5, storeIdx: 0, price: 229000 }, // Lider: 2290
    { productIdx: 5, storeIdx: 1, price: 219000 }, // Jumbo: 2190
    { productIdx: 5, storeIdx: 2, price: 239000 }, // Unimarc: 2390

    // Arroz
    { productIdx: 6, storeIdx: 0, price: 119000 }, // Lider: 1190
    { productIdx: 6, storeIdx: 1, price: 129000 }, // Jumbo: 1290
    { productIdx: 6, storeIdx: 2, price: 109000 }, // Unimarc: 1090

    // Coca-Cola
    { productIdx: 7, storeIdx: 0, price: 229000 }, // Lider: 2290
    { productIdx: 7, storeIdx: 1, price: 239000 }, // Jumbo: 2390
    { productIdx: 7, storeIdx: 2, price: 219000 }, // Unimarc: 2190
  ];

  for (const { productIdx, storeIdx, price } of priceData) {
    await prisma.productPrice.create({
      data: {
        productId: products[productIdx].id,
        storeId: stores[storeIdx].id,
        price,
        stock: 100,
        inStock: true,
      },
    });
  }

  console.log('✅ Created product prices');

  // Create shopping list
  const shoppingList = await prisma.shoppingList.create({
    data: {
      userId: user.id,
      name: 'Compras de la semana',
      items: {
        create: [
          {
            productId: products[0].id,
            name: products[0].name,
            quantity: 6,
            urgent: true,
          },
          {
            productId: products[1].id,
            name: products[1].name,
            quantity: 4,
          },
          {
            productId: products[2].id,
            name: products[2].name,
            quantity: 2,
          },
          {
            productId: products[3].id,
            name: products[3].name,
            quantity: 12,
          },
          {
            productId: products[4].id,
            name: products[4].name,
            quantity: 1,
          },
        ],
      },
    },
  });

  console.log('✅ Created shopping list');

  // Create budget
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Start of week
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // End of week

  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      period: 'weekly',
      amount: 4500000, // 45,000 CLP in cents
      spent: 3250000, // 32,500 CLP in cents
      startDate: weekStart,
      endDate: weekEnd,
    },
  });

  console.log('✅ Created budget');

  // Create alerts
  await prisma.alert.createMany({
    data: [
      {
        userId: user.id,
        type: 'savings',
        level: 'good',
        title: 'Ahorro disponible',
        message: 'Dividir carrito ahorra 12,4%',
      },
      {
        userId: user.id,
        type: 'budget',
        level: 'warn',
        title: 'Presupuesto',
        message: 'Restan $12.500 esta semana',
      },
      {
        userId: user.id,
        type: 'stock',
        level: 'info',
        title: 'Stock bajo',
        message: 'Leche se agota en 2 días',
      },
    ],
  });

  console.log('✅ Created alerts');

  // Create nutrition data
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    await prisma.nutritionData.create({
      data: {
        userId: user.id,
        date,
        score: 75 + Math.floor(Math.random() * 10),
        ultraProcessed: 15 + Math.random() * 10,
        fruits: Math.floor(Math.random() * 5) + 1,
        protein: 80 + Math.random() * 20,
        calories: 1800 + Math.random() * 400,
      },
    });
  }

  console.log('✅ Created nutrition data');

  // Create shortcut templates
  await prisma.shortcutTemplate.createMany({
    data: [
      {
        name: 'Asado',
        slug: 'asado',
        items: JSON.stringify([
          { name: 'Carne de vacuno 2kg', quantity: 1 },
          { name: 'Chorizo 1kg', quantity: 1 },
          { name: 'Pan para choripán', quantity: 2 },
          { name: 'Carbón 5kg', quantity: 1 },
          { name: 'Ensalada mixta', quantity: 1 },
        ]),
      },
      {
        name: 'Cumpleaños',
        slug: 'cumple',
        items: JSON.stringify([
          { name: 'Torta de chocolate', quantity: 1 },
          { name: 'Velas', quantity: 1 },
          { name: 'Bebidas 2L', quantity: 3 },
          { name: 'Papas fritas', quantity: 2 },
          { name: 'Platos desechables', quantity: 1 },
        ]),
      },
      {
        name: 'Desayunos',
        slug: 'desayunos',
        items: JSON.stringify([
          { name: 'Pan de molde', quantity: 2 },
          { name: 'Mermelada', quantity: 1 },
          { name: 'Mantequilla', quantity: 1 },
          { name: 'Café 500g', quantity: 1 },
          { name: 'Leche 1L', quantity: 4 },
        ]),
      },
      {
        name: 'Colación',
        slug: 'colacion',
        items: JSON.stringify([
          { name: 'Frutas variadas', quantity: 5 },
          { name: 'Yogurt', quantity: 6 },
          { name: 'Frutos secos', quantity: 2 },
          { name: 'Barritas de cereal', quantity: 1 },
        ]),
      },
    ],
  });

  console.log('✅ Created shortcut templates');

  console.log('🎉 Seeding completed successfully!');
  console.log('');
  console.log('Demo credentials:');
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
