# Runbook — MotoWorkshop SaaS

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
- `DEEPSEEK_API_KEY`, `GROQ_API_KEY`
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

El deploy de producción corre en el job `deploy-web` de `ci.yml`, gated por los mismos checks que el API, usando `cloudflare/wrangler-action@v4` con flags de CLI (`--project-name`, `--branch=main`):

```bash
cd apps/web
npx @cloudflare/next-on-pages@1   # build para el runtime de Cloudflare
wrangler pages deploy .vercel/output/static --project-name=... --branch=main
```

> **No crear `apps/web/wrangler.toml`.** `wrangler pages deploy` sincroniza cualquier `wrangler.toml` presente con la configuración del proyecto en el dashboard de Cloudflare — incluyendo `compatibility_flags` y `destination_dir`. Un archivo desactualizado sobreescribe esa configuración en cada deploy manual, aunque el archivo en sí parezca correcto (sus rutas son relativas a `apps/web/`, incompatibles con la integración Git que usa la raíz del repo como root). Todos los parámetros van por flags de CLI.

`.github/workflows/pages.yml` (`workflow_dispatch`, manual) queda como respaldo funcional si el job de CI necesita re-ejecutarse de forma aislada.

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

| Servicio      | Endpoint          | Respuesta esperada                                   |
| ------------- | ----------------- | ---------------------------------------------------- |
| API NestJS    | `GET /api/health` | `200 { "status": "ok" }`                             |
| Agents Python | `GET /health`     | `200 { "status": "ok", "redis": true, "api": true }` |

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
2. Verificar que `webhook` está configurado en Meta Business Dashboard apuntando a `https://motoworkshop-api.onrender.com/api/whatsapp/webhook`.
3. Revisar logs de API en Render.

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

| Tipo                               | Limite          | Archivo para ajustar                                                            |
| ---------------------------------- | --------------- | ------------------------------------------------------------------------------- |
| Por IP+email (forgot-password)     | 3 req / 15 min  | `forgot-password-throttler.guard.ts` (guard dedicado, no usa `@Throttle`)       |
| Por IP (reset-password)            | 5 req / 15 min  | `auth.controller.ts` - decorador `@Throttle` en `resetPassword()`               |
| Por IP (login)                     | 5 req / 5 min   | `auth.controller.ts` - decorador `@Throttle` en `login()`                       |
| Por IP global - circuit breaker    | 100 req / hora  | `app.module.ts` - throttler nombrado `hourly` en `ThrottlerModule.forRoot()`    |
| Por IP+ruta global - ventana corta | 60 req / minuto | `app.module.ts` - throttler nombrado `default`, clave en `GlobalThrottlerGuard` |

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
