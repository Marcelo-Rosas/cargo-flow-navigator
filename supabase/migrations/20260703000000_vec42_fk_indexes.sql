-- VEC-42: Create indexes on 35 FK columns without supporting indexes.
-- All indexes created with IF NOT EXISTS to be idempotent.
-- CONCURRENTLY cannot run inside a transaction block, so these are plain CREATE INDEX.
-- Tables that only exist in production (commercial_*, partner_*) are wrapped in
-- DO blocks so preview branches skip them gracefully.

-- ─── commercial_closeout_events ──────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_closeout_events'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_commercial_closeout_events_message_event_id
      ON commercial_closeout_events (message_event_id);

    CREATE INDEX IF NOT EXISTS idx_commercial_closeout_events_quote_id
      ON commercial_closeout_events (quote_id);
  END IF;
END $$;

-- ─── commercial_followup_runs ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_followup_runs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_commercial_followup_runs_notification_log_id
      ON commercial_followup_runs (notification_log_id);

    CREATE INDEX IF NOT EXISTS idx_commercial_followup_runs_quote_id
      ON commercial_followup_runs (quote_id);

    CREATE INDEX IF NOT EXISTS idx_commercial_followup_runs_rule_id
      ON commercial_followup_runs (rule_id);
  END IF;
END $$;

-- ─── commercial_message_events ───────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_message_events'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_commercial_message_events_client_id
      ON commercial_message_events (client_id);

    CREATE INDEX IF NOT EXISTS idx_commercial_message_events_shipper_id
      ON commercial_message_events (shipper_id);
  END IF;
END $$;

-- ─── commercial_operational_handoffs ─────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_operational_handoffs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_commercial_operational_handoffs_order_id
      ON commercial_operational_handoffs (order_id);

    CREATE INDEX IF NOT EXISTS idx_commercial_operational_handoffs_quote_id
      ON commercial_operational_handoffs (quote_id);
  END IF;
END $$;

-- ─── driver_offer_sequences ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_driver_offer_sequences_accepted_driver_id
  ON driver_offer_sequences (accepted_driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_offer_sequences_order_id
  ON driver_offer_sequences (order_id);

CREATE INDEX IF NOT EXISTS idx_driver_offer_sequences_trip_id
  ON driver_offer_sequences (trip_id);

CREATE INDEX IF NOT EXISTS idx_driver_offer_sequences_vehicle_type_id
  ON driver_offer_sequences (vehicle_type_id);

-- ─── financial_documents ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_financial_documents_owner_id
  ON financial_documents (owner_id);

-- ─── load_composition_suggestions ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_load_composition_suggestions_created_order_id
  ON load_composition_suggestions (created_order_id);

CREATE INDEX IF NOT EXISTS idx_load_composition_suggestions_suggested_vehicle_type_id
  ON load_composition_suggestions (suggested_vehicle_type_id);

-- ─── mirofish_recommendations ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mirofish_recommendations_report_id
  ON mirofish_recommendations (report_id);

-- ─── mirofish_route_insights ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mirofish_route_insights_report_id
  ON mirofish_route_insights (report_id);

-- ─── mirofish_shipper_insights ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mirofish_shipper_insights_report_id
  ON mirofish_shipper_insights (report_id);

CREATE INDEX IF NOT EXISTS idx_mirofish_shipper_insights_shipper_id
  ON mirofish_shipper_insights (shipper_id);

-- ─── orders ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_payment_term_id
  ON orders (payment_term_id);

CREATE INDEX IF NOT EXISTS idx_orders_price_table_id
  ON orders (price_table_id);

CREATE INDEX IF NOT EXISTS idx_orders_vehicle_type_id
  ON orders (vehicle_type_id);

-- ─── partner_users ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'partner_users'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_partner_users_shipper_id
      ON partner_users (shipper_id);
  END IF;
END $$;

-- ─── quotes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quotes_payment_term_id
  ON quotes (payment_term_id);

CREATE INDEX IF NOT EXISTS idx_quotes_price_table_id
  ON quotes (price_table_id);

CREATE INDEX IF NOT EXISTS idx_quotes_shipper_id
  ON quotes (shipper_id);

CREATE INDEX IF NOT EXISTS idx_quotes_vehicle_type_id
  ON quotes (vehicle_type_id);

-- ─── risk_costs ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_risk_costs_evaluation_id
  ON risk_costs (evaluation_id);

CREATE INDEX IF NOT EXISTS idx_risk_costs_service_id
  ON risk_costs (service_id);

-- ─── risk_evaluations ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_risk_evaluations_policy_id
  ON risk_evaluations (policy_id);

-- ─── risk_evidence ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_risk_evidence_document_id
  ON risk_evidence (document_id);

-- ─── toll_routes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_toll_routes_vehicle_type_id
  ON toll_routes (vehicle_type_id);

-- ─── trips ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_type_id
  ON trips (vehicle_type_id);

-- ─── waiting_time_rules ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_waiting_time_rules_vehicle_type_id
  ON waiting_time_rules (vehicle_type_id);
