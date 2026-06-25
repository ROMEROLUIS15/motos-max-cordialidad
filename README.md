# MotoWorkshop SaaS

Monorepo (pnpm workspaces) para gestión de talleres de motocicletas.

- **`apps/api`** — NestJS (arquitectura hexagonal) + Prisma + PostgreSQL
- **`apps/web`** — Next.js 14 (App Router) + Tailwind
- **`packages/types`** — tipos compartidos

Stack: NestJS · Next.js 14 · PostgreSQL (Neon) · Cloudflare R2 · Redis + BullMQ · @react-pdf/renderer · WhatsApp Cloud API · DeepSeek/Groq.

---

## Requisitos

- Node.js ≥ 20 (ver `.nvmrc`)
- pnpm ≥ 9 (`corepack enable`)
- Docker (para Redis local) — opcional
- PostgreSQL accesible (local o Neon)

## 1. Instalar dependencias

> ⚠️ En Windows, `pnpm install` puede fallar en los lifecycle scripts
> (`readStream must be readable`). Workaround:

```bash
pnpm install --ignore-scripts
```

Como consecuencia, el binario nativo de **bcrypt** no se compila. Recrearlo:

```bash
cd node_modules/.pnpm/bcrypt@*/node_modules/bcrypt
node ../../node_modules/@mapbox/node-pre-gyp/bin/node-pre-gyp install --fallback-to-build=false
cd -
```

## 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Rellena al menos:

| Variable | Para qué |
|----------|----------|
| `DATABASE_URL` | PostgreSQL/Neon (obligatoria) |
| `JWT_SECRET`, `ENCRYPTION_KEY` (hex 64) | Auth y cifrado |
| `REDIS_URL` | Cola WhatsApp (BullMQ) — opcional en dev |
| `R2_*` | Cloudflare R2 (fotos, PDFs, logo) |
| `WHATSAPP_*` | Meta WhatsApp Cloud API |
| `DEEPSEEK_API_KEY`, `GROQ_API_KEY` | RouterAgent de IA |
| `SENTRY_DSN` | Observabilidad (opcional) |

## 3. Redis (opcional, para la cola de WhatsApp)

```bash
docker-compose up -d redis
```

## 4. Base de datos

```bash
cd apps/api
npx prisma generate
npx prisma migrate dev      # aplica migraciones
npx prisma db seed          # datos demo (tenant + usuarios + catálogo)
```

**Login demo:** `owner@demo.com` / `Demo1234!` (también `recepcion@demo.com`, `tecnico@demo.com`).
El `tenantId` se imprime al final del seed (necesario para el login).

## 5. Ejecutar

```bash
# API (http://localhost:3001)
pnpm --filter @motoworkshop/api start:dev

# Web (http://localhost:3000)
pnpm --filter web dev
```

---

## Calidad

```bash
pnpm -r typecheck     # TypeScript
pnpm -r lint          # ESLint
pnpm -r test          # unit tests (Jest en api, Vitest en web)
```

- `GET /api/health` reporta el estado de los componentes (`ok` / `degraded`).

### Tests de integración (e2e)

Requieren una BD de pruebas. Con el Postgres de Docker (puerto **5433**):

```bash
docker compose up -d postgres
cd apps/api
export DB="postgresql://motoworkshop:motoworkshop@127.0.0.1:5433/motoworkshop_dev"
DATABASE_URL="$DB" npx prisma migrate deploy
DATABASE_URL="$DB" pnpm test:e2e
```

- `pnpm test:e2e` ya incluye `NODE_OPTIONS=--experimental-vm-modules` (necesario para el
  import dinámico de `@react-pdf/renderer` bajo Jest).
- El sub-test de cotización (genera y **sube un PDF a Cloudflare R2**) solo corre si además
  defines `R2_*`. Sin `R2_BUCKET_NAME` se salta automáticamente.

> ⚠️ En Windows, si tienes un Postgres nativo en 5432, Prisma se conecta a ese.
> Por eso el contenedor de pruebas publica el puerto **5433**.

## Módulos del API

`IdentityModule` · `CustomersModule` · `VehiclesModule` · `WorkshopModule` ·
`InventoryModule` · `CommerceModule` · `MessagingModule` · `AiModule` ·
`NotificationsModule` · `DashboardModule` · `AuditModule` · `SettingsModule` ·
`StorageModule`.

Convención de DI: los repositorios se inyectan por **Symbol token** + `@Inject(...)`
(las interfaces no se pueden inyectar por tipo en NestJS).
