# Security Measures

---

## CORS

| Entorno | Comportamiento |
|---------|---------------|
| Desarrollo (`NODE_ENV !== 'production'`) | `app.enableCors()` — abierto a todos los orígenes |
| Producción | Restringido a `ALLOWED_ORIGINS` (variable de entorno, orígenes separados por coma) |

**Implementación**: `apps/api/src/main.ts:12-16`

---

## WebSocket CORS

Misma lógica que HTTP CORS. El gateway de WebSocket (`NotificationsGateway`) lee `ALLOWED_ORIGINS` y configura `cors.origin` en el `Server` de Socket.IO.

**Implementación**: `apps/api/src/infrastructure/notifications/notifications.gateway.ts`

---

## JWT (JSON Web Tokens)

| Medida | Detalle |
|--------|---------|
| Algoritmo | `HS256` (HMAC-SHA256) |
| Secreto | `JWT_SECRET` — obligatorio en producción (≥ 32 caracteres) |
| Dev fallback | Si `NODE_ENV !== 'production'` y falta la variable, se usa un secreto por defecto con `console.warn` |
| Expiración access token | Configurable vía `JWT_EXPIRES_IN` (default `15m`) |
| Expiración refresh token | Configurable vía `JWT_REFRESH_EXPIRES_IN` (default `7d`) |
| Validación en producción | `TokenFactoryService` y `JwtService` lanzan `Error` si el secreto no está configurado en producción |
| Servicio-a-servicio | Tokens con `type: "service"` y expiración corta (`SERVICE_TOKEN_TTL_SECONDS`, default `300`) |

**Implementación**: `apps/api/src/infrastructure/auth/jwt.service.ts`, `apps/api/src/application/services/token-factory.service.ts`

---

## Cifrado de campos sensibles

| Propiedad | Valor |
|-----------|-------|
| Algoritmo | AES-256-GCM |
| Tamaño de clave | 256 bits (derivada de `ENCRYPTION_KEY`, string hex de 64 caracteres) |
| IV | 12 bytes aleatorios por encriptación |
| Auth tag | 16 bytes |
| Output | Base64: `iv(12) + authTag(16) + ciphertext` concatenados |
| Dev fallback | Si `NODE_ENV !== 'production'` y falta la clave, se usa un fallback con `console.warn` |
| Validación en producción | `FieldEncryptionService` lanza `Error` si falta la clave |

**Implementación**: `apps/api/src/infrastructure/crypto/field-encryption.service.ts`

---

## Rate Limiting

| Ámbito | Límite | Ventana | Implementación |
|--------|--------|---------|----------------|
| Global (todas las rutas) | 60 requests | 1 minuto | `ThrottlerGuard` como `APP_GUARD` |
| `POST /api/auth/refresh` | 10 requests | 1 minuto | `@Throttle()` decorator |
| `POST /api/tenants` | 3 requests | 5 minutos | `@Throttle()` decorator |

**Implementación**: `apps/api/src/app.module.ts` (global), `apps/api/src/presentation/http/controllers/auth.controller.ts`, `apps/api/src/presentation/http/controllers/tenants.controller.ts`

---

## Autenticación service-to-service

La comunicación entre NestJS (API) y Python (Agents) usa JWT firmado con la misma clave `JWT_SECRET`:

1. NestJS genera un token con `sub: "agents-service"`, `type: "service"` y TTL de 5 minutos.
2. Python usa este token en el header `Authorization: Bearer <token>` para todas las llamadas a la API.
3. NestJS verifica el token y su tipo (`type === "service"`) mediante `ServiceAuthGuard`.
4. Python renueva el token automáticamente antes de que expire (vía `SaasClient.refresh_token_if_needed()`).

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

| Variable | Servicio | Riesgo si falta |
|----------|----------|-----------------|
| `JWT_SECRET` | API, Agents | Falsificación de tokens de autenticación |
| `ENCRYPTION_KEY` | API | Datos sensibles almacenados sin cifrar |
| `ALLOWED_ORIGINS` | API | CORS abierto a cualquier origen en producción |
| `WHATSAPP_ACCESS_TOKEN` | API | No se pueden enviar mensajes WhatsApp |
| `WHATSAPP_VERIFY_TOKEN` | API | Webhook de WhatsApp no se puede verificar |
| `DEEPSEEK_API_KEY` | API, Agents | Agentes LLM sin funcionamiento |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | API, Agents | Sin acceso a storage de objetos |
| `DATABASE_URL` | API, Agents | Sin conexión a base de datos |
