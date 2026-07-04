import { test, expect } from '@playwright/test';

// Flujo real contra la API local: login → nueva orden (cliente nuevo + moto nueva) → mecánico → guardar.
test('crea una orden nueva con cliente y moto nuevos', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@demo.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('Demo1234!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('http://localhost:3000/', { timeout: 60_000 });

  await page.goto('/receptions/new');

  const suffix = Date.now();
  await page.getByRole('button', { name: 'Cliente nuevo' }).click();
  await page
    .getByPlaceholder('Nombre completo', { exact: true })
    .fill(`Cliente Orden E2E ${suffix}`);
  await page.getByPlaceholder('Documento', { exact: true }).fill(`DOC${suffix}`);
  await page.getByPlaceholder('Teléfono', { exact: true }).fill('3001234567');
  await page.getByPlaceholder('Ciudad', { exact: true }).fill('Bogotá');

  await page.getByRole('button', { name: 'Agregar moto nueva' }).click();
  await page.getByPlaceholder('Marca', { exact: true }).fill('Yamaha');
  await page.getByPlaceholder('Modelo', { exact: true }).fill('FZ');
  await page.getByPlaceholder('Placa', { exact: true }).fill(`E2E${suffix}`);
  await page.getByPlaceholder('Color', { exact: true }).fill('Rojo');
  await page.getByPlaceholder('N° motor', { exact: true }).fill(`ENG${suffix}`);

  await page.getByLabel('Mecánico que atiende').selectOption({ label: 'Tomás Técnico' });

  await page.getByRole('button', { name: 'Guardar orden' }).click();

  await expect(page).toHaveURL(/\/work-orders\/[0-9a-f-]{6,}/, { timeout: 30_000 });
  await expect(page.getByText(/E2E\d+/)).toBeVisible();
});
