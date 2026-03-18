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
    // Seed quote in 'enviado' stage (no deferred event yet)
    const seed = await seedGracePeriodQuote({ runId, createdBy, stage: 'enviado' });

    // Transition to 'ganho' — trigger should create deferred event
    await updateQuoteStage(seed.quoteId, 'ganho');

    // Wait briefly for trigger to fire
    await new Promise((r) => setTimeout(r, 1000));

    // Query deferred events
    const events = await queryWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE);

    expect(events.length).toBeGreaterThanOrEqual(1);
    const deferred = events[0];
    expect(deferred.status).toBe('pending');
    expect(deferred.execute_after).toBeTruthy();

    // execute_after should be approximately 24h from now (within 5min tolerance)
    const executeAfter = new Date(deferred.execute_after!).getTime();
    const expected24h = Date.now() + 24 * 60 * 60 * 1000;
    const tolerance = 5 * 60 * 1000; // 5 minutes
    expect(Math.abs(executeAfter - expected24h)).toBeLessThan(tolerance);

    // No order should exist yet
    const orders = await queryOrdersByQuoteId(seed.quoteId);
    expect(orders.length).toBe(0);
  });

  // ── Test 2: Deferred event cancelled when quote reverts from ganho ──
  test('cancels deferred event when quote reverts from ganho', async () => {
    // Seed quote directly in 'ganho' — trigger fires on INSERT, creating deferred event
    const seed = await seedGracePeriodQuote({ runId, createdBy, stage: 'ganho' });

    await new Promise((r) => setTimeout(r, 1000));

    // Verify deferred event exists
    let events = await queryWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].status).toBe('pending');

    // Revert to 'negociacao' — trigger should cancel the deferred event
    await updateQuoteStage(seed.quoteId, 'negociacao');

    await new Promise((r) => setTimeout(r, 1000));

    // Query again — should be cancelled
    events = await queryWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE);
    const cancelled = events.find((e) => e.status === 'cancelled');
    expect(cancelled).toBeTruthy();

    // No pending deferred events should remain
    const pending = events.filter((e) => e.status === 'pending');
    expect(pending.length).toBe(0);
  });

  // ── Test 3: Timer resets on ganho→X→ganho cycle ──
  test('resets timer when quote cycles ganho → negociacao → ganho', async () => {
    const seed = await seedGracePeriodQuote({ runId, createdBy, stage: 'ganho' });
    await new Promise((r) => setTimeout(r, 1000));

    // Record first deferred event
    let events = await queryWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE);
    const firstEventId = events[0]?.id;
    expect(firstEventId).toBeTruthy();

    // Revert to negociacao (cancels first deferred)
    await updateQuoteStage(seed.quoteId, 'negociacao');
    await new Promise((r) => setTimeout(r, 500));

    // Go back to ganho (creates new deferred)
    await updateQuoteStage(seed.quoteId, 'ganho');
    await new Promise((r) => setTimeout(r, 1000));

    // Query all deferred events
    events = await queryWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE);

    // First event should be cancelled
    const first = events.find((e) => e.id === firstEventId);
    expect(first?.status).toBe('cancelled');

    // New event should be pending with fresh execute_after
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
    await new Promise((r) => setTimeout(r, 1000));

    // Verify deferred event is pending
    const events = await queryWorkflowEvents(seed.quoteId, DEFERRED_EVENT_TYPE);
    expect(events.some((e) => e.status === 'pending')).toBe(true);

    // Manually create an order (simulating "Converter para OS" button)
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

    // Order should exist immediately
    const orders = await queryOrdersByQuoteId(seed.quoteId);
    expect(orders.length).toBe(1);
    expect(orders[0].id).toBe(orderId);
  });
});
