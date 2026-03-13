/**
 * E2E: Regra condicional do botão "Adicionar parada" no round 1 / IdentificationStep.
 *
 * Regras cobertas:
 * - 1 cliente => botão "Adicionar parada" NÃO visível
 * - 2+ clientes => botão "Adicionar parada" visível
 * - remover cliente extra e voltar para 1 => botão desaparece
 *
 * Requer build com a correção. Rodar contra build local:
 *   1. npm run build && npm run preview:static  (em outro terminal)
 *   2. npm run test:e2e:paradas
 *
 * vs produção (baseURL padrão): falha enquanto a correção não estiver deployada.
 */

import { expect, Page, test } from '@playwright/test';
import {
  injectFakeSession,
  mockAuthUserRoute,
  mockCurrentUserProfileRoute,
  mockPaymentTermsRoute,
  mockQuotesRoute,
  mockStaticRoute,
  loadFixture,
  registerFallbackRoutes,
} from './supabase-mocks';

const quotesFixture = loadFixture('quotes_stage_ganho.json');
const quoteCreateResponse = loadFixture('quote_create_ok.json');
const clientsFixture = loadFixture('clients.json');
const shippersFixture = loadFixture('shippers.json');
const priceTablesFixture = loadFixture('price_tables.json');
const vehicleTypesFixture = loadFixture('vehicle_types.json');
const paymentTermsFixture = loadFixture('payment_terms_list.json');
const paymentTerms50 = loadFixture('payment_terms_50.json');
const paymentTerms70 = loadFixture('payment_terms_70.json');
const pricingRulesFixture = loadFixture('pricing_rules_config.json');
const pricingParameterFixture = loadFixture('pricing_parameter_tax_regime.json');
const conditionalFeesFixture = loadFixture('conditional_fees.json');
const anttRatesFixture = loadFixture('antt_floor_rates.json');

async function setupWizardMocks(page: Page) {
  await mockStaticRoute(page, 'clients', clientsFixture);
  await mockStaticRoute(page, 'shippers', shippersFixture);
  await mockStaticRoute(page, 'price_tables', priceTablesFixture);
  await mockStaticRoute(page, 'vehicle_types', vehicleTypesFixture);
  await mockStaticRoute(page, 'pricing_rules_config', pricingRulesFixture);
  await mockStaticRoute(page, 'conditional_fees', conditionalFeesFixture);
  await mockStaticRoute(page, 'price_table_rows', []);
  await mockStaticRoute(page, 'pricing_parameters', pricingParameterFixture);
  await mockStaticRoute(page, 'antt_floor_rates', anttRatesFixture);
  await mockPaymentTermsRoute(page, {
    list: paymentTermsFixture,
    advanceFixtures: { 50: paymentTerms50, 70: paymentTerms70 },
  });
  await mockQuotesRoute(page, quotesFixture, undefined, quoteCreateResponse);
}

async function openNovaCotacaoStep1(page: Page) {
  const newQuoteBtn = page.getByRole('button', { name: 'Nova Cotação' });
  await newQuoteBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await newQuoteBtn.click();
  await page.getByRole('button', { name: /Nova cotação Fluxo 360|Fluxo 360 com motor/i }).click();
  await expect(page.getByLabel('Nome do Cliente *')).toBeVisible({ timeout: 5_000 });
}

test.describe('quote paradas gating (round 1)', () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeSession(page);
    await registerFallbackRoutes(page);
    await mockAuthUserRoute(page);
    await mockCurrentUserProfileRoute(page, 'operacional');
    await setupWizardMocks(page);
    await page.goto('/comercial');
    await expect(page.getByRole('heading', { name: /Bem-vindo de volta/i })).toHaveCount(0);
  });

  test('1 cliente => não exibe botão Adicionar parada', async ({ page }) => {
    await openNovaCotacaoStep1(page);
    await expect(page.getByRole('button', { name: /Adicionar parada/i })).toHaveCount(0);
  });

  test('2 clientes => exibe botão Adicionar parada', async ({ page }) => {
    await openNovaCotacaoStep1(page);
    await page.getByRole('button', { name: /Adicionar cliente/i }).click();
    await expect(page.getByRole('button', { name: /Adicionar parada/i })).toBeVisible();
  });

  test('3+ clientes => continua exibindo botão Adicionar parada', async ({ page }) => {
    await openNovaCotacaoStep1(page);
    await page.getByRole('button', { name: /Adicionar cliente/i }).click();
    await page.getByRole('button', { name: /Adicionar cliente/i }).click();
    await expect(page.getByRole('button', { name: /Adicionar parada/i })).toBeVisible();
  });

  test('remover cliente extra e voltar para 1 => botão Adicionar parada desaparece', async ({
    page,
  }) => {
    await openNovaCotacaoStep1(page);
    await page.getByRole('button', { name: /Adicionar cliente/i }).click();
    await expect(page.getByRole('button', { name: /Adicionar parada/i })).toBeVisible();
    await page.getByTitle('Remover destinatário').click();
    await expect(page.getByRole('button', { name: /Adicionar parada/i })).toHaveCount(0);
  });
});
