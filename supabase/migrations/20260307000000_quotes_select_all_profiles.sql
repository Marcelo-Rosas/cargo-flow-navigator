-- Permitir SELECT, INSERT e UPDATE em quotes para todos os perfis (admin, operacional, financeiro)

DROP POLICY IF EXISTS "quotes_select" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert" ON public.quotes;
DROP POLICY IF EXISTS "quotes_update" ON public.quotes;

CREATE POLICY "quotes_select" ON public.quotes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "quotes_insert" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "quotes_update" ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));
