-- VEC-40: Habilitar RLS em tabelas commercial_* e partner_* expostas via PostgREST
-- Estratégia por tabela:
--   commercial_*: SELECT para authenticated (sem user_id para isolar por linha)
--   partner_users: apenas service role (contém password_hash)
--   partner_quotes: isolada por user_id
--   partner_shippers: read-only para authenticated
--   product_dimensions: read-only para authenticated
--   ntc_scrape_log: RLS já tinha política, só habilitar
-- Wrapped in DO block: todas essas tabelas só existem em produção (criadas fora
-- das migrations), então preview branches pulam graciosamente.

DO $$
BEGIN
  -- ─── commercial_followup_rules ──────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_followup_rules'
  ) THEN
    ALTER TABLE public.commercial_followup_rules ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'commercial_followup_rules'
        AND policyname = 'commercial_followup_rules_select_authenticated'
    ) THEN
      CREATE POLICY "commercial_followup_rules_select_authenticated"
        ON public.commercial_followup_rules
        FOR SELECT
        USING ((SELECT auth.role()) = 'authenticated');
    END IF;
  END IF;

  -- ─── commercial_followup_runs ───────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_followup_runs'
  ) THEN
    ALTER TABLE public.commercial_followup_runs ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'commercial_followup_runs'
        AND policyname = 'commercial_followup_runs_select_authenticated'
    ) THEN
      CREATE POLICY "commercial_followup_runs_select_authenticated"
        ON public.commercial_followup_runs
        FOR SELECT
        USING ((SELECT auth.role()) = 'authenticated');
    END IF;
  END IF;

  -- ─── commercial_message_events ──────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_message_events'
  ) THEN
    ALTER TABLE public.commercial_message_events ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'commercial_message_events'
        AND policyname = 'commercial_message_events_select_authenticated'
    ) THEN
      CREATE POLICY "commercial_message_events_select_authenticated"
        ON public.commercial_message_events
        FOR SELECT
        USING ((SELECT auth.role()) = 'authenticated');
    END IF;
  END IF;

  -- ─── commercial_operational_handoffs ────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_operational_handoffs'
  ) THEN
    ALTER TABLE public.commercial_operational_handoffs ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'commercial_operational_handoffs'
        AND policyname = 'commercial_operational_handoffs_select_authenticated'
    ) THEN
      CREATE POLICY "commercial_operational_handoffs_select_authenticated"
        ON public.commercial_operational_handoffs
        FOR SELECT
        USING ((SELECT auth.role()) = 'authenticated');
    END IF;
  END IF;

  -- ─── commercial_closeout_events ─────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_closeout_events'
  ) THEN
    ALTER TABLE public.commercial_closeout_events ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'commercial_closeout_events'
        AND policyname = 'commercial_closeout_events_select_authenticated'
    ) THEN
      CREATE POLICY "commercial_closeout_events_select_authenticated"
        ON public.commercial_closeout_events
        FOR SELECT
        USING ((SELECT auth.role()) = 'authenticated');
    END IF;
  END IF;

  -- ─── partner_quotes ─────────────────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'partner_quotes'
  ) THEN
    ALTER TABLE public.partner_quotes ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'partner_quotes'
        AND policyname = 'partner_quotes_select_own'
    ) THEN
      CREATE POLICY "partner_quotes_select_own"
        ON public.partner_quotes
        FOR SELECT
        USING ((SELECT auth.uid()) = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'partner_quotes'
        AND policyname = 'partner_quotes_insert_own'
    ) THEN
      CREATE POLICY "partner_quotes_insert_own"
        ON public.partner_quotes
        FOR INSERT
        WITH CHECK ((SELECT auth.uid()) = user_id);
    END IF;
  END IF;

  -- ─── partner_shippers ───────────────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'partner_shippers'
  ) THEN
    ALTER TABLE public.partner_shippers ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'partner_shippers'
        AND policyname = 'partner_shippers_select_authenticated'
    ) THEN
      CREATE POLICY "partner_shippers_select_authenticated"
        ON public.partner_shippers
        FOR SELECT
        USING ((SELECT auth.role()) = 'authenticated');
    END IF;
  END IF;

  -- ─── partner_users ──────────────────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'partner_users'
  ) THEN
    ALTER TABLE public.partner_users ENABLE ROW LEVEL SECURITY;
  END IF;

  -- ─── product_dimensions ─────────────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_dimensions'
  ) THEN
    ALTER TABLE public.product_dimensions ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'product_dimensions'
        AND policyname = 'product_dimensions_select_authenticated'
    ) THEN
      CREATE POLICY "product_dimensions_select_authenticated"
        ON public.product_dimensions
        FOR SELECT
        USING ((SELECT auth.role()) = 'authenticated');
    END IF;
  END IF;

  -- ─── ntc_scrape_log ─────────────────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ntc_scrape_log'
  ) THEN
    ALTER TABLE public.ntc_scrape_log ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
