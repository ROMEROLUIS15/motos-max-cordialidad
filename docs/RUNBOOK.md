# Runbook — MotoWorkshop SaaS

---

## Inventario de servicios (producción)

| Servicio | Proveedor | Plan | URL | Keep-alive |
|----------|-----------|------|-----|------------|
| **API (NestJS)** | Render | Free | `https://motoworkshop-api.onrender.com` | Cada 10 min |
| **Web (Next.js)** | Cloudflare Pages | Free | `https://motoworkshop-web.pages.dev` | — (edge) |
| **Agents (FastAPI)** | Render | Free | `https://motoworkshop-agents.onrender.com` | Cada 10 min |
| **Base de datos** | Neon | Free | (conexión vía DATABASE_URL) | — |
| **Redis** | <TBD> | <TBD> | (conexión vía REDIS_URL) | — |
| **Object Storage** | Cloudflare R2 | Free | (vía R2_PUBLIC_URL) | — |
| **Monitoreo** | Sentry | Free | `sentry.io` | — |

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

### API (NestJS) — Render

```yaml
# render.yaml (auto-generado)
service:
  name: motoworkshop-api
  type: web
  runtime: docker
  dockerfile: apps/api/Dockerfile
  dockerContext: .
  plan: free
  healthCheckPath: /api/health
  autoDeploy: true  # Se despliega automáticamente al hacer push a main
```

**Deploy manual**: `git push origin main` → Render detecta el cambio y redepliega.

**Build**: Docker multistage (instalación → build → copia artefactos → producción).

### Web (Next.js) — Cloudflare Pages

**Via GitHub Action**:

```bash
# .github/workflows/pages.yml (workflow_dispatch manual)
pnpm install
pnpm --filter @motoworkshop/web build
# Publica .next/ a Cloudflare Pages via cloudflare/pages-action
```

**Output dir**: `.next` (configurado en `wrangler.toml`).

### Agents (Python) — Render

```yaml
service:
  name: motoworkshop-agents
  type: web
  runtime: docker
  dockerfile: apps/agents/Dockerfile
  dockerContext: apps/agents
  plan: free
  healthCheckPath: /health
  autoDeploy: true
```

**Deploy manual**: `git push origin main` → Render redepliega automáticamente.

---

## Migraciones de base de datos

```bash
# Producción — ejecutar via GitHub Action (deploy.yml) o manual
pnpm --filter @motoworkshop/api db:migrate
# Internamente corre: npx prisma migrate deploy

# NUNCA usar en producción:
# ❌ npx prisma migrate dev  (resetearía datos)
# ❌ npx prisma db push       (saltaría validaciones)
```

La migración se ejecuta automáticamente al iniciar el contenedor de la API (`CMD` en Dockerfile ejecuta `prisma migrate deploy` antes de iniciar el servidor).

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

| Servicio | Endpoint | Respuesta esperada |
|----------|----------|--------------------|
| API NestJS | `GET /api/health` | `200 { "status": "ok", "timestamp": "..." }` |
| Agents Python | `GET /health` | `200 { "status": "healthy", "redis": true, "saas": true }` |

Render usa estos endpoints para determinar si el servicio está vivo.

---

## Monitoreo

- **Sentry**: Captura errores no manejados en API (NestJS filtro global) y Agents (Sentry SDK).
- **Logs**: Render dashboard > servicio > **Logs**.
- **Keep-alive**: GitHub Action cada 10 minutos previene que los servicios free de Render entren en sleep.

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

| Recurso | URL |
|---------|-----|
| API en producción | `https://motoworkshop-api.onrender.com/api/health` |
| Web en producción | `https://motoworkshop-web.pages.dev` |
| Dashboard Render | `https://dashboard.render.com` |
| Dashboard Cloudflare | `https://dash.cloudflare.com` |
| Sentry | `https://sentry.io` |
| Neon Console | `https://console.neon.tech` |
| Meta Business | `https://business.facebook.com` |
