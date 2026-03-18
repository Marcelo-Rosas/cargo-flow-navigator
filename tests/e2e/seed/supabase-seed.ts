import { randomUUID } from 'node:crypto';
import { postgrest } from './postgrest';

export interface SeedResult {
  runId: string;
  quoteId: string;
  orderId: string;
  occurrenceId: string;
}

interface SeedParams {
  runId: string;
  createdBy: string;
}

const quoteNotesMarker = (runId: string) => `[e2e_run:${runId}] seeded quote`;
const orderNotesMarker = (runId: string) => `[e2e_run:${runId}] seeded order`;
const occurrenceDescriptionMarker = (runId: string) => `[e2e_run:${runId}] seeded occurrence`;

function encodeLike(value: string) {
  return encodeURIComponent(value);
}

export async function seedE2E({ runId, createdBy }: SeedParams): Promise<SeedResult> {
  const quoteId = randomUUID();
  const orderId = randomUUID();
  const occurrenceId = randomUUID();
  const clientName = `E2E Cliente ${runId}`;
  const clientEmail = `e2e+${runId}@local.test`;

  const quotesPayload = [
    {
      id: quoteId,
      client_name: clientName,
      client_email: clientEmail,
      origin: 'São Paulo, SP',
      destination: 'Rio de Janeiro, RJ',
      value: 1000,
      stage: 'ganho',
      notes: quoteNotesMarker(runId),
      quote_code: `E2E-${runId}`,
      created_by: createdBy,
    },
  ];

  const insertedQuotes = await postgrest<Array<{ id: string }>>({
    method: 'POST',
    table: 'quotes',
    body: quotesPayload,
  });

  if (!insertedQuotes?.[0]?.id) {
    throw new Error('Não foi possível inserir a quote de seed.');
  }

  const ordersPayload = [
    {
      id: orderId,
      os_number: `OS-E2E-${runId}-0001`,
      quote_id: quoteId,
      client_name: clientName,
      origin: 'São Paulo, SP',
      destination: 'Rio de Janeiro, RJ',
      value: 1000,
      stage: 'ordem_criada',
      notes: orderNotesMarker(runId),
      created_by: createdBy,
    },
  ];

  const insertedOrders = await postgrest<Array<{ id: string }>>({
    method: 'POST',
    table: 'orders',
    body: ordersPayload,
  });

  if (!insertedOrders?.[0]?.id) {
    throw new Error('Não foi possível inserir a ordem de serviço de seed.');
  }

  const occurrencesPayload = [
    {
      id: occurrenceId,
      order_id: orderId,
      description: occurrenceDescriptionMarker(runId),
      created_by: createdBy,
    },
  ];

  const insertedOccurrences = await postgrest<Array<{ id: string }>>({
    method: 'POST',
    table: 'occurrences',
    body: occurrencesPayload,
  });

  if (!insertedOccurrences?.[0]?.id) {
    throw new Error('Não foi possível inserir a ocorrência de seed.');
  }

  return {
    runId,
    quoteId,
    orderId,
    occurrenceId,
  };
}

// ─────────────────────────────────────────────────────
// Grace Period helpers
// ─────────────────────────────────────────────────────

export interface GracePeriodSeedResult {
  runId: string;
  quoteId: string;
}

/**
 * Seed a quote at a specific stage (for grace period tests).
 * The DB trigger will auto-create workflow_events when stage = 'ganho'.
 */
export async function seedGracePeriodQuote({
  runId,
  createdBy,
  stage = 'enviado',
}: SeedParams & { stage?: string }): Promise<GracePeriodSeedResult> {
  const quoteId = randomUUID();
  const clientName = `E2E GracePeriod ${runId}`;

  await postgrest<Array<{ id: string }>>({
    method: 'POST',
    table: 'quotes',
    body: [
      {
        id: quoteId,
        client_name: clientName,
        client_email: `e2e-gp+${runId}@local.test`,
        origin: 'Curitiba, PR',
        destination: 'Florianópolis, SC',
        value: 5000,
        stage,
        notes: quoteNotesMarker(runId),
        quote_code: `GP-${runId}`,
        created_by: createdBy,
      },
    ],
  });

  return { runId, quoteId };
}

/**
 * Update a quote's stage via PostgREST PATCH.
 */
export async function updateQuoteStage(quoteId: string, newStage: string): Promise<void> {
  await postgrest({
    method: 'PATCH',
    table: 'quotes',
    query: `?id=eq.${quoteId}`,
    body: { stage: newStage },
  });
}

/**
 * Query workflow_events for a specific entity and event type.
 */
export async function queryWorkflowEvents(
  entityId: string,
  eventType: string
): Promise<
  Array<{ id: string; status: string; execute_after: string | null; created_at: string }>
> {
  return postgrest({
    method: 'GET',
    table: 'workflow_events',
    query: `?entity_id=eq.${entityId}&event_type=eq.${eventType}&order=created_at.desc`,
  });
}

/**
 * Query orders linked to a quote.
 */
export async function queryOrdersByQuoteId(
  quoteId: string
): Promise<Array<{ id: string; os_number: string }>> {
  return postgrest({
    method: 'GET',
    table: 'orders',
    query: `?quote_id=eq.${quoteId}&select=id,os_number`,
  });
}

export async function cleanupE2E({ runId }: { runId: string }): Promise<void> {
  const occurrencesLike = `like.*${encodeLike(`[e2e_run:${runId}]`)}*`;
  await postgrest({
    method: 'DELETE',
    table: 'occurrences',
    query: `?description=${occurrencesLike}`,
  });

  const ordersLike = `like.*${encodeLike(`[e2e_run:${runId}]`)}*`;
  await postgrest({
    method: 'DELETE',
    table: 'orders',
    query: `?notes=${ordersLike}`,
  });

  const quotesLike = `like.*${encodeLike(`[e2e_run:${runId}]`)}*`;

  // Find seeded quote IDs to clean up related workflow_events
  const seededQuotes = await postgrest<Array<{ id: string }>>({
    method: 'GET',
    table: 'quotes',
    query: `?notes=${quotesLike}&select=id`,
  });

  // Clean up workflow_events for seeded quotes
  if (seededQuotes && seededQuotes.length > 0) {
    for (const q of seededQuotes) {
      await postgrest({
        method: 'DELETE',
        table: 'workflow_events',
        query: `?entity_id=eq.${q.id}`,
      });
    }
  }

  await postgrest({
    method: 'DELETE',
    table: 'quotes',
    query: `?notes=${quotesLike}`,
  });
}
