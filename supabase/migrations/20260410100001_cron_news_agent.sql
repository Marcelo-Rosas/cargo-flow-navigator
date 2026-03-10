-- ═══════════════════════════════════════════════════════
-- Cron: News Agent — 08:00 e 18:00 BRT (11:00 e 21:00 UTC)
-- Busca notícias em 3 portais, resume via LLM, persiste em news_items
-- ═══════════════════════════════════════════════════════

SELECT cron.schedule(
  'news-agent-scan',
  '0 11,21 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/news-agent',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  );
  $$
);
