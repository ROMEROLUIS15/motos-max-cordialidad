import { test, expect } from '@playwright/test';

// Flujo real contra la API local: login → registrar repuesto → entrada de stock → stock disponible sube.
test('registra un repuesto y aplica una entrada de stock', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@demo.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('Demo1234!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('http://localhost:3000/', { timeout: 60_000 });

  await page.goto('/inventory');

  const sku = `SKU-E2E-${Date.now()}`;
  await page.getByRole('button', { name: 'Nuevo repuesto' }).click();
  await page.getByPlaceholder('SKU', { exact: true }).fill(sku);
  await page.getByPlaceholder('Nombre', { exact: true }).fill('Bujía E2E');
  await page.getByPlaceholder('Precio costo', { exact: true }).fill('5000');
  await page.getByPlaceholder('Precio venta', { exact: true }).fill('9000');
  await page.getByRole('button', { name: 'Crear' }).click();

  const row = page.getByRole('row', { name: new RegExp(sku) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText('0', { exact: true }).first()).toBeVisible();

  await row.getByRole('button', { name: 'Movimiento' }).click();
  await page.getByPlaceholder('Cantidad', { exact: true }).fill('10');
  await page.getByPlaceholder('Notas (opcional)', { exact: true }).fill('Entrada inicial E2E');
  await page.getByRole('button', { name: 'Confirmar' }).click();

  await expect(row.getByText('10', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
});
