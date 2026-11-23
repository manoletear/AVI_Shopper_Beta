# AVI Shopper — Multi-usuario MCP

Cada integrante de la familia puede conectar su propio Grok Bot a AVI.
Se coordinan a través de AVI, no entre bots.

## Roles

| Rol | Puede hacer |
|-----|------------|
| **approver** | Todo: aprobar carros, invitar, revocar tokens, conectar tiendas, importar historial |
| **member** | Proponer carros, comparar precios, ver despensa y actividad |
| **viewer** | Solo lectura: ver despensa, historial, productos fijos |

## Flujo para sumar un integrante

### 1. Manuel (approver) invita a Claudia

En su Grok Bot:
> "Invita a Claudia como aprobadora"

Grok llama `invite_member(memberId: "fm-manu-002", role: "approver")`.
Devuelve un **código de acceso** válido por 72 horas.

### 2. Manuel le pasa el código a Claudia

Por WhatsApp, mail, o en persona:
> "Conecta AVI en tu Grok: usa el código ABC123..."

### 3. Claudia canjea el código

Opción A — Su Grok Bot llama al endpoint público:
```
POST https://avi-shopper-beta.vercel.app/api/mcp/redeem
Content-Type: application/json

{ "code": "ABC123..." }
```

Opción B — curl:
```bash
curl -X POST https://avi-shopper-beta.vercel.app/api/mcp/redeem \
  -H "Content-Type: application/json" \
  -d '{"code": "ABC123..."}'
```

Respuesta:
```json
{
  "success": true,
  "token": "Bearer eyJ...",
  "familyId": "fam-manu-001",
  "memberName": "Claudia",
  "role": "approver",
  "mcpUrl": "https://avi-shopper-beta.vercel.app/api/mcp"
}
```

### 4. Claudia configura el conector MCP

En su Grok Bot agrega un conector MCP con:
- **URL**: `https://avi-shopper-beta.vercel.app/api/mcp`
- **Token**: el Bearer que recibió en el paso 3

### 5. Claudia ya opera independiente

Puede ver la despensa, proponer carros, aprobar compras.
Cada acción queda atribuida a ella en el log de actividad.

## Seguridad

- Los tokens son sha256, nunca se almacenan en texto plano.
- El código de invitación es de un solo uso (índice UNIQUE + transacción atómica).
- El endpoint `/api/mcp/redeem` tiene rate limit: 5 intentos por IP cada 15 minutos.
- Los códigos vencen en 72 horas.
- Un approver puede revocar tokens con `revoke_member_token`.

## Herramientas por rol

### Approver (19 tools)
get_household, get_locked_products, get_pantry, get_store_connection_status,
get_purchase_history, whoami, get_activity, check_allergens, propose_cart,
get_delivery_windows, compare_prices, approve_item, approve_cart, fill_cart,
connect_store, import_purchases, invite_member, list_member_tokens, revoke_member_token

### Member (11 tools)
get_household, get_locked_products, get_pantry, get_store_connection_status,
get_purchase_history, whoami, get_activity, check_allergens, propose_cart,
get_delivery_windows, compare_prices

### Viewer (6 tools)
get_household, get_locked_products, get_pantry, get_store_connection_status,
get_purchase_history, whoami

## Endpoint público

`POST /api/mcp/redeem` — no requiere Bearer token. Canjea un código de invitación
y devuelve el token personal del integrante.
