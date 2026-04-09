-- MiroFish: period classification (historical vs forecast)
-- Separates closed 2025 CT-e data from 2026 projections/scenarios.

ALTER TABLE mirofish_reports
  ADD COLUMN period_type  TEXT CHECK (period_type IN ('historical', 'forecast')),
  ADD COLUMN period_start DATE,
  ADD COLUMN period_end   DATE;

-- SIM1 + SIM4 → historical: real CT-e data from 2025
UPDATE mirofish_reports
SET period_type = 'historical',
    period_start = '2025-01-01',
    period_end   = '2025-12-31'
WHERE simulation_id IN ('SIM1', 'SIM4');

-- SIM2 + SIM3 + SIM5 → forecast: NTC impact scenarios and route optimization for 2026
UPDATE mirofish_reports
SET period_type = 'forecast',
    period_start = '2026-01-01',
    period_end   = '2026-12-31'
WHERE simulation_id IN ('SIM2', 'SIM3', 'SIM5');

-- Index for fast period filtering
CREATE INDEX idx_mirofish_reports_period_type ON mirofish_reports(period_type);
