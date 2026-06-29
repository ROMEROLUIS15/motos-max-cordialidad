# MotoWorkshop SaaS

[![CI](https://github.com/ROMEROLUIS15/motos-max-cordialidad/actions/workflows/ci.yml/badge.svg)](https://github.com/ROMEROLUIS15/motos-max-cordialidad/actions/workflows/ci.yml)

SaaS multi-tenant para talleres de motos con asistencia de IA. Gestión de órdenes de trabajo, inventario, ventas de motos,CRM de clientes y comunicación vía WhatsApp.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| **API** | NestJS 11 · TypeScript · Prisma ORM |
| **Web** | Next.js 15.5 (App Router) · React 19 · Tailwind CSS · Radix UI |
| **Agentes IA** | Python 3.12 · FastAPI · LangGraph · DeepSeek / Groq |
| **Base de datos** | PostgreSQL (Neon) |
| **Cache / Cola** | Redis (BullMQ + sesiones agente) |
| **Storage** | Cloudflare R2 (fotos, PDFs) |
| **WhatsApp** | Meta Cloud API (webhook + envío) |
| **Frontend deploy** | Cloudflare Pages |
| **Backend deploy** | Render (Docker) |
| **Monitoreo** | Sentry |

---

## Arquitectura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser     │────▶│  Cloudflare      │────▶│  Render         │
│  (Next.js)  │     │  Pages (Next.js) │     │  NestJS API     │
└─────────────┘     └──────────────────┘     ─────┬──────────────┘
                                                  │
                    ┌──────────────────────────────┤
                    │                              │
                    ▼                              ▼
           ┌──────────────┐              ┌──────────────────┐
           │  Neon        │              │  Render          │
           │  PostgreSQL  │              │  FastAPI Agents  │
           └──────────────┘              └──────────────────┘
                    ▲                              │
                    │                              │
                    │                     ┌────────┴──────────┐
                    │                     │  Redis + R2       │
                    └─────────────────────┘                   │
                                                              │
                                                              ▼
                                                    ┌──────────────────┐
                                                    │  WhatsApp        │
                                                    │  Cloud API       │
                                                    └──────────────────┘
```

Monorepo pnpm workspaces con 4 paquetes:

| Paquete | Ruta | Rol |
|---------|------|-----|
| `@motoworkshop/api` | `apps/api/` | API REST NestJS (hexagonal) |
| `@motoworkshop/web` | `apps/web/` | Frontend Next.js |
| `@motoworkshop/agents` | `apps/agents/` | Microservicio Python (LangGraph) |
| `@motoworkshop/types` | `packages/types/` | Tipos compartidos TS |

---

## Prerrequisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`corepack enable && corepack prepare pnpm@9.14.4 --activate`)
- **Python** ≥ 3.12 + **uv** (`pip install uv`)
- **Docker** (opcional, para PostgreSQL + Redis local)
- **Git**

---

## Instalación

```bash
# 1. Clonar
git clone https://github.com/ROMEROLUIS15/motos-max-cordialidad.git
cd motos-max-cordialidad

# 2. Archivo de entorno
cp .env.local.example .env.local
# Editar .env.local con credenciales locales

# 3. Instalar dependencias Node
# En Windows bcrypt requiere build tools; si falla usar --ignore-scripts:
pnpm install --ignore-scripts
# Si estás en macOS/Linux o tienes build tools:
pnpm install

# 4. Python (agentes)
cd apps/agents
uv sync
cd ../..

# 5. Infraestructura local (Docker)
docker compose up -d

# 6. Base de datos
pnpm --filter @motoworkshop/api db:generate
pnpm --filter @motoworkshop/api db:migrate
pnpm --filter @motoworkshop/api db:seed
```

---

## Variables de entorno

| Variable | Descripción | Obligatoria en producción |
|----------|-------------|---------------------------|
| `DATABASE_URL` | URL de conexión PostgreSQL (Neon) | Sí |
| `REDIS_URL` | URL de conexión Redis | Sí |
| `JWT_SECRET` | Secreto para firmar JWT (≥ 32 chars) | Sí |
| `JWT_EXPIRES_IN` | Tiempo de expiración JWT (ej. `15m`) | No |
| `JWT_REFRESH_EXPIRES_IN` | Tiempo de expiración refresh token | No |
| `ENCRYPTION_KEY` | Clave AES-256-GCM en hex (64 chars) | Sí |
| `R2_ACCOUNT_ID` | ID de cuenta Cloudflare R2 | Sí |
| `R2_ACCESS_KEY_ID` | Access Key R2 | Sí |
| `R2_SECRET_ACCESS_KEY` | Secret Key R2 | Sí |
| `R2_BUCKET_NAME` | Nombre del bucket R2 | Sí |
| `R2_PUBLIC_URL` | URL pública del bucket R2 | Sí |
| `WHATSAPP_PHONE_NUMBER_ID` | ID de número de teléfono WhatsApp Business | Sí |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso WhatsApp Cloud API | Sí |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación webhook | Sí |
| `WHATSAPP_APP_SECRET` | App Secret de Meta | Sí |
| `DEEPSEEK_API_KEY` | API Key de DeepSeek | Sí (al menos un proveedor) |
| `GROQ_API_KEY` | API Key de Groq (fallback) | No |
| `SENTRY_DSN` | DSN de Sentry | No |
| `NODE_ENV` | `development` / `production` | Sí |
| `ALLOWED_ORIGINS` | Orígenes CORS (separados por coma) | Sí |
| `AGENTS_BASE_URL` | URL del microservicio de agentes | Sí |
| `API_BASE_URL` | URL de la API para los agentes | Sí |
| `SCHEDULER_ENABLED` | Habilitar scheduler de agentes | No |
| `TZ` | Zona horaria (ej. `America/Bogota`) | No |

---

## Desarrollo local

```bash
# Las 3 apps en paralelo
pnpm dev

# Apps individuales
pnpm dev:api     # API en http://localhost:3001
pnpm dev:web     # Web en http://localhost:3000

# Agentes Python
cd apps/agents
uv run uvicorn src.main:app --reload --port 8000
```

### Login demo

| Correo | Rol |
|--------|-----|
| `owner@demo.com` | Propietario (acceso completo) |
| `recepcion@demo.com` | Recepción (órdenes, clientes) |
| `tecnico@demo.com` | Técnico (órdenes asignadas) |

Contraseña: `password123`

---

## Calidad

```bash
pnpm typecheck              # TypeScript (API + Web)
pnpm lint                   # ESLint (API + Web)
pnpm test                   # Tests (API Jest + Web Vitest)
pnpm -r test:ci             # Tests en CI

# Python
cd apps/agents
uv run ruff check src tests
uv run mypy src
uv run pytest
```

---

## Despliegue

Ver [docs/RUNBOOK.md](docs/RUNBOOK.md) para el runbook de producción.

| Servicio | Proveedor | Método |
|----------|-----------|--------|
| API NestJS | Render | Dockerfile + auto-deploy desde `main` |
| Web Next.js | Cloudflare Pages | GitHub Action manual |
| Agentes Python | Render | Dockerfile + auto-deploy desde `main` |
| Base de datos | Neon | PostgreSQL serverless |
| Storage | Cloudflare R2 | S3-compatible |

---

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Runbook de producción](docs/RUNBOOK.md)
- [Decisiones técnicas (ADR)](docs/ADR.md)
- [Seguridad](docs/SECURITY.md)

---

## Licencia

Uso interno. Todos los derechos reservados.
