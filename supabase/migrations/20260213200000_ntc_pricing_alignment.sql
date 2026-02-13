-- =====================================================
-- MIGRATION: Alinhar dados de pricing com Planilha NTC
-- Data: 2026-02-13
-- Escopo: Fase 1 - Custos NTC
-- =====================================================

-- =====================================================
-- 1. ATUALIZAR CONDITIONAL FEES COM VALORES NTC
-- =====================================================

-- TDE: Taxa de Dificuldade de Entrega → 20% sobre frete (NTC 2.4)
UPDATE public.conditional_fees
SET fee_value = 20,
    fee_type = 'percentage',
    applies_to = 'freight',
    description = 'NTC 2.4 - Ressarcir custos adicionais por entregas dificultadas. Não exclui cobrança de estadia.'
WHERE code = 'TDE';

-- TEAR: Taxa de Entregas em Áreas Rurais → 20% sobre frete (NTC 2.5)
UPDATE public.conditional_fees
SET fee_value = 20,
    fee_type = 'percentage',
    applies_to = 'freight',
    description = 'NTC 2.5 - Acréscimo por condições precárias de estradas, maior consumo de insumos e menor velocidade média.'
WHERE code = 'TEAR';

-- SCHEDULING: Taxa de Agendamento → 20% sobre frete (NTC 3.1)
UPDATE public.conditional_fees
SET fee_value = 20,
    fee_type = 'percentage',
    applies_to = 'freight',
    description = 'NTC 3.1 - Custos adicionais de agendamento prévio, controles paralelos, horários diferenciados.'
WHERE code = 'SCHEDULING';

-- OFF_HOURS: Fora de Horário Normal → 30% sobre frete (NTC 3.2)
UPDATE public.conditional_fees
SET fee_value = 30,
    fee_type = 'percentage',
    applies_to = 'freight',
    description = 'NTC 3.2 - Operações fora do horário comercial (sábados, domingos, feriados, noite).'
WHERE code = 'OFF_HOURS';

-- RETURN: Devolução de Mercadorias → 100% sobre frete (NTC 2.2)
UPDATE public.conditional_fees
SET fee_value = 100,
    fee_type = 'percentage',
    applies_to = 'freight',
    description = 'NTC 2.2 - Devolução: mesmo valor do frete original, acrescido do ICMS gerado.'
WHERE code = 'RETURN';

-- REDELIVERY: manter como está (30% sobre frete) - não é item NTC direto
UPDATE public.conditional_fees
SET description = 'Reentrega/segunda tentativa de entrega.'
WHERE code = 'REDELIVERY';

-- =====================================================
-- 2. ADICIONAR TPD (Taxa para Pagamento de Descargas)
-- =====================================================

INSERT INTO public.conditional_fees (code, name, fee_type, fee_value, applies_to, active, description)
VALUES (
  'TPD',
  'Taxa para Pagamento de Descargas',
  'fixed',
  0,
  'freight',
  true,
  'NTC 2.7 - Ressarcir custos de descarga por terceiros. Valor por documento fiscal/recibo, acrescido de impostos e despesas administrativas.'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- 3. ADICIONAR FATOR DE CORREÇÃO INCTF
-- =====================================================

INSERT INTO public.pricing_parameters (key, value, unit, description)
VALUES (
  'correction_factor_inctf',
  0.7202,
  'fator',
  'Fator de Correção INCTF/DECOPE/NTC - Dezembro/2025. Utilizado para ajustar valores conforme metodologia NTC.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  unit = EXCLUDED.unit,
  description = EXCLUDED.description;

-- =====================================================
-- 4. ATUALIZAR WAITING TIME RULES COM VALORES NTC
-- Franquia NTC: 5 horas (seção 2.3)
-- Valores por tipo de veículo (tabela NTC)
-- =====================================================

-- Primeiro, atualizar a regra default existente (free_hours 6 → 5)
UPDATE public.waiting_time_rules
SET free_hours = 5
WHERE vehicle_type_id IS NULL;

-- Inserir regras NTC por tipo de veículo
-- Caminhão Truck: Diária R$ 1.317,95 / Hora R$ 146,44
INSERT INTO public.waiting_time_rules (vehicle_type_id, context, free_hours, rate_per_hour, rate_per_day, min_charge)
SELECT vt.id, 'both', 5, 146.44, 1317.95, 146.44
FROM public.vehicle_types vt
WHERE vt.code = 'TRUCK'
ON CONFLICT DO NOTHING;

-- Semirreboque 3 eixos (CARRETA_3): Diária R$ 775,75 / Hora R$ 96,97
INSERT INTO public.waiting_time_rules (vehicle_type_id, context, free_hours, rate_per_hour, rate_per_day, min_charge)
SELECT vt.id, 'both', 5, 96.97, 775.75, 96.97
FROM public.vehicle_types vt
WHERE vt.code = 'CARRETA_3'
ON CONFLICT DO NOTHING;

-- Conjunto CM+SR (RODOTREM): Diária R$ 2.216,43 / Hora R$ 234,79
INSERT INTO public.waiting_time_rules (vehicle_type_id, context, free_hours, rate_per_hour, rate_per_day, min_charge)
SELECT vt.id, 'both', 5, 234.79, 2216.43, 234.79
FROM public.vehicle_types vt
WHERE vt.code = 'RODOTREM'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. GARANTIR PARÂMETRO min_freight EXISTE
-- =====================================================

INSERT INTO public.pricing_parameters (key, value, unit, description)
VALUES (
  'min_freight',
  150,
  'BRL',
  'Frete mínimo obrigatório por operação.'
)
ON CONFLICT (key) DO NOTHING;
