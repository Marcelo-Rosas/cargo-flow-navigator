-- has_profile() helper — necessário antes de financial_documents_tables (20260219000500)
-- que usa esta função em políticas RLS.
-- A função foi originalmente adicionada em 20260225100000_fix_auth_rls_policies.sql
-- mas precisava existir antes para o Preview Branch aplicar migrations em ordem.

CREATE OR REPLACE FUNCTION public.has_profile(allowed public.user_profile[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.current_user_profile() = ANY(allowed);
$$;
