-- VEC-43: Restrict overly-broad USING(true) / WITH CHECK(true) write policies.
-- Strategy: lock all write operations to is_admin() — service_role bypasses RLS
-- so Edge Functions are unaffected. SELECT policies are preserved as-is.
-- Validation: test with ADMIN user only (per VEC-43 comment).

-- ============================================================
-- CONFIG TABLES — admin-only writes
-- ============================================================

-- equipment_rental_rates
DROP POLICY IF EXISTS "equipment_rental_rates_all_authenticated" ON public.equipment_rental_rates;
CREATE POLICY "equipment_rental_rates_write_admin"
  ON public.equipment_rental_rates
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ltl_parameters
DROP POLICY IF EXISTS "ltl_parameters_insert" ON public.ltl_parameters;
DROP POLICY IF EXISTS "ltl_parameters_update" ON public.ltl_parameters;
CREATE POLICY "ltl_parameters_write_admin"
  ON public.ltl_parameters
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- pricing_route_overrides
DROP POLICY IF EXISTS "Authenticated users can manage route overrides" ON public.pricing_route_overrides;
CREATE POLICY "pricing_route_overrides_write_admin"
  ON public.pricing_route_overrides
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- route_metrics_config
DROP POLICY IF EXISTS "route_metrics_config_write_authenticated" ON public.route_metrics_config;
CREATE POLICY "route_metrics_config_write_admin"
  ON public.route_metrics_config
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- unloading_cost_rates
DROP POLICY IF EXISTS "unloading_cost_rates_all_authenticated" ON public.unloading_cost_rates;
CREATE POLICY "unloading_cost_rates_write_admin"
  ON public.unloading_cost_rates
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- OPERATIONAL TABLES — admin-only writes
-- ============================================================

-- trips
DROP POLICY IF EXISTS "Authenticated users can manage trips" ON public.trips;
CREATE POLICY "trips_write_admin"
  ON public.trips
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- trip_orders
DROP POLICY IF EXISTS "Authenticated users can manage trip_orders" ON public.trip_orders;
CREATE POLICY "trip_orders_write_admin"
  ON public.trip_orders
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- trip_cost_items
DROP POLICY IF EXISTS "Authenticated users can manage trip_cost_items" ON public.trip_cost_items;
CREATE POLICY "trip_cost_items_write_admin"
  ON public.trip_cost_items
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- delivery_assessments
DROP POLICY IF EXISTS "authenticated_write" ON public.delivery_assessments;
CREATE POLICY "delivery_assessments_write_admin"
  ON public.delivery_assessments
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- driver_qualifications
DROP POLICY IF EXISTS "Authenticated users can insert driver_qualifications" ON public.driver_qualifications;
DROP POLICY IF EXISTS "Authenticated users can update driver_qualifications" ON public.driver_qualifications;
CREATE POLICY "driver_qualifications_write_admin"
  ON public.driver_qualifications
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- risk_evaluations
DROP POLICY IF EXISTS "Authenticated users can insert risk_evaluations" ON public.risk_evaluations;
DROP POLICY IF EXISTS "Authenticated users can update risk_evaluations" ON public.risk_evaluations;
CREATE POLICY "risk_evaluations_write_admin"
  ON public.risk_evaluations
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- risk_costs
DROP POLICY IF EXISTS "Authenticated users can insert risk_costs" ON public.risk_costs;
DROP POLICY IF EXISTS "Authenticated users can update risk_costs" ON public.risk_costs;
CREATE POLICY "risk_costs_write_admin"
  ON public.risk_costs
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- risk_evidence
DROP POLICY IF EXISTS "Authenticated users can insert risk_evidence" ON public.risk_evidence;
CREATE POLICY "risk_evidence_write_admin"
  ON public.risk_evidence
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- FINANCIAL TABLES — admin-only writes
-- ============================================================

-- payment_proofs
DROP POLICY IF EXISTS "Authenticated users can manage payment_proofs" ON public.payment_proofs;
CREATE POLICY "payment_proofs_write_admin"
  ON public.payment_proofs
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- quote_payment_proofs
DROP POLICY IF EXISTS "Authenticated users can manage quote_payment_proofs" ON public.quote_payment_proofs;
CREATE POLICY "quote_payment_proofs_write_admin"
  ON public.quote_payment_proofs
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- WORKFLOW / NOTIFICATION TABLES — admin-only writes
-- ============================================================

-- workflow_events
DROP POLICY IF EXISTS "Authenticated users can insert workflow_events" ON public.workflow_events;
DROP POLICY IF EXISTS "Authenticated users can update workflow_events" ON public.workflow_events;
CREATE POLICY "workflow_events_write_admin"
  ON public.workflow_events
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- workflow_event_logs
DROP POLICY IF EXISTS "Authenticated users can insert workflow_event_logs" ON public.workflow_event_logs;
CREATE POLICY "workflow_event_logs_write_admin"
  ON public.workflow_event_logs
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- notification_logs
DROP POLICY IF EXISTS "Authenticated users can update notification_logs" ON public.notification_logs;
CREATE POLICY "notification_logs_write_admin"
  ON public.notification_logs
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- notification_queue
DROP POLICY IF EXISTS "Authenticated users can insert notification_queue" ON public.notification_queue;
DROP POLICY IF EXISTS "Authenticated users can update notification_queue" ON public.notification_queue;
CREATE POLICY "notification_queue_write_admin"
  ON public.notification_queue
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ai_insights
DROP POLICY IF EXISTS "Authenticated users can insert ai_insights" ON public.ai_insights;
CREATE POLICY "ai_insights_write_admin"
  ON public.ai_insights
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- approval_requests
DROP POLICY IF EXISTS "approval_requests_insert" ON public.approval_requests;
CREATE POLICY "approval_requests_write_admin"
  ON public.approval_requests
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- compliance_checks
DROP POLICY IF EXISTS "Authenticated users can insert compliance_checks" ON public.compliance_checks;
CREATE POLICY "compliance_checks_write_admin"
  ON public.compliance_checks
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
