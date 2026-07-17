import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLIENT_POLL_INTERVAL_MS,
  CLIENT_POLL_REQUESTS_PER_HOUR,
  RATE_LIMIT_PER_HOUR,
  RATE_LIMIT_PER_MINUTE,
} from './rate-limit.policy';

/**
 * Keeps the API's ceilings and the web client's polling in agreement.
 *
 * These two numbers live in different packages and neither imports the other
 * (the API's runtime image does not ship `packages/`, and the web bundle has no
 * reason to know about throttlers). Nothing else connects them, so this test
 * reads the intervals out of the web sources and fails when the pair stops
 * making sense. It is deliberately noisy: a background refresh that gets
 * throttled produces no error anyone sees — a stale badge, and nothing more.
 */
const WEB_SRC = join(__dirname, '../../../../web/src');

/** Every `usePolling(..., N)` and `POLL_MS = N` found in the web client. */
function pollingIntervalsMs(): Array<{ file: string; ms: number }> {
  const found: Array<{ file: string; ms: number }> = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'test') walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;

      const src = readFileSync(full, 'utf8');
      const constants = new Map<string, number>();
      for (const m of src.matchAll(/const\s+(\w*POLL\w*)\s*=\s*([\d_]+)/g)) {
        constants.set(m[1], Number(m[2].replace(/_/g, '')));
      }
      for (const m of src.matchAll(/usePolling\([^,]+,\s*([\w\d_]+)\s*\)/g)) {
        const raw = m[1];
        const ms = /^[\d_]+$/.test(raw) ? Number(raw.replace(/_/g, '')) : constants.get(raw);
        if (ms !== undefined) found.push({ file: full.replace(WEB_SRC, 'apps/web/src'), ms });
      }
    }
  };

  walk(WEB_SRC);
  return found;
}

describe('rate-limit policy vs. what the web client actually does', () => {
  const intervals = pollingIntervalsMs();

  it('finds the polling call sites (guards against a silent regex miss)', () => {
    // If this fails after a refactor, do not delete it: re-point the parser, or
    // the invariant below silently stops checking anything.
    expect(intervals.length).toBeGreaterThan(0);
  });

  it.each(pollingIntervalsMs())('$file polls within the hourly ceiling', ({ ms }) => {
    const requestsPerHour = 3_600_000 / ms;
    expect(requestsPerHour).toBeLessThan(RATE_LIMIT_PER_HOUR);
  });

  it.each(pollingIntervalsMs())('$file polls within the per-minute ceiling', ({ ms }) => {
    const requestsPerMinute = 60_000 / ms;
    expect(requestsPerMinute).toBeLessThan(RATE_LIMIT_PER_MINUTE);
  });

  it('derives the hourly ceiling from the fastest interval the client uses', () => {
    const fastest = Math.min(...intervals.map((i) => i.ms));
    expect(CLIENT_POLL_INTERVAL_MS).toBeLessThanOrEqual(fastest);
    expect(CLIENT_POLL_REQUESTS_PER_HOUR).toBe(120);
    expect(RATE_LIMIT_PER_HOUR).toBe(600);
  });

  it('leaves room for a user working on top of the polling', () => {
    const busiest = Math.max(...intervals.map((i) => 3_600_000 / i.ms));
    expect(RATE_LIMIT_PER_HOUR / busiest).toBeGreaterThanOrEqual(4);
  });
});
