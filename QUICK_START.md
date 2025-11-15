# 🚀 AVI Shopper - Quick Start

## Setup en 3 pasos

### 1️⃣ Instalar dependencias
```bash
npm install
```

### 2️⃣ Configurar base de datos
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 3️⃣ Iniciar aplicación
```bash
npm run dev
```

Abre http://localhost:3000

## 🔑 Login Demo

```
Email: demo@avishopper.cl
Password: demo123456
```

## 📚 Documentación

- **Backend completo**: Ver `BACKEND_README.md`
- **API Endpoints**: Ver `API_DOCUMENTATION.md`
- **Wireframe Demo**: http://localhost:3000/demo

## 🎯 Lo que acabas de crear

### Backend completo con:
- ✅ 40+ API endpoints
- ✅ Autenticación (NextAuth + JWT)
- ✅ Base de datos (Prisma + SQLite)
- ✅ Listas de compras CRUD
- ✅ Comparación de precios entre tiendas
- ✅ División inteligente de carritos
- ✅ Análisis nutricional
- ✅ Sistema de presupuestos
- ✅ Analytics y estadísticas
- ✅ Sistema de alertas
- ✅ Datos demo pre-cargados

### Estructura:
```
/src/app/api/          → 40+ API routes
/src/services/         → Lógica de negocio
/src/lib/              → Utilidades
/prisma/               → Schema + seeders
```

## 🧪 Explorar los datos

Abre Prisma Studio (GUI de base de datos):
```bash
npm run db:studio
```

## 📡 Probar la API

### Ejemplos con curl:

**Registro:**
```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"12345678","name":"Test User"}'
```

**Login (NextAuth):**
Usa el frontend o:
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@avishopper.cl","password":"demo123456"}'
```

**Obtener listas:**
```bash
curl http://localhost:3000/api/shopping-lists \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

## 🔧 Comandos útiles

```bash
# Ver todos los datos en GUI
npm run db:studio

# Resetear y repoblar DB
npm run db:reset

# Solo repoblar datos
npm run db:seed

# Ver estructura de DB
cat prisma/schema.prisma
```

## 🎨 Frontend

El wireframe interactivo está en `/demo`:
- http://localhost:3000/demo

Para conectarlo al backend, reemplaza los datos mock con llamadas a la API.

## 📖 Próximos pasos

1. **Explorar la API**: Lee `API_DOCUMENTATION.md`
2. **Ver los datos**: Ejecuta `npm run db:studio`
3. **Conectar el frontend**: Usa las API routes en tu componente React
4. **Personalizar**: Modifica el schema en `prisma/schema.prisma`

## 🆘 Problemas comunes

**Error: Prisma Client not found**
```bash
npm run db:generate
```

**Error: Database not found**
```bash
npm run db:migrate
```

**Quiero empezar de cero**
```bash
npm run db:reset
```

## 💡 Tips

- Usa Prisma Studio para ver/editar datos visualmente
- Todas las API routes están en `/src/app/api`
- Los servicios de negocio están en `/src/services`
- Credenciales demo: `demo@avishopper.cl` / `demo123456`

---

**¿Dudas?** Lee la documentación completa en `API_DOCUMENTATION.md` y `BACKEND_README.md`
