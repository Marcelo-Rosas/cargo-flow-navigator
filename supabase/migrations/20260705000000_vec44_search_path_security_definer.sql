-- VEC-44: Fix search_path on 4 SECURITY DEFINER functions.
-- Without an explicit search_path, SECURITY DEFINER functions are vulnerable to
-- schema injection: a user who can CREATE SCHEMA could shadow public functions.
-- Setting search_path = public pins all unqualified name lookups to the public schema.
-- Functions only present in production are wrapped in DO blocks to skip in preview.

ALTER FUNCTION public.copy_quote_adiantamento_to_fat(p_quote_id uuid, p_fat_id uuid)
  SET search_path = public;

ALTER FUNCTION public.get_diesel_cost_by_route(p_from date, p_to date)
  SET search_path = public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_vault_secret'
  ) THEN
    ALTER FUNCTION public.get_vault_secret(p_name text)
      SET search_path = public;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'validate_api_key'
  ) THEN
    ALTER FUNCTION public.validate_api_key(p_key text, p_scope text)
      SET search_path = public;
  END IF;
END $$;
