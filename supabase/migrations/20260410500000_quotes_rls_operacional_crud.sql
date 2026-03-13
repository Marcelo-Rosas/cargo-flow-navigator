-- Incluir operacional em criar, alterar e deletar cotação (quotes)
-- Atualmente operacional já tem SELECT, INSERT, UPDATE via 20260307000000.
-- Apenas DELETE está restrito a admin; estender para admin + operacional + financeiro.

DROP POLICY IF EXISTS "quotes_delete" ON public.quotes;

CREATE POLICY "quotes_delete" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));
