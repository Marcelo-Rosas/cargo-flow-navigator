-- Feature: Cotação com paradas (origem → paradas → destino)
-- Ref: docs/plans/análise-360-paradas-roteiro-multiplos-destinatários.md

CREATE TYPE public.route_stop_type AS ENUM ('origin', 'stop', 'destination');

CREATE TABLE public.quote_route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  sequence int NOT NULL DEFAULT 0,
  stop_type public.route_stop_type NOT NULL DEFAULT 'stop',
  cnpj text,
  name text,
  cep text,
  city_uf text,
  label text,
  planned_km_from_prev numeric(10, 2),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, sequence)
);

CREATE INDEX idx_quote_route_stops_quote_id ON public.quote_route_stops(quote_id);
CREATE INDEX idx_quote_route_stops_sequence ON public.quote_route_stops(quote_id, sequence);

COMMENT ON TABLE public.quote_route_stops IS 'Paradas do roteiro da cotação: origem (0), paradas intermediárias (1..n-1), destino (n). Permite múltiplos destinatários no mesmo frete.';

-- RLS (mesmo padrão de quotes: SELECT público autenticado, INSERT/UPDATE/DELETE por perfil)
ALTER TABLE public.quote_route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_route_stops_select"
  ON public.quote_route_stops FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "quote_route_stops_insert"
  ON public.quote_route_stops FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "quote_route_stops_update"
  ON public.quote_route_stops FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "quote_route_stops_delete"
  ON public.quote_route_stops FOR DELETE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));
