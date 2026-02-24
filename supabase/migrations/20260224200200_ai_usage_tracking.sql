-- ============================================================
-- AI Usage Tracking + Budget Config
-- Controle de uso e limites da API Claude
-- ============================================================

-- 1. Tabela de rastreamento de uso da AI
CREATE TABLE IF NOT EXISTS ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type TEXT NOT NULL,                -- 'quote_profitability' | 'financial_anomaly' | 'approval_summary' | 'dashboard_insights'
  model_used TEXT NOT NULL,                   -- 'claude-haiku-4-5' | 'claude-sonnet-4'
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cache_read_tokens INT NOT NULL DEFAULT 0,
  cache_creation_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',     -- 'success' | 'rate_limited' | 'budget_exceeded' | 'cached' | 'error'
  entity_type TEXT,
  entity_id UUID,
  duration_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas de uso
CREATE INDEX idx_ai_usage_created_at ON ai_usage_tracking (created_at DESC);
CREATE INDEX idx_ai_usage_analysis_type ON ai_usage_tracking (analysis_type);
CREATE INDEX idx_ai_usage_status ON ai_usage_tracking (status);
CREATE INDEX idx_ai_usage_model ON ai_usage_tracking (model_used);

-- 2. Tabela de configuração de budget
CREATE TABLE IF NOT EXISTS ai_budget_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,                   -- 'daily_limit_usd' | 'monthly_limit_usd' | 'alert_threshold_pct' | 'min_value_for_ai_brl'
  value NUMERIC NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Seed data: configurações padrão de budget
INSERT INTO ai_budget_config (key, value, description) VALUES
  ('daily_limit_usd',      2.00,   'Limite diário de gasto com API Claude (USD)'),
  ('monthly_limit_usd',   30.00,   'Limite mensal de gasto com API Claude (USD)'),
  ('alert_threshold_pct',  0.80,   'Percentual do budget para disparar alerta (0.8 = 80%)'),
  ('min_quote_value_brl', 5000.00, 'Valor mínimo de cotação para acionar análise AI (BRL)'),
  ('min_financial_value_brl', 10000.00, 'Valor mínimo de doc financeiro para análise AI (BRL)')
ON CONFLICT (key) DO NOTHING;

-- 4. RLS Policies
ALTER TABLE ai_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_budget_config ENABLE ROW LEVEL SECURITY;

-- ai_usage_tracking: qualquer autenticado pode ler
CREATE POLICY "ai_usage_tracking_select_authenticated"
  ON ai_usage_tracking FOR SELECT
  TO authenticated
  USING (true);

-- ai_usage_tracking: service role pode inserir (Edge Functions)
CREATE POLICY "ai_usage_tracking_insert_service"
  ON ai_usage_tracking FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ai_budget_config: qualquer autenticado pode ler
CREATE POLICY "ai_budget_config_select_authenticated"
  ON ai_budget_config FOR SELECT
  TO authenticated
  USING (true);

-- ai_budget_config: service role pode tudo
CREATE POLICY "ai_budget_config_all_service"
  ON ai_budget_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ai_budget_config: autenticados podem atualizar (admin check no frontend)
CREATE POLICY "ai_budget_config_update_authenticated"
  ON ai_budget_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Funções auxiliares para consultas rápidas de budget

-- Gasto do dia atual (UTC)
CREATE OR REPLACE FUNCTION get_ai_daily_spend()
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(estimated_cost_usd), 0)
  FROM ai_usage_tracking
  WHERE created_at >= date_trunc('day', now())
    AND status IN ('success', 'cached');
$$ LANGUAGE sql STABLE;

-- Gasto do mês atual
CREATE OR REPLACE FUNCTION get_ai_monthly_spend()
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(estimated_cost_usd), 0)
  FROM ai_usage_tracking
  WHERE created_at >= date_trunc('month', now())
    AND status IN ('success', 'cached');
$$ LANGUAGE sql STABLE;

-- Estatísticas completas de uso
CREATE OR REPLACE FUNCTION get_ai_usage_stats()
RETURNS JSON AS $$
  SELECT json_build_object(
    'daily_spend', (SELECT get_ai_daily_spend()),
    'monthly_spend', (SELECT get_ai_monthly_spend()),
    'daily_limit', (SELECT value FROM ai_budget_config WHERE key = 'daily_limit_usd'),
    'monthly_limit', (SELECT value FROM ai_budget_config WHERE key = 'monthly_limit_usd'),
    'alert_threshold', (SELECT value FROM ai_budget_config WHERE key = 'alert_threshold_pct'),
    'today_calls', (
      SELECT COUNT(*)
      FROM ai_usage_tracking
      WHERE created_at >= date_trunc('day', now())
    ),
    'month_calls', (
      SELECT COUNT(*)
      FROM ai_usage_tracking
      WHERE created_at >= date_trunc('month', now())
    ),
    'today_by_model', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT model_used, COUNT(*) as calls,
               SUM(input_tokens) as total_input_tokens,
               SUM(output_tokens) as total_output_tokens,
               SUM(cache_read_tokens) as total_cache_read_tokens,
               SUM(estimated_cost_usd) as total_cost
        FROM ai_usage_tracking
        WHERE created_at >= date_trunc('day', now())
        GROUP BY model_used
      ) t
    ),
    'month_by_type', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT analysis_type, COUNT(*) as calls,
               SUM(estimated_cost_usd) as total_cost
        FROM ai_usage_tracking
        WHERE created_at >= date_trunc('month', now())
        GROUP BY analysis_type
      ) t
    ),
    'recent_errors', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT analysis_type, status, error_message, created_at
        FROM ai_usage_tracking
        WHERE status IN ('rate_limited', 'budget_exceeded', 'error')
          AND created_at >= now() - interval '7 days'
        ORDER BY created_at DESC
        LIMIT 10
      ) t
    )
  );
$$ LANGUAGE sql STABLE;

-- Budget check: retorna se pode gastar e quanto resta
CREATE OR REPLACE FUNCTION check_ai_budget()
RETURNS JSON AS $$
DECLARE
  daily_spend NUMERIC;
  monthly_spend NUMERIC;
  daily_limit NUMERIC;
  monthly_limit NUMERIC;
  alert_pct NUMERIC;
BEGIN
  daily_spend := get_ai_daily_spend();
  monthly_spend := get_ai_monthly_spend();

  SELECT value INTO daily_limit FROM ai_budget_config WHERE key = 'daily_limit_usd';
  SELECT value INTO monthly_limit FROM ai_budget_config WHERE key = 'monthly_limit_usd';
  SELECT value INTO alert_pct FROM ai_budget_config WHERE key = 'alert_threshold_pct';

  -- Defaults se não configurado
  daily_limit := COALESCE(daily_limit, 2.00);
  monthly_limit := COALESCE(monthly_limit, 30.00);
  alert_pct := COALESCE(alert_pct, 0.80);

  RETURN json_build_object(
    'allowed', (daily_spend < daily_limit AND monthly_spend < monthly_limit),
    'daily_remaining', GREATEST(daily_limit - daily_spend, 0),
    'monthly_remaining', GREATEST(monthly_limit - monthly_spend, 0),
    'daily_pct', CASE WHEN daily_limit > 0 THEN daily_spend / daily_limit ELSE 0 END,
    'monthly_pct', CASE WHEN monthly_limit > 0 THEN monthly_spend / monthly_limit ELSE 0 END,
    'alert', (daily_spend / daily_limit >= alert_pct OR monthly_spend / monthly_limit >= alert_pct)
  );
END;
$$ LANGUAGE plpgsql STABLE;
