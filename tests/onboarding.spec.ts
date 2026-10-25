import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const password = 'onboarding123';
const shots = '/opt/cursor/artifacts/onboarding';

test.describe('Onboarding básico', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('un usuario nuevo llega al primer carro y deja el perfil pendiente', async ({ page }) => {
    const email = `hogar.${Date.now()}@avishopper.cl`;
    await page.goto('/registro');
    await page.fill('input[type="text"]', 'Casa Nueva');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/onboarding', { timeout: 20000 });
    await expect(page.getByTestId('onboarding-title')).toHaveText('Dirección y acceso');
    mkdirSync(shots, { recursive: true });
    const shot = async (name: string) => {
      await page.getByTestId('onboarding-scroll').evaluate((node) => node.scrollTo(0, 0));
      await page.screenshot({ path: `${shots}/${name}.png` });
    };

    await page.getByPlaceholder('Los Leones').fill('Los Leones');
    await page.getByPlaceholder('123').fill('123');
    await page.getByPlaceholder('Providencia').fill('Providencia');
    await page.getByPlaceholder(/Timbre|Conserjería|Piso/).fill('Timbre blanco');
    await shot('01-direccion');
    await page.getByTestId('onboarding-continue').click();

    await expect(page.getByTestId('onboarding-title')).toHaveText('¿Cuántas personas?');
    await shot('02-personas');
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('onboarding-title')).toHaveText('¿Hay nana o asesora?');
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('onboarding-title')).toHaveText('Adultos y niños');
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('onboarding-title')).toHaveText('¿Cómo se llaman?');
    await page.getByPlaceholder('Nombre').nth(1).fill('Ana');
    await shot('03-hogar');
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('onboarding-title')).toHaveText('¿Mascotas?');
    await page.getByTestId('onboarding-continue').click();

    await expect(page.getByTestId('onboarding-title')).toHaveText('Alergias');
    await shot('04-alergias');
    await page.getByTestId('onboarding-continue').click();

    await expect(page.getByTestId('onboarding-title')).toHaveText('Tiendas');
    await shot('05-tiendas');
    await page.getByTestId('onboarding-continue').click();

    await expect(page.getByTestId('onboarding-title')).toHaveText('¿Quién aprueba el carro?');
    await shot('06-aprobador');
    await page.getByRole('button', { name: 'Guardar y armar el primer carro' }).click();
    await page.waitForURL('/cart-assistant', { timeout: 20000 });

    const status = await page.evaluate(async () => {
      const response = await fetch('/api/onboarding/basic');
      return response.json();
    });
    expect(status.success).toBe(true);
    expect(status.data.onboardingStep).toBe('basic_done');
    expect(status.data.substitutionMode).toBe('propose_approve');
    expect(status.data.needsOnboarding).toBe(false);
    expect(status.data.answers.address.street).toBe('Los Leones');
    expect(status.data.answers.address.comuna).toBe('Providencia');
    expect(status.data.answers.address.housingType).toBe('casa');
    expect(status.data.answers.stores.chains).toEqual(['jumbo', 'lider', 'unimarc', 'tottus']);
    expect(status.data.pendingProgressive).toContain('presupuesto');
    expect(status.data.pendingProgressive).toContain('sustitucion');
    expect(status.data.warnings).toEqual([]);

    await page.goto('/onboarding/perfil');
    await expect(page.getByRole('heading', { name: 'Tu perfil' })).toBeVisible();
    await expect(page.getByText('Presupuesto mensual')).toBeVisible();
    await expect(page.getByText('Proponer reemplazo y que yo apruebe')).toBeVisible();
    await shot('07-perfil');
  });
});
