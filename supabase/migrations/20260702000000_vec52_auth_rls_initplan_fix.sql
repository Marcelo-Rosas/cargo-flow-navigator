-- VEC-52: Convert auth_rls_initplan anti-pattern
-- Replace auth.uid() with (SELECT auth.uid()) in 22 RLS policies across 10 tables.
-- (SELECT auth.uid()) is evaluated once per statement and cached by the planner,
-- eliminating repeated per-row calls to the auth function.

-- ─── documents ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents FOR DELETE
USING (
  is_admin()
  OR (
    has_profile(ARRAY['financeiro'::user_profile])
    AND (type = ANY (ARRAY[
      'a_vista_fat'::document_type, 'saldo_fat'::document_type,
      'a_prazo_fat'::document_type, 'adiantamento'::document_type,
      'adiantamento_carreteiro'::document_type, 'saldo_carreteiro'::document_type,
      'comprovante_vpo'::document_type, 'nfe'::document_type,
      'cte'::document_type, 'pod'::document_type,
      'mdfe'::document_type, 'analise_gr'::document_type,
      'doc_rota'::document_type, 'comprovante_descarga'::document_type
    ]))
  )
  OR (
    has_profile(ARRAY['operacional'::user_profile])
    AND (uploaded_by = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents FOR UPDATE
USING (
  is_admin()
  OR (uploaded_by = (SELECT auth.uid()))
  OR has_profile(ARRAY['financeiro'::user_profile])
)
WITH CHECK (
  is_admin()
  OR (uploaded_by = (SELECT auth.uid()))
  OR has_profile(ARRAY['financeiro'::user_profile])
);

-- ─── drivers ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin can delete drivers" ON drivers;
CREATE POLICY "Admin can delete drivers" ON drivers FOR DELETE
USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Comercial and Admin can update drivers" ON drivers;
CREATE POLICY "Comercial and Admin can update drivers" ON drivers FOR UPDATE
USING (has_any_role((SELECT auth.uid()), ARRAY['admin'::app_role, 'comercial'::app_role]));

-- ─── load_composition_discount_breakdown ─────────────────────────────────────

DROP POLICY IF EXISTS "insert_own_discounts" ON load_composition_discount_breakdown;
CREATE POLICY "insert_own_discounts" ON load_composition_discount_breakdown FOR INSERT
WITH CHECK (
  ((SELECT auth.uid()) = created_by)
  OR ((SELECT auth.uid()) IN (
    SELECT profiles.user_id FROM profiles
    WHERE profiles.perfil = ANY (ARRAY['admin'::user_profile, 'financeiro'::user_profile])
  ))
);

DROP POLICY IF EXISTS "select_own_discounts" ON load_composition_discount_breakdown;
CREATE POLICY "select_own_discounts" ON load_composition_discount_breakdown FOR SELECT
USING (
  ((SELECT auth.uid()) = created_by)
  OR ((SELECT auth.uid()) IN (
    SELECT profiles.user_id FROM profiles
    WHERE profiles.perfil = ANY (ARRAY['admin'::user_profile, 'financeiro'::user_profile])
  ))
);

-- ─── load_composition_suggestions ────────────────────────────────────────────

DROP POLICY IF EXISTS "load_comp_delete" ON load_composition_suggestions;
CREATE POLICY "load_comp_delete" ON load_composition_suggestions FOR DELETE
USING ((created_by = (SELECT auth.uid())) AND (status = 'pending'::text));

DROP POLICY IF EXISTS "load_comp_update" ON load_composition_suggestions;
CREATE POLICY "load_comp_update" ON load_composition_suggestions FOR UPDATE
USING (
  ((SELECT auth.uid()) = created_by)
  OR ((SELECT auth.uid()) = approved_by)
  OR (auth.role() = 'service_role'::text)
)
WITH CHECK (
  ((SELECT auth.uid()) = created_by)
  OR ((SELECT auth.uid()) = approved_by)
  OR (auth.role() = 'service_role'::text)
);

-- ─── logistics_traffic_rules ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "logistics_traffic_rules_read" ON logistics_traffic_rules;
CREATE POLICY "logistics_traffic_rules_read" ON logistics_traffic_rules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role = ANY (ARRAY['admin'::app_role, 'comercial'::app_role, 'operacao'::app_role])
));

-- ─── mirofish_recommendations ────────────────────────────────────────────────

DROP POLICY IF EXISTS "mirofish_recommendations_read" ON mirofish_recommendations;
CREATE POLICY "mirofish_recommendations_read" ON mirofish_recommendations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role = ANY (ARRAY['admin'::app_role, 'comercial'::app_role])
));

-- ─── mirofish_reports ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "mirofish_reports_read" ON mirofish_reports;
CREATE POLICY "mirofish_reports_read" ON mirofish_reports FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role = ANY (ARRAY['admin'::app_role, 'comercial'::app_role])
));

-- ─── mirofish_route_insights ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "mirofish_route_insights_read" ON mirofish_route_insights;
CREATE POLICY "mirofish_route_insights_read" ON mirofish_route_insights FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role = ANY (ARRAY['admin'::app_role, 'comercial'::app_role])
));

-- ─── mirofish_shipper_insights ────────────────────────────────────────────────

DROP POLICY IF EXISTS "mirofish_shipper_insights_read" ON mirofish_shipper_insights;
CREATE POLICY "mirofish_shipper_insights_read" ON mirofish_shipper_insights FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role = ANY (ARRAY['admin'::app_role, 'comercial'::app_role])
));

-- ─── profiles ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
USING (
  (id = (SELECT auth.uid()))
  OR (user_id = (SELECT auth.uid()))
  OR is_admin()
);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
USING (
  (id = (SELECT auth.uid()))
  OR (user_id = (SELECT auth.uid()))
  OR is_admin()
)
WITH CHECK (
  (id = (SELECT auth.uid()))
  OR (user_id = (SELECT auth.uid()))
  OR is_admin()
);

-- ─── shippers ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin can delete shippers" ON shippers;
CREATE POLICY "Admin can delete shippers" ON shippers FOR DELETE
USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Comercial and Admin can create shippers" ON shippers;
CREATE POLICY "Comercial and Admin can create shippers" ON shippers FOR INSERT
WITH CHECK (has_any_role((SELECT auth.uid()), ARRAY['admin'::app_role, 'comercial'::app_role]));

DROP POLICY IF EXISTS "Comercial and Admin can update shippers" ON shippers;
CREATE POLICY "Comercial and Admin can update shippers" ON shippers FOR UPDATE
USING (has_any_role((SELECT auth.uid()), ARRAY['admin'::app_role, 'comercial'::app_role]));

-- ─── user_roles ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT
USING ((user_id = (SELECT auth.uid())) OR is_admin());

-- ─── vehicles ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin can delete vehicles" ON vehicles;
CREATE POLICY "Admin can delete vehicles" ON vehicles FOR DELETE
USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Comercial and Admin can create vehicles" ON vehicles;
CREATE POLICY "Comercial and Admin can create vehicles" ON vehicles FOR INSERT
WITH CHECK (has_any_role((SELECT auth.uid()), ARRAY['admin'::app_role, 'comercial'::app_role]));

DROP POLICY IF EXISTS "Comercial and Admin can update vehicles" ON vehicles;
CREATE POLICY "Comercial and Admin can update vehicles" ON vehicles FOR UPDATE
USING (has_any_role((SELECT auth.uid()), ARRAY['admin'::app_role, 'comercial'::app_role]));
