-- VEC-294: Enable RLS on vectra analytics staging tables
-- These tables are staging-only; only service_role (via Edge Functions) should access them.
-- service_role bypasses RLS by default in Supabase, so no allow policy is needed.

ALTER TABLE vectra_rentabilidade_rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vectra_manifestos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vectra_motoristas_margem   ENABLE ROW LEVEL SECURITY;

-- Explicit restrictive policy: block all authenticated users
-- DROP IF EXISTS guards re-apply when the same content was previously applied with a different version timestamp
DROP POLICY IF EXISTS "deny_authenticated" ON vectra_rentabilidade_rotas;
CREATE POLICY "deny_authenticated" ON vectra_rentabilidade_rotas
  AS RESTRICTIVE TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_authenticated" ON vectra_manifestos;
CREATE POLICY "deny_authenticated" ON vectra_manifestos
  AS RESTRICTIVE TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_authenticated" ON vectra_motoristas_margem;
CREATE POLICY "deny_authenticated" ON vectra_motoristas_margem
  AS RESTRICTIVE TO authenticated USING (false);
