-- ═══════════════════════════════════════════════════════
-- Cron Jobs for Operational Multi-Agent System
-- Requires pg_cron and pg_net extensions (enabled via Supabase Dashboard)
-- ═══════════════════════════════════════════════════════

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ───────────────────────────────────────────────────────
-- Daily Operational Report — 07:00 BRT (10:00 UTC)
-- ───────────────────────────────────────────────────────
SELECT cron.schedule(
  'daily-operational-report',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/ai-operational-agent',
    body := '{"analysisType":"operational_report","reportType":"daily"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  );
  $$
);

-- ───────────────────────────────────────────────────────
-- Weekly Regulatory Scan — Monday 08:00 BRT (11:00 UTC)
-- ───────────────────────────────────────────────────────
SELECT cron.schedule(
  'weekly-regulatory-scan',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/ai-operational-agent',
    body := '{"analysisType":"regulatory_update"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  );
  $$
);

-- ───────────────────────────────────────────────────────
-- Workflow Event Processor — every 2 minutes
-- Processes pending workflow events
-- ───────────────────────────────────────────────────────
SELECT cron.schedule(
  'process-workflow-events',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/workflow-orchestrator',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  );
  $$
);

-- ───────────────────────────────────────────────────────
-- Notification Batch Processor — every 5 minutes
-- Processes pending notifications (email + whatsapp)
-- ───────────────────────────────────────────────────────
SELECT cron.schedule(
  'process-pending-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/notification-hub',
    body := '{"batch":true}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  );
  $$
);
