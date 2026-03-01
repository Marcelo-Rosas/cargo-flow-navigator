import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test('exibe formulário de login', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
  });

  test('mostra erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel(/e-mail/i).fill('invalido@test.com');
    await page.getByLabel(/senha/i).fill('senhaerrada');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page.getByText(/incorretos/i)).toBeVisible();
  });
});
