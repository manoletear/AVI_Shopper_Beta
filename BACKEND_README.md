# AVI Shopper Backend

Backend completo para AVI Shopper construido con:
- **Next.js 14** (API Routes)
- **Prisma ORM** (SQLite para desarrollo)
- **NextAuth** (Autenticación)
- **TypeScript** (Type safety)
- **Zod** (Validación)

## 🚀 Setup Rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar base de datos

```bash
# Generar cliente Prisma
npm run db:generate

# Crear base de datos
npm run db:migrate

# Poblar con datos de demo
npm run db:seed
```

### 3. Iniciar servidor

```bash
npm run dev
```

Abre http://localhost:3000

## 🔑 Credenciales de Demo

```
Email: demo@avishopper.cl
Password: demo123456
```

## 📁 Estructura del Backend

```
src/
├── app/api/              # API Routes
│   ├── auth/            # NextAuth
│   ├── users/           # Gestión de usuarios
│   ├── shopping-lists/  # Listas de compras
│   ├── products/        # Catálogo de productos
│   ├── stores/          # Tiendas y comparación
│   ├── budgets/         # Presupuestos
│   ├── orders/          # Órdenes
│   ├── nutrition/       # Análisis nutricional
│   ├── alerts/          # Notificaciones
│   └── analytics/       # Estadísticas
├── lib/                 # Utilidades
│   ├── prisma.ts       # Cliente Prisma
│   ├── auth.ts         # Autenticación
│   ├── validations.ts  # Schemas Zod
│   └── responses.ts    # Helpers HTTP
├── services/            # Lógica de negocio
│   ├── cart.service.ts
│   ├── nutrition.service.ts
│   └── analytics.service.ts
└── types/              # TypeScript types
```

## 🗄️ Modelo de Datos

### Principales modelos

- **User**: Usuarios de la aplicación
- **ShoppingList**: Listas de compras
- **ShoppingItem**: Ítems en listas
- **Product**: Catálogo de productos
- **Store**: Tiendas (Lider, Jumbo, Unimarc)
- **ProductPrice**: Precios por tienda
- **Order**: Órdenes de compra
- **Budget**: Presupuestos semanales/mensuales
- **Alert**: Notificaciones
- **NutritionData**: Datos nutricionales

Ver esquema completo en `prisma/schema.prisma`

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo

# Base de datos
npm run db:generate      # Generar cliente Prisma
npm run db:migrate       # Crear/actualizar schema
npm run db:seed          # Poblar con datos demo
npm run db:studio        # Abrir Prisma Studio (GUI)
npm run db:reset         # Resetear base de datos

# Producción
npm run build            # Build para producción
npm run start            # Iniciar servidor producción
```

## 🎯 Funcionalidades Implementadas

### ✅ Autenticación
- Registro de usuarios
- Login con email/password
- Sesiones JWT con NextAuth
- Protección de rutas

### ✅ Gestión de Listas
- CRUD completo de listas de compras
- Agregar/editar/eliminar ítems
- Marcar ítems como urgentes o completados
- Asociar productos del catálogo

### ✅ Comparación de Precios
- Buscar productos en múltiples tiendas
- Comparar precios automáticamente
- Calcular mejor opción por tienda

### ✅ División Inteligente de Carrito
- Algoritmo greedy para optimizar precio
- División en múltiples tiendas
- Cálculo de ahorro vs compra consolidada
- Considera costos de delivery

### ✅ Análisis Nutricional
- Score nutricional (0-100)
- % de productos ultraprocesados
- Seguimiento de frutas, proteínas, calorías
- Tendencias en el tiempo

### ✅ Presupuestos
- Presupuestos semanales/mensuales
- Tracking de gastos
- Alertas cuando se acerca al límite

### ✅ Analytics
- Métricas de uso (WAU/MAU, retención)
- Ahorros totales
- Gasto por categoría
- Tendencias de compra

### ✅ Alertas
- Alertas de presupuesto
- Sugerencias de ahorro
- Avisos de stock bajo
- Notificaciones nutricionales

## 🧪 Testing con Prisma Studio

Ejecuta `npm run db:studio` para abrir una GUI donde puedes:
- Ver todos los datos
- Editar registros
- Crear nuevos datos
- Explorar relaciones

## 🔐 Seguridad

- ✅ Passwords hasheados (bcrypt)
- ✅ JWT tokens
- ✅ Validación de ownership
- ✅ Input validation (Zod)
- ✅ SQL injection prevention (Prisma)
- ✅ CORS configurado
- ✅ Error handling centralizado

## 📊 Algoritmos Clave

### División de Carrito (Greedy Algorithm)

```typescript
// Para cada producto:
//   - Encontrar la tienda con menor precio
//   - Asignar producto a esa tienda
// Resultado: carrito dividido optimizado
```

### Score Nutricional

```typescript
// Base: 100 puntos
// - Penalización por ultraprocesados: -40 max
// + Bonus por frutas: +20 max
// + Bonus por proteína adecuada: +10 max
// - Penalización por exceso calorías: -10 max
```

## 🔄 Flujo de Datos

```
Cliente → API Route → Validación (Zod) → Service → Prisma → DB
                         ↓
                    NextAuth (si requiere auth)
```

## 🌐 Variables de Entorno

Crea un archivo `.env`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="cambiar-en-produccion"
NODE_ENV="development"
```

## 📖 Documentación Completa

Ver `API_DOCUMENTATION.md` para:
- Todos los endpoints
- Request/Response examples
- Códigos de error
- Ejemplos de uso

## 🚧 Próximas Mejoras

- [ ] Integración con APIs reales de supermercados
- [ ] Sistema de caché (Redis)
- [ ] Rate limiting
- [ ] Webhooks
- [ ] Sistema de recomendaciones ML
- [ ] Soporte multi-hogar
- [ ] Integración de pagos

## 💡 Tips de Desarrollo

1. **Cambios en el schema**: Después de modificar `schema.prisma`:
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

2. **Resetear datos**: Si necesitas empezar de cero:
   ```bash
   npm run db:reset
   ```

3. **Ver queries SQL**: Chequea los logs en desarrollo

4. **Testing de endpoints**: Usa Prisma Studio o Postman

## 🐛 Troubleshooting

### Error: "Prisma Client not generated"
```bash
npm run db:generate
```

### Error: "Database not found"
```bash
npm run db:migrate
```

### Error: "No demo data"
```bash
npm run db:seed
```

## 📝 Convenciones de Código

- **API Routes**: REST convencional (GET, POST, PATCH, DELETE)
- **Naming**: camelCase para variables, PascalCase para tipos
- **Responses**: Siempre formato `{ success, data, error }`
- **Errors**: Clases custom extendiendo `AppError`
- **Validación**: Schemas Zod para todos los inputs

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una branch (`git checkout -b feature/amazing`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Abre un Pull Request

---

**Built with ❤️ for AVI Shopper**
