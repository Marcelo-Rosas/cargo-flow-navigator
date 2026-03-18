import { expect, test } from '@playwright/test';
import type { SeedResult } from '../seed/supabase-seed';
import { cleanupSeededData, setupSeededData } from '../seed/with-seed';

test.describe('Quote smoke (seeded real backend)', () => {
  // ✅ storageState dentro do describe para garantir aplicação correta
  test.use({ storageState: '.auth/user.json' });

  let seededData: SeedResult | null = null;

  test.beforeAll(async () => {
    seededData = await setupSeededData();
  });

  test.afterAll(async () => {
    if (seededData) {
      await cleanupSeededData(seededData.runId);
    }
  });

  test('dashboard comercial carrega sem passar pelo login', async ({ page }) => {
    await page.goto('/comercial');

    // ✅ Aguarda redirect de auth concluir antes de checar elementos
    await page.waitForURL('**/comercial', { timeout: 10_000 });

    await expect(page.getByRole('heading', { name: /Bem-vindo de volta/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /nova cotação/i })).toBeVisible();
  });

  test('detalhe da cotação seeded mostra aba Doc Fat', async ({ page }) => {
    if (!seededData) {
      throw new Error('Seeded data não foi inicializada');
    }

    await page.goto('/comercial');

    // ✅ Aguarda redirect de auth antes de procurar o card
    await page.waitForURL('**/comercial', { timeout: 10_000 });

    const card = page.getByTestId(`quote-card-${seededData.quoteId}`);

    // ✅ Timeout maior para o kanban carregar os cards via API
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    await expect(page.getByRole('tab', { name: /Doc Fat/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Histórico/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Pedágios/i })).toBeVisible();
  });
});
