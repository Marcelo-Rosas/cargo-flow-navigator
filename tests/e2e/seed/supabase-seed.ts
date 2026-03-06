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
  await postgrest({
    method: 'DELETE',
    table: 'quotes',
    query: `?notes=${quotesLike}`,
  });
}
