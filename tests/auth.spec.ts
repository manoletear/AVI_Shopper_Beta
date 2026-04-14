import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('landing page has navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=AVI')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('a[href="/registro"]')).toBeVisible();
    await expect(page.locator('a[href="/demo"]')).toBeVisible();
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Inicia sesión en tu cuenta')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('a[href="/registro"]')).toBeVisible();
  });

  test('registro page renders correctly', async ({ page }) => {
    await page.goto('/registro');
    await expect(page.locator('text=Crea tu cuenta gratis')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'bad@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // NextAuth shows generic error on failed credentials
    await expect(page.locator('text=/error|Error|incorrecta|encontrado/i')).toBeVisible({ timeout: 10000 });
  });

  test('login with demo credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@avishopper.cl');
    await page.fill('input[type="password"]', 'demo123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await expect(page.locator('text=Hola')).toBeVisible();
  });

  test('protected routes redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test('demo page is accessible without auth', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.locator('text=AVI Shopper')).toBeVisible();
  });
});
