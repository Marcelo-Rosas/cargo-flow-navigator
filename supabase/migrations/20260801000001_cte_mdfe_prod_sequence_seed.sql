-- Seed da numeração de PRODUÇÃO para o corte CFN+Focus, continuando de onde o
-- emissor Active (ACBr) parou: último CT-e nº 578, último MDF-e nº 289
-- (confirmado nos DAMDFE de 23/06/2026, ambiente prod SEFAZ).
--
-- Idempotente: só ELEVA, nunca reduz — re-deploys não resetam após o corte.
--
-- ATENÇÃO no corte: o Active pode ter avançado além de 578/289 até a data real
-- do corte. CONFIRMAR o último número emitido no Active no dia e, se maior,
-- atualizar estes valores ANTES do 1º emit prod (próximo número = último + 1).
-- A sequência prod só é consumida quando FOCUS_NFE_AMBIENTE=prod (hoje=homolog),
-- então este seed é inócuo enquanto não houver corte.

update cte_sequence
  set last_numero = 578
  where ambiente = 'prod' and serie = 1 and last_numero < 578;

update mdfe_sequence
  set last_numero = 289
  where ambiente = 'prod' and serie = 1 and last_numero < 289;
