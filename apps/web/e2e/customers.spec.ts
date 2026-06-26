import { test, expect } from '@playwright/test';

// Flujo real contra la API (Render): login → registrar cliente → cerrar sesión.
test('login, registro de cliente y cierre de sesión', async ({ page }) => {
  test.setTimeout(90_000);

  // 1) Login
  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@demo.com');
  await page.getByLabel('Contraseña').fill('Demo1234!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('http://localhost:3000/', { timeout: 60_000 });

  // 2) Registrar un cliente con documento único
  const doc = `E2E${Date.now()}`;
  await page.goto('/customers/new');
  await page.getByLabel('Nombre completo', { exact: true }).fill('Cliente E2E');
  await page.getByLabel('Número de documento', { exact: true }).fill(doc);
  await page.getByLabel('Teléfono', { exact: true }).fill('+57 300 111 2233');
  await page.getByLabel('Ciudad', { exact: true }).fill('Barranquilla');
  await page.getByRole('button', { name: 'Registrar cliente' }).click();

  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{6,}/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Cliente E2E' })).toBeVisible();

  // 3) Cerrar sesión
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.waitForURL(/\/login/, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});
