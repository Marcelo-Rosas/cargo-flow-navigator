/**
 * Grace Period E2E Tests (seeded, real backend)
 *
 * Validates the 24-hour grace period for automatic OS creation:
 * - Deferred event is created when quote goes to 'ganho'
 * - Deferred event is cancelled when quote reverts from 'ganho'
 * - Timer resets on ganho→X→ganho cycle
 * - Manual conversion still works immediately
 */
import { expect, test } from '@playwright/test';
import { getUserIdFromStorageState } from '../seed/get-user-id-from-storage';
import {
  cleanupE2E,
  seedGracePeriodQuote,
  updateQuoteStage,
  queryWorkflowEvents,
  queryOrdersByQuoteId,
  type GracePeriodSeedResult,
} from '../seed/supabase-seed';
import { postgrest } from '../seed/postgrest';
import { randomUUID } from 'node:crypto';

test.use({ storageState: '.auth/user.json' });

const DEFERRED_EVENT_TYPE = 'quote.ganho_deferred';

// ✅ Polling helper — substitui setTimeout fixo para aguardar triggers assíncronos do Supabase
async function waitForWorkflowEvents(
  quoteId: string,
  eventType: string,
  predicate: (events: Awaited<ReturnType<typeof queryWorkflowEvents>>) => boolean,
  { timeout = 8_000, interval = 500 } = {}
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const events = await queryWorkflowEvents(quoteId, eventType);
    if (predicate(events)) return events;
    await new Promise((r) => setTimeout(r, interval));
  }
  // Retorna estado real para expor no erro do Playwright
  return queryWorkflowEvents(quoteId, eventType);
}

test.describe('Grace period 24h — OS creation deferral (seeded)', () => {
  const runId = process.env.PW_RUN_ID ?? `gp-${Date.now()}`;
  let createdBy: string;

  test.beforeAll(() => {
    createdBy = getUserIdFromStorageState('.auth/user.json');
  });

  test.afterAll(async () => {
    await cleanupE2E({ runId });
  });

  // ── Test 1: Deferred event created when quote → ganho ──
  test('creates deferred event with execute_after when quote transitions to ganho', async () => {
    const seed = await seedGracePeriodQuote({ runId, createdBy, stage: 'enviado' });

    await updateQuoteStage(seed.quoteId, 'ganho');

    // ✅ Polling até evento pending aparecer
    const events = await waitForWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE, (evts) =>
      evts.some((e) => e.status === 'pending')
    );

    expect(events.length).toBeGreaterThanOrEqual(1);
    const deferred = events[0];
    expect(deferred.status).toBe('pending');
    expect(deferred.execute_after).toBeTruthy();

    const executeAfter = new Date(deferred.execute_after!).getTime();
    const expected24h = Date.now() + 24 * 60 * 60 * 1000;
    const tolerance = 5 * 60 * 1000;
    expect(Math.abs(executeAfter - expected24h)).toBeLessThan(tolerance);

    const orders = await queryOrdersByQuoteId(seed.quoteId);
    expect(orders.length).toBe(0);
  });

  // ── Test 2: Deferred event cancelled when quote reverts from ganho ──
  test('cancels deferred event when quote reverts from ganho', async () => {
    const seed = await seedGracePeriodQuote({ runId, createdBy, stage: 'ganho' });

    // ✅ Polling: aguarda trigger disparar após INSERT com stage ganho
    let events = await waitForWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE, (evts) =>
      evts.some((e) => e.status === 'pending')
    );

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].status).toBe('pending');

    await updateQuoteStage(seed.quoteId, 'negociacao');

    // ✅ Polling: aguarda cancelamento
    events = await waitForWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE, (evts) =>
      evts.some((e) => e.status === 'cancelled')
    );

    expect(events.find((e) => e.status === 'cancelled')).toBeTruthy();
    expect(events.filter((e) => e.status === 'pending').length).toBe(0);
  });

  // ── Test 3: Timer resets on ganho→X→ganho cycle ──
  test('resets timer when quote cycles ganho → negociacao → ganho', async () => {
    const seed = await seedGracePeriodQuote({ runId, createdBy, stage: 'ganho' });

    // ✅ Polling: aguarda primeiro evento pending
    let events = await waitForWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE, (evts) =>
      evts.some((e) => e.status === 'pending')
    );

    const firstEventId = events[0]?.id;
    expect(firstEventId).toBeTruthy();

    await updateQuoteStage(seed.quoteId, 'negociacao');

    // ✅ Polling: confirma cancelamento antes de avançar
    await waitForWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE, (evts) =>
      evts.some((e) => e.status === 'cancelled')
    );

    await updateQuoteStage(seed.quoteId, 'ganho');

    // ✅ Polling: aguarda novo evento pending (diferente do primeiro)
    events = await waitForWorkflowEvents(
      seed.quoteId,
      DEFERRED_EVENT_TYPE,
      (evts) => evts.filter((e) => e.status === 'pending' && e.id !== firstEventId).length > 0
    );

    const first = events.find((e) => e.id === firstEventId);
    expect(first?.status).toBe('cancelled');

    const pendingEvents = events.filter((e) => e.status === 'pending');
    expect(pendingEvents.length).toBe(1);
    expect(pendingEvents[0].id).not.toBe(firstEventId);

    const newExecuteAfter = new Date(pendingEvents[0].execute_after!).getTime();
    const expected24h = Date.now() + 24 * 60 * 60 * 1000;
    const tolerance = 5 * 60 * 1000;
    expect(Math.abs(newExecuteAfter - expected24h)).toBeLessThan(tolerance);
  });

  // ── Test 4: Manual conversion works immediately (no grace period) ──
  test('manual OS creation works immediately while deferred event is pending', async () => {
    const seed = await seedGracePeriodQuote({ runId, createdBy, stage: 'ganho' });

    // ✅ Polling: garante que evento pending existe antes de criar OS manual
    const events = await waitForWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE, (evts) =>
      evts.some((e) => e.status === 'pending')
    );

    expect(events.some((e) => e.status === 'pending')).toBe(true);

    const orderId = randomUUID();
    await postgrest({
      method: 'POST',
      table: 'orders',
      body: [
        {
          id: orderId,
          os_number: `OS-GP-${runId}-manual`,
          quote_id: seed.quoteId,
          client_name: `E2E GracePeriod ${runId}`,
          origin: 'Curitiba, PR',
          destination: 'Florianópolis, SC',
          value: 5000,
          stage: 'ordem_criada',
          notes: `[e2e_run:${runId}] seeded order`,
          created_by: createdBy,
        },
      ],
    });

    const orders = await queryOrdersByQuoteId(seed.quoteId);
    expect(orders.length).toBe(1);
    expect(orders[0].id).toBe(orderId);
  });
});
