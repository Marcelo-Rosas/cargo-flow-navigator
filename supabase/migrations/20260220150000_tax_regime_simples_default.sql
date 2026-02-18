-- =====================================================
-- Garantir default Simples Nacional (regime global)
-- Fonte da regra: pricing_parameters (lido pela Edge Function e pelo frontend).
-- Default = 1 (Simples): ICMS 0%, DAS = provisão por frete.
-- =====================================================

UPDATE public.pricing_parameters
SET value = 1,
    description = 'Regime tributário: 1 = Simples Nacional (ICMS 0%, DAS como provisão por frete), 0 = Normal. Default 1.'
WHERE key = 'tax_regime_simples';
