-- VEC-45: Consolidate dual RBAC — remove legacy has_role/has_any_role policies.
--
-- Two RBAC systems coexist:
--   has_profile() → profiles.perfil (user_profile enum) — primary system
--   has_role()/has_any_role() → user_roles.role (app_role enum) — legacy
--
-- vehicles: has_profile(ALL 4 profiles) already covers every role.
--   The 3 has_role/has_any_role policies are fully redundant → dropped.
-- drivers/shippers: "Admin can delete X" used has_role(uid,'admin') while
--   the rest of the table used has_profile. Migrated to is_admin() for
--   consistency with the primary RBAC system.

-- ─── vehicles: drop 3 legacy policies ────────────────────────────────────────
-- vehicles_delete/insert/update already cover has_profile([admin,comercial,operacional,financeiro])
DROP POLICY IF EXISTS "Admin can delete vehicles" ON vehicles;
DROP POLICY IF EXISTS "Comercial and Admin can create vehicles" ON vehicles;
DROP POLICY IF EXISTS "Comercial and Admin can update vehicles" ON vehicles;

-- ─── drivers: migrate Admin delete from has_role → is_admin() ────────────────
DROP POLICY IF EXISTS "Admin can delete drivers" ON drivers;
CREATE POLICY "Admin can delete drivers" ON drivers FOR DELETE
  USING (is_admin());

-- ─── shippers: migrate Admin delete from has_role → is_admin() ───────────────
DROP POLICY IF EXISTS "Admin can delete shippers" ON shippers;
CREATE POLICY "Admin can delete shippers" ON shippers FOR DELETE
  USING (is_admin());
