-- =====================================================
-- Popular tabela icms_rates com alíquotas CONFAZ 2026
--
-- Regras interestaduais (Resolução do Senado Federal nº 22/1989):
--   S/SE (exceto ES) → N/NE/CO/ES = 7%
--   Demais interestaduais = 12%
--
-- Alíquotas internas (mesma UF):
--   SP, RJ, MG = 18%
--   Demais = 17%
--
-- S/SE (exceto ES): SP, RJ, MG, PR, SC, RS, MS (nota: MS é CO mas segue regra S/SE em algumas tabelas)
-- Corrigido: S/SE = SP, RJ, MG, PR, SC, RS, ES. MS é CO.
-- Para frete: S/SE (exceto ES) = SP, RJ, MG, PR, SC, RS
-- =====================================================

-- Usar DO block para gerar todas as combinações
DO $$
DECLARE
  v_origin text;
  v_dest text;
  v_rate numeric;
  v_states text[] := ARRAY[
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
    'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
    'RO','RR','RS','SC','SE','SP','TO'
  ];
  -- S/SE (exceto ES): estados que aplicam 7% para N/NE/CO/ES
  v_sul_sudeste text[] := ARRAY['MG','PR','RJ','RS','SC','SP'];
  -- N/NE/CO/ES: estados que recebem 7% de S/SE
  v_norte_nordeste_co_es text[] := ARRAY[
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
    'MS','MT','PA','PB','PE','PI','RN','RO','RR','SE','TO'
  ];
  -- Estados com alíquota interna 18%
  v_interna_18 text[] := ARRAY['MG','RJ','SP'];
BEGIN
  FOREACH v_origin IN ARRAY v_states LOOP
    FOREACH v_dest IN ARRAY v_states LOOP
      IF v_origin = v_dest THEN
        -- Alíquota interna (mesma UF)
        IF v_origin = ANY(v_interna_18) THEN
          v_rate := 18;
        ELSE
          v_rate := 17;
        END IF;
      ELSIF v_origin = ANY(v_sul_sudeste) AND v_dest = ANY(v_norte_nordeste_co_es) THEN
        -- S/SE (exceto ES) → N/NE/CO/ES = 7%
        v_rate := 7;
      ELSE
        -- Demais interestaduais = 12%
        v_rate := 12;
      END IF;

      INSERT INTO public.icms_rates (origin_state, destination_state, rate_percent)
      VALUES (v_origin, v_dest, v_rate)
      ON CONFLICT (origin_state, destination_state)
      DO UPDATE SET
        rate_percent = EXCLUDED.rate_percent,
        updated_at = now()
      WHERE icms_rates.rate_percent NOT IN (7, 12, 17, 18)
         OR icms_rates.rate_percent IS NULL;
      -- Nota: só atualiza se o valor atual NÃO é uma alíquota padrão válida,
      -- preservando customizações manuais que já estejam corretas.
      -- Registros com valores como 0.12 ou 0.7 (escala errada) SERÃO atualizados.
    END LOOP;
  END LOOP;

  RAISE NOTICE 'ICMS rates populated: 27 states × 27 states = 729 combinations';
END $$;
