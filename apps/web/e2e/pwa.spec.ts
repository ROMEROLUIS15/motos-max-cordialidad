import { test, expect } from '@playwright/test';

test.describe('PWA — instalabilidad y offline', () => {
  test('el manifest se sirve y es válido', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const m = await res.json();
    expect(m.name).toBe('Motos Max Cordialidad');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(Array.isArray(m.icons)).toBeTruthy();
    expect(m.icons.length).toBeGreaterThan(0);
    expect(m.icons.some((i: { purpose?: string }) => i.purpose?.includes('maskable'))).toBeTruthy();
  });

  test('el manifest está enlazado en el head', async ({ page }) => {
    await page.goto('/login');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toContain('manifest.webmanifest');
  });

  test('el service worker se sirve', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBeTruthy();
    expect(await res.text()).toContain('addEventListener');
  });

  test('los iconos se sirven', async ({ request }) => {
    for (const p of [
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/maskable-512.png',
      '/icons/apple-touch-icon.png',
    ]) {
      const res = await request.get(p);
      expect(res.ok(), `${p} debe servirse`).toBeTruthy();
    }
  });

  test('la página offline renderiza', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
  });
});
