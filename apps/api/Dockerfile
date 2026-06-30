# syntax=docker/dockerfile:1
# Debian-slim (glibc) so the native modules bcrypt + sharp use prebuilt
# binaries instead of compiling from source (alpine/musl would need a toolchain).
FROM node:22-slim AS base
# OpenSSL is required by the Prisma query engine at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate
WORKDIR /app

FROM base AS builder
# @prisma/client postinstall runs `prisma generate` during `pnpm install`.
# Provide a dummy URL so Prisma doesn't fail — the real URL is injected at runtime.
ARG DATABASE_URL="postgresql://x:x@localhost:5432/x"
ENV DATABASE_URL=${DATABASE_URL}
# Copy every workspace package.json first so `--frozen-lockfile` can validate
# the whole workspace, then install only the api subtree.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter "@motoworkshop/api..."
COPY apps/api/ ./apps/api/
RUN pnpm --filter @motoworkshop/api db:generate
RUN pnpm --filter @motoworkshop/api build
# Pre-compile the seed to plain JS (src/ is available here but not at runtime),
# preserving relative paths so dist-seed/prisma/seed.js can require its src import.
RUN cd apps/api && npx tsc prisma/seed.ts --outDir dist-seed --rootDir . \
  --module commonjs --target ES2021 --esModuleInterop --skipLibCheck \
  --moduleResolution node --resolveJsonModule

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist-seed ./apps/api/dist-seed
COPY --from=builder /app/packages ./packages
WORKDIR /app/apps/api
# Render injects PORT; the app reads process.env.PORT.
EXPOSE 3001
# exec-form: Docker runs `sh -c "..."` natively (no platform re-parsing).
# 1) apply migrations  2) seed demo data (best-effort, idempotent)  3) start.
CMD ["sh", "-c", "npx prisma migrate deploy && (node dist-seed/prisma/seed.js || echo 'seed skipped') && node dist/main"]
