-- =============================================================
-- Migration: Fix Auth Functions, Triggers, and RLS Policies
-- Date: 2025-02-25
-- Purpose:
--   1. Fix current_user_profile() / is_admin() to handle both id and user_id
--   2. Fix handle_new_user_profile() to also populate user_id and email
--   3. Create has_profile() helper based on user_profile enum
--   4. Drop ALL "Full access" / "_own" / legacy policies
--   5. Recreate proper role-based RLS policies
-- =============================================================

SET statement_timeout = '60s';

-- =============================================================
-- 1. FIX FUNCTIONS
-- =============================================================

-- 1.1 current_user_profile: check both id and user_id for backward compat
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.user_profile
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.perfil
  FROM public.profiles p
  WHERE p.id = auth.uid() OR p.user_id = auth.uid()
  LIMIT 1;
$$;

-- 1.2 is_admin: same dual check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
      AND p.perfil = 'admin'
  );
$$;

-- 1.3 has_profile: new helper function
CREATE OR REPLACE FUNCTION public.has_profile(allowed public.user_profile[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.current_user_profile() = ANY(allowed);
$$;

-- 1.4 Fix handle_new_user_profile trigger to also set user_id and email
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, full_name, email, perfil)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    'operacional'
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = COALESCE(profiles.user_id, NEW.id),
    email   = COALESCE(profiles.email, NEW.email);

  RETURN NEW;
END;
$$;

-- 1.5 Fix set_user_profile to handle both id and user_id
CREATE OR REPLACE FUNCTION public.set_user_profile(target_user_id uuid, new_profile public.user_profile)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  UPDATE public.profiles
  SET perfil = new_profile, updated_at = now()
  WHERE id = target_user_id OR user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
END;
$$;


-- =============================================================
-- 2. DROP ALL PROBLEMATIC POLICIES
-- =============================================================

-- ---- profiles ----
DROP POLICY IF EXISTS "Full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_valid_domain" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- ---- user_roles (legacy) ----
DROP POLICY IF EXISTS "Full access user_roles" ON public.user_roles;

-- ---- audit_logs ----
DROP POLICY IF EXISTS "Full access audit_logs" ON public.audit_logs;

-- ---- clients ----
DROP POLICY IF EXISTS "clients_delete_own" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_own" ON public.clients;
DROP POLICY IF EXISTS "clients_select_own" ON public.clients;
DROP POLICY IF EXISTS "clients_update_own" ON public.clients;

-- ---- quotes ----
DROP POLICY IF EXISTS "Full access quotes" ON public.quotes;

-- ---- orders ----
DROP POLICY IF EXISTS "Full access orders" ON public.orders;

-- ---- documents ----
DROP POLICY IF EXISTS "Full access documents" ON public.documents;

-- ---- occurrences ----
DROP POLICY IF EXISTS "Full access occurrences" ON public.occurrences;

-- ---- conditional_fees ----
DROP POLICY IF EXISTS "Full access conditional_fees" ON public.conditional_fees;
DROP POLICY IF EXISTS "conditional_fees_delete_own" ON public.conditional_fees;
DROP POLICY IF EXISTS "conditional_fees_insert_own" ON public.conditional_fees;
DROP POLICY IF EXISTS "conditional_fees_select_own" ON public.conditional_fees;
DROP POLICY IF EXISTS "conditional_fees_update_own" ON public.conditional_fees;

-- ---- pricing_parameters ----
DROP POLICY IF EXISTS "Full access pricing_parameters" ON public.pricing_parameters;
DROP POLICY IF EXISTS "pricing_parameters_delete_own" ON public.pricing_parameters;
DROP POLICY IF EXISTS "pricing_parameters_insert_own" ON public.pricing_parameters;
DROP POLICY IF EXISTS "pricing_parameters_select_own" ON public.pricing_parameters;
DROP POLICY IF EXISTS "pricing_parameters_update_own" ON public.pricing_parameters;

-- ---- vehicle_types ----
DROP POLICY IF EXISTS "Full access vehicle_types" ON public.vehicle_types;
DROP POLICY IF EXISTS "vehicle_types_delete_own" ON public.vehicle_types;
DROP POLICY IF EXISTS "vehicle_types_insert_own" ON public.vehicle_types;
DROP POLICY IF EXISTS "vehicle_types_select_own" ON public.vehicle_types;
DROP POLICY IF EXISTS "vehicle_types_update_own" ON public.vehicle_types;

-- ---- waiting_time_rules ----
DROP POLICY IF EXISTS "Full access waiting_time_rules" ON public.waiting_time_rules;
DROP POLICY IF EXISTS "waiting_time_rules_delete_own" ON public.waiting_time_rules;
DROP POLICY IF EXISTS "waiting_time_rules_insert_own" ON public.waiting_time_rules;
DROP POLICY IF EXISTS "waiting_time_rules_select_own" ON public.waiting_time_rules;
DROP POLICY IF EXISTS "waiting_time_rules_update_own" ON public.waiting_time_rules;

-- ---- toll_routes ----
DROP POLICY IF EXISTS "Full access toll_routes" ON public.toll_routes;
DROP POLICY IF EXISTS "toll_routes_delete_own" ON public.toll_routes;
DROP POLICY IF EXISTS "toll_routes_insert_own" ON public.toll_routes;
DROP POLICY IF EXISTS "toll_routes_select_own" ON public.toll_routes;
DROP POLICY IF EXISTS "toll_routes_update_own" ON public.toll_routes;

-- ---- tac_rates ----
DROP POLICY IF EXISTS "Full access tac_rates" ON public.tac_rates;
DROP POLICY IF EXISTS "tac_rates_delete_own" ON public.tac_rates;
DROP POLICY IF EXISTS "tac_rates_insert_own" ON public.tac_rates;
DROP POLICY IF EXISTS "tac_rates_select_own" ON public.tac_rates;
DROP POLICY IF EXISTS "tac_rates_update_own" ON public.tac_rates;

-- ---- payment_terms ----
DROP POLICY IF EXISTS "Full access payment_terms" ON public.payment_terms;
DROP POLICY IF EXISTS "payment_terms_delete_own" ON public.payment_terms;
DROP POLICY IF EXISTS "payment_terms_insert_own" ON public.payment_terms;
DROP POLICY IF EXISTS "payment_terms_select_own" ON public.payment_terms;
DROP POLICY IF EXISTS "payment_terms_update_own" ON public.payment_terms;

-- ---- price_tables ----
DROP POLICY IF EXISTS "Full access price_tables" ON public.price_tables;
DROP POLICY IF EXISTS "price_tables_delete_own" ON public.price_tables;
DROP POLICY IF EXISTS "price_tables_insert_own" ON public.price_tables;
DROP POLICY IF EXISTS "price_tables_select_own" ON public.price_tables;
DROP POLICY IF EXISTS "price_tables_update_own" ON public.price_tables;

-- ---- price_table_rows ----
DROP POLICY IF EXISTS "Full access price_table_rows" ON public.price_table_rows;
DROP POLICY IF EXISTS "price_table_rows_delete_own" ON public.price_table_rows;
DROP POLICY IF EXISTS "price_table_rows_insert_own" ON public.price_table_rows;
DROP POLICY IF EXISTS "price_table_rows_select_own" ON public.price_table_rows;
DROP POLICY IF EXISTS "price_table_rows_update_own" ON public.price_table_rows;

-- ---- icms_rates ----
DROP POLICY IF EXISTS "Full access icms_rates" ON public.icms_rates;
DROP POLICY IF EXISTS "icms_rates_delete_own" ON public.icms_rates;
DROP POLICY IF EXISTS "icms_rates_insert_own" ON public.icms_rates;
DROP POLICY IF EXISTS "icms_rates_select_own" ON public.icms_rates;
DROP POLICY IF EXISTS "icms_rates_update_own" ON public.icms_rates;

-- ---- shippers (old has_role policies) ----
DROP POLICY IF EXISTS "shippers_delete_policy" ON public.shippers;
DROP POLICY IF EXISTS "shippers_insert_policy" ON public.shippers;
DROP POLICY IF EXISTS "shippers_select_policy" ON public.shippers;
DROP POLICY IF EXISTS "shippers_update_policy" ON public.shippers;

-- ---- owners (old has_role policies) ----
DROP POLICY IF EXISTS "Authenticated users can view owners" ON public.owners;
DROP POLICY IF EXISTS "Comercial and Admin can create owners" ON public.owners;
DROP POLICY IF EXISTS "Comercial and Admin can update owners" ON public.owners;
DROP POLICY IF EXISTS "Admin can delete owners" ON public.owners;

-- ---- antt_floor_rates (old has_role policies) ----
DROP POLICY IF EXISTS "Authenticated users can view antt_floor_rates" ON public.antt_floor_rates;
DROP POLICY IF EXISTS "Admin and Operacao can insert antt_floor_rates" ON public.antt_floor_rates;
DROP POLICY IF EXISTS "Admin and Operacao can update antt_floor_rates" ON public.antt_floor_rates;
DROP POLICY IF EXISTS "Admin can delete antt_floor_rates" ON public.antt_floor_rates;

-- ---- discharge_checklist_items (old has_role policies) ----
DROP POLICY IF EXISTS "Authenticated users can view discharge_checklist_items" ON public.discharge_checklist_items;
DROP POLICY IF EXISTS "Admin and Operacao can insert discharge_checklist_items" ON public.discharge_checklist_items;
DROP POLICY IF EXISTS "Admin and Operacao can update discharge_checklist_items" ON public.discharge_checklist_items;
DROP POLICY IF EXISTS "Admin can delete discharge_checklist_items" ON public.discharge_checklist_items;

-- ---- delivery_conditions (old has_role policies) ----
DROP POLICY IF EXISTS "Authenticated users can view delivery_conditions" ON public.delivery_conditions;
DROP POLICY IF EXISTS "Admin and Operacao can insert delivery_conditions" ON public.delivery_conditions;
DROP POLICY IF EXISTS "Admin and Operacao can update delivery_conditions" ON public.delivery_conditions;
DROP POLICY IF EXISTS "Admin can delete delivery_conditions" ON public.delivery_conditions;

-- ---- ntc_cost_indices (old has_role policies) ----
DROP POLICY IF EXISTS "Authenticated users can view ntc_cost_indices" ON public.ntc_cost_indices;
DROP POLICY IF EXISTS "Admin and Operacao can insert ntc_cost_indices" ON public.ntc_cost_indices;
DROP POLICY IF EXISTS "Admin and Operacao can update ntc_cost_indices" ON public.ntc_cost_indices;
DROP POLICY IF EXISTS "Admin can delete ntc_cost_indices" ON public.ntc_cost_indices;

-- ---- ntc_fuel_reference (old has_role policies) ----
DROP POLICY IF EXISTS "Authenticated users can view ntc_fuel_reference" ON public.ntc_fuel_reference;
DROP POLICY IF EXISTS "Admin and Operacao can insert ntc_fuel_reference" ON public.ntc_fuel_reference;
DROP POLICY IF EXISTS "Admin and Operacao can update ntc_fuel_reference" ON public.ntc_fuel_reference;
DROP POLICY IF EXISTS "Admin can delete ntc_fuel_reference" ON public.ntc_fuel_reference;

-- ---- financial_documents (too open) ----
DROP POLICY IF EXISTS "Authenticated users can view financial_documents" ON public.financial_documents;
DROP POLICY IF EXISTS "Authenticated users can insert financial_documents" ON public.financial_documents;
DROP POLICY IF EXISTS "Authenticated users can update financial_documents" ON public.financial_documents;

-- ---- financial_installments (too open) ----
DROP POLICY IF EXISTS "Authenticated users can view financial_installments" ON public.financial_installments;
DROP POLICY IF EXISTS "Authenticated users can manage financial_installments" ON public.financial_installments;

-- ---- approval_requests (update too open) ----
DROP POLICY IF EXISTS "Authenticated users can view approval_requests" ON public.approval_requests;
DROP POLICY IF EXISTS "Authenticated users can insert approval_requests" ON public.approval_requests;
DROP POLICY IF EXISTS "Authenticated users can update approval_requests" ON public.approval_requests;


-- =============================================================
-- 3. CREATE PROPER ROLE-BASED POLICIES
-- =============================================================

-- =================== profiles ===================
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR user_id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR user_id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR user_id = auth.uid() OR public.is_admin());

-- =================== user_roles (legacy, read-only for compat) ===================
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_roles_admin" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =================== audit_logs ===================
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- =================== clients (admin + operacional + financeiro) ===================
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "clients_delete" ON public.clients
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =================== quotes (admin + financeiro only, NOT operacional) ===================
CREATE POLICY "quotes_select" ON public.quotes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "quotes_insert" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "quotes_update" ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "quotes_delete" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =================== orders (admin + operacional + financeiro) ===================
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =================== documents (admin + operacional + financeiro) ===================
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin())
  WITH CHECK (uploaded_by = auth.uid() OR public.is_admin());

CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =================== occurrences (admin + operacional + financeiro) ===================
CREATE POLICY "occurrences_select" ON public.occurrences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "occurrences_insert" ON public.occurrences
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "occurrences_update" ON public.occurrences
  FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "occurrences_delete" ON public.occurrences
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =================== shippers (admin + operacional + financeiro) ===================
CREATE POLICY "shippers_select" ON public.shippers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shippers_insert" ON public.shippers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "shippers_update" ON public.shippers
  FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "shippers_delete" ON public.shippers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =================== owners (admin + operacional + financeiro) ===================
CREATE POLICY "owners_select" ON public.owners
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "owners_insert" ON public.owners
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "owners_update" ON public.owners
  FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

CREATE POLICY "owners_delete" ON public.owners
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- =================== PRICING / CONFIG TABLES (admin + operacional) ===================
-- Pattern: SELECT all auth, INSERT/UPDATE admin+operacional, DELETE admin only

-- pricing_parameters
CREATE POLICY "pricing_parameters_select" ON public.pricing_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "pricing_parameters_insert" ON public.pricing_parameters FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "pricing_parameters_update" ON public.pricing_parameters FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "pricing_parameters_delete" ON public.pricing_parameters FOR DELETE TO authenticated USING (public.is_admin());

-- vehicle_types
CREATE POLICY "vehicle_types_select" ON public.vehicle_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicle_types_insert" ON public.vehicle_types FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "vehicle_types_update" ON public.vehicle_types FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "vehicle_types_delete" ON public.vehicle_types FOR DELETE TO authenticated USING (public.is_admin());

-- waiting_time_rules
CREATE POLICY "waiting_time_rules_select" ON public.waiting_time_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "waiting_time_rules_insert" ON public.waiting_time_rules FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "waiting_time_rules_update" ON public.waiting_time_rules FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "waiting_time_rules_delete" ON public.waiting_time_rules FOR DELETE TO authenticated USING (public.is_admin());

-- toll_routes
CREATE POLICY "toll_routes_select" ON public.toll_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "toll_routes_insert" ON public.toll_routes FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "toll_routes_update" ON public.toll_routes FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "toll_routes_delete" ON public.toll_routes FOR DELETE TO authenticated USING (public.is_admin());

-- tac_rates
CREATE POLICY "tac_rates_select" ON public.tac_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "tac_rates_insert" ON public.tac_rates FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "tac_rates_update" ON public.tac_rates FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "tac_rates_delete" ON public.tac_rates FOR DELETE TO authenticated USING (public.is_admin());

-- conditional_fees
CREATE POLICY "conditional_fees_select" ON public.conditional_fees FOR SELECT TO authenticated USING (true);
CREATE POLICY "conditional_fees_insert" ON public.conditional_fees FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "conditional_fees_update" ON public.conditional_fees FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "conditional_fees_delete" ON public.conditional_fees FOR DELETE TO authenticated USING (public.is_admin());

-- payment_terms
CREATE POLICY "payment_terms_select" ON public.payment_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "payment_terms_insert" ON public.payment_terms FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "payment_terms_update" ON public.payment_terms FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "payment_terms_delete" ON public.payment_terms FOR DELETE TO authenticated USING (public.is_admin());

-- price_tables
CREATE POLICY "price_tables_select" ON public.price_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_tables_insert" ON public.price_tables FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "price_tables_update" ON public.price_tables FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "price_tables_delete" ON public.price_tables FOR DELETE TO authenticated USING (public.is_admin());

-- price_table_rows
CREATE POLICY "price_table_rows_select" ON public.price_table_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_table_rows_insert" ON public.price_table_rows FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "price_table_rows_update" ON public.price_table_rows FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "price_table_rows_delete" ON public.price_table_rows FOR DELETE TO authenticated USING (public.is_admin());

-- icms_rates
CREATE POLICY "icms_rates_select" ON public.icms_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "icms_rates_insert" ON public.icms_rates FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "icms_rates_update" ON public.icms_rates FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "icms_rates_delete" ON public.icms_rates FOR DELETE TO authenticated USING (public.is_admin());

-- antt_floor_rates
CREATE POLICY "antt_floor_rates_select" ON public.antt_floor_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "antt_floor_rates_insert" ON public.antt_floor_rates FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "antt_floor_rates_update" ON public.antt_floor_rates FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "antt_floor_rates_delete" ON public.antt_floor_rates FOR DELETE TO authenticated USING (public.is_admin());

-- discharge_checklist_items
CREATE POLICY "discharge_checklist_items_select" ON public.discharge_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "discharge_checklist_items_insert" ON public.discharge_checklist_items FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "discharge_checklist_items_update" ON public.discharge_checklist_items FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "discharge_checklist_items_delete" ON public.discharge_checklist_items FOR DELETE TO authenticated USING (public.is_admin());

-- delivery_conditions
CREATE POLICY "delivery_conditions_select" ON public.delivery_conditions FOR SELECT TO authenticated USING (true);
CREATE POLICY "delivery_conditions_insert" ON public.delivery_conditions FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "delivery_conditions_update" ON public.delivery_conditions FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "delivery_conditions_delete" ON public.delivery_conditions FOR DELETE TO authenticated USING (public.is_admin());

-- ntc_cost_indices
CREATE POLICY "ntc_cost_indices_select" ON public.ntc_cost_indices FOR SELECT TO authenticated USING (true);
CREATE POLICY "ntc_cost_indices_insert" ON public.ntc_cost_indices FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "ntc_cost_indices_update" ON public.ntc_cost_indices FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "ntc_cost_indices_delete" ON public.ntc_cost_indices FOR DELETE TO authenticated USING (public.is_admin());

-- ntc_fuel_reference
CREATE POLICY "ntc_fuel_reference_select" ON public.ntc_fuel_reference FOR SELECT TO authenticated USING (true);
CREATE POLICY "ntc_fuel_reference_insert" ON public.ntc_fuel_reference FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "ntc_fuel_reference_update" ON public.ntc_fuel_reference FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));
CREATE POLICY "ntc_fuel_reference_delete" ON public.ntc_fuel_reference FOR DELETE TO authenticated USING (public.is_admin());

-- =================== FINANCIAL TABLES (admin + financeiro + operacional) ===================
CREATE POLICY "financial_documents_select" ON public.financial_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "financial_documents_insert" ON public.financial_documents FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));
CREATE POLICY "financial_documents_update" ON public.financial_documents FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));
CREATE POLICY "financial_documents_delete" ON public.financial_documents FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "financial_installments_select" ON public.financial_installments FOR SELECT TO authenticated USING (true);
CREATE POLICY "financial_installments_insert" ON public.financial_installments FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));
CREATE POLICY "financial_installments_update" ON public.financial_installments FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[])) WITH CHECK (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));
CREATE POLICY "financial_installments_delete" ON public.financial_installments FOR DELETE TO authenticated USING (public.is_admin());

-- =================== APPROVAL REQUESTS (view all, update admin+financeiro) ===================
CREATE POLICY "approval_requests_select" ON public.approval_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "approval_requests_insert" ON public.approval_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "approval_requests_update" ON public.approval_requests FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));


-- =============================================================
-- 4. BACKFILL: Sync user_id for existing profiles
-- =============================================================
UPDATE public.profiles p
SET user_id = p.id
WHERE p.user_id IS NULL
  AND p.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.user_id = p.id AND p2.id <> p.id
  );
