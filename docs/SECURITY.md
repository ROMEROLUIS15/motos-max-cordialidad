# Security Measures

---

## CORS

| Entorno                                  | Comportamiento                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Desarrollo (`NODE_ENV !== 'production'`) | `app.enableCors()` — abierto a todos los orígenes                                  |
| Producción                               | Restringido a `ALLOWED_ORIGINS` (variable de entorno, orígenes separados por coma) |

**Implementación**: `apps/api/src/main.ts:12-16`

---

## WebSocket CORS

Misma lógica que HTTP CORS. El gateway de WebSocket (`NotificationsGateway`) lee `ALLOWED_ORIGINS` y configura `cors.origin` en el `Server` de Socket.IO.

**Implementación**: `apps/api/src/infrastructure/notifications/notifications.gateway.ts`

---

## JWT (JSON Web Tokens)

| Medida                   | Detalle                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Algoritmo                | `HS256` (HMAC-SHA256)                                                                                                           |
| Secreto                  | `JWT_SECRET` — obligatorio en producción (≥ 32 caracteres)                                                                      |
| Dev fallback             | Si `NODE_ENV !== 'production'` y falta la variable, se usa un secreto por defecto y se registra una advertencia (`Logger.warn`) |
| Expiración access token  | Configurable vía `JWT_EXPIRES_IN` (default `15m`)                                                                               |
| Expiración refresh token | Configurable vía `JWT_REFRESH_EXPIRES_IN` (default `7d`)                                                                        |
| Validación en producción | `TokenFactoryService` y `JwtService` lanzan `Error` si el secreto no está configurado en producción                             |
| Servicio-a-servicio      | Tokens con `type: "service"` y expiración corta (`SERVICE_TOKEN_TTL_SECONDS`, default `300`)                                    |

**Implementación**: `apps/api/src/infrastructure/auth/jwt.service.ts`, `apps/api/src/application/services/token-factory.service.ts`

---

## Cifrado de campos sensibles

| Propiedad                | Valor                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Algoritmo                | AES-256-GCM                                                                            |
| Tamaño de clave          | 256 bits (derivada de `ENCRYPTION_KEY`, string hex de 64 caracteres)                   |
| IV                       | 12 bytes aleatorios por encriptación                                                   |
| Auth tag                 | 16 bytes                                                                               |
| Output                   | Base64: `iv(12) + authTag(16) + ciphertext` concatenados                               |
| Dev fallback             | Si `NODE_ENV !== 'production'` y falta la clave, se usa un fallback con `console.warn` |
| Validación en producción | `FieldEncryptionService` lanza `Error` si falta la clave                               |

**Implementación**: `apps/api/src/infrastructure/crypto/field-encryption.service.ts`

---

## Rate Limiting

| Ámbito                               | Límite       | Ventana    | Clave      | Implementación                                  |
| ------------------------------------ | ------------ | ---------- | ---------- | ----------------------------------------------- |
| Global (todas las rutas)             | 60 requests  | 1 minuto   | IP + ruta  | `GlobalThrottlerGuard` como `APP_GUARD`         |
| Global — circuito de contención      | 100 requests | 1 hora     | IP + ruta  | Segundo throttler nombrado (`hourly`)           |
| `POST /api/auth/login`               | 5 requests   | 5 minutos  | IP         | `@Throttle()`                                   |
| `POST /api/auth/refresh`             | 10 requests  | 1 minuto   | IP         | `@Throttle()`                                   |
| `POST /api/auth/forgot-password`     | 3 requests   | 15 minutos | IP + email | `ForgotPasswordThrottlerGuard` (guard dedicado) |
| `POST /api/auth/reset-password`      | 5 requests   | 15 minutos | IP         | `@Throttle()`                                   |
| `POST /api/tenants` (alta de taller) | 3 requests   | 5 minutos  | IP         | `@Throttle()`                                   |

El guard global calcula la clave como `IP + ruta`, no solo IP — así un pico de tráfico en un endpoint no consume la cuota de los demás. El endpoint de `forgot-password` usa un guard propio en vez del throttler global porque necesita una clave compuesta (`IP + email`) para no bloquear a todos los usuarios detrás de una misma IP corporativa/NAT.

**Implementación**: `apps/api/src/presentation/http/guards/global-throttler.guard.ts`, `apps/api/src/presentation/http/guards/forgot-password-throttler.guard.ts`, `apps/api/src/presentation/http/controllers/auth.controller.ts`, `apps/api/src/presentation/http/controllers/tenants.controller.ts`

---

## Anti-enumeración de cuentas

El login y el flujo de recuperación de contraseña están diseñados para que un mensaje de error nunca revele si una cuenta existe:

| Endpoint                         | Comportamiento                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`           | Credenciales inválidas, usuario inexistente y cuenta inactiva devuelven el mismo mensaje genérico. El estado de la cuenta se evalúa **después** de verificar la contraseña. |
| `POST /api/auth/forgot-password` | Siempre responde `200` con el mismo mensaje, exista o no el email registrado.                                                                                               |
| `POST /api/auth/reset-password`  | Token inexistente, ya usado o expirado devuelven el mismo `400 "Token inválido o expirado."`.                                                                               |

**Implementación**: `apps/api/src/application/use-cases/identity/authenticate-user.use-case.ts`, `forgot-password.use-case.ts`, `reset-password.use-case.ts`

---

## Aislamiento multi-tenant

Todo recurso (clientes, vehículos, órdenes, usuarios, inventario) está scoped por `tenantId`. La regla invariante: el `tenantId` de una operación de escritura se resuelve **siempre** desde el JWT autenticado, nunca desde un campo del body de la petición. En el controlador, los campos de confianza (`tenantId`, ids de ruta) se aplican después de mezclar el body:

```typescript
// el spread del body va primero — los campos derivados del token siempre ganan
await this.updateCustomer.execute({ ...body, customerId: id, tenantId: user.tenantId });
```

Verificado con una prueba end-to-end contra base de datos real (`apps/api/test/cross-tenant-write.e2e-spec.ts`): un usuario autenticado de un tenant no puede leer ni modificar recursos de otro tenant, incluso si el body de la petición intenta especificar un `tenantId` distinto.

**Implementación**: controladores en `apps/api/src/presentation/http/controllers/`

---

## Recursos con URL firmada

| Recurso                           | TTL        | Notas                                                                       |
| --------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Reporte financiero (descarga web) | 15 minutos | Bucket privado; requiere JWT + permiso `reports:READ` para solicitar la URL |
| Contrato de compraventa           | 1 hora     | Generado on-demand solo para ventas confirmadas                             |

Una URL firmada no requiere autenticación adicional una vez emitida, por lo que su vida útil se mantiene deliberadamente corta.

**Implementación**: `apps/api/src/application/use-cases/agents/agents.use-cases/get-report-download-url.use-case.ts`, `apps/agents/src/reports/uploader.py`

---

## Idempotencia de webhooks

El webhook de WhatsApp deduplica por `waMessageId` antes de procesar un mensaje entrante, ya que el proveedor (Meta) garantiza entrega _at-least-once_ — un reintento de red o una notificación duplicada no vuelven a disparar el agente ni generan una respuesta repetida al cliente.

**Implementación**: `apps/api/src/application/use-cases/messaging/process-incoming-message.use-case.ts`

---

## Validación de entrada

`main.ts` registra un `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` global. Todos los `@Body()` de la API están tipados como clases DTO decoradas con `class-validator` (no interfaces TypeScript, que se borran en runtime y el pipe ignora) — cualquier campo no declarado en el DTO se descarta, y un tipo o formato incorrecto responde `400` antes de llegar al caso de uso. Los endpoints de autenticación (login, registro, recuperación de contraseña) además validan explícitamente contra un schema Zod estricto por delante del pipe global.

**Gotcha para el próximo DTO que se agregue**: NestJS solo valida parámetros tipados como clase; un `@Body() body: { foo: string }` inline o una `interface` no tiene metadata de clase en runtime y el pipe lo deja pasar sin validar. Todo DTO nuevo debe ser una `class` con decoradores, nunca una interfaz.

**Implementación**: `apps/api/src/main.ts`, `apps/api/src/presentation/http/dtos/*.dto.ts`

---

## Autenticación service-to-service

La comunicación entre NestJS (API) y Python (Agents) usa JWT firmado con la misma clave `JWT_SECRET`:

1. NestJS genera un token con `sub: "agents-service"`, `type: "service"` y TTL de 5 minutos.
2. Python usa este token en el header `Authorization: Bearer <token>` para todas las llamadas a la API.
3. NestJS verifica el token y su tipo (`type === "service"`) mediante `ServiceAuthGuard`.
4. Python renueva el token automáticamente antes de que expire (vía `SaasClient.refresh_token_if_needed()`).
5. La validación es bidireccional: el microservicio de agentes también exige y verifica el mismo tipo de token en sus propios endpoints expuestos a NestJS (`/agents/admin`), rechazando cualquier llamada sin un JWT válido firmado con el `JWT_SECRET` compartido.

**Implementación**: `apps/api/src/application/services/token-factory.service.ts`, `apps/api/src/presentation/http/guards/service-auth.guard.ts`, `apps/agents/src/saas_client.py`

---

## Generación de número de orden atómica

Los números de orden de trabajo se generan mediante una consulta SQL atómica `MAX(number) + 1` dentro de una transacción, en lugar de contadores en Redis o secuencias PostgreSQL. Esto evita race conditions cuando dos solicitudes crean órdenes simultáneamente.

**Implementación**: `apps/api/src/infrastructure/persistence/prisma/repositories/work-order.prisma-repository.ts`

---

## Caché de permisos

El guard `PermissionGuard` cachea los permisos del rol en memoria con un TTL de 30 segundos (reducido de 5 minutos tras auditoría). En un escenario multi-réplica, el TTL corto minimiza la ventana de desfase entre que se cambia un permiso y el guard lo refleja.

**Limitación**: La caché es en memoria (no Redis), por lo que no es compartida entre réplicas. Cada réplica puede tener un desfase de hasta 30 segundos.

**Implementación**: `apps/api/src/presentation/http/guards/permission.guard.ts`

---

## Python — Validación de configuración en producción

En `apps/agents/src/config.py`, un `model_validator` de Pydantic verifica al arrancar que `JWT_SECRET` no sea el valor por defecto cuando `NODE_ENV === "production"`. Si detecta el default, lanza `ValueError` y el proceso no arranca.

**Implementación**: `apps/agents/src/config.py`

---

## Resumen de secretos obligatorios en producción

| Variable                                    | Servicio    | Riesgo si falta                               |
| ------------------------------------------- | ----------- | --------------------------------------------- |
| `JWT_SECRET`                                | API, Agents | Falsificación de tokens de autenticación      |
| `ENCRYPTION_KEY`                            | API         | Datos sensibles almacenados sin cifrar        |
| `ALLOWED_ORIGINS`                           | API         | CORS abierto a cualquier origen en producción |
| `WHATSAPP_ACCESS_TOKEN`                     | API         | No se pueden enviar mensajes WhatsApp         |
| `WHATSAPP_VERIFY_TOKEN`                     | API         | Webhook de WhatsApp no se puede verificar     |
| `DEEPSEEK_API_KEY`                          | API, Agents | Agentes LLM sin funcionamiento                |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | API, Agents | Sin acceso a storage de objetos               |
| `DATABASE_URL`                              | API, Agents | Sin conexión a base de datos                  |

---

## Vulnerabilidades de dependencias — riesgo aceptado

`pnpm audit` y el escaneo de secretos (gitleaks) corren en cada push como parte del pipeline de CI y bloquean el merge ante una vulnerabilidad `high` nueva en dependencias de producción. Las siguientes están identificadas, evaluadas y aceptadas conscientemente porque su alcance es herramientas de build/desarrollo, no código que se ejecuta en producción:

| Paquete     | Severidad    | Alcance                                                                          | Por qué se acepta                                                                  |
| ----------- | ------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `undici`    | Alta / media | Dependencia transitiva de la herramienta de build de Cloudflare Pages (dev-only) | Sin ruta de actualización compatible (salto de major); no se ejecuta en producción |
| `esbuild`   | Media        | Dependencia transitiva del build de Cloudflare Pages                             | Forzar la versión bloquea el build; riesgo confinado a tiempo de build             |
| `file-type` | Media        | Dependencia transitiva de NestJS 10                                              | Se resuelve al migrar a NestJS 11 (ver ADR-007)                                    |
| `webpack`   | Baja         | Peer dependency de `@nestjs/cli`                                                 | Idem — ligado a la migración de NestJS                                             |

Estas excepciones están declaradas explícitamente en la configuración de auditoría del monorepo (`package.json` → `pnpm.auditConfig`) y se revisan en cada actualización de dependencias.
