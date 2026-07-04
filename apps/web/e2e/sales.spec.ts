import { test, expect } from '@playwright/test';

// Flujo real contra la API local: login → registrar moto disponible → crear venta → confirmarla.
test('registra una moto y confirma una venta de contado', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@demo.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('Demo1234!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('http://localhost:3000/', { timeout: 60_000 });

  const suffix = Date.now();
  const customerName = `Cliente Venta E2E ${suffix}`;

  // 1) Registrar cliente para la venta
  await page.goto('/customers/new');
  await page.getByLabel('Nombre completo', { exact: true }).fill(customerName);
  await page.getByLabel('Número de documento', { exact: true }).fill(`VDOC${suffix}`);
  await page.getByLabel('Teléfono', { exact: true }).fill('+57 300 222 3344');
  await page.getByLabel('Ciudad', { exact: true }).fill('Medellín');
  await page.getByRole('button', { name: 'Registrar cliente' }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{6,}/, { timeout: 30_000 });

  // 2) Registrar una moto disponible para vender
  await page.goto('/sales');
  await page.getByRole('button', { name: 'Nueva moto' }).click();
  const vin = `VIN${suffix}`;
  await page.getByPlaceholder('VIN / Chasis', { exact: true }).fill(vin);
  await page.getByPlaceholder('Marca', { exact: true }).fill('Honda');
  await page.getByPlaceholder('Modelo', { exact: true }).fill('CB190R');
  await page.getByPlaceholder('Precio costo', { exact: true }).fill('6000000');
  await page.getByPlaceholder('Precio venta', { exact: true }).fill('8000000');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText(vin)).toBeVisible({ timeout: 15_000 });

  // 3) Crear la venta (borrador) eligiendo esa moto y ese cliente
  await page.goto('/sales/orders');
  await page.getByRole('button', { name: 'Nueva venta' }).click();

  const motoSelect = page.getByRole('combobox').filter({ hasText: 'Selecciona una moto' });
  const motoValue = await motoSelect.locator('option', { hasText: vin }).getAttribute('value');
  await motoSelect.selectOption(motoValue!);

  const customerSelect = page.getByRole('combobox').filter({ hasText: 'Selecciona un cliente' });
  const customerValue = await customerSelect
    .locator('option', { hasText: customerName })
    .getAttribute('value');
  await customerSelect.selectOption(customerValue!);

  await page.getByRole('button', { name: 'Crear venta' }).click();

  const row = page.getByRole('row', { name: new RegExp(vin) });
  await expect(row.getByText('Borrador')).toBeVisible({ timeout: 15_000 });

  // 4) Confirmarla
  await row.getByRole('button', { name: 'Confirmar' }).click();
  await expect(row.getByText('Confirmada')).toBeVisible({ timeout: 15_000 });
});
