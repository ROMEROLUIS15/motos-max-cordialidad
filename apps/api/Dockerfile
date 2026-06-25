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

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages ./packages
WORKDIR /app/apps/api
# Render injects PORT; the app reads process.env.PORT.
EXPOSE 3001
# exec-form: Docker runs `sh -c "..."` natively (no platform re-parsing).
# Apply pending migrations (idempotent) before starting the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
