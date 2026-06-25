# Required GitHub Secrets

## CI/CD Secrets

### Database
- `DATABASE_URL` — Neon PostgreSQL connection string (production)

### API Deployment
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages:Edit permission
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

### Frontend
- `NEXT_PUBLIC_API_URL` — Production API URL (e.g., https://api.motoworkshop.com)

## Setup Instructions

1. Go to GitHub repository Settings > Secrets and variables > Actions
2. Add each secret listed above
3. For Cloudflare Pages, connect the repository at dash.cloudflare.com/pages
   - Build command: `pnpm --filter @motoworkshop/web build`
   - Build output directory: `apps/web/.next`
   - Root directory: `/` (monorepo root)
