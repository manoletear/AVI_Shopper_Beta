import { test, expect } from '@playwright/test';

test.describe('Public Pages', () => {
  test('landing page shows AVI branding and CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('img[alt="AVI"]').first()).toBeVisible();
    await expect(page.locator('text=/Compara precios/i').first()).toBeVisible();
    await expect(page.locator('a[href="/registro"]').first()).toBeVisible();
  });

  test('recuperar password page renders', async ({ page }) => {
    await page.goto('/recuperar');
    await expect(page.locator('text=/Recuperar/i')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('privacidad page is accessible', async ({ page }) => {
    await page.goto('/privacidad');
    await expect(page.locator('text=/privacidad/i').first()).toBeVisible();
  });
});

test.describe('Protected Pages (redirect to login)', () => {
  const protectedRoutes = [
    '/dashboard',
    '/listas',
    '/comparar',
    '/avi',
    '/perfil',
    '/familia',
    '/presupuesto',
    '/salud',
    '/reposicion',
    '/historial',
    '/configuracion/cuentas',
    '/configuracion/pagos',
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/login/, { timeout: 10000 });
    });
  }
});

test.describe('Dashboard (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@avishopper.cl');
    await page.fill('input[type="password"]', 'demo123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 15000 });
  });

  test('shows greeting and stats', async ({ page }) => {
    await expect(page.locator('text=/Buenos|Buenas/i')).toBeVisible();
  });

  test('category icons are visible', async ({ page }) => {
    await expect(page.locator('text=Mejor Precio').first()).toBeVisible();
    await expect(page.locator('text=Listas').first()).toBeVisible();
    await expect(page.locator('text=Salud').first()).toBeVisible();
  });

  test('AVI search bar links to cart-assistant', async ({ page }) => {
    await expect(page.locator('text=/Habla con AVI/i')).toBeVisible();
  });

  test('comparar page loads', async ({ page }) => {
    await page.goto('/comparar');
    await expect(page.locator('text=/Que necesitas comprar/i')).toBeVisible();
  });

  test('listas page loads', async ({ page }) => {
    await page.goto('/listas');
    await expect(page.locator('text=/Mis Listas/i')).toBeVisible();
  });

  test('perfil page loads', async ({ page }) => {
    await page.goto('/perfil');
    await expect(page.locator('text=/Perfil/i').first()).toBeVisible();
  });
});
