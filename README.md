# MotoWorkshop SaaS

[![CI](https://github.com/ROMEROLUIS15/motos-max-cordialidad/actions/workflows/ci.yml/badge.svg)](https://github.com/ROMEROLUIS15/motos-max-cordialidad/actions/workflows/ci.yml)

SaaS multi-tenant para talleres de motocicletas, con asistencia de IA vía WhatsApp. Gestión de órdenes de trabajo, inventario, venta de motocicletas, CRM de clientes y comunicación conversacional, todo aislado por taller (tenant).

---

## Funcionalidades

- **Órdenes de trabajo** — recepción de vehículo, líneas de servicio, repuestos, evidencia fotográfica, máquina de estados (pendiente → en progreso → esperando repuestos → completada → entregada), historial completo por vehículo.
- **Inventario** — repuestos con stock por sucursal (físico / reservado / disponible), movimientos de entrada/salida/ajuste/transferencia, alertas de stock bajo.
- **Cotizaciones y pagos** — cotizaciones versionadas con aprobación del cliente, registro de pagos, generación de PDF.
- **Venta de motocicletas** — inventario de unidades (nuevas/usadas), órdenes de venta con plan de pago, contrato de compraventa en PDF, dashboard de ventas.
- **CRM de clientes** — historial de vehículos y órdenes por cliente, servicio a domicilio.
- **Asistente conversacional por WhatsApp** — atención automática a clientes (RouterAgent) y a la administración del taller (AgentAdmin), con reportes periódicos y alertas de stock generados por IA.
- **Multi-tenant** — aislamiento estricto por taller a nivel de datos y de roles/permisos, con auditoría de acciones.
- **PWA instalable**, tema claro/oscuro, notificaciones en tiempo real (WebSocket).

---

## Stack

| Capa                | Tecnología                                                     |
| ------------------- | -------------------------------------------------------------- |
| **API**             | NestJS 10 · TypeScript · Prisma ORM                            |
| **Web**             | Next.js 15.5 (App Router) · React 19 · Tailwind CSS · Radix UI |
| **Agentes IA**      | Python 3.12 · FastAPI · LangGraph · DeepSeek / Groq            |
| **Base de datos**   | PostgreSQL (Neon)                                              |
| **Cache / Cola**    | Redis (BullMQ + sesiones de agente)                            |
| **Storage**         | Cloudflare R2 (fotos, PDFs)                                    |
| **WhatsApp**        | Meta Cloud API (webhook + envío)                               |
| **Frontend deploy** | Cloudflare Pages                                               |
| **Backend deploy**  | Render (Docker)                                                |
| **Monitoreo**       | Sentry                                                         |

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

La API sigue arquitectura hexagonal (dominio → aplicación → infraestructura → presentación) con inyección de dependencias por puertos. El microservicio de agentes es un proceso Python independiente, comunicado con la API vía JWT de servicio de vida corta. Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el detalle completo.

Monorepo pnpm workspaces con 4 paquetes:

| Paquete                | Ruta              | Rol                              |
| ---------------------- | ----------------- | -------------------------------- |
| `@motoworkshop/api`    | `apps/api/`       | API REST NestJS (hexagonal)      |
| `@motoworkshop/web`    | `apps/web/`       | Frontend Next.js                 |
| `@motoworkshop/agents` | `apps/agents/`    | Microservicio Python (LangGraph) |
| `@motoworkshop/types`  | `packages/types/` | Tipos compartidos TS             |

---

## Estructura del proyecto

```
motos-max-cordialidad/              # Raíz del monorepo (pnpm workspaces)
├── apps/
│   ├── api/                        # @motoworkshop/api — NestJS REST API
│   │   └── src/
│   │       ├── domain/             # Entidades, value objects, repos, excepciones
│   │       ├── application/        # Casos de uso, puertos, servicios de app
│   │       ├── infrastructure/     # Prisma, auth, WhatsApp, storage, agentes, observabilidad
│   │       └── presentation/       # Controladores HTTP, DTOs, guards, filtros
│   ├── web/                        # @motoworkshop/web — Next.js App Router
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/         # Login, recuperación de contraseña
│   │       │   ├── (dashboard)/    # Rutas protegidas (work-orders, customers,
│   │       │   │                   #   inventory, sales, reports, users, etc.)
│   │       │   └── api/            # Route handlers de Next.js
│   │       ├── components/ui/      # Componentes Radix UI / shadcn reutilizables
│   │       ├── hooks/              # Custom React hooks
│   │       ├── lib/                # Helpers y utilidades de fetch
│   │       └── types/              # Tipos locales del frontend
│   └── agents/                     # @motoworkshop/agents — FastAPI + LangGraph
│       └── src/
│           ├── agents/             # Agentes LangGraph (admin/, shared/)
│           ├── api/                # Endpoints FastAPI expuestos a la API NestJS
│           ├── reports/            # Generación de PDFs y plantillas
│           ├── schedulers/         # Tareas programadas (reportes, alertas de stock)
│           └── tools/              # Herramientas que consumen los agentes
├── packages/
│   └── types/                      # @motoworkshop/types — tipos TypeScript compartidos
│       └── src/
├── docs/                           # Documentación técnica (ARCHITECTURE, RUNBOOK, ADR, SECURITY)
├── docker-compose.yml              # PostgreSQL + Redis para desarrollo local
├── render.yaml                     # Configuración de servicios en Render
├── pnpm-workspace.yaml             # Definición del monorepo pnpm
├── tsconfig.base.json              # tsconfig base compartida entre apps TS
└── package.json                    # Scripts raíz del monorepo
```

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

# 2. Configurar archivos de entorno
# Opción A: script automático (Windows)
setup-env.bat

# Opción B: script automático (Linux/Mac)
chmod +x setup-env.sh
./setup-env.sh

# Opción C: manual (copiar todos los archivos)
cp .env.local.example .env.local
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/agents/.env.example apps/agents/.env

# 3. Editar los archivos .env con tus credenciales
# - .env.local (configuración general)
# - apps/api/.env (API NestJS)
# - apps/web/.env.local (frontend Next.js)
# - apps/agents/.env (Python agents)

# 4. Instalar dependencias Node
# En Windows bcrypt requiere build tools; si falla usar --ignore-scripts:
pnpm install --ignore-scripts
# En macOS/Linux (o con build tools disponibles):
pnpm install

# 5. Python (agentes)
cd apps/agents
uv sync
cd ../..

# 6. Infraestructura local (Docker)
docker compose up -d

# 7. Base de datos
pnpm --filter @motoworkshop/api db:generate
pnpm --filter @motoworkshop/api db:migrate
pnpm --filter @motoworkshop/api db:seed
```

---

## Variables de entorno

| Variable                   | Descripción                                    | Obligatoria en producción  |
| -------------------------- | ---------------------------------------------- | -------------------------- |
| `DATABASE_URL`             | URL de conexión PostgreSQL (Neon)              | Sí                         |
| `REDIS_URL`                | URL de conexión Redis                          | Sí                         |
| `JWT_SECRET`               | Secreto para firmar JWT (≥ 32 chars)           | Sí                         |
| `JWT_EXPIRES_IN`           | Expiración del access token (ej. `15m`)        | No                         |
| `JWT_REFRESH_EXPIRES_IN`   | Expiración del refresh token                   | No                         |
| `ENCRYPTION_KEY`           | Clave AES-256-GCM en hex (64 chars)            | Sí                         |
| `R2_ACCOUNT_ID`            | ID de cuenta Cloudflare R2                     | Sí                         |
| `R2_ACCESS_KEY_ID`         | Access Key R2                                  | Sí                         |
| `R2_SECRET_ACCESS_KEY`     | Secret Key R2                                  | Sí                         |
| `R2_BUCKET_NAME`           | Nombre del bucket R2                           | Sí                         |
| `R2_PUBLIC_URL`            | URL pública del bucket R2                      | Sí                         |
| `WHATSAPP_PHONE_NUMBER_ID` | ID de número de teléfono WhatsApp Business     | Sí                         |
| `WHATSAPP_ACCESS_TOKEN`    | Token de acceso WhatsApp Cloud API             | Sí                         |
| `WHATSAPP_VERIFY_TOKEN`    | Token de verificación del webhook              | Sí                         |
| `WHATSAPP_APP_SECRET`      | App Secret de Meta                             | Sí                         |
| `RESEND_API_KEY`           | API Key de Resend (envío de correo)            | Sí                         |
| `DEEPSEEK_API_KEY`         | API Key de DeepSeek                            | Sí (al menos un proveedor) |
| `GROQ_API_KEY`             | API Key de Groq (fallback de LLM)              | No                         |
| `GROQ_MODEL`               | Modelo de Groq (default `openai/gpt-oss-120b`) | No                         |
| `SENTRY_DSN`               | DSN de Sentry                                  | No                         |
| `NODE_ENV`                 | `development` / `production`                   | Sí                         |
| `ALLOWED_ORIGINS`          | Orígenes CORS permitidos (separados por coma)  | Sí                         |
| `AGENTS_BASE_URL`          | URL del microservicio de agentes               | Sí                         |
| `API_BASE_URL`             | URL de la API, consumida por los agentes       | Sí                         |
| `SCHEDULER_ENABLED`        | Habilita el scheduler de reportes/alertas      | No                         |
| `TZ`                       | Zona horaria (ej. `America/Bogota`)            | No                         |

---

## Desarrollo local

```bash
# Levanta Docker (Postgres+Redis), libera puertos y arranca API+Web en paralelo
pnpm dev

# Apps individuales
pnpm dev:api     # API en http://localhost:3001
pnpm dev:web     # Web en http://localhost:3000

# Agentes Python
cd apps/agents
uv run uvicorn src.main:app --reload --port 8000
```

### Cuentas demo (tras `db:seed`)

| Correo               | Rol                           | Contraseña  |
| -------------------- | ----------------------------- | ----------- |
| `owner@demo.com`     | Propietario (acceso completo) | `Demo1234!` |
| `recepcion@demo.com` | Recepción (órdenes, clientes) | `Demo1234!` |
| `tecnico@demo.com`   | Técnico (órdenes asignadas)   | `Demo1234!` |

---

## Calidad

El repositorio tiene un pipeline de CI que bloquea el merge y el deploy hasta que todo pasa: typecheck, tests con piso de cobertura, lint, tests del microservicio Python, e2e de API y de Web, escaneo de secretos y auditoría de dependencias. Ver [docs/RUNBOOK.md](docs/RUNBOOK.md#pipeline-de-cicd) para el detalle completo del pipeline.

```bash
pnpm typecheck              # TypeScript (API + Web)
pnpm lint                   # ESLint (API + Web)
pnpm test                   # Tests (API Jest + Web Vitest)
pnpm -r test:ci             # Tests en modo CI (con cobertura)

# API — end-to-end contra Postgres/Redis reales
pnpm --filter @motoworkshop/api test:e2e

# Python
cd apps/agents
uv run ruff check src tests
uv run mypy src
uv run pytest
```

---

## Despliegue

Los tres servicios se despliegan únicamente cuando el pipeline de CI está en verde — no hay auto-deploy directo de Render ni de Cloudflare al hacer push. Ver [docs/RUNBOOK.md](docs/RUNBOOK.md) para el runbook completo de producción (variables por servicio, rollback, diagnóstico de incidentes).

| Servicio       | Proveedor        | Disparador                                           |
| -------------- | ---------------- | ---------------------------------------------------- |
| API NestJS     | Render (Docker)  | Orquestado desde CI tras checks verdes               |
| Agentes Python | Render (Docker)  | Orquestado desde CI, solo si cambió `apps/agents/**` |
| Web Next.js    | Cloudflare Pages | Orquestado desde CI (`wrangler` vía flags de CLI)    |
| Base de datos  | Neon             | PostgreSQL serverless                                |
| Storage        | Cloudflare R2    | S3-compatible                                        |

---

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md) — capas, módulos, sistema multi-agente, modelo de datos.
- [Runbook de producción](docs/RUNBOOK.md) — inventario de servicios, pipeline de CI/CD, rollback, diagnóstico de incidentes.
- [Decisiones técnicas (ADR)](docs/ADR.md) — contexto, alternativas y trade-offs de cada decisión de arquitectura.
- [Seguridad](docs/SECURITY.md) — autenticación, rate limiting, aislamiento multi-tenant, cifrado, riesgo de dependencias aceptado.

---

## Contribuir

`main` es la rama protegida: requiere pull request y que los checks del pipeline de CI pasen antes de mergear. No se hace force-push ni se saltan los hooks locales (pre-commit escanea secretos, pre-push corre typecheck y tests).

---

## Licencia

Uso interno. Todos los derechos reservados.
