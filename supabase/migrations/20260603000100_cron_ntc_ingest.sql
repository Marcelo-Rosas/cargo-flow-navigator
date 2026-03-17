-- ═══════════════════════════════════════════════════════
-- Cron: NTC Ingest — Segunda-feira 08:10 BRT (11:10 UTC)
-- Busca JSON gerado pelo agente NTC cowork e persiste em market_indices
-- ═══════════════════════════════════════════════════════

SELECT cron.schedule(
  'ntc-ingest-weekly',
  '10 11 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/ntc-ingest',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  );
  $$
);
