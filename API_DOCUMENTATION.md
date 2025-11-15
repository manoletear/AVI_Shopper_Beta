# AVI SHOPPER - API Documentation

Backend completo para la aplicación AVI Shopper, construido con Next.js API Routes, Prisma ORM, y NextAuth.

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+
- npm o yarn

### Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
```

Editar `.env` con tus valores:
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-secreto-aqui"
```

3. Generar el cliente de Prisma:
```bash
npm run db:generate
```

4. Crear la base de datos:
```bash
npm run db:migrate
```

5. Poblar con datos de demo:
```bash
npm run db:seed
```

6. Iniciar el servidor:
```bash
npm run dev
```

La API estará disponible en `http://localhost:3000/api`

## 📚 Estructura del Proyecto

```
src/
├── app/
│   └── api/                 # API Routes
│       ├── auth/            # Autenticación (NextAuth)
│       ├── register/        # Registro de usuarios
│       ├── users/           # Gestión de usuarios
│       ├── shopping-lists/  # Listas de compras
│       ├── products/        # Productos
│       ├── stores/          # Tiendas y comparación
│       ├── budgets/         # Presupuestos
│       ├── orders/          # Órdenes de compra
│       ├── nutrition/       # Análisis nutricional
│       ├── alerts/          # Alertas
│       └── analytics/       # Analytics y estadísticas
├── lib/                     # Utilidades
│   ├── prisma.ts           # Cliente Prisma
│   ├── auth.ts             # Helpers de autenticación
│   ├── errors.ts           # Clases de error
│   ├── responses.ts        # Helpers de respuesta
│   ├── validations.ts      # Schemas de validación (Zod)
│   └── session.ts          # Gestión de sesión
├── services/                # Lógica de negocio
│   ├── cart.service.ts     # Comparación y división de carritos
│   ├── nutrition.service.ts # Cálculo nutricional
│   └── analytics.service.ts # Analytics
└── types/                   # TypeScript types
    └── index.ts
```

## 🔐 Autenticación

La API usa **NextAuth** con estrategia de credenciales (email/password) y JWT.

### Registro

**POST** `/api/register`

```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "name": "Nombre Usuario"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Login

**POST** `/api/auth/signin`

Usa el cliente NextAuth en el frontend:
```typescript
import { signIn } from 'next-auth/react';

await signIn('credentials', {
  email: 'demo@avishopper.cl',
  password: 'demo123456'
});
```

### Credenciales de Demo
- Email: `demo@avishopper.cl`
- Password: `demo123456`

## 👤 Usuarios

Todas las rutas requieren autenticación.

### Obtener perfil actual

**GET** `/api/users/me`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "image": null,
    "consents": { "precios": true, "consumo": true, "salud": false },
    "preferences": { "dietType": "balanced", "allergies": [], "favorites": [] }
  }
}
```

### Actualizar perfil

**PATCH** `/api/users/me`

```json
{
  "name": "Nuevo Nombre",
  "image": "https://ejemplo.com/avatar.jpg"
}
```

### Consentimientos

**GET** `/api/users/consents`

**PATCH** `/api/users/consents`

```json
{
  "precios": true,
  "consumo": true,
  "salud": true
}
```

### Preferencias

**GET** `/api/users/preferences`

**PATCH** `/api/users/preferences`

```json
{
  "dietType": "vegetarian",
  "allergies": ["gluten", "lactose"],
  "favorites": ["product-id-1", "product-id-2"]
}
```

## 🛒 Listas de Compras

### Listar todas las listas

**GET** `/api/shopping-lists`

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "list-id",
      "name": "Compras de la semana",
      "items": [...],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Crear lista

**POST** `/api/shopping-lists`

```json
{
  "name": "Lista nueva"
}
```

### Obtener lista específica

**GET** `/api/shopping-lists/{id}`

### Actualizar lista

**PATCH** `/api/shopping-lists/{id}`

```json
{
  "name": "Nombre actualizado"
}
```

### Eliminar lista

**DELETE** `/api/shopping-lists/{id}`

### Agregar ítem a lista

**POST** `/api/shopping-lists/{id}/items`

```json
{
  "name": "Leche descremada",
  "quantity": 2,
  "urgent": true,
  "productId": "product-id" // opcional
}
```

### Actualizar ítem

**PATCH** `/api/shopping-lists/{listId}/items/{itemId}`

```json
{
  "name": "Leche semidescremada",
  "quantity": 3,
  "urgent": false,
  "checked": true
}
```

### Eliminar ítem

**DELETE** `/api/shopping-lists/{listId}/items/{itemId}`

## 📦 Productos

### Buscar productos

**GET** `/api/products?search=leche&category=lacteos&page=1&limit=20`

**Query Parameters:**
- `search`: Término de búsqueda
- `category`: Filtrar por categoría
- `page`: Número de página (default: 1)
- `limit`: Ítems por página (default: 20)

**Respuesta:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### Crear producto

**POST** `/api/products`

```json
{
  "name": "Leche Colun 1L",
  "category": "Lácteos",
  "brand": "Colun",
  "barcode": "7801234567890",
  "calories": 350,
  "protein": 33,
  "carbs": 48,
  "fat": 1.5,
  "isUltraProcessed": false,
  "nutritionScore": 85
}
```

## 🏪 Tiendas y Comparación

### Listar tiendas

**GET** `/api/stores`

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "store-id",
      "name": "Lider",
      "slug": "lider",
      "deliveryFee": 179000,
      "minOrder": 1000000
    }
  ]
}
```

### Comparar precios y dividir carrito

**POST** `/api/stores/compare`

```json
{
  "mode": "split", // "compare" o "split"
  "items": [
    {
      "productId": "prod-1",
      "name": "Leche 1L",
      "quantity": 6
    },
    {
      "productId": "prod-2",
      "name": "Pan integral",
      "quantity": 4
    }
  ]
}
```

**Respuesta (mode: split):**
```json
{
  "success": true,
  "data": {
    "bags": [
      {
        "storeId": "jumbo",
        "storeName": "Jumbo",
        "items": [...],
        "subtotal": 2148000,
        "deliveryFee": 199000,
        "total": 2347000
      }
    ],
    "totalSavings": 252000,
    "savingsPercentage": 12.4,
    "consolidatedOption": {
      "storeId": "lider",
      "storeName": "Lider",
      "total": 2599000
    }
  }
}
```

## 💰 Presupuestos

### Obtener presupuestos

**GET** `/api/budgets?current=true`

**Query Parameters:**
- `current`: Si es `true`, devuelve solo el presupuesto activo

### Crear presupuesto

**POST** `/api/budgets`

```json
{
  "period": "weekly",
  "amount": 4500000,
  "startDate": "2024-01-15T00:00:00.000Z",
  "endDate": "2024-01-21T23:59:59.000Z"
}
```

## 📋 Órdenes

### Listar órdenes

**GET** `/api/orders?status=delivered&page=1&limit=20`

**Query Parameters:**
- `status`: Filtrar por estado (pending, confirmed, in_delivery, delivered, cancelled)
- `page`: Número de página
- `limit`: Ítems por página

### Crear orden

**POST** `/api/orders`

```json
{
  "storeId": "store-id",
  "items": [
    {
      "productId": "prod-1",
      "name": "Leche 1L",
      "quantity": 2,
      "price": 119000
    }
  ],
  "subtotal": 238000,
  "delivery": 179000,
  "total": 417000,
  "eta": "2024-01-15T18:00:00.000Z"
}
```

## 🥗 Nutrición

### Obtener resumen nutricional

**GET** `/api/nutrition?period=week`

**Query Parameters:**
- `period`: `week` o `month`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "score": 78,
    "ultraProcessedPercentage": 18.5,
    "fruitServings": 9,
    "proteinGrams": 83.2,
    "totalCalories": 12450,
    "trend": {
      "scoreDiff": 6,
      "ultraProcessedDiff": -2.3
    }
  }
}
```

## 🔔 Alertas

### Listar alertas

**GET** `/api/alerts?unread=true`

**Query Parameters:**
- `unread`: Si es `true`, devuelve solo alertas no leídas

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-id",
      "type": "savings",
      "level": "good",
      "title": "Ahorro disponible",
      "message": "Dividir carrito ahorra 12,4%",
      "read": false,
      "dismissed": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Crear alerta

**POST** `/api/alerts`

```json
{
  "type": "budget",
  "level": "warn",
  "title": "Presupuesto",
  "message": "Restan $12.500 esta semana"
}
```

### Actualizar alerta

**PATCH** `/api/alerts/{id}`

```json
{
  "read": true,
  "dismissed": false
}
```

### Eliminar alerta

**DELETE** `/api/alerts/{id}`

## 📊 Analytics

### Obtener analytics del usuario

**GET** `/api/analytics?days=30&type=summary`

**Query Parameters:**
- `days`: Número de días a analizar (default: 30)
- `type`: `summary` o `trends`

**Respuesta (type: summary):**
```json
{
  "success": true,
  "data": {
    "wauMau": 42,
    "retentionD30": 63,
    "ordersWithSplit": 54,
    "otif": 92,
    "totalSavings": 1845000,
    "averageOrderValue": 3250000,
    "topCategories": [
      {
        "category": "Lácteos",
        "spent": 850000,
        "percentage": 26.2
      }
    ]
  }
}
```

**Respuesta (type: trends):**
```json
{
  "success": true,
  "data": {
    "trends": [
      { "date": "2024-01-15", "amount": 3250000 },
      { "date": "2024-01-16", "amount": 1890000 }
    ]
  }
}
```

## 🛠 Utilidades

### Gestión de Base de Datos

```bash
# Generar cliente Prisma
npm run db:generate

# Crear migración
npm run db:migrate

# Poblar con datos de demo
npm run db:seed

# Abrir Prisma Studio (GUI)
npm run db:studio

# Resetear base de datos
npm run db:reset
```

## 🧪 Testing

Para probar la API, puedes usar:

1. **Postman/Insomnia**: Importa las rutas desde esta documentación
2. **Prisma Studio**: Visualiza y edita datos directamente
   ```bash
   npm run db:studio
   ```

## 🔧 Tipos de Error

Todas las respuestas de error siguen este formato:

```json
{
  "success": false,
  "error": {
    "message": "Mensaje de error descriptivo",
    "code": "ERROR_CODE"
  }
}
```

**Códigos de estado HTTP:**
- `200`: OK
- `201`: Created
- `204`: No Content
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

## 📝 Notas de Implementación

### Servicios

#### Cart Service (`src/services/cart.service.ts`)
- **compareStorePrices**: Compara precios de un carrito en todas las tiendas
- **splitCart**: Algoritmo greedy para dividir carrito optimizando precio

#### Nutrition Service (`src/services/nutrition.service.ts`)
- **calculateNutritionScore**: Calcula score nutricional (0-100)
- **analyzeShoppingListNutrition**: Analiza nutrición de una lista
- **getUserNutritionSummary**: Resumen nutricional del usuario

#### Analytics Service (`src/services/analytics.service.ts`)
- **getUserAnalytics**: Métricas completas del usuario
- **getSpendingTrends**: Tendencias de gasto en el tiempo

### Validaciones

Todas las validaciones usan **Zod**. Los schemas están en `src/lib/validations.ts`.

### Seguridad

- Passwords hasheados con **bcrypt**
- JWT para sesiones
- Verificación de ownership en todas las operaciones
- Validación de inputs con Zod
- SQL injection prevention (Prisma ORM)

## 🚀 Próximos Pasos

1. Integrar con APIs reales de supermercados
2. Implementar sistema de caché (Redis)
3. Agregar rate limiting
4. Implementar webhooks para notificaciones
5. Sistema de recomendaciones ML
6. Soporte para múltiples hogares/usuarios
7. Integración con pagos

## 📄 Licencia

MIT

---

**¿Preguntas?** Abre un issue en el repositorio.
