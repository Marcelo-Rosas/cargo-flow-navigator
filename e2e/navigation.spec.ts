import { test, expect } from '@playwright/test';

test.describe('Navegação (autenticado)', () => {
  test('acessa dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\//);
    await expect(page.getByText(/visão geral do seu pipeline/i)).toBeVisible();
  });

  test('acessa comercial', async ({ page }) => {
    await page.goto('/comercial');
    await expect(page).toHaveURL(/\/comercial/);
    await expect(page.getByText(/board comercial/i)).toBeVisible();
  });

  test('acessa operacional', async ({ page }) => {
    await page.goto('/operacional');
    await expect(page).toHaveURL(/\/operacional/);
    await expect(page.getByText(/board operacional/i)).toBeVisible();
  });

  test('acessa financeiro e aba Fluxo de Caixa', async ({ page }) => {
    await page.goto('/financeiro');
    await expect(page).toHaveURL(/\/financeiro/);
    await page.getByRole('button', { name: /fluxo de caixa/i }).click();
    await expect(page.getByText(/contas a receber e a pagar/i)).toBeVisible();
  });
});
