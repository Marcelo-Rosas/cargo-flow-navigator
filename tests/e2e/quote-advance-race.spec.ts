import { expect, test } from '@playwright/test';
import {
  mockAuthUserRoute,
  mockCurrentUserProfileRoute,
  mockPaymentTermsRoute,
  mockQuotesRoute,
  mockStaticRoute,
  loadFixture,
  registerFallbackRoutes,
} from './supabase-mocks';

const quotesFixture = loadFixture('quotes_stage_ganho.json');
const quoteUpdateResponse = loadFixture('quote_update_ok.json');
const clientsFixture = loadFixture('clients.json');
const shippersFixture = loadFixture('shippers.json');
const priceTablesFixture = loadFixture('price_tables.json');
const vehicleTypesFixture = loadFixture('vehicle_types.json');
const paymentTermsListFixture = loadFixture('payment_terms_list.json');
const paymentTerms50 = loadFixture('payment_terms_50.json');
const paymentTerms70 = loadFixture('payment_terms_70.json');
const pricingRulesFixture = loadFixture('pricing_rules_config.json');
const pricingParameterFixture = loadFixture('pricing_parameter_tax_regime.json');
const conditionalFeesFixture = loadFixture('conditional_fees.json');
const priceTableRowsFixture = loadFixture('price_table_rows_valid.json');
const anttRatesFixture = loadFixture('antt_floor_rates.json');

test.use({ storageState: '.auth/user.json' });

test('race selection keeps last choice applied', async ({ page }) => {
  await registerFallbackRoutes(page);
  await mockAuthUserRoute(page);
  await mockCurrentUserProfileRoute(page);
  await mockQuotesRoute(page, quotesFixture, quoteUpdateResponse);
  await mockStaticRoute(page, 'clients', clientsFixture);
  await mockStaticRoute(page, 'shippers', shippersFixture);
  await mockStaticRoute(page, 'price_tables', priceTablesFixture);
  await mockStaticRoute(page, 'vehicle_types', vehicleTypesFixture);
  await mockStaticRoute(page, 'pricing_rules_config', pricingRulesFixture);
  await mockStaticRoute(page, 'conditional_fees', conditionalFeesFixture);
  await mockStaticRoute(page, 'antt_floor_rates', anttRatesFixture);
  await mockStaticRoute(page, 'price_table_rows', priceTableRowsFixture);
  await mockStaticRoute(page, 'pricing_parameters', pricingParameterFixture);
  await mockPaymentTermsRoute(page, {
    list: paymentTermsListFixture,
    advanceFixtures: {
      50: paymentTerms50,
      70: paymentTerms70,
    },
    delayFirstAdvancePercent: 50,
    delayFirstMs: 400,
  });

  await page.goto('/comercial');
  await expect(page.getByRole('heading', { name: /Bem-vindo de volta/i })).toHaveCount(0);
  const quoteCard = page.getByTestId('quote-card-quote-test-1');
  await quoteCard.click();

  await page.getByRole('tab', { name: /Doc Fat/i }).click();
  const trigger = page
    .getByRole('tabpanel', { name: /Doc Fat/i })
    .getByRole('combobox')
    .filter({ hasText: /Adiantamento/i });
  await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  const toggleSequence = ['50', '70', '50', '70'];
  for (const value of toggleSequence) {
    await trigger.click();
    const option = page.getByRole('option', { name: new RegExp(`${value}%\\s*Adiantamento`) });
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await expect(trigger).toHaveText(new RegExp(`${value}% Adiantamento`), { timeout: 5000 });
  }

  await expect(trigger).toHaveText(/70% Adiantamento/);
  await expect(page.getByText('Condição de pagamento não encontrada')).toHaveCount(0);
  await expect(page.getByText('Há mais de uma condição de pagamento')).toHaveCount(0);
  await expect(page.getByText('Erro ao salvar adiantamento')).toHaveCount(0);
});

// Instructions:
// - Run a single spec: npx playwright test tests/e2e/quote-advance-race.spec.ts --project=chromium
// - Open Playwright UI: npx playwright test --ui
