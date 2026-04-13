# AVI Shopper - Arquitectura Agéntica Mesh Orquestada

## Visión General

AVI Shopper opera bajo una **arquitectura agéntica tipo Mesh**, donde múltiples agentes especializados colaboran de forma orquestada para ejecutar las operaciones de compras familiares de principio a fin. Un **orquestador central** coordina la comunicación entre agentes, asegurando que cada tarea se delegue al especialista correcto y que los resultados fluyan coherentemente hacia el usuario.

```
                    ┌─────────────────────┐
                    │   USUARIO / FAMILIA  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   AVI ORCHESTRATOR   │
                    │   (Agente Central)   │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
   ┌──────▼──────┐    ┌───────▼───────┐    ┌───────▼───────┐
   │  SHOPPING    │    │   PRICING     │    │   ACCOUNT     │
   │  AGENT       │    │   AGENT       │    │   AGENT       │
   └──────┬──────┘    └───────┬───────┘    └───────┬───────┘
          │                    │                     │
   ┌──────▼──────┐    ┌───────▼───────┐    ┌───────▼───────┐
   │  NUTRITION   │    │   DELIVERY    │    │   BUDGET      │
   │  AGENT       │    │   AGENT       │    │   AGENT       │
   └─────────────┘    └──────────────┘     └──────────────┘
```

---

## Agentes del Mesh

### 1. AVI Orchestrator (Agente Central)

**Rol**: Cerebro del sistema. Recibe las intenciones del usuario, descompone tareas complejas en sub-tareas y las asigna a los agentes especializados.

**Responsabilidades**:
- Interpretar la intención del usuario (NLU)
- Planificar la secuencia de ejecución
- Coordinar la comunicación inter-agentes
- Resolver conflictos entre recomendaciones de agentes
- Consolidar resultados y presentar al usuario

**Decisiones clave**:
- Cuándo ejecutar agentes en paralelo vs. en secuencia
- Priorización cuando hay restricciones de presupuesto vs. preferencias nutricionales
- Fallback cuando un agente falla o una tienda no responde

```
Input:  "Necesito comprar para la semana, somos 4, presupuesto 80.000"
Output: Plan de compras optimizado con split por tiendas
Flow:   Shopping → Pricing → Nutrition → Budget → Delivery
```

---

### 2. Shopping Agent (Agente de Compras)

**Rol**: Gestiona las listas de compras familiares y la selección de productos.

**Capacidades**:
- Crear y mantener listas de compras colaborativas
- Sugerir productos basados en historial y preferencias
- Aplicar templates de compra (Asado, Cumpleaños, Desayunos)
- Detectar productos faltantes basándose en patrones de consumo
- Manejar preferencias por miembro de familia (sin gluten, vegano, etc.)

**Interacciones**:
- → **Pricing Agent**: Solicita precios actualizados para los productos de la lista
- → **Nutrition Agent**: Solicita evaluación nutricional de los productos seleccionados
- ← **Orchestrator**: Recibe la intención de compra del usuario

---

### 3. Pricing Agent (Agente de Precios)

**Rol**: Motor de comparación de precios entre supermercados.

**Capacidades**:
- Comparar precios del mismo producto entre Jumbo, Líder, Santa Isabel y Unimarc
- Detectar ofertas y promociones vigentes
- Calcular el split óptimo del carrito por tienda
- Sugerir sustituciones más económicas de calidad similar
- Proyectar ahorro total vs. compra en una sola tienda

**Interacciones**:
- → **Account Agent**: Verifica que el usuario tiene cuenta activa en las tiendas recomendadas
- → **Budget Agent**: Reporta el costo total para validación de presupuesto
- ← **Shopping Agent**: Recibe lista de productos para cotizar

---

### 4. Account Agent (Agente de Cuentas)

**Rol**: Gestiona las cuentas del usuario en cada supermercado.

**Capacidades**:
- Vincular cuentas existentes del usuario en supermercados
- **Auto-crear cuentas** cuando el usuario no tiene una, usando sus datos de perfil AVI
- Verificar estado de cuentas (activa, pendiente, suspendida)
- Gestionar tarjetas de fidelidad y puntos acumulados
- Mantener credenciales seguras y encriptadas

**Interacciones**:
- → **Delivery Agent**: Proporciona credenciales para ejecutar pedidos
- ← **Pricing Agent**: Recibe consulta de disponibilidad de cuenta por tienda
- ← **Orchestrator**: Recibe instrucciones de vinculación/creación de cuentas

**Flujo de auto-creación**:
```
1. Pricing Agent recomienda comprar en Unimarc
2. Account Agent detecta: usuario NO tiene cuenta en Unimarc
3. Account Agent → Orchestrator: "Necesito crear cuenta"
4. Orchestrator → Usuario: "¿Creo tu cuenta en Unimarc con tus datos?"
5. Usuario confirma → Account Agent crea la cuenta
6. Account Agent → Delivery Agent: "Cuenta lista, proceder con pedido"
```

---

### 5. Nutrition Agent (Agente de Nutrición)

**Rol**: Evalúa y optimiza la calidad nutricional de las compras.

**Capacidades**:
- Calcular score nutricional del carrito (0-100)
- Detectar porcentaje de ultra-procesados
- Sugerir sustituciones más saludables
- Respetar restricciones dietéticas por miembro de familia
- Tracking de tendencias nutricionales semanales/mensuales

**Interacciones**:
- → **Shopping Agent**: Sugiere sustituciones nutricionales
- ← **Shopping Agent**: Recibe lista de productos para evaluar
- → **Orchestrator**: Reporta alertas nutricionales

---

### 6. Budget Agent (Agente de Presupuesto)

**Rol**: Controla que las compras se mantengan dentro del presupuesto familiar.

**Capacidades**:
- Definir presupuestos semanales y mensuales
- Tracking de gasto en tiempo real vs. presupuesto
- Alertar cuando se acerca al límite
- Sugerir ajustes al carrito si excede el presupuesto
- Reportes de ahorro histórico

**Interacciones**:
- → **Orchestrator**: Emite alertas de presupuesto
- ← **Pricing Agent**: Recibe costo total del carrito optimizado
- → **Shopping Agent**: Solicita reducción de items si hay exceso

---

### 7. Delivery Agent (Agente de Entregas)

**Rol**: Ejecuta los pedidos y gestiona las entregas.

**Capacidades**:
- Ejecutar pedidos en las APIs de cada supermercado
- Coordinar entregas múltiples (split cart = múltiples pedidos)
- Estimar tiempos de entrega (ETA)
- Tracking de estado del pedido en tiempo real
- Notificar al usuario sobre el progreso

**Interacciones**:
- ← **Account Agent**: Recibe credenciales para ejecutar pedidos
- ← **Pricing Agent**: Recibe el split óptimo por tienda
- → **Orchestrator**: Reporta estado de entrega

---

## Patrones de Comunicación

### Mesh Topology

Los agentes se comunican en una topología **mesh parcial orquestada**: cualquier agente puede comunicarse con otro a través del Orchestrator, pero también existen canales directos entre agentes frecuentemente acoplados.

```
Canales directos (hot paths):
  Shopping ←→ Pricing      (cotización de productos)
  Pricing  ←→ Account      (verificación de cuentas)
  Account  ←→ Delivery     (ejecución de pedidos)
  Shopping ←→ Nutrition     (evaluación nutricional)
  Pricing  ←→ Budget       (validación de presupuesto)

Canal orquestado (via Orchestrator):
  Todos los demás flujos
```

### Protocolo de Mensajes

Cada mensaje entre agentes sigue el formato:

```json
{
  "messageId": "uuid",
  "from": "pricing-agent",
  "to": "account-agent",
  "type": "query | response | event | command",
  "intent": "verify_account_status",
  "payload": { ... },
  "priority": "high | normal | low",
  "correlationId": "uuid-de-la-tarea-original",
  "timestamp": "ISO-8601"
}
```

---

## Flujos Principales

### Flujo 1: Compra Semanal Completa

```
1. Usuario → Orchestrator:    "Compras de la semana, presupuesto 80.000"
2. Orchestrator → Shopping:    Generar lista sugerida
3. Shopping → Orchestrator:    Lista con 25 productos
4. Orchestrator → [Pricing, Nutrition]:  (paralelo)
   4a. Pricing:  Cotizar en 4 tiendas + calcular split
   4b. Nutrition: Evaluar score nutricional
5. Pricing → Budget:           Validar total vs. presupuesto
6. Budget → Orchestrator:      ✅ Dentro del presupuesto
7. Pricing → Account:          Verificar cuentas en tiendas del split
8. Account → Orchestrator:     ⚠️ Sin cuenta en Unimarc
9. Orchestrator → Usuario:     "¿Creo tu cuenta en Unimarc?"
10. Usuario → Orchestrator:    "Sí"
11. Orchestrator → Account:    Auto-crear cuenta Unimarc
12. Account → Orchestrator:    ✅ Cuenta creada
13. Orchestrator → Usuario:    Presenta plan optimizado
14. Usuario → Orchestrator:    "Confirmar compra"
15. Orchestrator → Delivery:   Ejecutar pedidos en 2 tiendas
16. Delivery → Orchestrator:   Confirmación + ETAs
17. Orchestrator → Usuario:    "Pedidos confirmados, llegan entre 14:00-16:00"
```

### Flujo 2: Auto-Creación de Cuenta

```
1. Trigger: Pricing Agent recomienda tienda sin cuenta vinculada
2. Account Agent consulta datos del usuario:
   - Email: ana.garcia@email.com
   - Nombre: Ana García
   - Teléfono: +56 9 1234 5678
3. Account Agent crea cuenta via API del supermercado
4. Account Agent almacena credenciales (encriptadas)
5. Account Agent marca cuenta como status: "pending" hasta verificación
6. Account Agent notifica al Orchestrator: cuenta lista
```

### Flujo 3: Alerta de Presupuesto

```
1. Budget Agent detecta: gasto mensual al 85% del presupuesto
2. Budget → Orchestrator: emite alerta level: "warn"
3. Orchestrator → Usuario: "Llevas $68.000 de $80.000 este mes"
4. Usuario: "Ajusta la próxima compra"
5. Orchestrator → Shopping: reducir lista a esenciales
6. Shopping → Pricing: cotizar lista reducida
7. Pricing → Budget: ✅ $11.500 - dentro del margen
```

---

## Resiliencia y Fallbacks

| Escenario | Fallback |
|-----------|----------|
| Tienda no responde | Pricing Agent excluye tienda y recalcula split |
| Cuenta rechazada | Account Agent notifica, Orchestrator sugiere alternativa |
| Presupuesto excedido | Budget Agent solicita a Shopping Agent priorizar items |
| Producto sin stock | Shopping Agent busca sustitución, Pricing recotiza |
| Error en pedido | Delivery Agent reintenta 3x, luego escala a Orchestrator |
| Agente no responde | Orchestrator aplica timeout (30s) y ejecuta sin ese agente |

---

## Stack Tecnológico del Mesh

| Componente | Tecnología |
|------------|-----------|
| Orchestrator | Next.js API Routes + Estado en memoria |
| Comunicación inter-agentes | Mensajería async interna (event-driven) |
| Estado compartido | Prisma + SQLite (migrable a PostgreSQL) |
| Cuentas de tiendas | StoreAccount model con encriptación |
| Autenticación | NextAuth.js |
| Frontend | React + Tailwind CSS |
| IA / NLU | Claude API (Anthropic) para interpretación de intenciones |

---

## Roadmap del Mesh

### Fase 1 - MVP (Actual)
- [x] Shopping Agent (listas colaborativas)
- [x] Pricing Agent (comparación básica)
- [x] Nutrition Agent (score nutricional)
- [x] Budget Agent (alertas de presupuesto)
- [x] Account Agent (vincular/crear cuentas de supermercados)
- [ ] Delivery Agent (ejecución de pedidos)
- [ ] Orchestrator central

### Fase 2 - Orquestación
- [ ] Protocolo de mensajería inter-agentes
- [ ] Ejecución paralela de agentes
- [ ] Manejo de conflictos entre agentes
- [ ] Logs y trazabilidad de decisiones

### Fase 3 - Inteligencia
- [ ] Integración con Claude API para NLU
- [ ] Aprendizaje de preferencias familiares
- [ ] Predicción de listas de compras
- [ ] Optimización multi-objetivo (precio + nutrición + preferencias)

### Fase 4 - Escala
- [ ] Migración a PostgreSQL
- [ ] WebSockets para comunicación en tiempo real
- [ ] Integración real con APIs de supermercados (Jumbo, Líder, etc.)
- [ ] App móvil nativa
