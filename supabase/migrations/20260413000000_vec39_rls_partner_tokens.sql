-- VEC-39: Habilitar RLS em partner_tokens (token sensível exposto via PostgREST)
-- A tabela não tem user_id — é config de parceiros acessada só via service role.
-- Habilitar RLS sem políticas para autenticados = deny-by-default.
-- Service role bypassa RLS automaticamente no Supabase.

ALTER TABLE public.partner_tokens ENABLE ROW LEVEL SECURITY;

-- Nenhuma política de SELECT/INSERT/UPDATE/DELETE para anon ou authenticated.
-- Acesso mantido apenas via service role (Edge Functions: validate_api_key, etc.).
