-- company_settings: permitir UPDATE para admins (formulario Configuracoes da Empresa)
DROP POLICY IF EXISTS company_settings_update ON public.company_settings;

CREATE POLICY company_settings_update
  ON public.company_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
