import { test, expect } from '@playwright/test';

test.describe('Comercial (smoke)', () => {
  test('exibe board comercial', async ({ page }) => {
    await page.goto('/comercial');
    await expect(page).toHaveURL(/\/comercial/);
    await expect(page.getByText(/board comercial/i)).toBeVisible();
  });

  test('arrasta card entre colunas no Kanban', async ({ page }) => {
    await page.goto('/comercial');
    await expect(page).toHaveURL(/\/comercial/);
    await expect(page.getByText(/board comercial/i)).toBeVisible();

    const firstCard = page.getByTestId(/^quote-card-/).first();
    const dragHandle = page.getByTestId(/^quote-card-drag-handle-/).first();
    const targetColumn = page.getByTestId('kanban-column-precificacao');

    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.hover();
    await expect(dragHandle).toBeVisible({ timeout: 3000 });

    const targetBox = await targetColumn.boundingBox();
    if (!targetBox) throw new Error('Target column not found');

    await dragHandle.hover();
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 15,
    });
    await page.mouse.up();

    await expect(page.getByText(/cotação movida/i)).toBeVisible({ timeout: 5000 });
  });
});
