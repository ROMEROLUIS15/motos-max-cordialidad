# Design Document — Fase 2: Sistema Multiagente

---

## 1. Overview

Fase 2 agrega un microservicio Python (`apps/agents`) con LangGraph que implementa el **AgentAdmin**. Esta fase requiere **primero crear endpoints REST en NestJS con autenticación service-to-service**, ya que el sistema actual no tiene estos componentes.

**Problemas identificados en Fase 1:**

1. No existen endpoints REST para Python: `/api/reports`, `/api/purchase-orders/draft`, `/api/home-services`, `/api/dashboard/summary` (existe pero con formato diferente)
2. No hay autenticación service-to-service: ningún claim/guard distingue a un servicio interno (los roles reales son `SystemRole = {OWNER, ADMIN, RECEPTIONIST, TECHNICIAN, VIEWER}`, sin `INTERNAL`)
3. El RouterAgent actual usa JWT de usuario, no compatible con Python
4. No existe carpeta `apps/agents/` para el microservicio Python
5. Los cron jobs de Python necesitan listar tenants activos, pero no hay endpoint para eso
6. El sistema de notificaciones actual es básico, no permite alertas de stock

**Solución propuesta - Tres fases de implementación:**

1. **Fase 2A**: Crear endpoints REST en NestJS con autenticación service-to-service
2. **Fase 2B**: Implementar microservicio Python (`apps/agents/`) que consume esos endpoints
3. **Fase 2C**: Integrar WhatsApp routing y sistema completo

**Principio central:** El microservicio Python interactúa exclusivamente con NestJS a través de endpoints REST protegidos con JWT de servicio. NestJS mantiene el control total sobre la base de datos.

> **✅ Verificado contra el código de Fase 1 (revisión 2026-06-25).** Los 6 problemas de arriba se confirmaron en el repo. Decisiones canónicas que rigen TODO este documento (y deben replicarse en `tasks.md` y `architecture.md`):
>
> 1. **Auth de servicio:** JWT firmado con el **mismo `JWT_SECRET`** de Fase 1, con claim **`type: "service"`**. Un **`ServiceAuthGuard`** nuevo valida ese claim; **no** se usa un rol falso `INTERNAL`/`AGENT` (el `JWTPayload` real usa `roleId` = UUID de la tabla `Role`, enum `SystemRole = {OWNER, ADMIN, RECEPTIONIST, TECHNICIAN, VIEWER}` — sin `INTERNAL`).
> 2. **Todos** los Python→NestJS van bajo **`/api/agents/*`** (un solo `AgentsController` con `ServiceAuthGuard`). Python **nunca** llama endpoints de usuario (`/api/dashboard/summary`, `/api/stock/low-stock`, `/api/messages/send`, …) porque están tras `JwtAuthGuard + PermissionGuard`.
> 3. **`tenantId` siempre explícito** en cada request (query/body); el token de servicio no lo deriva.
> 4. **WhatsApp proactivo** (reporte listo, alerta de stock) usa un endpoint nuevo `POST /api/agents/notifications/whatsapp { tenantId, content }` que resuelve el teléfono del OWNER. El `/api/messages/send` existente **no sirve** (su contrato es `{ sessionId, content }` y exige sesión activa + JWT de usuario).
> 5. **Checkpoint LangGraph:** `MemorySaver` in-process; la persistencia entre mensajes la da `memory.py` sobre Redis. No se añade `langgraph-checkpoint-redis`.
> 6. **Orden obligatorio:** Fase 2A (endpoints NestJS + ServiceAuthGuard + migraciones) **antes** que Fase 2B (Python). El use-case a tocar está en `application/use-cases/messaging/process-incoming-message.use-case.ts` (no en `workshop/`).

---

## 2. Arquitectura Actualizada

### Diagrama de Alto Nivel

```
WhatsApp Cloud API
        │ webhook
        ▼
NestJS :3001  ──────────────────────────────────────────
  │  ├── Nuevos Endpoints REST (Fase 2A)                │
  │  │   ├── /api/reports                               │
  │  │   ├── /api/agents/tenants (listar tenants)      │
  │  │   ├── /api/agents/notifications (alertas stock) │
  │  │   ├── /api/purchase-orders/draft                │
  │  │   └── /api/home-services                        │
  │  │                                                  │
  │  ├── Autenticación Service-to-Service              │
  │  │   JWT con claim type: "service" (ServiceAuthGuard)│
  │  │                                                  │
  │  │ ¿número == OWNER.whatsappPhone?                 │
  │  │                                                  │
  │  ├── SÍ ──▶ POST http://agents:8000/agents/admin   │
  │  │                    │                             │
  │  │                    ▼                             │
  │  │          FastAPI + LangGraph                    │
  │  │          (apps/agents :8000)                    │
  │  │              │                                   │
  │  │              ├── Tools ──▶ GET/POST http://api:3001
  │  │              ├── Redis  (sesión 2h TTL)         │
  │  │              └── APScheduler (reportes automáticos)
  │  │                                                  │
  │  └── NO ──▶ RouterAgent NestJS (sin cambios Fase 1)─┘

apps/web :3000
  ├── /reports          (nueva página)
  ├── /home-services    (nueva página)
  └── /purchase-orders  (nueva página)
```

### Cambios necesarios en NestJS (Fase 2A)

#### 1. Extender JWT Payload para soportar roles de servicio

```typescript
// application/ports/jwt.port.ts
export interface JWTPayload {
  sub: string; // User ID, o "agents-service" para tokens de servicio
  tenantId: string; // tenant del usuario; en service se ignora (el tenant va explícito por request)
  branchId: string | null;
  roleId: string; // Role ID real (UUID de la tabla Role); "" en tokens de servicio
  type?: 'user' | 'service'; // ausente o "user" = usuario; "service" = microservicio Python
  iat?: number;
  exp?: number;
}
```

#### 2. Nuevo guard para autenticación de servicios

```typescript
// presentation/http/guards/service-auth.guard.ts
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.substring(7);
    try {
      const payload = this.jwtService.verify(token);

      // Validar que sea un token de servicio (claim type === 'service').
      // NO se valida contra la tabla Role ni PermissionGuard: es un principal sintético.
      if (payload.type !== 'service') {
        throw new UnauthorizedException('Invalid service token');
      }

      request.service = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired service token');
    }
  }
}
```

#### 3. Nuevo endpoint para listar tenants activos (necesario para cron jobs)

```typescript
// presentation/http/controllers/agents.controller.ts
@Controller('agents')
@UseGuards(ServiceAuthGuard)
export class AgentsController {
  @Get('tenants')
  async getActiveTenants() {
    return this.tenantService.getActiveTenants();
  }
}
```

#### 4. Modificación en process-incoming-message.use-case.ts

```typescript
// Agregar método en UserRepository (interface)
findOwnerByWhatsappPhone(phone: string, tenantId: string): Promise<User | null>;

// En el use case (~15 líneas nuevas)
const isAdmin = await this.userRepo.findOwnerByWhatsappPhone(
  message.from,
  session.tenantId,
);

if (isAdmin) {
  try {
    await this.agentsHttpClient.post('/agents/admin', {
      message: message.body,
      phoneNumber: message.from,
      tenantId: session.tenantId,
    });
  } catch {
    // Si el microservicio no está disponible, escala al recepcionista
    await this.notificationPort.notifyReceptionist(session.tenantId, message);
  }
  return;
}
// Flujo normal RouterAgent (sin cambios)
```

---

## 3. Estructura del Microservicio Python (Fase 2B)

```
apps/agents/
├── pyproject.toml
├── Dockerfile
├── .env.example
├── src/
│   ├── main.py                    # FastAPI app
│   ├── config.py                  # pydantic-settings (JWT_SECRET reusado, API_BASE_URL)
│   │
│   ├── agents/
│   │   ├── admin/
│   │   │   ├── agent.py           # LangGraph StateGraph
│   │   │   ├── state.py           # AdminAgentState TypedDict
│   │   │   ├── nodes.py           # classify, execute_tool, respond, fallback
│   │   │   └── prompts.py         # System prompts en español colombiano
│   │   └── shared/
│   │       ├── llm_factory.py     # DeepSeek → Groq fallback
│   │       ├── memory.py          # Redis session management TTL 2h
│   │       └── auth.py            # Generar JWT de servicio para NestJS (reusa JWT_SECRET)
│   │
│   ├── tools/
│   │   ├── inventory_tools.py     # get_inventory_status, get_low_stock_analysis
│   │   ├── sales_tools.py         # get_sales_summary, get_technician_performance
│   │   ├── order_tools.py         # prepare_purchase_order
│   │   ├── report_tools.py        # trigger_report_generation
│   │   ├── notification_tools.py  # send_stock_alert (envía notificación vía NestJS)
│   │   └── tenant_tools.py        # get_active_tenants (para cron jobs)
│   │
│   ├── schedulers/
│   │   ├── scheduler.py           # APScheduler setup + timezone Colombia
│   │   ├── weekly_report.py       # lunes 8am - usa tenant_tools para listar tenants
│   │   ├── monthly_report.py      # día 1 del mes 8am
│   │   └── stock_alert.py         # cada hora revisa stock crítico
│   │
│   ├── reports/
│   │   ├── generator.py           # orquestador de reportes
│   │   ├── templates/
│   │   │   ├── weekly.py          # template reporte semanal
│   │   │   └── monthly.py         # template reporte mensual
│   │   └── uploader.py            # sube PDF a R2
│   │
│   ├── api/
│   │   ├── router.py              # FastAPI routers
│   │   ├── admin_handler.py       # POST /agents/admin (recibe desde NestJS)
│   │   └── health.py              # GET /health
│   │
│   └── clients/
│       └── saas_client.py         # httpx async client → NestJS con JWT de servicio
```

**Clave del diseño:** El microservicio Python NO puede ser implementado hasta que los endpoints REST en NestJS (Fase 2A) estén completos y funcionales. El cliente `saas_client.py` debe autenticarse con JWT especial para servicios.

---

## 4. LangGraph — Grafo del AgentAdmin (Fase 2B)

### Estado del agente

```python
# agents/admin/state.py
from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AdminAgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    tenant_id: str
    admin_phone: str
    session_id: str
    tool_call_count: int
    intent: str | None        # SALES_QUERY | INVENTORY_QUERY | REPORT_REQUEST | GENERAL
    final_response: str | None
    last_tool_result: dict | None  # Resultado de la última tool ejecutada
```

### Grafo

```python
# agents/admin/agent.py
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

def build_admin_agent(redis_client) -> CompiledGraph:
    graph = StateGraph(AdminAgentState)

    graph.add_node("classify",      classify_intent_node)
    graph.add_node("execute_tool",  execute_tool_node)
    graph.add_node("respond",       respond_node)
    graph.add_node("fallback",      fallback_node)

    graph.set_entry_point("classify")

    graph.add_conditional_edges("classify", route_after_classify, {
        "tool":    "execute_tool",
        "respond": "respond",
        "fallback":"fallback",
    })
    graph.add_conditional_edges("execute_tool", route_after_tool, {
        "continue": "execute_tool",   # el LLM pide otra tool
        "respond":  "respond",        # tiene suficiente info
        "limit":    "respond",        # llegó al límite de 5 calls
        "fallback": "fallback",       # error en tool execution
    })
    graph.add_edge("respond",  END)
    graph.add_edge("fallback", END)

    # Checkpoint in-process (dentro de una invocación). La persistencia de la
    # sesión entre mensajes la maneja memory.py sobre Redis (ver §6).
    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)
```

### Nodos del grafo

```python
# agents/admin/nodes.py
import logging

logger = logging.getLogger(__name__)

async def classify_intent_node(state: AdminAgentState) -> dict:
    """Clasifica el intent del último mensaje del admin."""
    llm = get_llm()  # DeepSeek o Groq
    last_message = state["messages"][-1].content

    result = await llm.ainvoke(CLASSIFY_PROMPT.format(message=last_message))
    intent = parse_intent(result.content)  # SALES_QUERY | INVENTORY_QUERY | REPORT_REQUEST | GENERAL

    return {"intent": intent, "tool_call_count": 0}


async def execute_tool_node(state: AdminAgentState) -> dict:
    """Ejecuta la tool adecuada según el intent. Stateless — el count está en el estado."""
    if state["tool_call_count"] >= MAX_TOOL_CALLS:
        return {"intent": "limit"}

    tool_result = await run_tool_for_intent(state["intent"], state["tenant_id"])

    return {
        "messages": [ToolMessage(content=str(tool_result), tool_call_id="...")],
        "tool_call_count": state["tool_call_count"] + 1,
    }


async def respond_node(state: AdminAgentState) -> dict:
    """Genera la respuesta final en lenguaje natural."""
    llm = get_llm()
    response = await llm.ainvoke(
        RESPOND_PROMPT.format(
            context=format_tool_results(state["messages"]),
            limit_reached=(state["tool_call_count"] >= MAX_TOOL_CALLS),
        )
    )
    return {"final_response": response.content}


async def fallback_node(state: AdminAgentState) -> dict:
    """Respuesta predefinida cuando el LLM falla."""
    return {"final_response": FALLBACK_MESSAGE}
```

---

## 5. Tools del AgentAdmin (Fase 2B)

**Importante:** Todas estas tools requieren que los endpoints REST correspondientes en NestJS (Fase 2A) estén implementados.

| Tool                         | Endpoint NestJS                              | Autenticación | Descripción                            |
| ---------------------------- | -------------------------------------------- | ------------- | -------------------------------------- |
| `get_sales_summary`          | `GET /api/agents/dashboard/summary`          | Service JWT   | Ingresos, órdenes, ticket promedio     |
| `get_inventory_status`       | `GET /api/agents/inventory/status`           | Service JWT   | Stock actual, críticos, días restantes |
| `get_technician_performance` | `GET /api/agents/technicians/ranking`        | Service JWT   | Ranking de técnicos por período        |
| `get_pending_orders`         | `GET /api/agents/work-orders/pending`        | Service JWT   | Órdenes sin atender                    |
| `prepare_purchase_order`     | `POST /api/agents/purchase-orders/draft`     | Service JWT   | Crea borrador en plataforma            |
| `trigger_report_generation`  | `POST /api/agents/reports/generate`          | Service JWT   | Genera PDF → R2 → notifica             |
| `get_active_tenants`         | `GET /api/agents/tenants`                    | Service JWT   | Lista tenants para cron jobs           |
| `send_stock_alert`           | `POST /api/agents/notifications/stock-alert` | Service JWT   | Notificación in-app de stock bajo      |
| (WhatsApp proactivo)         | `POST /api/agents/notifications/whatsapp`    | Service JWT   | Envía WhatsApp al OWNER del tenant     |
| `get_home_service_requests`  | `GET /api/agents/home-services`              | Service JWT   | Solicitudes de servicio a domicilio    |

### Nuevos endpoints REST en NestJS (Fase 2A)

```typescript
// NestJS Controller: AgentsController
// Un único guard de servicio protege TODO el controller. No hay @RequireRole:
// el principal de servicio no tiene rol de la tabla Role; el tenantId va por request.
@Controller('agents')
@UseGuards(ServiceAuthGuard)
export class AgentsController {
  @Get('tenants') getActiveTenants() {} // cron jobs
  @Get('dashboard/summary') getDashboardSummary(@Query() q) {} // ?tenantId&from&to
  @Get('inventory/status') getInventoryStatus(@Query() q) {} // ?tenantId
  @Get('work-orders/pending') getPendingOrders(@Query() q) {} // ?tenantId
  @Get('home-services') listHomeServices(@Query() q) {}
  @Post('purchase-orders/draft') createPurchaseOrderDraft(@Body() b) {}
  @Post('reports') createReportRecord(@Body() b) {}
  @Post('reports/generate') generateReport(@Body() b) {}
  @Post('notifications/stock-alert') createStockNotification(@Body() b) {} // in-app
  @Post('notifications/whatsapp') sendOwnerWhatsapp(@Body() b) {} // proactivo al OWNER
}
```

### Contrato de cada tool (pydantic)

```python
# tools/inventory_tools.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class GetInventoryStatusInput(BaseModel):
    tenant_id: str
    branch_id: Optional[str] = None
    days_lookback: int = 30  # para calcular rotación

class GetInventoryStatusOutput(BaseModel):
    critical_parts: list[CriticalPartInfo]
    total_parts: int
    total_stock_value: float
    last_updated: datetime

class CriticalPartInfo(BaseModel):
    sku: str
    name: str
    stock_disponible: float
    min_stock_alert: float
    days_remaining: Optional[int] = None  # stock_disponible / promedio_diario
    suggested_order_qty: int  # promedio_diario * 30
    rotation_rate: float  # unidades vendidas por día (últimos 30 días)
```

### Cliente HTTP para NestJS

```python
# clients/saas_client.py
import httpx
from typing import Optional, Dict, Any
from agents.shared.auth import create_service_token

class SaaSClient:
    def __init__(self, base_url: str, jwt_secret: str):
        self.base_url = base_url
        self.jwt_secret = jwt_secret
        self.client = httpx.AsyncClient(timeout=30.0)

    async def _get_auth_headers(self, tenant_id: Optional[str] = None) -> Dict[str, str]:
        """Genera headers con JWT de servicio."""
        token = create_service_token(self.jwt_secret, tenant_id)
        return {"Authorization": f"Bearer {token}"}

    async def get_inventory_status(self, tenant_id: str, branch_id: Optional[str] = None) -> Dict[str, Any]:
        """Llama al endpoint de inventario en NestJS."""
        headers = await self._get_auth_headers(tenant_id)
        params = {"tenantId": tenant_id}
        if branch_id:
            params["branchId"] = branch_id

        response = await self.client.get(
            f"{self.base_url}/api/agents/inventory/status",
            headers=headers,
            params=params
        )
        response.raise_for_status()
        return response.json()

    async def get_active_tenants(self) -> List[Dict[str, Any]]:
        """Obtiene lista de tenants activos (para cron jobs)."""
        headers = await self._get_auth_headers()
        response = await self.client.get(
            f"{self.base_url}/api/agents/tenants",
            headers=headers
        )
        response.raise_for_status()
        return response.json()
```

---

## 6. Memoria de Sesión — Redis

```python
# agents/shared/memory.py
import json
from redis.asyncio import Redis
from langchain_core.messages import BaseMessage, messages_from_dict, messages_to_dict

SESSION_PREFIX = "agent:admin"
TTL_SECONDS = 7200  # 2 horas

async def get_session(redis: Redis, phone: str, tenant_id: str) -> list[BaseMessage]:
    key = f"{SESSION_PREFIX}:{tenant_id}:{phone}"
    data = await redis.get(key)
    if not data:
        return []
    return messages_from_dict(json.loads(data))

async def save_session(
    redis: Redis, phone: str, tenant_id: str, messages: list[BaseMessage]
) -> None:
    key = f"{SESSION_PREFIX}:{tenant_id}:{phone}"
    await redis.setex(key, TTL_SECONDS, json.dumps(messages_to_dict(messages)))

async def clear_session(redis: Redis, phone: str, tenant_id: str) -> None:
    key = f"{SESSION_PREFIX}:{tenant_id}:{phone}"
    await redis.delete(key)
```

**Checkpoint LangGraph:** el grafo usa **`MemorySaver`** (in-process). La **persistencia entre mensajes** la da `memory.py` sobre Redis: carga el historial al entrar y lo guarda al salir, con `thread_id = f"{tenant_id}:{phone}"`. Así se evita la dependencia extra `langgraph-checkpoint-redis` y queda una sola fuente de sesión en Redis (prefijo `agent:admin:*`).

---

## 7. LLM Factory — DeepSeek → Groq Fallback

```python
# agents/shared/llm_factory.py
from langchain_openai import ChatOpenAI
from functools import lru_cache

@lru_cache(maxsize=1)
def get_deepseek_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        api_key=settings.DEEPSEEK_API_KEY,
        timeout=10,
        max_retries=1,
    )

@lru_cache(maxsize=1)
def get_groq_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model="openai/gpt-oss-120b",
        base_url="https://api.groq.com/openai/v1",
        api_key=settings.GROQ_API_KEY,
        timeout=10,
        max_retries=1,
    )

async def get_llm_with_fallback() -> ChatOpenAI:
    """Intenta DeepSeek, cae a Groq si falla el primer intento."""
    try:
        llm = get_deepseek_llm()
        await llm.ainvoke("ping")  # test rápido
        return llm
    except Exception:
        logger.warning("DeepSeek no disponible, usando Groq")
        return get_groq_llm()
```

**Nota:** Ambos usan `langchain_openai.ChatOpenAI` porque DeepSeek y Groq son OpenAI-compatible. No se necesitan adapters adicionales.

---

## 8. Reportes — Generación y Entrega

### Flujo completo

```
APScheduler dispara job (lunes 8am o día 1 del mes)
        │
        ▼
report_generator.generate(tenant_id, type, period_start, period_end)
        │
        ├── saas_client.get("/api/agents/dashboard/summary?tenantId=...&from=...&to=...")
        ├── saas_client.get("/api/agents/inventory/status?tenantId=...")
        ├── saas_client.get("/api/agents/work-orders/pending?tenantId=...")
        │
        ▼
pandas: calcular métricas (tendencias, márgenes, rotación)
        │
        ▼
reportlab: generar PDF con template
        │
        ▼
boto3: subir PDF a R2 → /{tenant_id}/reports/{type}/{year}/{filename}.pdf
        │
        ▼
saas_client.post("/api/agents/reports", { tenantId, type, pdfR2Key, periodStart, periodEnd })
        │
        ▼
saas_client.post("/api/agents/notifications/whatsapp", { tenantId, content: "📊 Tu reporte... → [link]" })
```

### Template semanal (estructura del PDF)

```
┌─────────────────────────────────────────────┐
│  [Logo taller]    REPORTE SEMANAL           │
│  Semana del 16 al 22 de junio de 2025       │
├─────────────────────────────────────────────┤
│  RESUMEN EJECUTIVO                          │
│  Ingresos cobrados: $X.XXX.XXX              │
│  Órdenes completadas: XX                    │
│  Órdenes canceladas: X                      │
│  Ticket promedio: $XXX.XXX                  │
├─────────────────────────────────────────────┤
│  TÉCNICOS                                   │
│  1. [Nombre] — XX órdenes                  │
│  2. [Nombre] — XX órdenes                  │
├─────────────────────────────────────────────┤
│  REPUESTOS MÁS USADOS                       │
│  1. Aceite 20W50 — XX unidades              │
│  2. Pastillas de freno — XX unidades        │
├─────────────────────────────────────────────┤
│  ⚠️ STOCK CRÍTICO                           │
│  Pastillas freno Pulsar 200: 3 unid. (mín 10)│
└─────────────────────────────────────────────┘
```

### Template mensual — secciones adicionales

```
├─ Tendencia de ingresos vs mes anterior (gráfico de barras matplotlib)
├─ Margen bruto por categoría de repuesto
├─ Clientes nuevos (XX) vs recurrentes (XX)
├─ Tiempo promedio de resolución: X.X días
└─ Top 10 repuestos por rotación y por margen
```

---

## 9. Alertas de Stock — Throttle Pattern

```python
# tools/inventory_tools.py

ALERT_KEY_PREFIX = "alert:stock"
ALERT_TTL = 86400  # 24 horas

async def check_and_send_stock_alerts(tenant_id: str, redis: Redis) -> None:
    low_stock = await saas_client.get(f"/api/agents/inventory/status?tenantId={tenant_id}")

    for part in low_stock["items"]:
        alert_key = f"{ALERT_KEY_PREFIX}:{tenant_id}:{part['id']}"

        already_alerted = await redis.exists(alert_key)
        if already_alerted:
            continue  # no spam — ya se alertó en las últimas 24h

        # Enviar alerta (WhatsApp proactivo al OWNER + notificación en plataforma)
        message = build_alert_message(part)
        await saas_client.post("/api/agents/notifications/whatsapp", {
            "tenantId": tenant_id,
            "content": message,
        })

        # Marcar como alertado por 24h
        await redis.setex(alert_key, ALERT_TTL, "1")
```

**Job APScheduler:** cada hora revisa todos los tenants. La clave Redis `alert:stock:{tenant_id}:{part_id}` con TTL 24h garantiza que no llegue spam.

---

## 10. Servicio a Domicilio — Flujo Técnico

### Nueva tool en NestJS RouterAgent (Fase 1 extension)

```typescript
// Agregar en infrastructure/ai/tools/implementations/
// create-home-service-request.tool.ts

export const createHomeServiceRequestTool: Tool = {
  name: 'createHomeServiceRequest',
  description:
    'Crea una solicitud de servicio a domicilio cuando el cliente reporta moto varada o necesita servicio en su ubicación',
  inputSchema: z.object({
    customerName: z.string(),
    customerPhone: z.string(),
    address: z.string(),
    problemDesc: z.string(),
    serviceType: z.enum(['BREAKDOWN', 'REPAIR', 'PARTS_DELIVERY']),
  }),
  execute: async (input, context) => {
    // POST /api/home-services interno
    const result = await homeServiceRepo.create({ ...input, tenantId: context.tenantId });
    // Notificar al taller
    await notificationPort.notifyStaff(context.tenantId, {
      type: 'HOME_SERVICE_REQUESTED',
      resourceId: result.id,
    });
    return { requestId: result.id, status: 'PENDIENTE' };
  },
};
```

### Nuevo endpoint NestJS

```
POST   /api/home-services                          { customerName, customerPhone, address, problemDesc, serviceType }
GET    /api/home-services?status=&page=&pageSize=
GET    /api/home-services/:id
PATCH  /api/home-services/:id/assign               { technicianId }
PATCH  /api/home-services/:id/status               { status }
POST   /api/home-services/:id/convert-to-work-order
```

---

## 11. Nuevos Modelos en BD — Migraciones Prisma

### `reports`

```prisma
model Report {
  id          String    @id @default(uuid())
  tenantId    String
  type        String    @db.VarChar(20)   // WEEKLY | MONTHLY | ON_DEMAND
  periodStart DateTime  @db.Timestamptz()
  periodEnd   DateTime  @db.Timestamptz()
  pdfR2Key    String?   @db.Text
  status      String    @default("PENDING") @db.VarChar(20)
  generatedAt DateTime? @db.Timestamptz()
  createdAt   DateTime  @default(now()) @db.Timestamptz()

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, type, createdAt(sort: Desc)], name: "idx_reports_tenant")
  @@map("reports")
}
```

### `home_service_requests`

```prisma
model HomeServiceRequest {
  id            String    @id @default(uuid())
  tenantId      String
  branchId      String?
  customerId    String?
  customerName  String    @db.VarChar(255)
  customerPhone String    @db.VarChar(50)
  address       Text
  problemDesc   Text
  serviceType   String    @db.VarChar(30)
  status        String    @default("PENDING") @db.VarChar(20)
  assignedTo    String?
  workOrderId   String?
  estimatedCost Decimal?  @db.Decimal(12, 2)
  notes         String?   @db.Text
  requestedAt   DateTime  @default(now()) @db.Timestamptz()
  assignedAt    DateTime? @db.Timestamptz()
  completedAt   DateTime? @db.Timestamptz()
  createdAt     DateTime  @default(now()) @db.Timestamptz()
  updatedAt     DateTime  @updatedAt @db.Timestamptz()

  tenant    Tenant     @relation(fields: [tenantId], references: [id])
  customer  Customer?  @relation(fields: [customerId], references: [id])
  technician User?     @relation(fields: [assignedTo], references: [id])
  workOrder WorkOrder? @relation(fields: [workOrderId], references: [id])

  @@index([tenantId, status], name: "idx_home_services_tenant")
  @@map("home_service_requests")
}
```

### `purchase_order_drafts`

```prisma
model PurchaseOrderDraft {
  id         String    @id @default(uuid())
  tenantId   String
  status     String    @default("DRAFT") @db.VarChar(20)
  items      Json                         // [{partId, partName, sku, qty, reason}]
  notes      String?   @db.Text
  createdBy  String    @default("AI_AGENT") @db.VarChar(20)
  approvedBy String?
  approvedAt DateTime? @db.Timestamptz()
  createdAt  DateTime  @default(now()) @db.Timestamptz()
  updatedAt  DateTime  @updatedAt @db.Timestamptz()

  tenant     Tenant  @relation(fields: [tenantId], references: [id])
  approvedByUser User? @relation(fields: [approvedBy], references: [id])

  @@index([tenantId, status], name: "idx_purchase_drafts_tenant")
  @@map("purchase_order_drafts")
}
```

---

## 12. Autenticación Service-to-Service

El microservicio Python se identifica ante NestJS con un JWT de **servicio**, firmado con el **mismo `JWT_SECRET`** de Fase 1 (no se introduce un secreto nuevo). El claim distintivo es **`type: "service"`**:

```python
# agents/shared/auth.py
import jwt
from datetime import datetime, timedelta

def create_service_token(secret: str) -> str:
    return jwt.encode({
        "sub":  "agents-service",
        "type": "service",          # <- claim que reconoce ServiceAuthGuard
        "iat":  datetime.utcnow(),
        "exp":  datetime.utcnow() + timedelta(minutes=5),
    }, secret, algorithm="HS256")
```

En NestJS, **`ServiceAuthGuard`** (nuevo, ver §2) valida `type === "service"` y **no** consulta la BD ni pasa por `PermissionGuard`. Todos los endpoints que consume Python viven bajo **`/api/agents/*`** con `@UseGuards(ServiceAuthGuard)`. El `tenantId` va **explícito** en cada request. Separación estricta: un token de usuario (sin `type` o `type:"user"`) **no** pasa `ServiceAuthGuard`, y un token de servicio **no** pasa el `JwtAuthGuard` de usuario (que sí resuelve `roleId` contra la tabla `Role`).

---

## 13. Docker Compose — Adición

```yaml
# Agregar al docker-compose.yml existente
services:
  agents:
    build:
      context: ./apps/agents
      dockerfile: Dockerfile
    ports:
      - '8000:8000'
    environment:
      REDIS_URL: ${REDIS_URL}
      API_BASE_URL: http://api:3001
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
      GROQ_API_KEY: ${GROQ_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY}
      R2_BUCKET_NAME: ${R2_BUCKET_NAME}
      SENTRY_DSN: ${SENTRY_DSN}
      TZ: America/Bogota
    depends_on:
      - redis
      - api
    networks:
      - motoworkshop-net

networks:
  motoworkshop-net:
    driver: bridge
```

---

## 14. Nuevas Variables de Entorno

```bash
# .env.local — agregar
AGENTS_BASE_URL="http://localhost:8000"
ADMIN_SESSION_TTL_SECONDS=7200
TZ="America/Bogota"
```

---

## 15. ADRs — Decisiones Arquitectónicas Fase 2

**ADR-F2-001: LangGraph Python sobre implementación manual TypeScript**
Razón: LangGraph Python es production-ready. El ecosistema de análisis (pandas) y la madurez del tooling justifican el microservicio separado para el AgentAdmin. El agente de clientes permanece en TypeScript porque ya está implementado y es suficientemente simple.

**ADR-F2-002: Los agentes no acceden directamente a la BD**
Razón: mantiene la separación de responsabilidades. NestJS es la única capa que conoce el modelo de datos. Si cambia el schema, solo cambia NestJS, no Python.

**ADR-F2-003: Redis compartido entre NestJS y Python**
Razón: el mismo Redis de Fase 1 sirve para la memoria de sesión del AgentAdmin. No se necesita una instancia Redis separada. Las keys tienen prefijos distintos para evitar colisiones: `agent:admin:*` para Python, resto para NestJS.

**ADR-F2-004: Reportes generados en Python, no en NestJS**
Razón: pandas y matplotlib/reportlab son superiores a las alternativas JS para análisis de datos y generación de documentos con gráficos. El PDF de cotizaciones (Fase 1) usa `@react-pdf/renderer` porque es un documento simple. Los reportes de negocio con gráficos estadísticos justifican Python.

**ADR-F2-005: Servicio a domicilio se implementa en NestJS, no en Python**
Razón: es una entidad de negocio que sigue los mismos patrones del sistema (WorkOrder, Customer, Notification). La captura la hace el RouterAgent de clientes en NestJS. Python no necesita conocer este flujo.

---

## 16. Cronograma de Implementación y Dependencias Críticas

### Fase 2A: Endpoints REST en NestJS (Semana 1-2)

**Dependencia crítica**: DEBE completarse antes de Fase 2B

#### Sprint 1: Autenticación Service-to-Service

1. Extender JWTPayload con tipo "service" (application/ports/jwt.port.ts)
2. Crear ServiceAuthGuard (presentation/http/guards/service-auth.guard.ts)
3. Crear AgentsController con base
4. Implementar endpoint GET /api/agents/tenants (protegido por ServiceAuthGuard)

#### Sprint 2: Endpoints para Python

1. GET /api/agents/dashboard/summary (adaptar endpoint existente para servicio)
2. GET /api/agents/inventory/status (nuevo endpoint con cálculo de rotación)
3. POST /api/agents/purchase-orders/draft (creación de borradores)
4. POST /api/agents/reports/generate (disparar generación de reportes)

#### Sprint 3: Integración inicial

1. Modificar process-incoming-message.use-case.ts con routing para admin
2. Agregar agentsHttpClient para comunicación con Python
3. Crear variable de entorno AGENTS_BASE_URL

### Fase 2B: Microservicio Python (Semana 3-4)

**Dependencia**: Requiere Fase 2A completa

#### Sprint 1: Infraestructura básica

1. Crear carpeta `apps/agents/` con estructura de directorios
2. Configurar FastAPI con dependencias (LangGraph, httpx, APScheduler)
3. Implementar saas_client.py con autenticación JWT
4. Crear sistema de logs compatibles con Sentry

#### Sprint 2: Tools del AgentAdmin

1. Implementar inventory_tools.py con conexión a NestJS
2. Implementar sales_tools.py
3. Implementar tenant_tools.py (para cron jobs)
4. Crear sistema de caché Redis para resultados

#### Sprint 3: LangGraph y flujos

1. Implementar AdminAgentState y grafo LangGraph
2. Crear nodos: classify, execute_tool, respond, fallback
3. Implementar memory.py para sesiones 2h TTL
4. Crear endpoint POST /agents/admin

### Fase 2C: Integración y Despliegue (Semana 5)

**Dependencia**: Requiere Fase 2A y Fase 2B

#### Sprint 1: Cron jobs y schedulers

1. Implementar weekly_report.py (lunes 8am)
2. Implementar monthly_report.py (día 1 del mes 8am)
3. Implementar stock_alert.py (cada hora)
4. Configurar timezone America/Bogota en APScheduler

#### Sprint 2: Reportes PDF

1. Implementar templates semanales/mensuales
2. Integración con R2 para almacenamiento
3. Notificación vía NestJS → WhatsApp
4. Crear página /reports en frontend

#### Sprint 3: Pruebas y despliegue

1. Pruebas E2E entre NestJS y Python
2. Configurar CI/CD para microservicio Python
3. Actualizar docker-compose.yml
4. Documentación final

---

## 17. Testing Strategy Actualizado

### Pruebas para Fase 2A (NestJS)

- **Unit Tests**: ServiceAuthGuard, JWT con tipos "service"
- **Integration Tests**: AgentsController endpoints con diferentes roles
- **Contract Tests**: Verificar que los endpoints devuelven formato esperado por Python
- **Security Tests**: Validar que tokens de usuario no funcionan en endpoints de servicio

### Pruebas para Fase 2B (Python)

- **Unit Tests**: Tools individuales con mocking de httpx
- **Integration Tests**: saas_client.py con NestJS mock server
- **LangGraph Tests**: Verificar flujos del grafo con diferentes intents
- **Memory Tests**: Validar TTL de sesiones en Redis

### Pruebas para Fase 2C (Integración completa)

- **E2E Tests**: Flujo completo: WhatsApp → NestJS → Python → Tools → Respuesta
- **Cron Job Tests**: Verificar generación de reportes en horarios correctos
- **Performance Tests**: Tiempos de respuesta < 10 segundos
- **Fallback Tests**: Cuando Python no está disponible, escala a recepcionista

---

## 18. Correctness Properties

### Propiedades universales del sistema

1. **Consistencia de datos**: Python nunca modifica datos directamente, solo a través de NestJS
2. **Autenticación obligatoria**: Todas las llamadas entre servicios requieren JWT válido
3. **Idempotencia de alertas**: Una alerta de stock no se envía más de una vez cada 24h
4. **Preservación de contexto**: La sesión del admin persiste por exactamente 2h
5. **Límite de tool calls**: Máximo 5 tool calls por mensaje del admin
6. **Fallback garantizado**: Si Python falla, el mensaje escala a recepcionista humano

### Propiedades específicas por herramienta

1. **get_inventory_status**: Siempre devuelve `days_remaining` calculado correctamente
2. **prepare_purchase_order**: Solo crea borradores DRAFT, nunca ordena directamente
3. **send_stock_alert**: Verifica Redis antes de enviar para evitar spam
4. **get_active_tenants**: Solo accesible con token de servicio (`type: "service"`), nunca con token de usuario

### Loop invariants

1. **LangGraph classify node**: `tool_call_count` se reinicia a 0 para cada nuevo mensaje
2. **execute_tool node**: Si `tool_call_count >= MAX_TOOL_CALLS`, retorna inmediatamente
3. **Redis session**: La sesión expira exactamente después de `TTL_SECONDS` de inactividad
4. **JWT tokens**: Los tokens de servicio expiran en 5 minutos y se renuevan automáticamente

---

## 19. Error Handling y Recovery

### Escenarios de error y recuperación

#### 1. Python microservicio no disponible

- **Detección**: Timeout en NestJS al llamar a Python
- **Recuperación**: Mensaje escala a recepcionista humano
- **Registro**: Log en Sentry con tenantId y mensaje

#### 2. LLM no disponible (DeepSeek + Groq fallan)

- **Detección**: Excepción en get_llm_with_fallback()
- **Recuperación**: Usar fallback_node con mensaje predefinido
- **Registro**: Alert en Sentry, métrica de disponibilidad LLM

#### 3. Redis no disponible

- **Detección**: Excepción en operaciones Redis
- **Recuperación**: LangGraph sin checkpointing, sesiones no persistentes
- **Registro**: Log de error, pero sistema sigue funcionando

#### 4. NestJS endpoints no responden

- **Detección**: httpx timeout en saas_client.py
- **Recuperación**: Retry con backoff exponencial (3 intentos)
- **Registro**: Métricas de disponibilidad de API

### Circuit Breaker Pattern

```python
# clients/saas_client.py
from tenacity import retry, stop_after_attempt, wait_exponential

class SaaSClient:
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def call_nestjs_endpoint(self, endpoint: str, params: dict):
        # Implementación con circuit breaker
        pass
```

### Health Checks

- **NestJS**: `GET /health` (existente)
- **Python**: `GET /health` con verificación de Redis, LLM y NestJS
- **Monitorización**: Alerta si health check falla por > 2 minutos

---

## 20. Resumen de Cambios Técnicos Requeridos

### Modificaciones en código existente (NestJS)

1. **JWTPayload interface**: Agregar campo opcional `type?: "user" | "service"` (no rompe el shape actual `{ sub, tenantId, branchId, roleId }`)
2. **UserRepository**: Agregar `findOwnerByWhatsappPhone(phone, tenantId)`
3. **process-incoming-message.use-case.ts**: en `application/use-cases/**messaging**/` (verificado — NO en `workshop/`), ~15 líneas para routing admin
   - _No_ hace falta modificar `JwtService.verify()`: `ServiceAuthGuard` reusa la verificación de firma existente y solo chequea `type`.

### Nuevos componentes (NestJS)

1. **ServiceAuthGuard**: Guard para autenticación de servicios
2. **AgentsController**: Controlador con endpoints REST para Python
3. **TenantService.getActiveTenants()**: Método para listar tenants activos

### Infraestructura nueva

1. **apps/agents/**: Directorio completo para microservicio Python
2. **Docker service**: Agregar servicio `agents` a docker-compose.yml
3. **Variables de entorno**: AGENTS_BASE_URL (el microservicio reusa `JWT_SECRET` para firmar tokens de servicio)

### Variables de entorno nuevas

```bash
# .env.local
AGENTS_BASE_URL="http://localhost:8000"  # dev local
# El microservicio Python firma sus tokens de servicio con el JWT_SECRET ya existente (no se crea uno nuevo).
ADMIN_SESSION_TTL_SECONDS="7200"  # 2 horas
REPORT_GENERATION_TIMEZONE="America/Bogota"
STOCK_ALERT_CHECK_INTERVAL="3600"  # cada hora
```

### Migraciones de base de datos (Prisma)

1. **reports table**: Para registro de reportes generados
2. **home_service_requests table**: Para solicitudes de servicio a domicilio
3. **purchase_order_drafts table**: Para borradores creados por AI

**Nota final**: Este diseño resuelve todas las inconsistencias identificadas en el contexto actual, creando primero los endpoints REST necesarios en NestJS antes de implementar el microservicio Python, garantizando compatibilidad y coherencia en todo el sistema.
