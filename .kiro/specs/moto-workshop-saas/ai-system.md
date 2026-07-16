# AI System — MotoWorkshop SaaS

---

## Principios Fundamentales

1. **Los agentes nunca tocan la base de datos directamente.** Toda interacción con datos ocurre a través de Tools tipadas que invocan casos de uso.
2. **El sistema funciona sin IA.** La caída de todos los proveedores LLM no degrada ninguna funcionalidad operativa del taller.
3. **Toda interacción de IA es observable.** Cada invocación de Tool, cada llamada al LLM y cada fallo se registran en log con contexto completo.
4. **Las Tools son contratos tipados.** El schema de entrada se valida con TypeScript strict antes de ejecutar cualquier caso de uso.

---

## Evolución del Sistema de IA

### Fase 1 — RouterAgent (actual)

Un único agente que clasifica la intención del mensaje, selecciona la Tool apropiada y genera la respuesta.

```
Usuario → RouterAgent → Tool → UseCase → Resultado → Respuesta
```

### Fase 2 — Agentes Especializados

El RouterAgent delega a agentes especializados según el dominio de la consulta:

```
Usuario → RouterAgent → CommercialAgent   (ventas, cotizaciones)
                     → WorkshopAgent     (órdenes, técnicos, vehículos)
                     → FinancialAgent    (pagos, métricas, reportes)
                     → ManagementAgent   (inventario, configuración)
```

### Fase 3 — Orquestación Multiagente

Un SupervisorAgent coordina múltiples agentes especializados para resolver tareas complejas que requieren colaboración entre dominios.

```
Usuario → SupervisorAgent → [WorkshopAgent + InventoryAgent + FinancialAgent]
                         → Resultado consolidado
```

---

## Arquitectura del RouterAgent (Fase 1)

### Componentes

```
┌─────────────────────────────────────────────────────────┐
│                    AI Module                            │
│                                                         │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │ RouterAgent  │    │       ToolRegistry            │   │
│  │              │───▶│  getWorkOrderStatus           │   │
│  │  Classifies  │    │  checkInventory               │   │
│  │  intent →    │    │  getVehicleHistory            │   │
│  │  selects     │    │  createAppointment            │   │
│  │  tool →      │    │  createQuote                  │   │
│  │  generates   │    │  getBusinessInformation       │   │
│  │  response    │    └──────────────┬────────────────┘   │
│  └──────┬───────┘                   │                    │
│         │                    ┌──────▼──────┐             │
│  ┌──────▼──────┐             │ToolExecutor │             │
│  │LLMProvider  │             │             │             │
│  │             │             │ 1. Validate │             │
│  │ DeepSeek ──▶│             │    schema   │             │
│  │   (primary) │             │ 2. Invoke   │             │
│  │ Groq ──────▶│             │    UseCase  │             │
│  │   (fallback)│             │ 3. Log      │             │
│  └─────────────┘             │    result   │             │
│                              └──────┬──────┘             │
└─────────────────────────────────────┼─────────────────── ┘
                                      │
                              ┌───────▼────────┐
                              │  Application   │
                              │  Use Cases     │
                              └────────────────┘
```

### Flujo de Procesamiento

```typescript
// Pseudocódigo del flujo del RouterAgent
async processMessage(message: IncomingWhatsAppMessage): Promise<void> {
  const context = await this.buildContext(message);

  // Verificar si es cliente registrado
  const isRegistered = await this.customerLookup(message.phoneNumber);
  const availableTools = isRegistered
    ? this.toolRegistry.getAllTools()
    : this.toolRegistry.getPublicTools(); // solo getBusinessInformation

  let attempts = 0;
  let response: AgentResponse | null = null;

  while (attempts < 3 && !response) {
    try {
      // Llamada al LLM (DeepSeek → Groq → fallback)
      const llmResult = await this.llmProvider.complete({
        context,
        tools: availableTools,
        timeout: 10_000
      });

      if (llmResult.requiresTool) {
        // Validar y ejecutar Tool (máximo 5 por mensaje)
        const toolResult = await this.toolExecutor.execute(
          llmResult.toolName,
          llmResult.toolArgs
        );
        context.addToolResult(toolResult);
        // El LLM continúa con el resultado
      } else {
        response = llmResult.response;
      }
    } catch {
      attempts++;
    }
  }

  if (!response) {
    // Fallback: mensaje predefinido + notificar recepcionista
    await this.sendFallbackMessage(message.phoneNumber);
    await this.notifyReceptionist(message);
  }
}
```

---

## Tools — Fase 1

### Contratos TypeScript

```typescript
// Tool: getWorkOrderStatus
interface GetWorkOrderStatusInput {
  workOrderId: string; // UUID
}
interface GetWorkOrderStatusOutput {
  orderNumber: string;
  status: WorkOrderStatus;
  promisedDeliveryAt: string; // ISO 8601
  technicianName: string;
  serviceType: ServiceType;
}

// Tool: checkInventory
interface CheckInventoryInput {
  partSku: string;
  branchId: string; // UUID
}
interface CheckInventoryOutput {
  partName: string;
  stockDisponible: number;
  unit: string;
  isAvailable: boolean;
}

// Tool: getVehicleHistory
interface GetVehicleHistoryInput {
  vehicleId: string; // UUID
}
interface GetVehicleHistoryOutput {
  plate: string;
  brand: string;
  model: string;
  recentWorkOrders: Array<{
    orderNumber: string;
    serviceType: ServiceType;
    status: WorkOrderStatus;
    createdAt: string;
    completedAt?: string;
  }>;
}

// Tool: createAppointment
interface CreateAppointmentInput {
  customerId: string; // UUID
  requestedDate: string; // ISO 8601
  serviceType: ServiceType;
  notes?: string;
}
interface CreateAppointmentOutput {
  receptionId: string;
  confirmedAt: string;
  branchAddress: string;
}

// Tool: createQuote
interface CreateQuoteInput {
  workOrderId: string; // UUID
}
interface CreateQuoteOutput {
  quoteNumber: string;
  total: number;
  pdfUrl: string; // URL pre-firmada 24h
  validUntil: string;
}

// Tool: getBusinessInformation
interface GetBusinessInformationInput {
  infoType: 'hours' | 'location' | 'services' | 'general';
}
interface GetBusinessInformationOutput {
  content: string; // Respuesta en lenguaje natural
}
```

---

## Proveedores LLM

### Jerarquía de Fallback

```
Intento 1: DeepSeek
  → Timeout: 10 segundos
  → Si responde: usar resultado
  → Si timeout/error: continuar al siguiente

Intento 2: Groq
  → Timeout: 10 segundos
  → Si responde: usar resultado
  → Si timeout/error: continuar al fallback

Fallback final:
  → Enviar mensaje predefinido al cliente
  → Generar notificación interna al RECEPTIONIST
  → Registrar evento en Sentry
```

### Configuración de Proveedores

```typescript
interface LLMProviderConfig {
  primary: {
    provider: 'deepseek';
    model: 'deepseek-chat';
    timeout: 10_000; // ms
    maxRetries: 1;
  };
  secondary: {
    provider: 'groq';
    model: 'openai/gpt-oss-120b'; // o equivalente disponible
    timeout: 10_000; // ms
    maxRetries: 1;
  };
}
```

---

## Límites y Protecciones

| Límite                                 | Valor                         | Consecuencia si se supera        |
| -------------------------------------- | ----------------------------- | -------------------------------- |
| Invocaciones de Tools por mensaje      | 5                             | Escalar a recepcionista          |
| Timeout por Tool                       | 5 segundos                    | Error de timeout al LLM          |
| Timeout por llamada LLM                | 10 segundos                   | Fallback al proveedor secundario |
| Intentos de resolución consecutivos    | 3                             | Escalar a recepcionista          |
| Acceso a datos sin verificar identidad | Solo `getBusinessInformation` | N/A — restricción de diseño      |

---

## Logging de IA

Cada invocación del sistema de IA genera los siguientes eventos de log:

```typescript
interface AIInvocationLog {
  timestamp: string;
  traceId: string;
  tenantId: string;
  sessionId: string; // WhatsAppSession.id
  provider: 'deepseek' | 'groq' | 'fallback';
  toolName?: string;
  toolInput?: Record<string, unknown>; // sin datos sensibles
  toolOutput?: Record<string, unknown>;
  toolDurationMs?: number;
  llmDurationMs: number;
  tokensUsed?: number;
  succeeded: boolean;
  escalatedToHuman: boolean;
  failureReason?: string;
}
```

---

## Mensajes de Fallback Predefinidos

Configurables por Tenant en `tenants.whatsapp_messages`:

```
fallback_ai_unavailable:
  "Hola {customer_name}, en este momento no puedo procesar tu consulta automáticamente.
   Un asesor te atenderá a la brevedad. ¡Gracias por tu paciencia!"

fallback_out_of_hours:
  "Hola! Nuestro horario de atención es {business_hours}.
   Te responderemos en cuanto estemos disponibles. 🏍️"

escalate_to_human:
  "Entendido, voy a conectarte con uno de nuestros asesores.
   En un momento te atienden. ¡Gracias!"
```

---

## Preparación para Fase 2 y 3

La arquitectura de Fase 1 está diseñada para que la adición de agentes especializados no requiera modificar los contratos de Tools existentes:

**Fase 2 — Adición de agentes especializados:**

- Cada agente especializado tiene su propio conjunto de Tools.
- El RouterAgent actualiza su lógica de clasificación para delegar al agente correcto.
- Los casos de uso del dominio no cambian.

**Fase 3 — SupervisorAgent:**

- El SupervisorAgent recibe la intención clasificada y coordina múltiples agentes especializados.
- Puede invocar Tools de diferentes agentes en secuencia o en paralelo.
- Los resultados se consolidan antes de generar la respuesta al cliente.

**Regla de compatibilidad:**
Los contratos de Tools de Fase 1 son compatibles hacia adelante. Las nuevas Tools se agregan al registro, no reemplazan las existentes.
