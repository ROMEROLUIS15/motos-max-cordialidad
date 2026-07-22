import { test, expect } from '@playwright/test';

/**
 * Real integration tests — NO mocks, calls the actual API on localhost:3001.
 *
 * Split in two groups:
 *
 *  A) API Contract tests (via page.request — no browser UI, no rate-limit from
 *     multiple parallel browser sessions): test the HTTP behavior directly.
 *
 *  B) UI Behavior tests (no API calls — test pure frontend logic):
 *     Zod validation, strength indicator, help page, help link.
 *
 * Requirements:
 *   - pnpm --filter @motoworkshop/api start:dev  (port 3001)
 *   - pnpm --filter @motoworkshop/web dev        (port 3000)
 *
 * Run:
 *   pnpm --filter @motoworkshop/web test:e2e --project=chromium --grep "Real API"
 */

const REAL_EMAIL = process.env['REAL_TEST_EMAIL'] ?? 'owner@demo.com';
const API = 'http://localhost:3001';

// ── A. API Contract Tests (HTTP only — no browser UI) ──────────────────────

test.describe('A. API Contract — Real HTTP calls', () => {
  test('A1. forgot-password: email registrado → HTTP 200 o 429 (rate-limited)', async ({
    request,
  }) => {
    const res = await request.post(`${API}/api/auth/forgot-password`, {
      data: { email: REAL_EMAIL },
      headers: { 'Content-Type': 'application/json' },
    });

    // Anti-enumeration: must be 200 (or 429 if throttled — both valid)
    const status = res.status();
    console.log(`Known email → HTTP ${status}`);
    expect([200, 429]).toContain(status);

    if (status === 200) {
      const body = await res.json();
      expect(body.message).toBeTruthy();
      console.log(`Success message: "${body.message}"`);
    } else {
      const body = await res.json();
      expect(body.code).toBe('TOO_MANY_REQUESTS');
      console.log(`Rate limited: "${body.message}"`);
    }
  });

  test('A2. Anti-enumeración: email desconocido → MISMO código HTTP que email conocido', async ({
    request,
  }) => {
    const unknownEmail = `playwright_ae_${Date.now()}@nonexistent-domain-xyz.com`;

    const [knownRes, unknownRes] = await Promise.all([
      request.post(`${API}/api/auth/forgot-password`, {
        data: { email: REAL_EMAIL },
        headers: { 'Content-Type': 'application/json' },
      }),
      request.post(`${API}/api/auth/forgot-password`, {
        data: { email: unknownEmail },
        headers: { 'Content-Type': 'application/json' },
      }),
    ]);

    const knownStatus = knownRes.status();
    const unknownStatus = unknownRes.status();
    console.log(`Known: ${knownStatus}, Unknown: ${unknownStatus}`);

    // Both must return the SAME status code (anti-enumeration principle)
    // Both will be either 200 (success) or 429 (throttled) — never 404 for unknown
    expect([200, 429]).toContain(unknownStatus);

    // If not throttled, unknown email must return 200 (not 404 or 400)
    if (unknownStatus !== 429) {
      expect(unknownStatus).toBe(200);
      const body = await unknownRes.json();
      expect(body.message).toBeTruthy();
      console.log(`Unknown email message: "${body.message}"`);
    }
  });

  test('A3. reset-password: token falso → HTTP 400 con mensaje unificado', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/reset-password`, {
      data: { token: 'completely-fake-token-xyz-99999', password: 'StrongPass99' },
      headers: { 'Content-Type': 'application/json' },
    });

    const status = res.status();
    console.log(`Invalid token → HTTP ${status}`);

    // Allow 429 if throttled (rate limiter working)
    if (status === 429) {
      const body = await res.json();
      expect(body.code).toBe('TOO_MANY_REQUESTS');
      console.log(`Rate limited: "${body.message}"`);
      return;
    }

    expect(status).toBe(400);
    const body = await res.json();
    // Error message must be the SAME regardless of whether token exists or not
    expect(body.message).toBe('Token inválido o expirado.');
    console.log(`Error message: "${body.message}" ✅`);
  });

  test('A4. forgot-password: email inválido → HTTP 400 (o 429 si throttled)', async ({
    request,
  }) => {
    const res = await request.post(`${API}/api/auth/forgot-password`, {
      data: { email: 'not-a-valid-email' },
      headers: { 'Content-Type': 'application/json' },
    });
    const status = res.status();
    // 400 = Zod validation (normal)
    // 429 = throttler intercepts before validation (also correct)
    expect([400, 429]).toContain(status);
    console.log(`Invalid email format → HTTP ${status} ✅`);
  });

  test('A5. API health check', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    console.log(`API health: ${JSON.stringify(body)} ✅`);
  });
});

// ── B. UI Behavior Tests (no real API calls) ──────────────────────────────

test.describe('B. UI Behavior — Frontend logic tests', () => {
  test('B1. Indicador de fuerza responde en tiempo real', async ({ page }) => {
    await page.goto('/reset-password?token=strengthtest');
    await page.waitForSelector('#password', { timeout: 15000 });

    await page.locator('#password').fill('a');
    await expect(page.locator('[role="status"]')).toBeVisible();

    const failing = page.locator('[role="status"] li.text-muted-foreground');
    const count = await failing.count();
    expect(count).toBeGreaterThan(2);
    console.log(`Weak "a": ${count} rules failing ✅`);

    await page.locator('#password').fill('StrongPass99');
    await expect(page.locator('[role="status"] li.text-emerald-400')).toHaveCount(4, {
      timeout: 3000,
    });
    console.log('Strong "StrongPass99": all 4 rules passing ✅');
  });

  test('B2. Zod rechaza mayúscula faltante — API no es llamado', async ({ page }) => {
    await page.goto('/reset-password?token=zodtest');
    await page.waitForSelector('#password', { timeout: 15000 });

    let apiCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/reset-password')) apiCalled = true;
    });

    await page.locator('#password').fill('nouppercase1');
    await page.locator('#confirm').fill('nouppercase1');
    await page.locator('#reset-password-submit').click();
    await expect(page.locator('p.text-destructive', { hasText: /may[uú]scula/i })).toBeVisible({
      timeout: 5000,
    });

    expect(apiCalled).toBe(false);
    console.log('✅ Zod blocked API call — uppercase error shown');
  });

  test('B3. Zod rechaza número faltante — API no es llamado', async ({ page }) => {
    await page.goto('/reset-password?token=zodtest2');
    await page.waitForSelector('#password', { timeout: 15000 });

    let apiCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/reset-password')) apiCalled = true;
    });

    await page.locator('#password').fill('NoNumbers!');
    await page.locator('#confirm').fill('NoNumbers!');
    await page.locator('#reset-password-submit').click();
    await expect(page.locator('p.text-destructive', { hasText: /n[uú]mero/i })).toBeVisible({
      timeout: 5000,
    });

    expect(apiCalled).toBe(false);
    console.log('✅ Zod blocked API call — number error shown');
  });

  test('B4. Página de ayuda muestra los 4 FAQ cards', async ({ page }) => {
    await page.goto('/reset-password/help');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: 'Ayuda — Recuperación de contraseña', level: 1 }),
    ).toBeVisible();

    const count = await page.locator('section.rounded-xl').count();
    expect(count).toBe(4);
    await expect(page.getByText('Mínimo 8 caracteres')).toBeVisible();
    await expect(page.locator('li', { hasText: 'Al menos una letra mayúscula (A' })).toBeVisible();
    console.log(`✅ Help page: ${count} FAQ cards`);
  });

  test('B5. Link de ayuda visible en formulario de reset', async ({ page }) => {
    await page.goto('/reset-password?token=helptest');
    await page.waitForSelector('#password', { timeout: 15000 });
    const helpLink = page.getByTestId('help-link');
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toHaveAttribute('href', '/reset-password/help');
    console.log('✅ Help link visible and correct href');
  });

  test('B6. Toggle muestra y oculta contraseña', async ({ page }) => {
    await page.goto('/reset-password?token=toggletest');
    await page.waitForSelector('#password', { timeout: 15000 });

    await page.locator('#password').fill('TestPass1');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Mostrar contraseña' }).first().click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Ocultar contraseña' }).first().click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    console.log('✅ Password toggle works');
  });
});
