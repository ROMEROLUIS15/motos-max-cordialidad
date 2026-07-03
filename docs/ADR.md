# Architecture Decision Records

---

## ADR-001: pnpm Workspaces como estrategia de monorepo

**Fecha**: 2024-10

**Contexto**: El proyecto consta de múltiples aplicaciones (API NestJS, Web Next.js, microservicio Python) que comparten tipos y utilidades. Necesitamos una forma de gestionar dependencias, scripts y versiones de forma centralizada.

**Decisión**: Usar pnpm workspaces con un único `pnpm-workspace.yaml` que agrupa `apps/*` y `packages/*`.

**Alternativas consideradas**:

| Alternativa                | Razón de descarte                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **nx**                     | Poderoso pero sobrecarga de configuración innecesaria para 3 apps. Nx trae su propio sistema de caché, task orchestrator y generadores que no necesitamos. |
| **turbo**                  | Similar a nx. El caché remoto es de pago.                                                                                                                  |
| **Repositorios separados** | Mayor overhead de coordinación entre repos (cambios atómicos, versionado de tipos compartidos).                                                            |
| **npm workspaces**         | Soporte básico pero sin overrides nativos hasta npm 9+. pnpm tiene mejor gestión de dependencias huérfanas.                                                |

**Trade-offs**:

- **Positivo**: Instalaciones más rápidas que npm (enlace simbólico + store global), overrides funcionan para parchear transitivas, `pnpm-lock.yaml` unificado evita conflictos de versiones.
- **Negativo**: pnpm es un ecosistema aparte (no npm estándar). Algunas herramientas (específicamente `@nestjs/cli` webpack plugin) pueden tener comportamientos inesperados con el hoisting diferencial de pnpm. En Windows, `bcrypt` necesita `--ignore-scripts` por su compilación nativa.

---

## ADR-002: Arquitectura hexagonal en NestJS

**Fecha**: 2024-10

**Contexto**: El API necesita ser mantenible, testeable y permitir cambiar implementaciones de infraestructura (ej. cambiar método de pago, proveedor de almacenamiento, ORM) sin afectar la lógica de negocio.

**Decisión**: Dividir el código en 4 capas: Domain → Application → Infrastructure → Presentation.

```
Domain:       Entidades + repositorios (interfaces) + value objects. Sin imports externos.
Application:  Casos de uso + puertos (interfaces que Infrastructure implementa). Depende solo de Domain.
Infrastructure: Implementaciones concretas (PrismaService, JwtService, S3Storage, etc.). Depende de Application.
Presentation:  Controladores HTTP, guards, filtros, interceptors. Orquesta use-cases.
```

**Alternativas consideradas**:

| Alternativa                    | Razón de descarte                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Módulos planos por feature** | Funciona para prototipos, pero cambias de ORM o proveedor de storage y tienes que tocar archivos en toda la codebase. Sin DIP, los tests usan la DB real.         |
| **Módulos NEST por feature**   | NestJS modular por feature (ej. `users/`, `workshop/`, `inventory/`) termina mezclando controladores con lógica de negocio con queries de BD en el mismo feature. |

**Trade-offs**:

- **Positivo**: Testabilidad real (mockeas puertos en vez de la DB). Cada capa se puede reemplazar sin tocar las otras. La lógica de negocio es portable a otro framework.
- **Negativo**: Más archivos, más imports, más boilerplate (interfaces + implementaciones + registros en módulos). Curva de aprendizaje para developers nuevos.

---

## ADR-003: Symbol tokens para DI en vez de interfaces

**Fecha**: 2024-10

**Contexto**: NestJS usa su propio sistema de Inyección de Dependencias con decoradores. Queremos inyectar por interfaz para cumplir DIP, pero TypeScript elimina las interfaces en tiempo de compilación (no existe `instanceof` para interfaces en runtime). NestJS necesita un token concreto en runtime para resolver dependencias.

**Decisión**: Usar `Symbol('PortName')` como token de DI combinado con `@Inject()`.

```typescript
// Puerto
export const WHATSAPP_SENDER_PORT = Symbol('WHATSAPP_SENDER_PORT');
export interface WhatsAppSenderPort {
  sendToPhone(to: string, message: string, sentBy: string | null): Promise<void>;
}

// Implementación
@Injectable()
export class WhatsAppCloudAdapter implements WhatsAppSenderPort { ... }

// Registro en módulo
providers: [
  { provide: WHATSAPP_SENDER_PORT, useClass: WhatsAppCloudAdapter },
]

// Inyección en use-case
constructor(
  @Inject(WHATSAPP_SENDER_PORT)
  private readonly whatsapp: WhatsAppSenderPort,
) {}
```

**Alternativas consideradas**:

| Alternativa                      | Descarte                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inyección por clase concreta** | Rompe DIP: el use-case depende de la implementación. Si cambias de proveedor, tocas el use-case.                                                                                                                    |
| **String token**                 | `'WHATSAPP_SENDER_PORT'` funciona pero hay riesgo de colisión de strings y no hay autocompletado. Symbol garantiza unicidad.                                                                                        |
| **abstract class**               | Podemos inyectar por `abstract class` (NestJS lo soporta). Pero introduce herencia donde debería haber interfaces. Además, una clase abstracta puede tener implementación, lo que diluye la separación de concerns. |

**Trade-offs**:

- **Positivo**: Runtime-safe (TypeScript no borra Symbols). Unicidad garantizada. Cumple DIP real.
- **Negativo**: Más boilerplate (definir token, exportarlo, registrarlo explícitamente en el módulo). Cada nuevo puerto requiere 3 archivos tocados (port, módulo, use-case).

---

## ADR-004: Python microservicio separado para agentes IA

**Fecha**: 2024-11

**Contexto**: Necesitamos agentes conversacionales con LangGraph para WhatsApp y admin dashboard. El equipo evalúa implementarlos en TypeScript (mismo stack) o en un microservicio Python separado.

**Decisión**: Microservicio Python independiente (`apps/agents/`) que se comunica con NestJS vía JWT service-to-service. Usa FastAPI + LangGraph + APScheduler + ReportLab.

**Alternativas consideradas**:

| Alternativa                         | Razón de descarte                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LangChain.JS / Vercel AI SDK**    | El ecosistema Python para LLM tooling es más maduro: LangGraph oficial, más modelos con soporte nativo, más herramientas de agentes. TypeScript está alcanzando pero todavía tiene menos integraciones. |
| **Integrar en NestJS directamente** | Ejecutar LangGraph dentro de Node.js requeriría llamadas HTTP a un LLM proxy o usar bindings Python. Más complejo que un microservicio separado.                                                        |
| **Un solo monolito Python**         | Perderíamos todo el código NestJS existente (auth, Prisma, etc.). Migrar no es viable.                                                                                                                  |

**Trade-offs**:

- **Positivo**: Stack óptimo para cada tarea (NestJS para CRUD + auth, Python para LLM). LangGraph y LangChain en su entorno natural. Los schedulers (APScheduler) son más robustos que los equivalentes Node.js.
- **Negativo**: Stack políglota más complejo. Latencia de red adicional (cada tool call del agente Python viaja a NestJS y vuelve). Costos operativos de mantener dos stacks (build, deploy, monitoreo).

---

## ADR-005: Cloudflare Pages + Render en vez de Vercel + Railway

**Fecha**: 2024-10

**Contexto**: El proyecto necesita alojamiento para frontend y backend sin costo inicial. Evaluamos proveedores serverless y contenedores.

**Decisión**: Frontend en Cloudflare Pages (free tier con ancho de banda ilimitado), backend en Render (Dockerfile propio, plan free con 512 MB RAM).

**Alternativas consideradas**:

| Alternativa | Razón de descarte                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| **Vercel**  | Excelente para frontend, pero caro para backend (funciones serverless). No soporta Dockerfile nativo. |
| **Railway** | Bueno para backend pero plan free limitado a 500 MB y 500 horas. Frontend no es su fuerte.            |
| **Fly.io**  | Más caro que Render para el mismo servicio.                                                           |

**Trade-offs**:

- **Positivo**: Cloudflare Pages edge global con ancho de banda ilimitado. Render soporta Dockerfile completo (multistage build, migraciones automáticas). Costo $0 en ambos para el tier free.
- **Negativo**: Render free tier tiene cold starts de ~50 segundos (el contenedor duerme tras inactividad). Mitigamos con un keep-alive cada 10 min vía GitHub Action. Cloudflare Pages requiere un Action manual para deploy (no auto-deploy nativo). Render plan free no tiene esclavo de BD (usamos Neon aparte).

---

## ADR-006: AES-256-GCM para cifrado de campos sensibles en BD

**Fecha**: 2024-10

**Contexto**: El sistema almacena datos personales de clientes (nombres, teléfonos, direcciones) y datos financieros. Neon ofrece cifrado en reposo a nivel de disco, pero queremos una capa adicional de protección a nivel de aplicación.

**Decisión**: Usar `@nestjs/common` `FieldEncryptionService` con AES-256-GCM (clave de 256 bits, IV de 12 bytes, auth tag de 16 bytes). La clave se deriva de `ENCRYPTION_KEY` (string hex de 64 caracteres).

```typescript
// encrypt: base64(iv + authTag + ciphertext)
// decrypt: reverse
```

**Alternativas consideradas**:

| Alternativa                                            | Descarte                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Solo cifrado Neon (disco)**                          | Protege contra robo físico del disco pero no contra fuga de datos desde la aplicación o snapshot de BD.                |
| **Cifrado a nivel de columna PostgreSQL (`pgcrypto`)** | Más lento que cifrar en la aplicación. La clave estaría en la BD (si alguien accede a la BD, tiene acceso a la clave). |
| **No cifrar nada**                                     | Riesgo de exposición de datos personales.                                                                              |

**Trade-offs**:

- **Positivo**: Doble capa de cifrado (aplicación + disco). La clave nunca está en la BD. Si alguien obtiene un dump de la BD, los campos sensibles son ilegibles.
- **Negativo**: No se puede hacer `WHERE` sobre campos cifrados (no son deterministas). Hay que desencriptar en la aplicación antes de usar. Si se pierde `ENCRYPTION_KEY`, los datos son irrecuperables (sin backdoor). Impacto en performance por CPU de encriptación/desencriptación en cada lectura/escritura.

---

## ADR-007: NestJS se mantiene en v10 — migración a v11 diferida

**Fecha**: 2026

**Contexto**: NestJS 11 resuelve una vulnerabilidad de severidad moderada en una dependencia transitiva (`file-type`, vía `@nestjs/common`), pero introduce cambios incompatibles: Express v4→v5 y `@nestjs/schedule` v4→v6 con breaking changes en la API de cron jobs.

**Decisión**: permanecer en NestJS 10 hasta ejecutar una migración planificada con ventana de pruebas dedicada. La vulnerabilidad se acepta como riesgo conocido documentado (ver `SECURITY.md`) mientras tanto.

**Alternativas consideradas**:

| Alternativa                                 | Razón de descarte                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Actualizar de inmediato a v11**           | Cambios incompatibles en Express y en el scheduler sin ventana de pruebas dedicada — riesgo de regresión no planificada en un sistema con usuarios activos. |
| **Parchear solo la dependencia transitiva** | No es posible: `file-type` está fijado por rango en `@nestjs/common` 10.x; requiere el salto de major completo.                                             |

**Trade-offs**:

- **Positivo**: cero riesgo de regresión no planificada mientras el sistema está en operación activa; la migración se puede planificar con calma en vez de bajo presión de un CVE.
- **Negativo**: la vulnerabilidad permanece abierta (mitigada — alcance de build/dependencia transitiva, no explotable directamente) hasta ejecutar la migración. Este ADR debe revisarse cuando se planifique el salto a v11.

---

## ADR-008: bcryptjs en lugar de bcrypt para el hashing de contraseñas

**Fecha**: 2026

**Contexto**: `bcrypt` (binding nativo) depende transitivamente de `@mapbox/node-pre-gyp` → `tar@^6`, una versión con una vulnerabilidad conocida. pnpm no puede forzar un override entre majors incompatibles (`tar@^6` → `>=7`) cuando el consumidor declara ese rango.

**Decisión**: reemplazar `bcrypt` por `bcryptjs`, una implementación en JavaScript puro con la misma API pública.

**Alternativas consideradas**:

| Alternativa                                     | Razón de descarte                                                                                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mantener bcrypt y aceptar el CVE transitivo** | Existía una alternativa sin ese costo; no había razón para aceptar el riesgo.                                                                              |
| **Argon2**                                      | Requiere binding nativo también, con el mismo problema de portabilidad y compilación en distintos entornos (Windows sin build tools, contenedores Alpine). |

**Trade-offs**:

- **Positivo**: sin dependencias nativas — instala igual en cualquier plataforma sin build tools ni compilación, elimina el CVE transitivo por completo.
- **Negativo**: bcryptjs es más lento que la implementación en C de bcrypt (diferencia no perceptible en el volumen actual de autenticaciones del sistema).

---

## ADR-009: Unicidad de email por tenant, no global

**Fecha**: 2026

**Contexto**: El sistema es multi-tenant. Una misma persona (ej. un contador o un gerente de zona) puede necesitar una cuenta en más de un taller cliente, potencialmente con el mismo correo electrónico.

**Decisión**: la unicidad de `email` en el modelo `User` se define a nivel de tenant (`@@unique([tenantId, email])`), no globalmente.

**Alternativas consideradas**:

| Alternativa                  | Razón de descarte                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Unicidad global de email** | Impediría que la misma persona tuviera cuentas en dos talleres distintos — un caso de uso real del negocio. |

**Trade-offs**:

- **Positivo**: modela correctamente la realidad del negocio; cada tenant gestiona su propio espacio de usuarios sin coordinarse con otros tenants.
- **Negativo**: cualquier flujo de autenticación que no reciba el `tenantId` de forma explícita debe resolver la posible ambigüedad entre tenants de manera determinista (implementado: el login sin `tenantId` solo procede si exactamente una cuenta coincide con el email; de lo contrario responde el mismo error genérico que una credencial inválida).

---

## ADR-010: `SalePayment` como modelo independiente de `Payment`

**Fecha**: 2026 (Fase 3 — módulo de ventas)

**Contexto**: el modelo `Payment` existente está diseñado específicamente para pagos asociados a una orden de trabajo (`workOrderId` obligatorio, acoplado a los reportes financieros del taller). El nuevo módulo de venta de motocicletas necesita registrar pagos y cuotas de una venta.

**Decisión**: introducir `SalePayment` como modelo independiente en vez de generalizar `Payment` con una relación polimórfica.

**Alternativas consideradas**:

| Alternativa                                                            | Razón de descarte                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Generalizar `Payment` (relación polimórfica workOrder / saleOrder)** | Habría requerido migrar datos de producción existentes y complejizar las queries de reportes financieros del taller, para un beneficio (menos duplicación de modelo) no crítico en el alcance de la Fase 3. |

**Trade-offs**:

- **Positivo**: entrega del módulo de ventas sin riesgo de migración sobre datos de producción existentes; cada modelo permanece simple y con un único propósito.
- **Negativo**: la lógica de "registrar pago" y "listar pagos" está duplicada entre los dos modelos. Candidato a unificación si aparece una tercera necesidad de pagos (ej. suscripciones de plataforma).
