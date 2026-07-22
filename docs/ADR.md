# Architecture Decision Records

[English](./ADR.en.md) · **🌐 Español**

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

---

## ADR-011: Repositorios de dominio en vez de `PrismaService` directo en use-cases

**Fecha**: 2026-07-03 (auditoría general — hallazgo Alta)

**Contexto**: una auditoría encontró 9 use-cases/servicios de la capa de aplicación (`forgot-password`, `reset-password`, `cleanup-expired-tokens`, `work-order-parts`, `delivery-alerts` scheduler, `quote-assembler`, `transfer-vehicle-ownership`, `get-vehicle-history`, `get-customer-profile`) que inyectaban `PrismaService` directamente en vez de un repositorio de dominio, violando DIP (Dependency Inversion Principle) del patrón hexagonal ya establecido en ADR-002: la capa de aplicación quedaba acoplada al ORM concreto, no a una abstracción.

**Decisión**: crear los repositorios de dominio faltantes (`PasswordResetTokenRepository`, `VehicleOwnershipHistoryRepository`) y extender `WorkOrderRepository` con los métodos de consulta que faltaban (`findVehicleServiceHistory`, `findRecentByCustomer`), migrando los 9 use-cases a depender de esas interfaces vía Symbol token + `@Inject` (ver ADR-003), nunca de `PrismaService`.

**Alternativas consideradas**:

| Alternativa                                                | Razón de descarte                                                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dejarlo así, documentar como deuda técnica**             | El patrón hexagonal pierde su propósito (testear use-cases sin BD real) si una parte relevante del código lo rodea; further erosion en cada PR nuevo. |
| **Un solo "repositorio god" con todos los métodos ad-hoc** | Repite el problema original (acoplamiento a Prisma) un nivel más arriba; dificulta razonar sobre qué invariantes de dominio protege cada repositorio. |

**Trade-off no trivial encontrado durante la implementación**: la cadena de imports de NestJS `WorkshopModule → VehiclesModule → CustomersModule` es circular en la dirección inversa — `CommerceModule`/`VehiclesModule`/`CustomersModule` no pueden importar el módulo canónico que provee `WORK_ORDER_REPOSITORY`/`VEHICLE_REPOSITORY`/`CUSTOMER_REPOSITORY` sin crear un ciclo. Se optó por re-proveer localmente el mismo token + clase de implementación en cada módulo que lo necesita (documentado inline) en vez de introducir `forwardRef()`, que oculta el ciclo real en lugar de resolverlo.

**Trade-offs**:

- **Positivo**: todos los use-cases de la capa de aplicación son testeables con mocks puros, sin `PrismaClient` real ni contenedor de BD; consistente con el resto del código.
- **Negativo**: la re-provisión local del mismo token en varios módulos es una duplicación menor (un `providers: [{ provide: TOKEN, useClass: Impl }]` repetido) que hay que mantener sincronizada si la clase de implementación cambia.

---

## ADR-012: Rate limiting por identidad del llamador y límites derivados del cliente

**Fecha**: 2026-07-16

**Contexto**: el throttler global protege toda la API. Su clave era la IP del llamador (más la ruta, ADR previo implícito en `GlobalThrottlerGuard`) y sus techos eran valores redondos (60/minuto, 100/hora). Dos propiedades del sistema real hacen que esa combinación no describa a un usuario legítimo:

1. **Los usuarios de un taller comparten una IP pública** (salen por el mismo router). Una cuota por IP es, en la práctica, una cuota por taller: se estrecha a medida que crece el equipo, castigando al cliente por contratar gente. El proyecto ya había reconocido este efecto en `ForgotPasswordThrottlerGuard`, que usa `IP + email` precisamente para no bloquear a todos los usuarios detrás de un NAT.
2. **El propio cliente web genera tráfico de fondo**: `usePolling` refresca la campana de notificaciones y tres pantallas cada 30 s. Son 120 peticiones/hora por pantalla con la pestaña simplemente abierta — por encima del techo horario de 100.

El segundo punto es el más costoso de diagnosticar: un refresco en segundo plano que recibe `429` no produce ninguna señal visible. No hay pantalla de error; hay un contador que deja de moverse.

**Decisión**:

- **La clave del throttler es el sujeto, no la máquina**: en rutas autenticadas se acota por `sub` del JWT; en rutas anónimas (login, forgot-password, webhooks) se mantiene la IP, que es la única identidad disponible y la que importa frente a fuerza bruta. La ruta sigue formando parte de la clave.
- **Los techos se derivan del comportamiento del cliente, no de números redondos**: `rate-limit.policy.ts` calcula el límite horario como `(3.600.000 / intervalo_de_polling) × margen`, y `rate-limit.policy.spec.ts` lee los intervalos reales de `apps/web` y falla si alguno se acerca al techo.

**Alternativas consideradas**:

| Alternativa                                            | Razón de descarte                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subir solo el techo horario**                        | Arregla el síntoma de hoy y deja intacto el multiplicador del NAT: el número correcto pasaría a depender de cuántos empleados tenga el taller, y volvería a romperse al contratar al siguiente.                                                                                                                                        |
| **Bajar la frecuencia del polling**                    | Degrada el producto (notificaciones más lentas) sin resolver la causa: con 4 usuarios tras una IP, cualquier intervalo razonable vuelve a cruzar un techo por IP.                                                                                                                                                                      |
| **Sustituir el polling por el WebSocket ya existente** | Elimina la clase entera de problema y es el destino natural (ver «Evolución»), pero hoy los servicios corren en el plan free de Render, que **suspende el proceso por inactividad**: las conexiones se caerían y reconectarían constantemente. En ese entorno el polling es más robusto que el WebSocket.                              |
| **Verificar el JWT dentro del guard**                  | El guard global corre antes que `JwtAuthGuard`, así que tendría que duplicar la verificación de firma en cada petición. Para una clave de contador no aporta: un `sub` falsificado falla la autenticación aguas abajo y devuelve 401 sin datos, así que lo único que podría alterar es en qué cubeta se cuenta una petición condenada. |

**Trade-offs**:

- **Positivo**: el límite deja de depender de la topología de red del cliente; el equipo puede crecer sin recalibrar nada. Los techos son auditables: se leen como una fórmula con su origen, no como una constante heredada.
- **Positivo**: el acoplamiento entre el intervalo del cliente y el techo del servidor pasa de invisible a verificado en CI, con el nombre del archivo culpable en el mensaje de fallo.
- **Negativo**: el guard decodifica el JWT (sin verificar firma) en cada petición autenticada — un `JSON.parse` sobre un segmento base64, despreciable frente a la consulta que viene después, pero es trabajo que antes no se hacía.
- **Negativo**: el test de invariante lee las fuentes de `apps/web` con expresiones regulares, y falla si un refactor cambia la forma de las llamadas. Es deliberado: la alternativa —una constante compartida que ambos paquetes importen— sólo demostraría que los dos ficheros coinciden **con la constante**; una pantalla que fije su intervalo a mano se desviaría en silencio y el test seguiría en verde. Lo que hay que verificar es el número que el cliente realmente publica. Que el test se rompa ante un refactor es el precio, y avisa justo cuando conviene revisar el invariante a mano.

**Evolución**: cuando los servicios pasen a un plan con proceso permanente, el cliente puede consumir el gateway de WebSocket que la API ya expone (`notifications.gateway.ts`) y retirar el polling. En ese momento el tráfico de fondo desaparece y estos techos dejan de tener relación con el uso normal.

---

## ADR-013: Boundaries transaccionales con bloqueo de fila en las mutaciones de inventario

**Fecha**: 2026-07-21

**Contexto**: el `InventoryAdapter` (implementación de `InventoryPort`) mutaba el stock con un patrón _read-modify-write_ sobre valores absolutos y sin transacción:

1. `reserveStock` / `releaseReservation` leían la fila (`ensureExists`/`findByPartAndBranch`), aplicaban la regla en el modelo de dominio y guardaban `stockReservado` con `update`. Dos reservas concurrentes del mismo repuesto leen el mismo `stockDisponible`, ambas pasan la validación de `PartBranchStock.reserve()`, y el segundo `save` pisa al primero — _lost update_ que **sobrevende stock**.
2. `confirmStockDiscount` / `releaseAllReservations` recorrían los repuestos de una orden en un bucle, cada iteración con escrituras independientes (`stock.save` + `stockEntry.create`), sin transacción. Un fallo a mitad del bucle deja el stock **descontado a medias** y el libro de movimientos (`StockEntry`) inconsistente con el físico.

El propio repositorio ya tenía el patrón correcto en `transferAtomically` (`$transaction` + operadores atómicos), así que la carencia era de **consistencia**, no de desconocimiento: las operaciones igualmente críticas de reserva y descuento no lo seguían.

**Decisión**: toda mutación de stock corre dentro de `prisma.$transaction` y bloquea la(s) fila(s) `part_branch_stock` afectada(s) con `SELECT … FOR UPDATE` antes del _read-modify-write_. El bloqueo de fila serializa a los llamadores concurrentes sobre el mismo repuesto, eliminando el _lost update_. Las operaciones multi-parte (`confirmStockDiscount`, `releaseAllReservations`) bloquean y escriben todos los repuestos —y sus asientos `StockEntry`— dentro de **una sola** transacción, de modo que un fallo revierte el cambio completo. Las invariantes de negocio siguen en `PartBranchStock` (que lanza `InsufficientStockException` / `INSUFFICIENT_PHYSICAL_STOCK`); el adaptador solo aporta el límite transaccional.

**Alternativas consideradas**:

| Alternativa                                                                                                                     | Razón de descarte                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`UPDATE` condicional atómico** (`SET reservado = reservado + q WHERE (fisico - reservado) >= q`, comprobando filas afectadas) | Es libre de carrera sin bloqueo explícito, pero traslada la invariante «no reservar más de lo disponible» a SQL, **abandonando el modelo de dominio rico** que el resto del proyecto sostiene (ADR-002). Se prefirió mantener la regla en `PartBranchStock` y darle atomicidad con el lock. |
| **Isolation `Serializable` + reintento**                                                                                        | Conserva el modelo de dominio, pero aborta con error de serialización bajo contención y obliga a un bucle de reintentos en cada operación. `FOR UPDATE` (bloqueo pesimista sobre una fila muy acotada) da la misma garantía sin la complejidad del reintento.                               |
| **Concurrencia optimista con columna `version`**                                                                                | Requiere migración de esquema y, de nuevo, lógica de reintento en el cliente para el mismo resultado. Más superficie de cambio para la misma garantía que ya da el lock de fila.                                                                                                            |
| **Dejarlo como estaba y documentarlo como deuda**                                                                               | La sobreventa es un error de correctitud real en un flujo vivo (órdenes de trabajo + inventario), no un riesgo teórico; el coste de arreglarlo era bajo y el patrón de referencia ya existía en el mismo archivo.                                                                           |

**Trade-off no trivial — desviación consciente de ADR-011**: estas operaciones atómicas usan el cliente de transacción de Prisma (`tx.partBranchStock.update`, `tx.stockEntry.create`, `tx.$queryRaw` para el `FOR UPDATE`) **directamente**, en vez de delegar en los repositorios de dominio (`PartStockRepository`/`StockEntryRepository`) como manda ADR-011. Es deliberado: una transacción no se puede componer a partir de llamadas a repositorios independientes sin propagar el `tx` a través de las firmas de los puertos, lo que filtraría el detalle de persistencia hacia el dominio. El adaptador de infraestructura es el lugar legítimo para el «script transaccional» —igual que `transferAtomically` ya vivía en el repositorio— y sigue depende solo de `PrismaService`, no de otro puerto.

**Trade-offs**:

- **Positivo**: desaparece la sobreventa por concurrencia y el descuento parcial; stock físico y libro de movimientos quedan siempre consistentes (todo-o-nada).
- **Positivo**: consistencia interna — el patrón atómico de `transferAtomically` se aplica ya a todas las mutaciones de stock, no a una sola.
- **Negativo**: el `FOR UPDATE` mantiene un bloqueo de fila durante la transacción (corta); reservas concurrentes del **mismo** repuesto se serializan. Es el comportamiento correcto, pero reduce el paralelismo en ese punto.
- **Negativo**: el lock requiere `$queryRaw` porque Prisma no expone `FOR UPDATE` en su API fluida; es SQL crudo parametrizado, acotado a una lectura por PK.

**Verificación**: `inventory.adapter.spec.ts` cubre la orquestación (se toma el lock antes de escribir, el dominio rechaza lo insuficiente sin persistir, el bucle multi-parte va en una transacción). La serialización real de `FOR UPDATE` y el rollback todo-o-nada son garantías de Postgres, ejercitadas contra base de datos real en `test/workshop-flow.e2e-spec.ts`.
