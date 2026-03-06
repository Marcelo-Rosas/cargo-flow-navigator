/** Query key for card-detail cache: at least one of quoteId or orderId should be set */
export function cardQueryKey(quoteId?: string | null, orderId?: string | null) {
  return ['card', { quoteId: quoteId ?? undefined, orderId: orderId ?? undefined }] as const;
}

/**
 * Canonical card type: unified representation of a Kanban "card" across
 * Comercial (quote), Operações (order), and Financeiro (FAT/PAG) boards.
 * Used by useCardDetails and modals for consistent display and cache keys.
 */
export interface CanonicalCard {
  quoteId: string | null;
  orderId: string | null;
  fatId: string | null;
  pagId: string | null;

  clientName: string | null;
  origin: string | null;
  destination: string | null;

  /** Primary value: quote value if quote exists, else order value */
  value: number | null;
  quoteValue: number | null;
  orderValue: number | null;

  /** Stage from quote or order */
  stage: string | null;
  quoteCode: string | null;
  osNumber: string | null;

  carreteiroReal: number | null;
  carreteiroAntt: number | null;

  fatStatus: string | null;
  pagStatus: string | null;
  totalAmount: number | null;
  expectedAmount: number | null;
  paidAmount: number | null;
}

/**
 * Shape returned by RPC get_card_full_data(quote_id, order_id).
 * Matches backend JSONB structure.
 */
export interface CardFullDataRpc {
  quote: Record<string, unknown> | null;
  order: Record<string, unknown> | null;
  fat: Record<string, unknown> | null;
  pag: Record<string, unknown> | null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === 'string' ? v : String(v);
}

/**
 * Maps RPC get_card_full_data response to CanonicalCard.
 */
export function mapCardFullDataToCanonicalCard(rpc: CardFullDataRpc): CanonicalCard | null {
  const q = rpc.quote ?? null;
  const o = rpc.order ?? null;
  const fat = rpc.fat ?? null;
  const pag = rpc.pag ?? null;

  const quoteId = q ? (str((q as { id?: unknown }).id) ?? null) : null;
  const orderId = o ? (str((o as { id?: unknown }).id) ?? null) : null;
  const fatId = fat ? (str((fat as { id?: unknown }).id) ?? null) : null;
  const pagId = pag ? (str((pag as { id?: unknown }).id) ?? null) : null;

  const clientName =
    str((q as { client_name?: unknown })?.client_name) ??
    str((o as { client_name?: unknown })?.client_name) ??
    null;
  const origin =
    str((q as { origin?: unknown })?.origin) ?? str((o as { origin?: unknown })?.origin) ?? null;
  const destination =
    str((q as { destination?: unknown })?.destination) ??
    str((o as { destination?: unknown })?.destination) ??
    null;

  const quoteValue = q ? num((q as { value?: unknown }).value) : null;
  const orderValue = o ? num((o as { value?: unknown }).value) : null;
  const value = quoteValue ?? orderValue ?? null;

  const stage =
    str((q as { stage?: unknown })?.stage) ?? str((o as { stage?: unknown })?.stage) ?? null;
  const quoteCode = str((q as { quote_code?: unknown })?.quote_code) ?? null;
  const osNumber = str((o as { os_number?: unknown })?.os_number) ?? null;

  const carreteiroReal = o ? num((o as { carreteiro_real?: unknown }).carreteiro_real) : null;
  const carreteiroAntt = o ? num((o as { carreteiro_antt?: unknown }).carreteiro_antt) : null;

  const fatStatus = fat ? (str((fat as { status?: unknown }).status) ?? null) : null;
  const pagStatus = pag ? (str((pag as { status?: unknown }).status) ?? null) : null;
  const totalAmount =
    num((fat as { total_amount?: unknown })?.total_amount) ??
    num((pag as { total_amount?: unknown })?.total_amount) ??
    null;
  const expectedAmount = num((pag as { expected_amount?: unknown })?.expected_amount) ?? null;
  const paidAmount = num((pag as { paid_amount?: unknown })?.paid_amount) ?? null;

  return {
    quoteId,
    orderId,
    fatId,
    pagId,
    clientName,
    origin,
    destination,
    value,
    quoteValue,
    orderValue,
    stage,
    quoteCode,
    osNumber,
    carreteiroReal,
    carreteiroAntt,
    fatStatus,
    pagStatus,
    totalAmount,
    expectedAmount,
    paidAmount,
  };
}
