-- =====================================================
-- Migration: Tabela Fracionada (LTL) NTC Dez/25
-- Novas colunas de faixa de peso em price_table_rows
-- + Tabela ltl_parameters para mínimos NTC
-- =====================================================
SET ROLE postgres;

-- 1. Adicionar colunas de faixa de peso para Fracionado (LTL)
-- Lotação continua usando cost_per_ton / cost_per_kg
ALTER TABLE price_table_rows
  ADD COLUMN IF NOT EXISTS weight_rate_10        numeric,  -- R$/CTe: 1-10 kg
  ADD COLUMN IF NOT EXISTS weight_rate_20        numeric,  -- R$/CTe: 11-20 kg
  ADD COLUMN IF NOT EXISTS weight_rate_30        numeric,  -- R$/CTe: 21-30 kg
  ADD COLUMN IF NOT EXISTS weight_rate_50        numeric,  -- R$/CTe: 31-50 kg
  ADD COLUMN IF NOT EXISTS weight_rate_70        numeric,  -- R$/CTe: 51-70 kg
  ADD COLUMN IF NOT EXISTS weight_rate_100       numeric,  -- R$/CTe: 71-100 kg
  ADD COLUMN IF NOT EXISTS weight_rate_150       numeric,  -- R$/CTe: 101-150 kg
  ADD COLUMN IF NOT EXISTS weight_rate_200       numeric,  -- R$/CTe: 151-200 kg
  ADD COLUMN IF NOT EXISTS weight_rate_above_200 numeric;  -- R$/kg: acima de 200 kg

-- 2. Tabela de parâmetros LTL (mínimos NTC por referência mensal)
CREATE TABLE IF NOT EXISTS ltl_parameters (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month           text NOT NULL,                       -- 'DEZ/25'
  min_freight               numeric NOT NULL DEFAULT 9.28,       -- Frete Valor Mínimo por CTe
  min_freight_cargo_limit   numeric NOT NULL DEFAULT 3093.81,    -- Até valor mercadoria de R$
  min_tso                   numeric NOT NULL DEFAULT 4.64,       -- TSO mínimo por CTe
  gris_percent              numeric NOT NULL DEFAULT 0.30,       -- GRIS padrão (%)
  gris_high_risk_percent    numeric NOT NULL DEFAULT 0.50,       -- GRIS regiões alto risco (%)
  gris_min                  numeric NOT NULL DEFAULT 9.28,       -- GRIS mínimo por CTe
  gris_min_cargo_limit      numeric NOT NULL DEFAULT 3093.81,    -- Até valor mercadoria de R$
  dispatch_fee              numeric NOT NULL DEFAULT 102.90,     -- Taxa de Despacho por CTe
  cubage_factor             numeric NOT NULL DEFAULT 300,        -- kg/m³
  correction_factor         numeric NOT NULL DEFAULT 0.7202,     -- Fator INCTF/DECOPE NTC
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS para ltl_parameters
ALTER TABLE ltl_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ltl_parameters_select" ON ltl_parameters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ltl_parameters_insert" ON ltl_parameters
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ltl_parameters_update" ON ltl_parameters
  FOR UPDATE TO authenticated USING (true);

-- 4. GRANT
GRANT SELECT, INSERT, UPDATE ON ltl_parameters TO authenticated;

-- 5. Inserir dados NTC Dez/25
INSERT INTO ltl_parameters (reference_month)
VALUES ('DEZ/25')
ON CONFLICT DO NOTHING;

RESET ROLE;
