/**
 * Kanban Drag-and-Drop usability tests
 *
 * Run against local dev server:
 *   npm run dev  (em outra aba)
 *   PW_BASE_URL=http://localhost:8080 npx playwright test kanban-dnd --project=chromium-mocks --headed
 *
 * Ou contra produção (sem mudanças locais visíveis):
 *   npx playwright test kanban-dnd --project=chromium-mocks
 */
import { expect, Locator, Page, test } from '@playwright/test';
import {
  injectFakeSession,
  loadFixture,
  mockAuthUserRoute,
  mockCurrentUserProfileRoute,
  mockQuotesRoute,
  registerFallbackRoutes,
} from './supabase-mocks';

const quotesFixture: unknown[] = loadFixture('quotes_kanban_dnd.json');
const updateOkFixture = loadFixture('quote_update_ok.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulates a pointer drag compatible with dnd-kit's PointerSensor.
 * Uses gradual steps to trigger activation (distance: 8) and allow
 * collision detection to settle at the target.
 */
async function dragFromTo(page: Page, source: Locator, target: Locator) {
  const sourceBB = await source.boundingBox();
  const targetBB = await target.boundingBox();
  if (!sourceBB || !targetBB) throw new Error('Bounding box not found for drag source or target');

  const sx = sourceBB.x + sourceBB.width / 2;
  const sy = sourceBB.y + sourceBB.height / 2;
  const tx = targetBB.x + targetBB.width / 2;
  const ty = targetBB.y + targetBB.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Small initial movement to exceed the activation distance threshold (8px)
  await page.mouse.move(sx, sy + 12, { steps: 4 });
  // Slide to target with enough steps for collision detection to fire
  await page.mouse.move(tx, ty, { steps: 30 });
  await page.mouse.up();
}

async function setupMocks(page: Page) {
  // Inject fake session before goto (runs as addInitScript in page context)
  await injectFakeSession(page);

  // Playwright calls the LAST registered matching handler first.
  // Register fallback first so specific mocks registered below take priority.
  await registerFallbackRoutes(page);
  await mockAuthUserRoute(page);
  await mockCurrentUserProfileRoute(page, 'admin');
  await mockQuotesRoute(page, quotesFixture, updateOkFixture);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Kanban DnD — Board Comercial', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/comercial');
    // Wait for board + first card — session inject + data load can take a moment
    await expect(page.getByTestId('kanban-column-novo_pedido')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('quote-card-dnd-quote-a')).toBeVisible({ timeout: 5000 });
  });

  test('cards são renderizados na coluna correta', async ({ page }) => {
    const novoPedidoCol = page.getByTestId('kanban-column-novo_pedido');
    const qualificacaoCol = page.getByTestId('kanban-column-qualificacao');

    // Alpha e Beta devem estar em novo_pedido
    await expect(novoPedidoCol.getByTestId('quote-card-dnd-quote-a')).toBeVisible();
    await expect(novoPedidoCol.getByTestId('quote-card-dnd-quote-b')).toBeVisible();

    // Gamma deve estar em qualificação
    await expect(qualificacaoCol.getByTestId('quote-card-dnd-quote-c')).toBeVisible();
  });

  test('arrastar card entre colunas: preview visual imediato (overStage)', async ({ page }) => {
    const dragHandle = page.getByTestId('quote-card-drag-handle-dnd-quote-a');
    const targetCol = page.getByTestId('kanban-column-qualificacao');

    const sourceBB = await dragHandle.boundingBox();
    const targetBB = await targetCol.boundingBox();
    if (!sourceBB || !targetBB) throw new Error('Bounding box not found');

    const sx = sourceBB.x + sourceBB.width / 2;
    const sy = sourceBB.y + sourceBB.height / 2;
    const tx = targetBB.x + targetBB.width / 2;
    const ty = targetBB.y + targetBB.height / 2;

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx, sy + 12, { steps: 4 });
    await page.mouse.move(tx, ty, { steps: 30 });

    // Enquanto o mouse ainda está pressionado, o card deve aparecer na coluna destino (overStage)
    await expect(targetCol.getByTestId('quote-card-dnd-quote-a')).toBeVisible();

    await page.mouse.up();
  });

  test('arrastar card de novo_pedido para qualificacao persiste via PATCH', async ({ page }) => {
    // Responde PATCH com sucesso (mock pode já estar tratando; garantir 200 se nossa rota rodar)
    await page.route('**/rest/v1/quotes**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateOkFixture),
        });
        return;
      }
      await route.continue();
    });

    const dragHandle = page.getByTestId('quote-card-drag-handle-dnd-quote-a');
    const targetCol = page.getByTestId('kanban-column-qualificacao');

    await dragFromTo(page, dragHandle, targetCol);

    const patchRequest = await page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes('/quotes')
    );
    const patchBody = JSON.parse(patchRequest.postData() ?? '{}') as { stage?: string };
    expect(patchBody.stage).toBe('qualificacao');
  });

  test('arrastar card sobre outro card em coluna diferente move para a coluna do card alvo', async ({
    page,
  }) => {
    await page.route('**/rest/v1/quotes**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateOkFixture),
        });
        return;
      }
      await route.continue();
    });

    const dragHandle = page.getByTestId('quote-card-drag-handle-dnd-quote-a');
    const targetCard = page.getByTestId('quote-card-dnd-quote-c'); // está em qualificacao

    await dragFromTo(page, dragHandle, targetCard);

    const patchRequest = await page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes('/quotes')
    );
    const patchBody = JSON.parse(patchRequest.postData() ?? '{}') as { stage?: string };
    expect(patchBody.stage).toBe('qualificacao');
  });

  test('drag sem mover para coluna diferente não dispara PATCH', async ({ page }) => {
    let patchCalled = false;
    await page.route('**/rest/v1/quotes**', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true;
      }
      await route.continue();
    });

    // Drag e soltar na mesma coluna (novo_pedido)
    const dragHandle = page.getByTestId('quote-card-drag-handle-dnd-quote-a');
    const targetCard = page.getByTestId('quote-card-dnd-quote-b'); // também em novo_pedido

    await dragFromTo(page, dragHandle, targetCard);

    // Aguarda um tempo razoável para garantir que nenhum PATCH foi chamado
    await page.waitForTimeout(500);
    expect(patchCalled).toBe(false);
  });

  test.skip('drag de card para coluna "ganho" abre modal de conversão (não faz PATCH direto)', async ({
    page,
  }) => {
    let patchCalled = false;
    await page.route('**/rest/v1/quotes**', async (route) => {
      if (route.request().method() === 'PATCH') patchCalled = true;
      await route.continue();
    });

    const dragHandle = page.getByTestId('quote-card-drag-handle-dnd-quote-a');
    const ganhoCol = page.getByTestId('kanban-column-ganho');

    await dragFromTo(page, dragHandle, ganhoCol);

    // O modal de conversão deve aparecer
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    expect(patchCalled).toBe(false);
  });

  test('rollback visual: card volta para coluna original se o PATCH falhar', async ({ page }) => {
    // Força um erro 500 no PATCH
    await page.route('**/rest/v1/quotes**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Internal server error' }),
        });
        return;
      }
      await route.continue();
    });

    const dragHandle = page.getByTestId('quote-card-drag-handle-dnd-quote-a');
    const targetCol = page.getByTestId('kanban-column-qualificacao');
    const sourceCol = page.getByTestId('kanban-column-novo_pedido');

    await dragFromTo(page, dragHandle, targetCol);

    // Após a falha o React Query não altera o cache, então o card deve voltar
    // ao novo_pedido (a mutation falhou e o overStage foi resetado)
    await expect(sourceCol.getByTestId('quote-card-dnd-quote-a')).toBeVisible({ timeout: 3000 });
    await expect(targetCol.getByTestId('quote-card-dnd-quote-a')).not.toBeVisible();
  });
});
