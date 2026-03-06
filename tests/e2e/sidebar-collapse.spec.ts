/**
 * Sidebar collapse E2E: verifica que ao colapsar o sidebar, o main content ajusta
 * o padding-left sem deixar gap. Requer LayoutProvider + MainLayout com padding dinâmico.
 */
import { expect, test } from '@playwright/test';
import {
  mockAuthUserRoute,
  mockCurrentUserProfileRoute,
  mockQuotesRoute,
  mockStaticRoute,
  loadFixture,
  registerFallbackRoutes,
} from './supabase-mocks';

const quotesFixture = loadFixture('quotes_stage_ganho.json');
const clientsFixture = loadFixture('clients.json');
const priceTablesFixture = loadFixture('price_tables.json');
const vehicleTypesFixture = loadFixture('vehicle_types.json');

test.use({ storageState: '.auth/user.json' });

test('sidebar collapse adjusts main content without gap', async ({ page }) => {
  await registerFallbackRoutes(page);
  await mockAuthUserRoute(page);
  await mockCurrentUserProfileRoute(page);
  await mockQuotesRoute(page, quotesFixture);
  await mockStaticRoute(page, 'clients', clientsFixture);
  await mockStaticRoute(page, 'price_tables', priceTablesFixture);
  await mockStaticRoute(page, 'vehicle_types', vehicleTypesFixture);

  await page.goto('/comercial');
  await expect(page.getByRole('heading', { name: /Bem-vindo de volta/i })).toHaveCount(0);

  const sidebar = page.getByTestId('sidebar').or(page.getByRole('complementary'));
  const mainContent = page.getByTestId('main-content');
  const mainRegion = page.getByRole('main').first();
  const toggle = page
    .getByTestId('sidebar-toggle')
    .or(page.getByRole('complementary').getByRole('button').last());

  await expect(sidebar).toBeVisible();
  await expect(mainContent).toBeVisible();
  await expect(toggle).toBeVisible();

  const expandedSidebarBox = await sidebar.boundingBox();
  const expandedMainBox = await mainRegion.boundingBox();
  expect(expandedSidebarBox?.width).toBeGreaterThan(200);
  expect(expandedMainBox?.x).toBeGreaterThanOrEqual((expandedSidebarBox?.width ?? 0) - 5);

  await toggle.click();
  await page.waitForTimeout(300);

  const collapsedSidebarBox = await sidebar.boundingBox();
  const collapsedMainBox = await mainRegion.boundingBox();
  expect(collapsedSidebarBox?.width).toBeLessThan(100);
  expect(Math.abs((collapsedMainBox?.x ?? 0) - (collapsedSidebarBox?.width ?? 0))).toBeLessThan(15);

  await toggle.click();
  await page.waitForTimeout(300);

  const reExpandedSidebarBox = await sidebar.boundingBox();
  const reExpandedMainBox = await mainRegion.boundingBox();
  expect(reExpandedSidebarBox?.width).toBeGreaterThan(200);
  expect(Math.abs((reExpandedMainBox?.x ?? 0) - (reExpandedSidebarBox?.width ?? 0))).toBeLessThan(
    15
  );
});
