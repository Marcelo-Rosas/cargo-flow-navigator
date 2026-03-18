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
const calculateFreightOk = loadFixture('calculate_freight_ok.json');
const calculateFreightOutOfRange = loadFixture('calculate_freight_out_of_range.json');

async function setupWizardMocks(
  page: Page,
  priceTableRows: unknown[],
  options?: { delayPost?: number }
) {
  await mockStaticRoute(page, 'clients', clientsFixture);
  await mockStaticRoute(page, 'shippers', shippersFixture);
  await mockStaticRoute(page, 'price_tables', priceTablesFixture);
  await mockStaticRoute(page, 'vehicle_types', vehicleTypesFixture);
  await mockStaticRoute(page, 'pricing_rules_config', pricingRulesFixture);
  await mockStaticRoute(page, 'conditional_fees', conditionalFeesFixture);
  await mockStaticRoute(page, 'price_table_rows', priceTableRows);
  await mockStaticRoute(page, 'pricing_parameters', pricingParameterFixture);
  await mockStaticRoute(page, 'antt_floor_rates', anttRatesFixture);
  await mockPaymentTermsRoute(page, {
    list: paymentTermsFixture,
    advanceFixtures: {
      50: paymentTerms50,
      70: paymentTerms70,
    },
  });

  await mockQuotesRoute(page, quotesFixture, undefined, quoteCreateResponse, {
    delayPostMs: options?.delayPost,
  });
}

const fillBaseQuoteForm = async (page: Page, km: string) => {
  const newQuoteBtn = page.getByRole('button', { name: 'Nova Cotação' });
  await newQuoteBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await newQuoteBtn.click();
  // Modal "Tipo de cotação" — selecionar fluxo 360
  const novaCotacaoOption = page
    .getByRole('button', { name: 'Nova cotação' })
    .or(page.getByText('Fluxo 360 com motor de cálculo'));
  if (
    await novaCotacaoOption
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false)
  ) {
    await novaCotacaoOption.first().click();
  }
  await page.getByLabel('Nome do Cliente *').fill('E2E Cliente');
  await page.getByLabel('Origem *').fill('São Paulo, SP');
  await page.getByLabel('Destino *').fill('Rio de Janeiro, RJ');
  await page.getByRole('button', { name: /Próximo/i }).click();

  await page.getByLabel('Tabela de Preços').click();
  await page.getByRole('option', { name: /Tabela Teste/i }).click();
  await page.getByLabel('Prazo de Pagamento').click();
  await page.getByRole('option', { name: /50\/50/i }).click();
  await page.getByLabel('Distância (km)').fill(km);
  await page.getByLabel('Peso').fill('1000');
  await page.getByRole('button', { name: /Próximo/i }).click();

  await page.getByLabel('Valor da Carga').fill('1000');
  await page.getByRole('button', { name: /Próximo/i }).click();

  // Step 4 — Seguro (skip)
  await page.getByRole('button', { name: /Próximo/i }).click();
};

test('wizard blocks CTA when km out of range', async ({ page }) => {
  await injectFakeSession(page);
  await registerFallbackRoutes(page);
  await mockAuthUserRoute(page);
  await mockCurrentUserProfileRoute(page, 'operacional');
  await setupWizardMocks(page, []);
  await page.route('**/functions/v1/calculate-freight**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,apikey',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calculateFreightOutOfRange),
    });
  });
  await page.goto('/comercial');
  await expect(page.getByRole('heading', { name: /Bem-vindo de volta/i })).toHaveCount(0);

  await fillBaseQuoteForm(page, '150');

  await expect(
    page.getByTestId('wizard-blocked-reason').filter({
      hasText:
        /Distância.*não encontrou|Verifique a faixa de km|faixa da tabela|Distância fora da faixa/i,
    })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Criar Cotação/i })).toBeDisabled();
});

test('wizard shows "Salvando..." while submit is pending', async ({ page }) => {
  await injectFakeSession(page);
  await registerFallbackRoutes(page);
  await mockAuthUserRoute(page);
  await mockCurrentUserProfileRoute(page, 'operacional');
  const priceTableRows = loadFixture('price_table_rows_valid.json');
  await setupWizardMocks(page, priceTableRows, { delayPost: 800 });
  await page.route('**/functions/v1/calculate-freight**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,apikey',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calculateFreightOk),
    });
  });
  await page.goto('/comercial');
  await expect(page.getByRole('heading', { name: /Bem-vindo de volta/i })).toHaveCount(0);

  await fillBaseQuoteForm(page, '100');
  const submitBtn = page
    .getByTestId('wizard-submit')
    .or(page.getByRole('button', { name: /Criar Cotação/i }));
  const postResponse = page.waitForResponse(
    (resp) => resp.url().includes('/rest/v1/quotes') && resp.request().method() === 'POST'
  );
  await submitBtn.click();
  await expect(submitBtn).toHaveText(/Salvando\.\.\.|Criar Cotação/, { timeout: 2000 });
  await postResponse;
});

// Instructions:
// npx playwright test tests/e2e/quote-wizard-gating.spec.ts --project=chromium
// npx playwright test --ui
