-- VEC-43: Restrict overly-broad USING(true) policies.
--
-- Two patterns fixed:
--   1. quotes table had a {public} SELECT policy exposing all quotes to unauthenticated users.
--      Duplicate of quotes_select ({authenticated}) — dropped.
--   2. Five policies named "Admin can manage X" that used {authenticated} without is_admin()
--      check, allowing any logged-in user to mutate approval rules, AI budget config,
--      notification templates, workflow definitions, and workflow transitions.

-- ─── quotes: remove public (anon) read access ────────────────────────────────
-- quotes_select already grants SELECT to {authenticated}. This policy was redundant
-- and dangerously exposed quote data to unauthenticated callers.
DROP POLICY IF EXISTS "Enable read access for all users" ON quotes;

-- ─── approval_rules: gate writes to admin only ────────────────────────────────
DROP POLICY IF EXISTS "Admin can manage approval_rules" ON approval_rules;
CREATE POLICY "Admin can manage approval_rules" ON approval_rules
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── ai_budget_config: gate update to admin only ─────────────────────────────
DROP POLICY IF EXISTS "ai_budget_config_update_authenticated" ON ai_budget_config;
CREATE POLICY "ai_budget_config_update_admin" ON ai_budget_config
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── notification_templates: gate writes to admin only ───────────────────────
DROP POLICY IF EXISTS "Admin can manage notification_templates" ON notification_templates;
CREATE POLICY "Admin can manage notification_templates" ON notification_templates
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── workflow_definitions: gate writes to admin only ─────────────────────────
DROP POLICY IF EXISTS "Admin can manage workflow_definitions" ON workflow_definitions;
CREATE POLICY "Admin can manage workflow_definitions" ON workflow_definitions
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── workflow_transitions: gate writes to admin only ─────────────────────────
DROP POLICY IF EXISTS "Admin can manage workflow_transitions" ON workflow_transitions;
CREATE POLICY "Admin can manage workflow_transitions" ON workflow_transitions
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
