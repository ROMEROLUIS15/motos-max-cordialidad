// One-command local dev: `pnpm dev`
// 1. Frees ports 3000 (web) / 3001 (api) — kills stale dev servers (EADDRINUSE).
// 2. Ensures Docker infra (Postgres 5433 + Redis 6379); on Windows it starts
//    Docker Desktop if the daemon is down.
// 3. Waits for Postgres health, then runs API (nest watch) + Web (next dev)
//    in parallel with streamed output.
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'pipe', ...opts }).toString();
const log = (msg) => console.log(`[dev] ${msg}`);

// ── 1. Free ports ───────────────────────────────────────────────────────────
execSync(`node scripts/free-ports.mjs 3000 3001`, { stdio: 'inherit' });

// ── 2. Docker infra ─────────────────────────────────────────────────────────
function dockerReady() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!dockerReady()) {
  const desktop = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
  if (process.platform === 'win32' && existsSync(desktop)) {
    log('Docker daemon apagado — iniciando Docker Desktop...');
    spawn(desktop, { detached: true, stdio: 'ignore' }).unref();
    const deadline = Date.now() + 150_000;
    while (Date.now() < deadline && !dockerReady()) {
      execSync(
        process.platform === 'win32' ? 'ping -n 6 127.0.0.1 > NUL' : 'sleep 5',
        { stdio: 'ignore', shell: true },
      );
    }
  }
  if (!dockerReady()) {
    console.error('[dev] ✘ Docker no está disponible. Inicia Docker Desktop y reintenta.');
    process.exit(1);
  }
}

log('Levantando Postgres + Redis (docker compose)...');
execSync('docker compose up -d postgres redis', { stdio: 'inherit' });

// Wait for Postgres to accept connections (healthcheck: pg_isready).
const deadline = Date.now() + 60_000;
let healthy = false;
while (Date.now() < deadline) {
  try {
    const status = run('docker inspect --format "{{.State.Health.Status}}" motoworkshop_postgres').trim();
    if (status === 'healthy') {
      healthy = true;
      break;
    }
  } catch {
    /* container still starting */
  }
  execSync(process.platform === 'win32' ? 'ping -n 3 127.0.0.1 > NUL' : 'sleep 2', {
    stdio: 'ignore',
    shell: true,
  });
}
log(healthy ? 'Postgres healthy ✔' : 'Postgres aún no reporta healthy — arrancando igual (Prisma reintenta)');

// ── 3. API + Web in parallel ────────────────────────────────────────────────
log('Arrancando API (3001) + Web (3000)...  Ctrl+C detiene ambos.');
const child = spawn('pnpm', ['-r', '--parallel', '--stream', 'dev'], {
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
