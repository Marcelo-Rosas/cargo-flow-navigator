import { describe, expect, it } from 'vitest';
import { buildQuoteCloneInsert } from '@/lib/quote-clone';

const baseQuote = {
  id: 'old-id',
  quote_code: 'COT-2026-05-0011',
  client_name: 'CORPUS QUALITY',
  client_id: 'client-1',
  origin: 'Navegantes, SC',
  destination: 'Curitiba, PR',
  value: 19500,
  stage: 'ganho' as const,
  email_sent: true,
  email_sent_at: '2026-05-01T00:00:00Z',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-02T00:00:00Z',
  created_by: 'user-old',
  handoff_required: true,
  approval_status: 'approved',
  cargo_type: 'Geral',
  destination_cep: null,
  origin_cep: null,
  freight_modality: null,
  freight_type: null,
  km_distance: 200,
  notes: null,
  payment_method: null,
  payment_term_id: null,
  price_table_id: null,
  pricing_breakdown: null,
  shipper_id: null,
  shipper_name: null,
  tags: null,
  toll_value: null,
  volume: null,
  weight: null,
  assigned_to: null,
  advance_due_date: null,
  balance_due_date: null,
  validity_date: null,
  estimated_loading_date: null,
  cargo_value: null,
  client_email: null,
  shipper_email: null,
  conditional_fees_breakdown: null,
  commercial_owner_name: null,
  cubage_weight: null,
  billable_weight: null,
  discount_value: null,
  vehicle_type_id: null,
  waiting_time_cost: null,
  tac_percent: null,
  is_legacy: false,
  additional_shippers: [],
  approval_metadata: null,
  delivered_at: null,
  delivery_conditions_selected: null,
  delivery_notes: null,
  discharge_checklist_selected: null,
  followup_target_locked_at: null,
  followup_target_type: null,
  last_commercial_reply_at: null,
  opened_at: null,
  proposal_sent_at: null,
  resend_email_id: null,
  sent_at: null,
};

describe('buildQuoteCloneInsert', () => {
  it('reseta identidade, estágio e flags de e-mail/aprovação', () => {
    const insert = buildQuoteCloneInsert(baseQuote, 'user-new');

    expect(insert).not.toHaveProperty('id');
    expect(insert).not.toHaveProperty('quote_code');
    expect(insert.stage).toBe('novo_pedido');
    expect(insert.email_sent).toBe(false);
    expect(insert.created_by).toBe('user-new');
    expect(insert.handoff_required).toBe(false);
    expect(insert.client_name).toBe('CORPUS QUALITY');
    expect(insert.value).toBe(19500);
    expect(insert).not.toHaveProperty('approval_status');
    expect(insert).not.toHaveProperty('email_sent_at');
  });
});
