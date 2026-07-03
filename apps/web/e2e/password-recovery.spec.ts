import { test, expect, Page } from '@playwright/test';

/**
 * Playwright E2E tests for the password recovery UI flow.
 *
 * Covers:
 *   - forgot-password page: form render, validation, 429 UX, success state
 *   - reset-password page: Suspense load, strength indicator, complexity errors,
 *     toggle show/hide, 429 UX, success/error states, help link
 *   - help/FAQ page: headings, FAQ content, navigation links
 *
 * API calls are intercepted with page.route() mocks — the real backend is not needed.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

async function mockForgotPassword(page: Page, status: number, body: object) {
  await page.route('**/api/auth/forgot-password', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

async function mockResetPassword(page: Page, status: number, body: object) {
  await page.route('**/api/auth/reset-password', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

// ── Forgot Password Page ────────────────────────────────────────────────────

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');
  });

  test('renderiza el formulario correctamente', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Recuperar contraseña', level: 2 }),
    ).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#forgot-password-submit')).toBeVisible();
    await expect(page.getByRole('link', { name: /Volver al inicio de sesión/i })).toBeVisible();
  });

  test('valida email inválido con mensaje de error', async ({ page }) => {
    await page.locator('#email').fill('no-es-un-email');
    await page.locator('#forgot-password-submit').click();
    await expect(page.getByText('Email inválido')).toBeVisible();
  });

  test('muestra éxito con cualquier email (anti-enumeración)', async ({ page }) => {
    await mockForgotPassword(page, 200, {
      message: 'Si el email está registrado, recibirás un link de recuperación.',
    });
    await page.locator('#email').fill('cualquier@email.com');
    await page.locator('#forgot-password-submit').click();
    await expect(page.getByText(/Si existe una cuenta con ese email/i)).toBeVisible();
  });

  test('muestra alerta amber y deshabilita formulario cuando hay 429', async ({ page }) => {
    await mockForgotPassword(page, 429, {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiados intentos. Espera aproximadamente 60 minutos.',
    });
    await page.locator('#email').fill('test@test.com');
    await page.locator('#forgot-password-submit').click();

    // Amber warning visible
    await expect(page.getByText(/Demasiados intentos/i)).toBeVisible();

    // Button disabled
    await expect(page.locator('#forgot-password-submit')).toBeDisabled();

    // Input disabled
    await expect(page.locator('#email')).toBeDisabled();
  });

  test('el link "Volver al inicio de sesión" apunta a /login', async ({ page }) => {
    // Note: navigating to /login redirects via middleware — verify href instead
    await expect(
      page.getByRole('link', { name: /Volver al inicio de sesión/i }).first(),
    ).toHaveAttribute('href', '/login');
  });
});

// ── Reset Password Page ─────────────────────────────────────────────────────

test.describe('Reset Password Page', () => {
  const TOKEN = 'abc123testtoken';

  test.beforeEach(async ({ page }) => {
    await page.goto(`/reset-password?token=${TOKEN}`);
    // Wait for Suspense to resolve and form to be ready
    await page.waitForSelector('#password', { timeout: 15000 });
  });

  test('renderiza el formulario sin exponer el token en pantalla', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Restablecer contraseña', level: 2 }),
    ).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirm')).toBeVisible();
    // Security: the token must never be rendered in the page body
    await expect(page.locator('#token')).toHaveCount(0);
    await expect(page.locator('main, body')).not.toContainText(TOKEN);
  });

  test('envía el token de la URL en el POST sin mostrarlo', async ({ page }) => {
    let sentBody: { token?: string } = {};
    await page.route('**/api/auth/reset-password', async (route) => {
      sentBody = route.request().postDataJSON() as { token?: string };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'ok' }),
      });
    });
    await page.locator('#password').fill('StrongPass99');
    await page.locator('#confirm').fill('StrongPass99');
    await page.locator('#reset-password-submit').click();
    await expect(page.getByText(/Contrase.*restablecida con.*xito/i)).toBeVisible();
    expect(sentBody.token).toBe(TOKEN);
  });

  test('sin token en la URL muestra aviso de enlace inválido', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByTestId('missing-token')).toBeVisible();
    await expect(page.getByRole('link', { name: /Solicitar un nuevo enlace/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    await expect(page.locator('#password')).toHaveCount(0);
  });

  test('muestra indicador de fuerza al escribir la contraseña', async ({ page }) => {
    await page.locator('#password').fill('a');
    // strength indicator should appear
    await expect(page.locator('[role="status"]')).toBeVisible();
    // Should show 4 rules
    await expect(page.locator('[role="status"] li')).toHaveCount(4);
  });

  test('indicador pasa a verde cuando se cumplen todos los requisitos', async ({ page }) => {
    await page.locator('#password').fill('ValidPass9');
    const rules = page.locator('[role="status"] li');
    await expect(rules).toHaveCount(4);
    // All rules should be green
    for (const rule of await rules.all()) {
      await expect(rule).toHaveClass(/text-emerald-400/);
    }
  });

  test('rechaza contraseña sin número — Zod client-side', async ({ page }) => {
    await page.locator('#password').fill('NoNumbers!');
    await page.locator('#confirm').fill('NoNumbers!');
    await page.locator('#reset-password-submit').click();
    // Scope to the error paragraph to avoid strict-mode collision with strength indicator
    await expect(page.locator('p.text-destructive', { hasText: /n[uú]mero/i })).toBeVisible();
  });

  test('rechaza contraseña sin mayúscula — Zod client-side', async ({ page }) => {
    await page.locator('#password').fill('nouppercase1');
    await page.locator('#confirm').fill('nouppercase1');
    await page.locator('#reset-password-submit').click();
    // Scope to the error paragraph to avoid strict-mode collision with strength indicator
    await expect(page.locator('p.text-destructive', { hasText: /may[uú]scula/i })).toBeVisible();
  });

  test('muestra error cuando las contraseñas no coinciden', async ({ page }) => {
    await page.locator('#password').fill('StrongPass1');
    await page.locator('#confirm').fill('Diferente99');
    await page.locator('#reset-password-submit').click();
    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible();
  });

  test('muestra mensaje de éxito tras reset correcto', async ({ page }) => {
    await mockResetPassword(page, 200, { message: 'Contraseña actualizada exitosamente.' });
    await page.locator('#password').fill('StrongPass99');
    await page.locator('#confirm').fill('StrongPass99');
    await page.locator('#reset-password-submit').click();
    await expect(page.getByText(/Contrase.*restablecida con.*xito/i)).toBeVisible();
  });

  test('muestra error unificado para token inválido (400)', async ({ page }) => {
    await mockResetPassword(page, 400, { message: 'Token inválido o expirado.' });
    await page.locator('#password').fill('StrongPass99');
    await page.locator('#confirm').fill('StrongPass99');
    await page.locator('#reset-password-submit').click();
    await expect(page.getByText('Token inválido o expirado.')).toBeVisible();
  });

  test('muestra alerta amber y deshabilita botón cuando hay 429', async ({ page }) => {
    await mockResetPassword(page, 429, {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiados intentos. Espera aproximadamente 60 minutos.',
    });
    await page.locator('#password').fill('StrongPass99');
    await page.locator('#confirm').fill('StrongPass99');
    await page.locator('#reset-password-submit').click();

    await expect(page.getByText(/Demasiados intentos/i)).toBeVisible();
    await expect(page.locator('#reset-password-submit')).toBeDisabled();
  });

  test('el toggle muestra y oculta la contraseña', async ({ page }) => {
    const pwInput = page.locator('#password');
    await pwInput.fill('TestPass1');
    await expect(pwInput).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Mostrar contraseña' }).first().click();
    await expect(pwInput).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Ocultar contraseña' }).first().click();
    await expect(pwInput).toHaveAttribute('type', 'password');
  });

  test('muestra link a la página de ayuda', async ({ page }) => {
    await expect(page.getByTestId('help-link')).toBeVisible();
    await expect(page.getByTestId('help-link')).toHaveAttribute('href', '/reset-password/help');
  });
});

// ── Help / FAQ Page ─────────────────────────────────────────────────────────

test.describe('Password Recovery Help Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reset-password/help');
    await page.waitForLoadState('networkidle');
  });

  test('muestra el título correcto', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Ayuda — Recuperación de contraseña', level: 1 }),
    ).toBeVisible();
  });

  test('muestra la FAQ sobre requisitos de contraseña', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Por qué necesito/i })).toBeVisible();
  });

  test('muestra la FAQ sobre bloqueo por demasiados intentos', async ({ page }) => {
    // Actual FAQ text: "¿Por qué mi intento falló después de varios intentos?"
    await expect(page.getByRole('heading', { name: /intento fall/i })).toBeVisible();
  });

  test('muestra los 4 requisitos de contraseña en la lista', async ({ page }) => {
    await expect(page.getByText('Mínimo 8 caracteres')).toBeVisible();
    // Use exact li text to avoid strict-mode collision with paragraph text
    await expect(page.locator('li', { hasText: 'Al menos una letra mayúscula (A' })).toBeVisible();
    await expect(page.locator('li', { hasText: 'Al menos una letra minúscula' })).toBeVisible();
    await expect(page.locator('li', { hasText: 'Al menos un número' })).toBeVisible();
  });

  test('el link "Volver al inicio de sesión" navega al login', async ({ page }) => {
    await page.getByRole('link', { name: /Volver al inicio de sesión/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('el link "Solicitar un nuevo enlace" apunta al forgot-password', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Solicitar un nuevo enlace/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
