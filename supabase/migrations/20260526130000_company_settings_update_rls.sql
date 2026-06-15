-- company_settings: permitir UPDATE para admins (formulario Configuracoes da Empresa)
-- Guard contra preview branches onde a tabela so e criada por uma migration
-- posterior (20260713000000_company_settings.sql). Em prod a policy ja existe
-- e DROP POLICY IF EXISTS torna a re-aplicacao idempotente.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_settings'
  ) THEN
    RAISE NOTICE 'company_settings table does not exist yet — skipping update policy';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS company_settings_update ON public.company_settings;

  CREATE POLICY company_settings_update
    ON public.company_settings
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
END $$;
