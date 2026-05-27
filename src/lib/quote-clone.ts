import type { Database } from '@/integrations/supabase/types';

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteInsert = Database['public']['Tables']['quotes']['Insert'];

/** Campos que não devem ser copiados ao clonar (identidade, workflow, e-mail, aprovação). */
const CLONE_OMIT = new Set([
  'id',
  'quote_code',
  'created_at',
  'updated_at',
  'stage',
  'email_sent',
  'email_sent_at',
  'resend_email_id',
  'sent_at',
  'proposal_sent_at',
  'approval_metadata',
  'approval_status',
  'delivered_at',
  'opened_at',
  'last_commercial_reply_at',
  'followup_target_locked_at',
  'followup_target_type',
  'created_by',
  'handoff_required',
]);

/** Monta payload de insert para duplicar cotação em "Novo Pedido". */
export function buildQuoteCloneInsert(source: Quote, createdBy: string): QuoteInsert {
  const base = Object.fromEntries(
    Object.entries(source).filter(([key]) => !CLONE_OMIT.has(key))
  ) as Omit<QuoteInsert, 'stage' | 'email_sent' | 'created_by' | 'handoff_required'>;

  return {
    ...base,
    stage: 'novo_pedido',
    email_sent: false,
    handoff_required: false,
    created_by: createdBy,
  };
}
