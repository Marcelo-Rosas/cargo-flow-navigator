-- VEC-40: Habilitar RLS em tabelas commercial_* e partner_* expostas via PostgREST
-- Estratégia por tabela:
--   commercial_*: SELECT para authenticated (sem user_id para isolar por linha)
--   partner_users: apenas service role (contém password_hash)
--   partner_quotes: isolada por user_id
--   partner_shippers: read-only para authenticated
--   product_dimensions: read-only para authenticated
--   ntc_scrape_log: RLS já tinha política, só habilitar

-- ─── commercial_followup_rules ────────────────────────────────────────────────
-- Tabela de configuração de regras (8 rows). Leitura para autenticados, escrita via service role.
ALTER TABLE public.commercial_followup_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_followup_rules_select_authenticated"
  ON public.commercial_followup_rules
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ─── commercial_followup_runs ─────────────────────────────────────────────────
-- Histórico de execuções de follow-up por quote. Leitura para autenticados.
ALTER TABLE public.commercial_followup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_followup_runs_select_authenticated"
  ON public.commercial_followup_runs
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ─── commercial_message_events ───────────────────────────────────────────────
-- Eventos de mensagens do funil comercial. Leitura para autenticados.
ALTER TABLE public.commercial_message_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_message_events_select_authenticated"
  ON public.commercial_message_events
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ─── commercial_operational_handoffs ─────────────────────────────────────────
-- Handoffs entre comercial e operacional. Leitura para autenticados.
ALTER TABLE public.commercial_operational_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_operational_handoffs_select_authenticated"
  ON public.commercial_operational_handoffs
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ─── commercial_closeout_events ──────────────────────────────────────────────
-- Eventos de encerramento de negociação. Leitura para autenticados.
ALTER TABLE public.commercial_closeout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_closeout_events_select_authenticated"
  ON public.commercial_closeout_events
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ─── partner_quotes ───────────────────────────────────────────────────────────
-- Cotações geradas pelo widget white-label. Isoladas por user_id.
ALTER TABLE public.partner_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_quotes_select_own"
  ON public.partner_quotes
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "partner_quotes_insert_own"
  ON public.partner_quotes
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ─── partner_shippers ─────────────────────────────────────────────────────────
-- Config de embarcadores parceiros (branding, slug). Read-only para autenticados.
ALTER TABLE public.partner_shippers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_shippers_select_authenticated"
  ON public.partner_shippers
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ─── partner_users ────────────────────────────────────────────────────────────
-- Usuários do portal parceiro com password_hash. APENAS service role.
-- Nenhuma política = deny-by-default para anon/authenticated.
ALTER TABLE public.partner_users ENABLE ROW LEVEL SECURITY;

-- ─── product_dimensions ──────────────────────────────────────────────────────
-- Dimensões de produtos (tabela de referência). Read-only para autenticados.
ALTER TABLE public.product_dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_dimensions_select_authenticated"
  ON public.product_dimensions
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ─── ntc_scrape_log ───────────────────────────────────────────────────────────
-- Já possui política "Enable insert for authenticated users only" (USING true).
-- Só precisava habilitar o RLS para a política entrar em vigor.
ALTER TABLE public.ntc_scrape_log ENABLE ROW LEVEL SECURITY;
