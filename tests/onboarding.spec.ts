import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const password = 'onboarding123';
const shots = '/opt/cursor/artifacts/onboarding';

test.describe('Onboarding del hogar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('un usuario nuevo entra al onboarding y lo guardado queda en el hogar', async ({ page }) => {
    const email = `hogar.${Date.now()}@avishopper.cl`;
    await page.goto('/registro');
    await page.fill('input[type="text"]', 'Casa Nueva');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/onboarding', { timeout: 20000 });
    await expect(page.getByTestId('onboarding-title')).toHaveText('¿Dónde recibes?');
    mkdirSync(shots, { recursive: true });
    const shot = async (name: string) => {
      await page.getByTestId('onboarding-scroll').evaluate((node) => node.scrollTo(0, 0));
      await page.screenshot({ path: `${shots}/${name}.png` });
    };

    await page.getByPlaceholder('Los Leones').fill('Los Leones');
    await page.getByPlaceholder('123').fill('123');
    await page.getByPlaceholder('Depto 402').fill('Depto 4');
    await page.getByPlaceholder('Providencia').fill('Providencia');
    await page.getByRole('button', { name: 'Dejar en la puerta' }).click();
    await shot('01-direccion');
    await page.getByTestId('onboarding-continue').click();

    await expect(page.getByTestId('onboarding-title')).toHaveText('Tus tiendas');
    await page.getByRole('button', { name: 'Jumbo' }).click();
    await page.getByRole('button', { name: 'Unimarc' }).click();
    await page.getByRole('button', { name: 'Club Unimarc' }).click();
    await shot('02-tiendas');
    await page.getByTestId('onboarding-continue').click();

    for (const title of [
      '¿Para cuántos compras?',
      'Integrantes e invitaciones',
      'Alergias y restricciones',
      'Dieta y preferencias',
      'Mascotas',
      'Si un producto falta',
      'Ritmo de reposición',
    ]) {
      await expect(page.getByTestId('onboarding-title')).toHaveText(title);
      const file = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await shot(file);
      await page.getByTestId('onboarding-skip').click();
    }

    await expect(page.getByTestId('onboarding-title')).toHaveText('Presupuesto');
    await page.getByRole('button', { name: /3\.000/ }).click();
    await shot('10-presupuesto');
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByRole('button', { name: 'Ir al inicio' })).toBeVisible();

    const status = await page.evaluate(async () => {
      const response = await fetch('/api/onboarding');
      return response.json();
    });
    expect(status.success).toBe(true);
    expect(status.data.needsOnboarding).toBe(false);
    expect(status.data.address.street).toBe('Los Leones');
    expect(status.data.address.comuna).toBe('Providencia');
    expect(status.data.address.dropoff).toBe('door');
    expect(status.data.windows[0].day).toBe('sabado');
    expect(status.data.stores.find((store: { chain: string }) => store.chain === 'unimarc').loyaltyProgram).toBe('club_unimarc');
    expect(status.data.budget).toBe(3000);
    expect(status.data.proposeAlcohol).toBe(true);
    expect(status.data.steps.household).toBe('skipped');
    expect(status.data.approverRole).toBe('master');
    expect(status.data.elderWeight).toBe(0.8);

    await page.goto('/configuracion/hogar');
    await expect(page.getByText('Tamaño del hogar')).toBeVisible();
    await page.getByRole('link', { name: /Tamaño del hogar/ }).click();
    await page.waitForURL(/paso=household/);
    await page.getByRole('button', { name: '4', exact: true }).click();
    await page.getByTestId('onboarding-continue').click();
    await page.waitForURL('/configuracion/hogar');

    const updated = await page.evaluate(async () => {
      const response = await fetch('/api/onboarding');
      return response.json();
    });
    expect(updated.data.householdSize).toBe(4);
    expect(updated.data.steps.household).toBe('done');
  });
});
