import { test, expect } from '@playwright/test';

test.describe('Financeiro (smoke)', () => {
  test('exibe aba Receber', async ({ page }) => {
    await page.goto('/financeiro');
    await expect(page).toHaveURL(/\/financeiro/);
    await expect(page.getByText(/financeiro/i).first()).toBeVisible();
    await expect(page.getByText(/contas a receber e a pagar/i)).toBeVisible();
  });

  test('exibe aba Fluxo de Caixa ao clicar', async ({ page }) => {
    await page.goto('/financeiro');
    await page.getByRole('button', { name: /fluxo de caixa/i }).click();
    await expect(page.getByRole('button', { name: /fluxo de caixa/i })).toBeVisible();
  });
});
