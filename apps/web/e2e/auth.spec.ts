import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test('una visita sin sesión redirige al login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });

  test('el login muestra la marca y "Recordarme"', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Motos Max Cordialidad' })).toBeVisible();
    await expect(page.getByText('Recordarme en este equipo de confianza')).toBeVisible();
  });
});
