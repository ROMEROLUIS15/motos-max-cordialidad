// Frees the dev ports before starting servers, so a stale `next dev` or
// nest process never causes EADDRINUSE. Usage: node scripts/free-ports.mjs [ports...]
// Default ports: 3000 (web) and 3001 (api).
import { execSync } from 'node:child_process';

const ports = process.argv.slice(2).map(Number).filter(Boolean);
const targets = ports.length ? ports : [3000, 3001];

for (const port of targets) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano -p tcp`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .split(/\r?\n/)
        .filter((l) => l.includes(`:${port} `) && l.includes('LISTENING'));
      const pids = new Set(out.map((l) => l.trim().split(/\s+/).pop()));
      for (const pid of pids) {
        if (pid && pid !== '0') {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`[free-ports] killed PID ${pid} on port ${port}`);
        }
      }
    } else {
      execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, { stdio: 'ignore' });
    }
  } catch {
    // port already free — nothing to do
  }
}
