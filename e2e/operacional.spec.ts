import { test, expect } from '@playwright/test';

test.describe('Operacional (smoke)', () => {
  test('exibe board operacional', async ({ page }) => {
    await page.goto('/operacional');
    await expect(page).toHaveURL(/\/operacional/);
    await expect(page.getByText(/board operacional/i)).toBeVisible();
  });
});
