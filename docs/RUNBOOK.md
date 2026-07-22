# Runbook — MotoWorkshop SaaS

[English](./RUNBOOK.en.md) · **🌐 Español**

---

## Inventario de servicios (producción)

| Servicio             | Proveedor        | Plan  | URL                                        | Keep-alive  |
| -------------------- | ---------------- | ----- | ------------------------------------------ | ----------- |
| **API (NestJS)**     | Render           | Free  | `https://motoworkshop-api.onrender.com`    | Cada 10 min |
| **Web (Next.js)**    | Cloudflare Pages | Free  | `https://motos-max-cordialidad.pages.dev`  | — (edge)    |
| **Agents (FastAPI)** | Render           | Free  | `https://motoworkshop-agents.onrender.com` | Cada 10 min |
| **Base de datos**    | Neon             | Free  | (conexión vía DATABASE_URL)                | —           |
| **Redis**            | <TBD>            | <TBD> | (conexión vía REDIS_URL)                   | —           |
| **Object Storage**   | Cloudflare R2    | Free  | (vía R2_PUBLIC_URL)                        | —           |
| **Monitoreo**        | Sentry           | Free  | `sentry.io`                                | —           |

---

## Variables de entorno por servicio

### API (Render — `motoworkshop-api`)

Todas las de `.env.local.example` excepto las específicas de web:

- `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- `ENCRYPTION_KEY`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
- `WHATSAPP_UTILITY_TEMPLATE` (opcional) — nombre de una plantilla **utility aprobada** en Meta con un único parámetro de body. Ejemplo: nombre `notificacion_taller`, idioma **Español a secas** (el código envía `code: 'es'`; una variante como es_MX da error 132001), body: "Hola, tienes una novedad de tu taller: {{1}}. Si tienes alguna duda, responde a este mensaje." — ojo: Meta **rechaza** plantillas cuyo body empieza o termina con la variable, y solo se llenan parámetros del body (sin header con variable ni botones dinámicos). Si está configurada, los mensajes fuera de la ventana de 24h se envían con esta plantilla en vez de texto libre (que Meta rechaza con error 131047). Sin configurar, se intenta texto libre y el fallo queda visible (mensaje FAILED + notificación in-app a admins).
- `WHATSAPP_API_VERSION` (opcional, default `v21.0`) — versión de Graph API; permite el bump sin tocar código cuando Meta retire la versión actual (~2 años de soporte por versión).
- `DEEPSEEK_API_KEY`, `GROQ_API_KEY`
- `GROQ_MODEL` (opcional, default `openai/gpt-oss-120b`) — modelo de Groq; permite el cambio sin tocar código cuando Groq deprecie el modelo actual (avisan por email con ~1 mes de margen). Modelos vigentes en https://console.groq.com/docs/models. Debe soportar tool calling (lo usa el RouterAgent). Vacío = default.
- `SENTRY_DSN`
- `NODE_ENV=production`, `ALLOWED_ORIGINS`
- `AGENTS_BASE_URL`, `SERVICE_TOKEN_TTL_SECONDS`
- `TZ=America/Bogota`
- `PORT=3001`

### Web (Cloudflare Pages — `motoworkshop-web`)

Configurado en el dashboard de Cloudflare Pages > Settings > Environment variables:

- `NEXT_PUBLIC_API_URL=https://motoworkshop-api.onrender.com`
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`
- `SENTRY_ORG`, `SENTRY_PROJECT`

### Agents (Render — `motoworkshop-agents`)

- `DATABASE_URL` (lectura para consultas)
- `REDIS_URL`
- `JWT_SECRET` (compartido con API, para firmar/verificar service tokens)
- `API_BASE_URL=https://motoworkshop-api.onrender.com`
- `DEEPSEEK_API_KEY`, `GROQ_API_KEY`
- `GROQ_MODEL` (opcional, default `openai/gpt-oss-120b`) — igual que en la API; ambos servicios lo leen por separado, así que un cambio de modelo hay que hacerlo **en los dos**. Un cambio de variable en Render **no aplica hasta el próximo deploy** (`autoDeployTrigger: off`): tras cambiarla, redesplegar. El modelo que el proceso está usando de verdad se comprueba con `curl https://motoworkshop-agents.onrender.com/health` → campo `llm.fallback` (la API no expone el suyo; usa el mismo valor)
- `SENTRY_DSN`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`
- `ADMIN_SESSION_TTL_SECONDS=7200`, `SERVICE_TOKEN_TTL_SECONDS=300`
- `SCHEDULER_ENABLED=true`
- `TZ=America/Bogota`
- `PORT=8000`

> Secretos (`sync: false`) configurados en `render.yaml`. No incluir valores en el blueprint.

---

## Despliegue

Nada se despliega si el pipeline de CI no está en verde. Ver [«Pipeline de CI/CD»](#pipeline-de-cicd) más abajo para el detalle completo; esta sección cubre solo el mecanismo de cada servicio.

### API (NestJS) — Render

```yaml
# render.yaml
service:
  name: motoworkshop-api
  type: web
  runtime: docker
  dockerfile: apps/api/Dockerfile
  dockerContext: .
  plan: free
  healthCheckPath: /api/health
  autoDeployTrigger: off # el deploy NO lo dispara Render — lo orquesta CI
```

El auto-deploy nativo de Render está deshabilitado a propósito. El job `deploy-api` de `ci.yml` dispara el deploy vía la API de Render (`POST /v1/services/{id}/deploys`) **solo después** de que todos los checks (typecheck, tests, lint, e2e, secrets, audit) pasan, y espera a que el estado sea `live` antes de continuar con el smoke test. Esto evita un deadlock que se daría si en cambio se usara `autoDeployTrigger: checksPass` junto con un job de verificación en el mismo pipeline (Render esperaría el check, el check esperaría a Render).

**Build**: Docker multistage (instalación → build → copia de artefactos → imagen final). Las migraciones y el seed corren dentro del `CMD` del contenedor al arrancar (ver [«Migraciones de base de datos»](#migraciones-de-base-de-datos)) — el plan free de Render no ofrece `preDeployCommand` como paso separado.

### Web (Next.js) — Cloudflare Pages

El deploy de producción corre en el job `deploy-web` de `ci.yml`, gated por los mismos checks que el API. Desde 2026-07-05 el job **no construye ni sube artefactos**: dispara el **build server-side de Cloudflare** vía la API de Pages y espera el resultado:

```bash
# 1. Crear el deployment (Cloudflare clona el repo y builda con su propio entorno)
POST /accounts/{account}/pages/projects/motos-max-cordialidad/deployments  -F branch=main
# 2. Poll de latest_stage hasta deploy:success (o fallo)
# 3. Verificación post-deploy: GET /customers/<uuid> debe responder ≠ 500
```

El paso 3 existe porque un deploy puede "succeed" con el worker roto (incidente 2026-07-04: `compatibility_date` de producción desactualizada → todas las rutas dinámicas en 500 mientras las estáticas respondían 200 y el smoke test pasaba). Un smoke test de rutas estáticas **no** detecta un worker edge roto.

> **No crear `apps/web/wrangler.toml`.** `wrangler pages deploy` sincroniza cualquier `wrangler.toml` presente con la configuración del proyecto en el dashboard de Cloudflare — incluyendo `compatibility_flags`, `compatibility_date` y `destination_dir`. Así fue como la config de producción quedó pisada con una fecha de 2024 (ver troubleshooting). El flujo actual ya no usa wrangler, pero la advertencia sigue vigente para cualquier deploy manual.

`.github/workflows/pages.yml` (`workflow_dispatch`, manual) queda como respaldo funcional — usa el mismo mecanismo de build server-side.

### Agents (Python) — Render

Mismo mecanismo que el API: `autoDeployTrigger: off`, el job `deploy-agents` de `ci.yml` orquesta el deploy vía API de Render. Este job además solo se ejecuta si el diff del commit toca `apps/agents/**` — un cambio solo en `apps/web` o `apps/api` no redespliega el microservicio de agentes.

---

## Migraciones de base de datos

```bash
# Local / manual
pnpm --filter @motoworkshop/api db:migrate
# Internamente corre: npx prisma migrate dev (crea+aplica migración)

# NUNCA usar contra producción:
# ❌ npx prisma migrate dev  (resetearía datos)
# ❌ npx prisma db push       (saltaría validaciones)
```

En **producción**, la migración se ejecuta automáticamente dentro del `CMD` del contenedor de la API al arrancar — `npx prisma migrate deploy && node dist-seed/prisma/seed.js && node dist/main` — no hay un paso separado ni una GitHub Action dedicada. Dos razones: el plan free de Render no ofrece `preDeployCommand`, y Neon no es alcanzable de forma confiable desde fuera de la red de Render para correr el seed manualmente. El seed es idempotente (usa `upsert`/chequeos de existencia), por lo que reintentarlo en cada arranque es seguro.

---

## Rollback

### Render (API y Agents)

1. Ir al dashboard de Render > servicio > **Deploy History**.
2. Identificar el commit anterior a la incidencia.
3. Click en **"Deploy"** junto a ese commit.
4. Render rebuildeará y desplegará esa versión.

### Cloudflare Pages (Web)

1. Dashboard de Cloudflare Pages > **Deployments**.
2. Buscar el deployment anterior exitoso.
3. Click en **"..."** > **"Rollback to this deployment"**.

---

## Health Checks

| Servicio      | Endpoint          | Respuesta esperada                                                                                                             |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| API NestJS    | `GET /api/health` | `200 { "status": "ok" }`                                                                                                       |
| Agents Python | `GET /health`     | `200 { "status": "ok", "redis": true, "api": true, "llm": { "primary": "deepseek-chat", "fallback": "openai/gpt-oss-120b" } }` |

Render usa estos endpoints para determinar si el servicio está vivo, y el job `smoke-web`/keep-alive los consulta cada 10 minutos para evitar que el plan free entre en sleep.

> **Nota de implementación**: existe un segundo controller (`HealthController` en `health.controller.ts`) que expone un chequeo más detallado (estado de Postgres, y si Redis/R2/WhatsApp están configurados) también bajo `/health`. `AppController` registra su propia ruta `health` primero, así que en la práctica `GET /api/health` responde siempre la forma simple de arriba. Si se necesita el detalle por componente, exponerlo bajo una ruta propia (ej. `/api/health/detail`) en vez de depender del orden de registro de controllers.

---

## Monitoreo

- **Sentry**: Captura errores no manejados en API (NestJS filtro global) y Agents (Sentry SDK).
- **Logs**: Render dashboard > servicio > **Logs**.
- **Keep-alive**: GitHub Action cada 10 minutos previene que los servicios free de Render entren en sleep.

---

## Pipeline de CI/CD

Todo push a `main` corre la misma secuencia; nada se despliega si un check falla.

**Checks (`ci.yml`, en paralelo):**

| Check           | Qué valida                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Typecheck       | `tsc --noEmit` en API y Web                                                                                    |
| Test            | Jest (API) + Vitest (Web), con piso de cobertura                                                               |
| Lint            | ESLint en API y Web                                                                                            |
| Agents (Python) | `ruff check` + `ruff format --check` + `mypy` + `pytest`                                                       |
| E2E API         | Suites contra Postgres + Redis efímeros en el runner, incluye el gate de migraciones (`prisma migrate deploy`) |
| E2E Web         | Playwright (Chromium) contra specs mockeadas                                                                   |
| Secrets scan    | `gitleaks-action` sobre el diff                                                                                |
| Audit           | `pnpm audit --prod --audit-level high` (con las excepciones documentadas en `SECURITY.md`)                     |

**Deploys (solo si los 8 checks anteriores pasan):** `deploy-web` (Cloudflare Pages) → `smoke-web` (verifica `/`, `/login`, `/reset-password/help` con contenido real) en paralelo con `deploy-api` / `deploy-agents` (Render, orquestados vía API — ver arriba) → verificación de health post-deploy.

**Protección de la rama `main`**: 8 checks requeridos + pull request obligatorio. Un fallo en cualquier paso — incluido un smoke test post-deploy — dispara un correo de notificación al equipo (`notify-failure`) para que un deploy roto no pase desapercibido.

---

## Diagnóstico de problemas comunes

### API lenta en el primer request

**Problema**: Render free tier "duerme" el contenedor tras 15 min de inactividad. El primer request puede tardar ~50s (cold start).

**Solución**: El keep-alive cada 10 min reduce la ventana, pero no elimina el cold start por completo. Considerar plan Starter ($7/mes) si la latencia es crítica.

### Redis caído

**Síntoma**: Cola WhatsApp no procesa mensajes, sesiones de agente fallan, login lento.

**Impacto**: Degradado parcial. La API sigue funcionando (Redis es caché/cola, no almacenamiento primario). Los mensajes de WhatsApp entrantes se pierden hasta que Redis se recupere.

**Acción**: Verificar estado del proveedor Redis. Reiniciar si es necesario.

### LLM sin saldo (DeepSeek / Groq)

**Síntoma**: Los agentes (RouterAgent WhatsApp o AgentAdmin) responden con errores o "no pude procesar tu solicitud". Logs muestran `429` o `401`.

**Impacto**: Solo agentes. El resto del sistema funciona normalmente.

**Acción**: Recargar crédito del proveedor. El sistema tiene fallback: si DeepSeek falla, intenta con Groq (`LLMProviderFactory`). Si ambos fallan, el agente escala a humano.

### Webhook de WhatsApp no responde

**Síntoma**: Mensajes de WhatsApp entrantes no generan respuesta.

**Diagnóstico**:

1. Verificar que `WHATSAPP_VERIFY_TOKEN` coincide entre Meta y la variable de entorno.
2. Verificar que `webhook` está configurado en Meta Business Dashboard apuntando a `https://motoworkshop-api.onrender.com/api/webhooks/whatsapp` (GET de verificación y POST de mensajes viven en esa ruta — `whatsapp-webhook.controller.ts`).
3. Revisar logs de API en Render.

### Mensajes salientes de WhatsApp fallan (notificación WHATSAPP_SEND_FAILED)

**Síntoma**: llega una notificación in-app `WHATSAPP_SEND_FAILED`, o hay mensajes con estado `FAILED` en la sección Mensajes.

> ⚠️ **Estado real verificado 2026-07-04**: las variables `WHATSAPP_*` **NO existen en Render**
> (verificado vía API: ni PHONE_NUMBER_ID, ni ACCESS_TOKEN, ni APP_SECRET, ni VERIFY_TOKEN).
> El canal de WhatsApp de producción **nunca ha estado conectado a Meta**: todo envío falla
> con Graph code 100 ("Object with ID 'messages' does not exist" — phone id vacío) y el
> webhook entrante rechazaría cualquier POST por firma ausente. Los mensajes automáticos a
> clientes ("tu moto está lista", alertas de entrega) nunca se han entregado. Para activar el
> canal: crear la app en Meta for Developers, obtener PHONE_NUMBER_ID + token de System User,
> y configurar las 4 variables en Render. Mientras no estén, el sistema marca los mensajes
> FAILED con un warn en logs y **no** genera notificaciones in-app (para no inundar al admin).

**Diagnóstico** (el campo `metaCode` de la notificación indica la causa):

- **Primero**: verificar que las 4 variables `WHATSAPP_*` existen en Render (ver advertencia de arriba). `metaCode: 100` con "Object with ID 'messages'" = `WHATSAPP_PHONE_NUMBER_ID` vacío.

- `metaCode: 131047` — el mensaje era iniciado por el negocio (ej. "tu moto está lista", alertas del scheduler) y el cliente no escribió en las últimas 24h. Meta solo permite plantillas aprobadas fuera de esa ventana. **Acción**: aprobar una plantilla utility en Meta Business Manager (WhatsApp Manager → Plantillas → categoría "Utilidad", body con un parámetro `{{1}}`) y configurar su nombre en `WHATSAPP_UTILITY_TEMPLATE`; el sistema la usa automáticamente cuando detecta la ventana cerrada.
- `metaCode: 190` (o HTTP 401) — `WHATSAPP_ACCESS_TOKEN` expirado o revocado. **Importante**: el token debe ser de **System User** (Meta Business Settings → Users → System users → generar token con permisos `whatsapp_business_messaging`), que no expira. Un token de usuario normal dura 60 días y muere en silencio.
- Otros 4xx — payload o número inválido; revisar logs (el error ya no se reintenta: los 4xx fallan rápido).
- Sin `metaCode` — fallo de red/5xx tras 3 reintentos (30s/60s/120s de backoff); suele resolverse solo, revisar status de Meta.

### Falla el build de Cloudflare Pages: "routes not configured to run with the Edge Runtime"

**Síntoma**: el job "Deploy Web (Cloudflare Pages)" del CI falla con `Failed to produce a Cloudflare Pages build from the project` señalando una o más rutas dinámicas (`[id]`, `[slug]`).

**Causa**: toda ruta dinámica (no estática) bajo `apps/web/src/app` necesita `export const runtime = 'edge';`, porque Cloudflare Workers solo ejecuta Edge Runtime, nunca Node.js. Este export puede parecer "código muerto" leyendo solo el componente (sobre todo si la página es `'use client'`, donde el runtime del servidor no se nota a simple vista) — **no lo es**: su única función es satisfacer al build de `@cloudflare/next-on-pages`.

**Acción**: si se quitó por error, restaurar el export en cada archivo señalado por el log del build (`git log -p -- <archivo>` para ver cuándo se agregó/quitó). No hay forma de verificar esto con `next build` local ni con `pnpm --filter web typecheck` — ninguno de los dos falla sin el export; solo el build real de `@cloudflare/next-on-pages` lo detecta, y en Windows ese build no corre localmente (ver más abajo), así que el chequeo real solo ocurre en CI (Linux).

**Local Windows**: `npx @cloudflare/next-on-pages` / `pnpm dlx @cloudflare/next-on-pages` fallan con `spawn npx/pnpm ENOENT` — es un bug conocido del Vercel CLI (que next-on-pages invoca internamente) en Windows, no del proyecto. Verificar solo con `next build` local; el build real de Cloudflare corre en CI.

### Rutas dinámicas ([id]) devuelven 500 en producción pero los previews funcionan

**Síntoma**: `/work-orders/<id>`, `/customers/<id>`, `/vehicles/<id>` responden `Internal Server Error` (texto plano, header `x-matched-path` presente) en `motos-max-cordialidad.pages.dev`, mientras las rutas estáticas (`/`, `/login`) dan 200 — y el MISMO commit desplegado como preview (URL `<hash>.motos-max-cordialidad.pages.dev` de una rama) funciona.

**Causa (incidente 2026-07-04)**: la config de **producción** del proyecto Pages difiere de la de preview. En el incidente real, `deployment_configs.production.compatibility_date` quedó en `2024-01-01` (residuo de la recuperación del incidente del wrangler.toml) — el worker corría con runtime de 2024, incapaz de ejecutar Next 15.5. Los previews tenían la fecha correcta, lo que hizo que todo bisect por commit diera "verde" y despistara hacia el código.

**Diagnóstico**: comparar ambas configs — `GET /accounts/{account}/pages/projects/motos-max-cordialidad` → `deployment_configs.preview` vs `.production` (compatibility_date, compatibility_flags, env_vars).

**Acción**: `PATCH` al proyecto igualando production a preview (compatibility*date, `compatibility_flags:["nodejs_compat"]`, env vars `NEXT_PUBLIC*\*`), luego re-desplegar (`POST .../deployments -F branch=main`). El paso "Verify dynamic route" del CI existe precisamente para atrapar esto: un smoke test de rutas estáticas NO detecta un worker roto.

### E2E de Web fallan en bucle con "Demasiados intentos. Intenta de nuevo en 5 minutos."

**Causa**: `POST /api/auth/login` tiene throttle real de 5 intentos / 5 minutos por IP (ver [SECURITY.md](SECURITY.md#rate-limiting)). Cada spec de `apps/web/e2e/*.spec.ts` hace login real contra la API local — correr toda la suite varias veces seguidas (o en paralelo con varios workers) agota la cuota.

**Acción**: esperar a que expire la ventana (o hacer polling: `curl -X POST .../api/auth/login` hasta que deje de responder `429`) antes de reintentar. No es un bug de los tests; es el rate-limit funcionando como se diseñó.

### La app responde 429 con uso normal (o una pantalla deja de refrescarse sola)

**Síntoma**: peticiones rechazadas con `429` sin que nadie esté haciendo nada raro. La variante silenciosa es peor: la campana de notificaciones o una pantalla que se auto-refresca deja de actualizarse, sin error visible — un refresco en segundo plano que recibe `429` no tiene a nadie mirando.

**Causa habitual**: el techo horario de una ruta quedó por debajo del tráfico que el propio cliente genera. El frontend refresca varias pantallas por temporizador (`usePolling`), así que una pestaña abierta produce peticiones constantes sin intervención del usuario: a 30 s de intervalo son 120/hora **por pantalla**.

**Diagnóstico**:

```bash
# ¿Qué ruta está siendo limitada? El 429 responde con el header estándar
curl -i -H "Authorization: Bearer $TOKEN" https://motoworkshop-api.onrender.com/api/notifications/unread-count | head -12
```

**Acción**: no subir el número a ojo. El techo se deriva del intervalo del cliente en `apps/api/src/presentation/http/rate-limit.policy.ts`, y `rate-limit.policy.spec.ts` verifica en CI que ningún intervalo de `apps/web` se acerque al límite. Si una pantalla nueva empieza a hacer polling más rápido, ese test falla y señala el archivo: la corrección es ajustar el intervalo o el margen, en el mismo sitio donde vive la fórmula. Ver [ADR-012](ADR.md) y [SECURITY.md](SECURITY.md#rate-limiting).

**Nota sobre la clave**: el contador va por **usuario** en rutas autenticadas, no por IP, así que los empleados de un mismo taller no comparten cuota aunque salgan por el mismo router. Si aparecen `429` en rutas anónimas (login, forgot-password), ahí la clave sí es la IP y el límite estricto es intencional.

### Scheduler no ejecuta reportes

**Síntoma**: No se generan reportes semanales/mensuales.

**Diagnóstico**:

1. Verificar que `SCHEDULER_ENABLED=true` en Agents.
2. Verificar que el `SaasClient` puede conectarse a la API (revisar `API_BASE_URL` y `JWT_SECRET`).
3. Revisar logs de Agents en Render.

---

## Enlaces rápidos

| Recurso              | URL                                                |
| -------------------- | -------------------------------------------------- |
| API en producción    | `https://motoworkshop-api.onrender.com/api/health` |
| Web en producción    | `https://motos-max-cordialidad.pages.dev`          |
| Dashboard Render     | `https://dashboard.render.com`                     |
| Dashboard Cloudflare | `https://dash.cloudflare.com`                      |
| Sentry               | `https://sentry.io`                                |
| Neon Console         | `https://console.neon.tech`                        |
| Meta Business        | `https://business.facebook.com`                    |
| Resend Dashboard     | `https://resend.com/dashboard`                     |

### Tokens de recuperacion de contrasena acumulados

**Sintoma**: La tabla `PasswordResetToken` crece sin control o usuarios reportan que el link del email no funciona.

**Diagnostico**:

1. Revisar logs de la API: buscar `cleanup-expired-tokens: deleted N expired unused token(s)`.
2. El job `CleanupExpiredTokensJob` corre cada hora. Si no aparece en logs, verificar que `ScheduleModule.forRoot()` esta activo.

**Accion**: El job borra tokens donde `expiresAt < NOW() AND usedAt IS NULL`. Los tokens usados se preservan para auditoria.

---

## Recuperacion de contrasena - Arquitectura y operacion

### Flujo tecnico

```
Usuario -> POST /api/auth/forgot-password
         |
   [ForgotPasswordThrottlerGuard: 3 req/15min por IP+email]
         |
   ForgotPasswordUseCase:
     1. Busca usuario -> siempre responde HTTP 200 (anti-enumeracion)
     2. deleteMany tokens previos sin usar (usedAt IS NULL)
     3. Crea token: raw = randomBytes(32), hash = SHA-256(raw)
     4. Envia email via Resend con raw token

Usuario -> POST /api/auth/reset-password (desde link del email)
         |
   [ThrottlerGuard: 5 req/15min por IP]
         |
   ResetPasswordUseCase:
     1. hash = SHA-256(token recibido)
     2. findUnique(tokenHash) en DB
     3. Valida: existe + usedAt IS NULL + expiresAt > NOW()
        -> Cualquier fallo: HTTP 400 "Token invalido o expirado."
     4. transaction: actualiza passwordHash + marca usedAt = NOW()
     5. Envia email de confirmacion
```

### Rate limiting - Configuracion

| Tipo                                     | Limite          | Archivo para ajustar                                                                   |
| ---------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| Por IP+email (forgot-password)           | 3 req / 15 min  | `forgot-password-throttler.guard.ts` (guard dedicado, no usa `@Throttle`)              |
| Por IP (reset-password)                  | 5 req / 15 min  | `auth.controller.ts` - decorador `@Throttle` en `resetPassword()`                      |
| Por IP (login)                           | 5 req / 5 min   | `auth.controller.ts` - decorador `@Throttle` en `login()`                              |
| Por sujeto+ruta global - circuit breaker | 600 req / hora  | `app.module.ts` - throttler nombrado `hourly`; techo derivado del cliente, ver ADR-012 |
| Por sujeto+ruta global - ventana corta   | 60 req / minuto | `app.module.ts` - throttler nombrado `default`, clave en `GlobalThrottlerGuard`        |

### Cleanup job de tokens

| Parametro  | Valor                                             |
| ---------- | ------------------------------------------------- |
| Frecuencia | `EVERY_HOUR` (`@nestjs/schedule`)                 |
| Condicion  | `expiresAt < NOW() AND usedAt IS NULL`            |
| Preserva   | Tokens con `usedAt IS NOT NULL` (auditoria)       |
| Clase      | `CleanupExpiredTokensJob` en `identity.module.ts` |

### Troubleshooting de password recovery

**El email no llega**

1. Buscar en logs: `forgot-password: email sent to ...` o `SMTP FAILED for ...`.
2. Verificar `RESEND_API_KEY` en variables de entorno de Render.
3. Verificar `SMTP_FROM=onboarding@resend.dev` configurado.

**El link dice token invalido o expirado**

1. El token expira en 15 minutos. Si el usuario espero mas, debe solicitar uno nuevo.
2. Solo existe un token valido por usuario - solo el ultimo link solicitado funciona.

**Muchos usuarios bloqueados por rate limit (429)**

1. Limite es 3 intentos / 15 min por IP+email (forgot-password) o 5 intentos / 15 min por IP (reset-password).
2. Si es un proxy corporativo compartido, aumentar limite en `auth.controller.ts`.
3. Revisar Sentry para patrones de ataque.
