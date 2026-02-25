-- Add carrier-specific payment columns to orders
-- Separate from the commercial payment_term_id (which comes from the quote/client side)

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier_payment_term_id UUID REFERENCES public.payment_terms(id),
  ADD COLUMN IF NOT EXISTS carrier_advance_date DATE,
  ADD COLUMN IF NOT EXISTS carrier_balance_date DATE;

CREATE INDEX IF NOT EXISTS idx_orders_carrier_payment_term ON public.orders(carrier_payment_term_id);

-- Add carrier payment document types to the enum
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'adiantamento_carreteiro';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'saldo_carreteiro';

-- Recreate financial_payable_kanban view to include carrier payment data
DROP VIEW IF EXISTS public.financial_payable_kanban;

CREATE VIEW public.financial_payable_kanban AS
SELECT
  k.*,
  o.client_name,
  o.origin,
  o.destination,
  o.origin_cep,
  o.destination_cep,
  o.value         AS order_value,
  o.carreteiro_real,
  o.carreteiro_antt,
  o.cargo_type,
  o.weight,
  o.volume,
  o.km_distance,
  o.freight_type,
  o.freight_modality,
  o.toll_value,
  o.pricing_breakdown,
  o.shipper_name,
  o.carrier_advance_date,
  o.carrier_balance_date,
  vt.name         AS vehicle_type_name,
  vt.code         AS vehicle_type_code,
  vt.axes_count,
  pt.name         AS payment_term_name,
  pt.code         AS payment_term_code,
  pt.days         AS payment_term_days,
  pt.adjustment_percent AS payment_term_adjustment,
  pt.advance_percent    AS payment_term_advance,
  cpt.name            AS carrier_payment_term_name,
  cpt.code            AS carrier_payment_term_code,
  cpt.days            AS carrier_payment_days,
  cpt.advance_percent AS carrier_advance_percent
FROM public.financial_documents_kanban k
JOIN public.orders o ON o.id = k.source_id
LEFT JOIN public.vehicle_types vt ON vt.id = o.vehicle_type_id
LEFT JOIN public.payment_terms pt ON pt.id = o.payment_term_id
LEFT JOIN public.payment_terms cpt ON cpt.id = o.carrier_payment_term_id
WHERE k.type = 'PAG';
